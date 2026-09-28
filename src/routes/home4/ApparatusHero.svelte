<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { base } from '$app/paths';
	import {
		ApparatusRenderer,
		type ApparatusFocus,
		type ApparatusFrame,
		type Projected
	} from './apparatus-renderer';
	import { LAYERS, buildApparatusScene, type ApparatusNote } from './apparatus-scene';

	interface Props {
		/** Eyebrow and headline; first in reading order at every width. */
		title: Snippet;
		/** Lede, calls to action and figures. */
		body: Snippet;
	}

	type Status = 'pending' | 'live' | 'fallback';

	let { title, body }: Props = $props();

	const MAX_PIXEL_RATIO = 1.75;
	/** Caps the drawing buffer on very large screens; the points stay sharp well below this. */
	const MAX_CANVAS_PIXELS = 4_200_000;
	/** Share of the art region's shorter side the vessel, its frame and capture rig fill. */
	const FORM_FILL = 0.5;
	/** Lens radius as a share of the art region's shorter side. */
	const LENS_FILL = 0.2;
	const REVEAL_SECONDS = 2.4;
	const TOUR_SECONDS = 5.5;
	const DRIFT_PER_SECOND = 0.09;
	const REST_YAW = 0.35;
	const REST_PITCH = 0.24;
	const KEY_TURNS: Record<string, [number, number]> = {
		ArrowLeft: [-0.3, 0],
		ArrowRight: [0.3, 0],
		ArrowUp: [0, -0.12],
		ArrowDown: [0, 0.12]
	};
	/** The guided tour adds one layer at a time to the evidence, then shows them all together. */
	const TOUR = [1, 2, 3, 4, -1];

	let root = $state<HTMLDivElement>();
	let art = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let lensRing = $state<HTMLDivElement>();
	let labelNodes = $state<HTMLLIElement[]>([]);
	let status = $state<Status>('pending');
	let layers = $state([true, true, false, false, false]);
	let focusLayer = $state(1);
	let touring = $state(true);
	let paused = $state(false);
	let reducedMotion = $state(false);
	let evidenceCount = $state(0);
	let notes = $state<ApparatusNote[]>([]);
	let announcement = $state('');

	const pad = (value: number) => String(value).padStart(2, '0');
	const focused = $derived(LAYERS[focusLayer]);

	// Frame state changes every frame, so it stays outside Svelte's reactivity.
	let renderer: ApparatusRenderer | null = null;
	const frame: ApparatusFrame = {
		yaw: REST_YAW,
		pitch: REST_PITCH,
		layers: new Float32Array([1, 1, 0, 0, 0]),
		lensX: 0,
		lensY: 0,
		lensRadius: 0.2,
		lens: 0,
		reveal: 0,
		scan: -9,
		time: 0,
		pulse: 0
	};
	const projected: Projected = { x: 0, y: 0, front: 0 };
	let yawTarget = REST_YAW;
	let pitchTarget = REST_PITCH;
	let lensTarget = 0;
	let lensPixels = 80;
	let lensLeft = 0;
	let lensTop = 0;
	let tourIndex = 0;
	let held = 0;
	let raf = 0;
	let last = 0;
	let inView = false;
	let pageVisible = true;
	let dragId = -1;
	let dragX = 0;
	let dragY = 0;
	let dragMoved = false;
	let focusPoint = { x: 0, y: 0 };

	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

	function settled() {
		if (frame.reveal < 1 || Math.abs(lensTarget - frame.lens) > 0.002) return false;
		if (Math.abs(yawTarget - frame.yaw) > 0.0005 || Math.abs(pitchTarget - frame.pitch) > 0.0005) {
			return false;
		}
		return layers.every((on, i) => Math.abs((on ? 1 : 0) - frame.layers[i]) < 0.002);
	}

	function placeOverlays() {
		if (!renderer) return;
		const shown = frame.layers[1] * clamp(frame.reveal * 2 - 1, 0, 1);
		for (let i = 0; i < notes.length; i++) {
			const node = labelNodes[i];
			if (!node) continue;
			if (shown < 0.01) {
				node.style.opacity = '0';
				continue;
			}
			renderer.project(notes[i].position, frame.yaw, frame.pitch, projected);
			node.style.transform = `translate3d(${projected.x}px, ${projected.y}px, 0)`;
			node.style.opacity = String(shown * (0.15 + 0.85 * projected.front));
		}
		if (lensRing) {
			const size = lensPixels * 2;
			lensRing.style.width = `${size}px`;
			lensRing.style.height = `${size}px`;
			lensRing.style.transform = `translate3d(${lensLeft - lensPixels}px, ${lensTop - lensPixels}px, 0)`;
			lensRing.style.opacity = String(frame.lens);
		}
	}

	function advanceTour() {
		held = 0;
		tourIndex = (tourIndex + 1) % TOUR.length;
		const extra = TOUR[tourIndex];
		layers = LAYERS.map((_, i) => i === 0 || extra < 0 || i === extra);
		focusLayer = extra < 0 ? 0 : extra;
	}

	function step(now: number) {
		raf = 0;
		if (!renderer) return;
		const dt = Math.min((now - last) / 1000, 0.05);
		last = now;
		const moving = !paused && !reducedMotion;
		if (moving) frame.time += dt;

		if (reducedMotion) {
			frame.reveal = 1;
			frame.yaw = yawTarget;
			frame.pitch = pitchTarget;
			frame.lens = lensTarget;
			for (let i = 0; i < LAYERS.length; i++) frame.layers[i] = layers[i] ? 1 : 0;
		} else {
			frame.reveal = Math.min(1, frame.reveal + dt / REVEAL_SECONDS);
			if (moving && dragId < 0) yawTarget += dt * DRIFT_PER_SECOND;
			if (moving && touring && frame.reveal >= 1) {
				held += dt;
				if (held > TOUR_SECONDS) advanceTour();
			}
			const ease = 1 - Math.exp(-dt * 6);
			frame.yaw += (yawTarget - frame.yaw) * ease;
			frame.pitch += (pitchTarget - frame.pitch) * ease;
			frame.lens += (lensTarget - frame.lens) * (1 - Math.exp(-dt * 10));
			const fade = 1 - Math.exp(-dt * 5);
			for (let i = 0; i < LAYERS.length; i++) {
				frame.layers[i] += ((layers[i] ? 1 : 0) - frame.layers[i]) * fade;
			}
		}
		frame.pulse = moving ? 1 : 0;
		frame.scan = moving && frame.reveal >= 1 ? ((frame.time * 0.16) % 1) * 2.8 - 1.4 : -9;

		renderer.render(frame);
		placeOverlays();
		if (!raf && (moving || !settled())) raf = requestAnimationFrame(step);
	}

	/** Draws at least one more frame; the loop then keeps itself alive only while something moves. */
	function schedule() {
		if (raf || !renderer || !inView || !pageVisible) return;
		last = performance.now();
		raf = requestAnimationFrame(step);
	}

	function halt() {
		cancelAnimationFrame(raf);
		raf = 0;
	}

	function toggleLayer(index: number) {
		touring = false;
		layers[index] = !layers[index];
		focusLayer = index;
		announcement = `${LAYERS[index].label} layer ${layers[index] ? 'shown' : 'hidden'}.`;
		schedule();
	}

	/** Shows the evidence with one other layer and brings the model into view, for links further down. */
	export function isolate(index: number) {
		touring = false;
		layers = LAYERS.map((_, i) => i === 0 || i === index);
		focusLayer = index;
		announcement = `Showing the ${LAYERS[index].label.toLowerCase()} layer in the model.`;
		art?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
		art?.focus({ preventScroll: true });
		schedule();
	}

	/** Text, links and controls keep their own pointer behaviour; open space belongs to the model. */
	function onInterface(target: EventTarget | null) {
		return target instanceof Element && !!target.closest('a, button, [data-hero-ui]');
	}

	function aimLens(clientX: number, clientY: number) {
		if (!root) return;
		const rect = root.getBoundingClientRect();
		lensLeft = clientX - rect.left;
		lensTop = clientY - rect.top;
		frame.lensX = (lensLeft / rect.width) * 2 - 1;
		frame.lensY = 1 - (lensTop / rect.height) * 2;
		lensTarget = 1;
	}

	function toggleKeyboardLens() {
		if (!root) return;
		if (lensTarget > 0) {
			lensTarget = 0;
			return;
		}
		const rect = root.getBoundingClientRect();
		aimLens(rect.left + focusPoint.x, rect.top + focusPoint.y);
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0 || status !== 'live' || onInterface(event.target)) return;
		dragId = event.pointerId;
		dragX = event.clientX;
		dragY = event.clientY;
		dragMoved = false;
		root?.setPointerCapture(event.pointerId);
		schedule();
	}

	function onpointermove(event: PointerEvent) {
		if (status !== 'live') return;
		if (dragId === event.pointerId) {
			const dx = event.clientX - dragX;
			const dy = event.clientY - dragY;
			if (!dragMoved && Math.abs(dx) + Math.abs(dy) < 6) return;
			dragMoved = true;
			yawTarget += dx * 0.008;
			pitchTarget = clamp(pitchTarget + dy * 0.005, -0.35, 0.8);
			dragX = event.clientX;
			dragY = event.clientY;
		}
		if (event.pointerType === 'mouse' && !onInterface(event.target)) {
			aimLens(event.clientX, event.clientY);
		} else if (event.pointerType === 'mouse') {
			lensTarget = 0;
		}
		schedule();
	}

	function onpointerup(event: PointerEvent) {
		if (dragId !== event.pointerId) return;
		dragId = -1;
		// A tap places the lens on touch screens, where there is no hover.
		if (!dragMoved && event.pointerType !== 'mouse') aimLens(event.clientX, event.clientY);
		schedule();
	}

	function onpointercancel(event: PointerEvent) {
		if (dragId === event.pointerId) dragId = -1;
	}

	function onpointerleave(event: PointerEvent) {
		if (event.pointerType !== 'mouse') return;
		lensTarget = 0;
		schedule();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.target !== event.currentTarget) return;
		const turn = KEY_TURNS[event.key];
		const digit = Number(event.key);
		if (turn) {
			yawTarget += turn[0];
			pitchTarget = clamp(pitchTarget + turn[1], -0.35, 0.8);
		} else if (event.key === 'Home') {
			yawTarget = REST_YAW;
			pitchTarget = REST_PITCH;
		} else if (Number.isInteger(digit) && digit >= 1 && digit <= LAYERS.length) {
			toggleLayer(digit - 1);
		} else if (event.key === 'l' || event.key === 'L') {
			toggleKeyboardLens();
		} else {
			return;
		}
		event.preventDefault();
		schedule();
	}

	function togglePause() {
		paused = !paused;
		if (paused) touring = false;
		schedule();
	}

	onMount(() => {
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = motionQuery.matches;
		if (reducedMotion) {
			touring = false;
			frame.reveal = 1;
		}
		const compact =
			window.matchMedia('(max-width: 640px), (pointer: coarse)').matches ||
			(navigator.hardwareConcurrency ?? 8) <= 4;
		evidenceCount = compact ? 7000 : 14000;

		const scene = buildApparatusScene(evidenceCount);
		notes = scene.notes;
		renderer = canvas ? ApparatusRenderer.create(canvas, scene, compact ? 2.4 : 2) : null;
		if (!renderer || !canvas || !root || !art) {
			renderer?.dispose();
			renderer = null;
			status = 'fallback';
			return;
		}
		status = 'live';

		const listeners = new AbortController();
		const { signal } = listeners;
		motionQuery.addEventListener(
			'change',
			(event) => {
				reducedMotion = event.matches;
				if (reducedMotion) touring = false;
				schedule();
			},
			{ signal }
		);
		document.addEventListener(
			'visibilitychange',
			() => {
				pageVisible = document.visibilityState === 'visible';
				if (pageVisible) schedule();
				else halt();
			},
			{ signal }
		);
		canvas.addEventListener(
			'webglcontextlost',
			(event) => {
				event.preventDefault();
				halt();
				renderer = null;
				status = 'fallback';
			},
			{ signal }
		);

		const host = root;
		const anchor = art;
		const fit = () => {
			const box = host.getBoundingClientRect();
			const region = anchor.getBoundingClientRect();
			const shorter = Math.min(region.width, region.height);
			focusPoint = {
				x: region.left - box.left + region.width / 2,
				y: region.top - box.top + region.height / 2
			};
			const focus: ApparatusFocus = { ...focusPoint, radius: shorter * FORM_FILL };
			const pixelRatio = Math.min(
				window.devicePixelRatio || 1,
				MAX_PIXEL_RATIO,
				Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, box.width * box.height))
			);
			lensPixels = shorter * LENS_FILL;
			frame.lensRadius = lensPixels / Math.max(1, box.height / 2);
			renderer?.resize(box.width, box.height, pixelRatio, focus);
			schedule();
		};
		fit();
		const resize = new ResizeObserver(fit);
		resize.observe(host);
		resize.observe(anchor);

		const visibility = new IntersectionObserver(([entry]) => {
			inView = entry.isIntersecting;
			if (inView) schedule();
			else halt();
		});
		visibility.observe(host);

		return () => {
			listeners.abort();
			resize.disconnect();
			visibility.disconnect();
			halt();
			renderer?.dispose();
			renderer = null;
		};
	});
</script>

<!-- The whole hero is the model's canvas: open space takes drag, hover and tap; text keeps its own. -->
<div
	id="apparatus-hero"
	bind:this={root}
	class:is-live={status === 'live'}
	class:is-fallback={status === 'fallback'}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	{onpointercancel}
	{onpointerleave}
>
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
	<div class="veil" aria-hidden="true"></div>

	{#if status === 'live'}
		<div bind:this={lensRing} class="lens" aria-hidden="true">
			<span>Interpretation lens</span>
		</div>
		<ol class="labels" aria-hidden="true">
			{#each notes as note, index (note.id)}
				<li bind:this={labelNodes[index]}>
					<span class="leader"></span>
					<span class="tag"><b>{pad(index + 1)}</b> {note.label}</span>
				</li>
			{/each}
		</ol>
	{/if}

	<div class="stage">
		<div class="title" data-hero-ui>
			{@render title()}
		</div>

		<!-- The art region hosts no element of its own; the keys are the keyboard equivalent of dragging. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			bind:this={art}
			class="art"
			role="group"
			aria-label="Conceptual 3D diagram: a broken amphora and the layers an edition adds to it"
			aria-describedby="apparatus-hero-hint apparatus-hero-notes"
			tabindex={status === 'live' ? 0 : -1}
			{onkeydown}
		>
			<span class="crop crop-tl" aria-hidden="true"></span>
			<span class="crop crop-tr" aria-hidden="true"></span>
			<span class="crop crop-bl" aria-hidden="true"></span>
			<span class="crop crop-br" aria-hidden="true"></span>
			<div class="plate-bar" aria-hidden="true">
				<span>Fig. 1 · The apparatus</span>
				<span>
					{evidenceCount ? `${evidenceCount.toLocaleString('en')} points · ` : ''}Procedural
				</span>
			</div>

			{#if status === 'fallback'}
				<div class="fallback">
					<img src={`${base}/images/landing/annotate.webp`} alt="" />
					<p>This browser cannot draw the interactive diagram, so a still illustration is shown.</p>
				</div>
			{/if}
		</div>

		<div class="legend" data-hero-ui>
			<p class="legend-head" id="apparatus-hero-legend">Layers of an edition</p>
			{#if status === 'live'}
				<div class="layer-list" role="group" aria-labelledby="apparatus-hero-legend">
					{#each LAYERS as layer, index (layer.id)}
						<button
							type="button"
							class={`layer layer-${layer.id}`}
							aria-pressed={layers[index]}
							onclick={() => toggleLayer(index)}
						>
							<span class="swatch" aria-hidden="true"></span>
							<span class="index" aria-hidden="true">{pad(index + 1)}</span>
							<span class="name">{layer.label}</span>
						</button>
					{/each}
				</div>
			{:else}
				<ol class="layer-list">
					{#each LAYERS as layer, index (layer.id)}
						<li class={`layer layer-${layer.id}`}>
							<span class="swatch" aria-hidden="true"></span>
							<span class="index" aria-hidden="true">{pad(index + 1)}</span>
							<span class="name">{layer.label}</span>
						</li>
					{/each}
				</ol>
			{/if}
		</div>

		<div class="body" data-hero-ui>
			{@render body()}
		</div>
	</div>

	<div class="rail" data-hero-ui>
		<div class="caption">
			<span class="kicker">Conceptual diagram · not a scan, not a published edition</span>
			<p class="caption-title">
				<span class="caption-index">{pad(focusLayer + 1)}</span>
				{focused.label}
			</p>
			<p class="note">{focused.note}</p>
		</div>
		<div class="tools">
			{#if status === 'live' && !reducedMotion}
				<button type="button" class="pause" aria-pressed={paused} onclick={togglePause}>
					Pause motion
				</button>
			{/if}
			<p id="apparatus-hero-hint" class="hint">
				{#if status === 'live'}
					Point at the vessel, or tap it, to look through the interpretation lens. Drag or use the
					arrow keys to turn it; keys 1–5 switch layers, L toggles the lens and Home resets.
				{:else}
					A procedural vessel standing for the objects Pure3D editions document, with the layers an
					edition adds: evidence, annotation, interpretation, paradata and a frame of reference.
				{/if}
			</p>
			<p id="apparatus-hero-notes" class="sr-only">
				Example annotations on the conceptual vessel:
				{#each notes as note (note.id)}{note.label}: {note.note}
				{/each}
			</p>
			<p class="sr-only" role="status" aria-live="polite">{announcement}</p>
		</div>
	</div>
</div>

<style>
	#apparatus-hero {
		--hero-ink: 18, 20, 18;
		--hero-paper: 244, 241, 235;
		--sage: #99c7a8;
		position: relative;
		isolation: isolate;
		overflow: hidden;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		min-height: clamp(660px, calc(100vh - 77px), 1060px);
		min-height: clamp(660px, calc(100svh - 77px), 1060px);
		background:
			radial-gradient(ellipse 52% 70% at 66% 44%, #26372d 0%, #18201b 52%, #121412 100%),
			var(--color-ink);
		color: var(--color-paper);
		touch-action: pan-y;
		cursor: crosshair;
	}
	#apparatus-hero:active {
		cursor: grabbing;
	}
	/* A survey grid behind the vessel, fading out towards the copy. */
	#apparatus-hero::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background-image:
			linear-gradient(rgba(var(--hero-paper), 0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(var(--hero-paper), 0.04) 1px, transparent 1px);
		background-size: 64px 64px;
		mask-image: radial-gradient(ellipse 60% 76% at 66% 46%, black 12%, transparent 72%);
	}

	canvas {
		position: absolute;
		inset: 0;
		z-index: 0;
		display: block;
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 1.2s ease;
	}
	.is-live canvas {
		opacity: 1;
	}

	.veil {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background:
			linear-gradient(
				90deg,
				rgba(var(--hero-ink), 0.95) 0%,
				rgba(var(--hero-ink), 0.84) calc(50% - 200px),
				rgba(var(--hero-ink), 0.3) calc(50% - 40px),
				rgba(var(--hero-ink), 0) calc(50% + 80px)
			),
			linear-gradient(0deg, rgba(var(--hero-ink), 0.94) 0%, rgba(var(--hero-ink), 0) 22%);
	}

	.lens {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 2;
		border: 1px dashed var(--sage);
		border-radius: 50%;
		opacity: 0;
		pointer-events: none;
		box-shadow: 0 0 0 1px rgba(var(--hero-ink), 0.4);
	}
	.lens span {
		position: absolute;
		bottom: -26px;
		left: 50%;
		translate: -50% 0;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--sage);
	}

	.labels {
		position: absolute;
		inset: 0;
		z-index: 2;
		margin: 0;
		padding: 0;
		list-style: none;
		pointer-events: none;
	}
	.labels li {
		position: absolute;
		top: 0;
		left: 0;
		opacity: 0;
		will-change: transform, opacity;
	}
	.leader {
		position: absolute;
		top: 0;
		left: 0;
		width: 34px;
		height: 1px;
		background: rgba(244, 181, 160, 0.85);
		transform-origin: 0 0;
		rotate: -40deg;
	}
	.tag {
		position: absolute;
		top: -34px;
		left: 26px;
		padding: 3px 8px;
		border-radius: 4px;
		background: rgba(var(--hero-ink), 0.78);
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--color-paper);
	}
	.tag b {
		font-weight: 500;
		color: #f4b5a0;
	}

	.stage,
	.rail {
		position: relative;
		z-index: 3;
		width: 100%;
		max-width: 1320px;
		margin: 0 auto;
		padding-inline: clamp(20px, 4vw, 48px);
	}
	.stage {
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1fr) auto;
		grid-template-rows: auto minmax(0, 1fr);
		column-gap: clamp(24px, 3.5vw, 48px);
		row-gap: 28px;
		padding-block: clamp(48px, 6vw, 88px) 24px;
		pointer-events: none;
	}
	.title,
	.body,
	.legend,
	.art {
		pointer-events: auto;
	}
	.title {
		grid-column: 1;
		grid-row: 1;
		align-self: end;
		display: grid;
		gap: 28px;
		min-width: 0;
		cursor: auto;
	}
	.body {
		grid-column: 1;
		grid-row: 2;
		display: grid;
		align-content: start;
		gap: 30px;
		min-width: 0;
		cursor: auto;
	}

	.art {
		position: relative;
		grid-column: 2;
		grid-row: 1 / span 2;
		min-height: clamp(420px, 62vh, 720px);
		min-height: clamp(420px, 62svh, 720px);
		border-radius: var(--radius-surface);
		cursor: inherit;
	}
	.art:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 4px;
	}
	.crop {
		position: absolute;
		width: 20px;
		height: 20px;
		border: 0 solid var(--color-vermillion);
		pointer-events: none;
	}
	.crop-tl {
		top: 0;
		left: 0;
		border-top-width: 2px;
		border-left-width: 2px;
	}
	.crop-tr {
		top: 0;
		right: 0;
		border-top-width: 2px;
		border-right-width: 2px;
	}
	.crop-bl {
		bottom: 0;
		left: 0;
		border-bottom-width: 2px;
		border-left-width: 2px;
	}
	.crop-br {
		right: 0;
		bottom: 0;
		border-right-width: 2px;
		border-bottom-width: 2px;
	}
	.plate-bar {
		position: absolute;
		top: 4px;
		right: 32px;
		left: 32px;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(var(--hero-paper), 0.7);
		pointer-events: none;
	}
	.fallback {
		position: absolute;
		inset: 36px 0 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 16px;
		padding: 32px;
		border-radius: var(--radius-surface);
		background: var(--color-paper);
		text-align: center;
		cursor: auto;
	}
	.fallback img {
		width: min(100%, 420px);
		opacity: 0.9;
	}
	.fallback p {
		margin: 0;
		max-width: 36ch;
		font: italic 400 16px/1.45 var(--font-serif);
		color: var(--color-ink-3);
	}
	.is-fallback {
		cursor: auto;
	}

	/* ---------- legend: a stratigraphic column of layer switches ---------- */
	.legend {
		grid-column: 3;
		grid-row: 1 / span 2;
		align-self: center;
		display: grid;
		gap: 12px;
		width: 176px;
		cursor: auto;
	}
	.legend-head {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(var(--hero-paper), 0.66);
	}
	.layer-list {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.layer {
		display: grid;
		grid-template-columns: 18px auto minmax(0, 1fr);
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 12px;
		border: 1px solid rgba(var(--hero-paper), 0.2);
		border-radius: var(--radius-control);
		background: rgba(var(--hero-ink), 0.6);
		color: rgba(var(--hero-paper), 0.72);
		font: 500 14px/1.1 var(--font-sans);
		text-align: left;
	}
	button.layer {
		cursor: pointer;
		transition:
			border-color 0.18s ease,
			background 0.18s ease,
			color 0.18s ease;
	}
	button.layer:hover {
		border-color: rgba(var(--hero-paper), 0.6);
		color: var(--color-paper);
	}
	button.layer[aria-pressed='true'] {
		border-color: rgba(var(--hero-paper), 0.7);
		background: rgba(var(--hero-paper), 0.1);
		color: var(--color-paper);
	}
	button.layer:focus-visible,
	.pause:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 3px;
	}
	.index {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		color: rgba(var(--hero-paper), 0.5);
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.swatch {
		position: relative;
		width: 18px;
		height: 18px;
		opacity: 0.4;
		transition: opacity 0.18s ease;
	}
	[aria-pressed='true'] .swatch,
	li.layer .swatch {
		opacity: 1;
	}
	.layer-evidence .swatch {
		background: radial-gradient(circle, var(--color-paper) 1.4px, transparent 1.8px) 0 0 / 6px 6px;
	}
	.layer-annotation .swatch {
		border: 1.5px solid var(--color-vermillion);
		border-radius: 50%;
		background: radial-gradient(circle, var(--color-vermillion) 3px, transparent 3.5px);
	}
	.layer-interpretation .swatch {
		border: 1.5px dashed var(--sage);
		border-radius: 50% 50% 40% 40%;
	}
	.layer-paradata .swatch {
		background:
			linear-gradient(135deg, transparent 45%, var(--color-paper) 46% 54%, transparent 55%),
			linear-gradient(45deg, transparent 45%, var(--color-paper) 46% 54%, transparent 55%);
		clip-path: polygon(0 50%, 100% 0, 100% 100%);
	}
	.layer-frame .swatch {
		border-bottom: 1.5px solid var(--color-paper);
		border-left: 1.5px solid var(--color-paper);
		background: repeating-linear-gradient(90deg, #f4b5a0 0 1px, transparent 1px 4px) 0 100% / 100%
			4px no-repeat;
	}

	/* ---------- rail ---------- */
	.rail {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: start;
		gap: 18px clamp(32px, 5vw, 72px);
		padding-block: 22px clamp(24px, 3vw, 36px);
		cursor: auto;
	}
	.rail::before {
		content: '';
		position: absolute;
		top: 0;
		right: clamp(20px, 4vw, 48px);
		left: clamp(20px, 4vw, 48px);
		height: 1px;
		background: rgba(var(--hero-paper), 0.16);
	}
	.caption {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #f4b5a0;
	}
	.caption-title {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin: 0;
		font: 500 22px/1.15 var(--font-sans);
		letter-spacing: -0.015em;
	}
	.caption-index {
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.06em;
		color: rgba(var(--hero-paper), 0.5);
	}
	.note {
		margin: 0;
		max-width: 58ch;
		font: italic 400 15px/1.45 var(--font-serif);
		color: rgba(var(--hero-paper), 0.76);
	}
	.tools {
		display: grid;
		justify-items: start;
		gap: 10px;
		min-width: 0;
	}
	.pause {
		min-height: 44px;
		padding: 0 16px;
		border: 1px solid rgba(var(--hero-paper), 0.3);
		border-radius: var(--radius-control);
		background: rgba(var(--hero-ink), 0.55);
		color: var(--color-paper);
		font: 500 11px/1 var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.pause:hover,
	.pause[aria-pressed='true'] {
		border-color: var(--color-paper);
	}
	.hint {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.55;
		letter-spacing: 0.02em;
		color: rgba(var(--hero-paper), 0.66);
	}

	/* ---------- narrower screens ---------- */
	@media (max-width: 1180px) {
		.stage {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-rows: auto auto auto;
		}
		.art {
			grid-row: 1 / span 2;
		}
		.legend {
			grid-column: 2;
			grid-row: 3;
			width: auto;
		}
		.legend .layer-list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.body {
			grid-row: 2 / span 2;
		}
	}

	@media (max-width: 960px) {
		#apparatus-hero {
			min-height: 0;
			background:
				radial-gradient(ellipse 100% 30% at 50% 30%, #26372d 0%, #18201b 60%, #121412 100%),
				var(--color-ink);
		}
		#apparatus-hero::before {
			mask-image: radial-gradient(ellipse 90% 26% at 50% 30%, black 10%, transparent 80%);
		}
		.veil {
			background: none;
		}
		.stage {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: none;
			row-gap: 20px;
			padding-block: 32px 12px;
		}
		.title,
		.art,
		.legend,
		.body {
			grid-column: 1;
			grid-row: auto;
		}
		.art {
			min-height: 0;
			height: clamp(300px, 88vw, 460px);
			max-height: 60svh;
		}
		/* Text below the vessel sits on its own dark ground, clear of the particles. */
		.body {
			margin-inline: calc(-1 * clamp(20px, 4vw, 48px));
			padding: 24px clamp(20px, 4vw, 48px) 8px;
			background: rgba(var(--hero-ink), 0.94);
		}
		.rail {
			grid-template-columns: minmax(0, 1fr);
			background: rgba(var(--hero-ink), 0.94);
		}
	}

	@media (max-width: 640px) {
		.legend .layer-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.layer {
			padding: 0 10px;
			gap: 8px;
			font-size: 13.5px;
		}
		.plate-bar {
			right: 28px;
			left: 28px;
			font-size: 10px;
		}
		.tag {
			font-size: 9.5px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		canvas,
		button.layer,
		.swatch {
			transition: none;
		}
	}
</style>
