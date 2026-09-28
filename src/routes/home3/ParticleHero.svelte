<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { base } from '$app/paths';
	import {
		ParticleField,
		type FieldFocus,
		type FieldFrame,
		type GlyphSource,
		type ParticleGlyphs
	} from './particle-field';
	import { PARTICLE_FORMS, buildParticleCloud } from './particle-forms';

	interface Props {
		/** Headline, lede and calls to action, laid over the artwork. */
		copy: Snippet;
		/** Actions shown beneath the form, such as opening a published edition. */
		foot?: Snippet;
		/** Draws every particle as a letter from the copy instead of a dot. */
		glyphs?: GlyphSource;
	}

	type Status = 'pending' | 'live' | 'fallback';

	let { copy, foot, glyphs }: Props = $props();

	/**
	 * Dots read as a dense scan. Letters need far fewer, larger particles to stay readable rather
	 * than smearing into each other. Pairs are [regular, compact]; sizes are CSS pixels at the centre
	 * of the form.
	 */
	const DENSITY = {
		points: {
			form: [18000, 9000],
			dust: [2800, 1200],
			size: [2.2, 2.2],
			maxSize: 18,
			clusters: {}
		},
		glyphs: {
			form: [1400, 700],
			dust: [260, 120],
			size: [18, 14],
			maxSize: 44,
			clusters: { anchorPoints: 4, anchorRadius: 0.07 }
		}
	};

	const MAX_PIXEL_RATIO = 1.75;
	/** Caps the drawing buffer on very large screens; the points stay sharp well below this. */
	const MAX_CANVAS_PIXELS = 4_200_000;
	/** Share of the art region's shorter side the form and its ring fill. */
	const FORM_FILL = 0.46;
	const MORPH_SECONDS = 2.6;
	const HOLD_SECONDS = 7;
	const DRIFT_PER_SECOND = 0.12;
	const REST_YAW = 0.6;
	const REST_PITCH = 0.22;
	const KEY_TURNS: Record<string, [number, number]> = {
		ArrowLeft: [-0.35, 0],
		ArrowRight: [0.35, 0],
		ArrowUp: [0, -0.15],
		ArrowDown: [0, 0.15]
	};

	let root = $state<HTMLDivElement>();
	let copyBox = $state<HTMLDivElement>();
	let art = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let status = $state<Status>('pending');
	let formIndex = $state(0);
	let paused = $state(false);
	let reducedMotion = $state(false);
	let particleCount = $state(0);

	const form = $derived(PARTICLE_FORMS[formIndex]);
	const unit = $derived(glyphs ? 'letters' : 'points');
	const pad = (value: number) => String(value).padStart(2, '0');

	// Frame state changes every frame, so it stays outside Svelte's reactivity.
	let field: ParticleField | null = null;
	const frame: FieldFrame = {
		from: 0,
		to: 0,
		morph: 0,
		yaw: REST_YAW,
		pitch: REST_PITCH,
		pointerX: 0,
		pointerY: 0,
		pointerStrength: 0,
		burst: 0,
		time: 0,
		scan: -9
	};
	let yawTarget = REST_YAW;
	let pitchTarget = REST_PITCH;
	let pointerTarget = 0;
	let burstAge = 0.22;
	let held = 0;
	let raf = 0;
	let last = 0;
	let inView = false;
	let pageVisible = true;
	let dragId = -1;
	let dragX = 0;
	let dragY = 0;
	let dragMoved = false;

	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

	/** Scatter quickly, then fall back into the form. */
	function burstEnvelope(age: number) {
		return age < 0.22 ? Math.sin((age / 0.22) * Math.PI * 0.5) : Math.exp(-(age - 0.22) * 2.4);
	}

	function settled() {
		return (
			frame.morph >= 1 &&
			frame.burst < 0.002 &&
			frame.pointerStrength < 0.002 &&
			pointerTarget < 0.002 &&
			Math.abs(yawTarget - frame.yaw) < 0.0005 &&
			Math.abs(pitchTarget - frame.pitch) < 0.0005
		);
	}

	function step(now: number) {
		raf = 0;
		if (!field) return;
		const dt = Math.min((now - last) / 1000, 0.05);
		last = now;
		const moving = !paused && !reducedMotion;
		frame.time += dt;

		if (reducedMotion) {
			frame.morph = 1;
			frame.yaw = yawTarget;
			frame.pitch = pitchTarget;
			frame.burst = 0;
			frame.pointerStrength = pointerTarget = 0;
		} else {
			frame.morph = Math.min(1, frame.morph + dt / MORPH_SECONDS);
			if (moving && dragId < 0) {
				yawTarget += dt * DRIFT_PER_SECOND;
				held += dt;
				if (held > HOLD_SECONDS && frame.morph >= 1) {
					showForm((frame.to + 1) % PARTICLE_FORMS.length);
				}
			}
			const ease = 1 - Math.exp(-dt * 6);
			frame.yaw += (yawTarget - frame.yaw) * ease;
			frame.pitch += (pitchTarget - frame.pitch) * ease;
			pointerTarget *= Math.exp(-dt * 0.8);
			frame.pointerStrength += (pointerTarget - frame.pointerStrength) * (1 - Math.exp(-dt * 8));
			burstAge += dt;
			frame.burst = burstEnvelope(burstAge);
		}
		frame.scan = moving ? ((frame.time * 0.2) % 1) * 3 - 1.5 : -9;

		field.render(frame);
		if (!raf && (moving || !settled())) raf = requestAnimationFrame(step);
	}

	/** Draws at least one more frame; the loop then keeps itself alive only while something moves. */
	function schedule() {
		if (raf || !field || !inView || !pageVisible) return;
		last = performance.now();
		raf = requestAnimationFrame(step);
	}

	function halt() {
		cancelAnimationFrame(raf);
		raf = 0;
	}

	function showForm(index: number) {
		held = 0;
		if (index === frame.to) return;
		// Changing form mid-transition skips ahead, so a short scatter hides the jump.
		if (frame.morph < 1 && !reducedMotion) burstAge = Math.min(burstAge, 0.22);
		frame.from = frame.to;
		frame.to = index;
		frame.morph = reducedMotion ? 1 : 0;
		formIndex = index;
		schedule();
	}

	function scatter() {
		held = 0;
		if (reducedMotion) return;
		burstAge = 0;
		schedule();
	}

	/** Text, links and controls keep their own pointer behaviour; open space belongs to the form. */
	function onInterface(target: EventTarget | null) {
		return target instanceof Element && !!target.closest('a, button, [data-hero-ui]');
	}

	function trackPointer(event: PointerEvent) {
		if (!root) return;
		const rect = root.getBoundingClientRect();
		frame.pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		frame.pointerY = 1 - ((event.clientY - rect.top) / rect.height) * 2;
		if (!reducedMotion) pointerTarget = 1;
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0 || status !== 'live' || onInterface(event.target)) return;
		dragId = event.pointerId;
		dragX = event.clientX;
		dragY = event.clientY;
		dragMoved = false;
		root?.setPointerCapture(event.pointerId);
		trackPointer(event);
		schedule();
	}

	function onpointermove(event: PointerEvent) {
		if (dragId === event.pointerId) {
			const dx = event.clientX - dragX;
			const dy = event.clientY - dragY;
			if (!dragMoved && Math.abs(dx) + Math.abs(dy) < 6) return;
			dragMoved = true;
			yawTarget += dx * 0.008;
			pitchTarget = clamp(pitchTarget + dy * 0.005, -0.3, 0.9);
			dragX = event.clientX;
			dragY = event.clientY;
		} else if (event.pointerType !== 'mouse') {
			return;
		}
		trackPointer(event);
		schedule();
	}

	function onpointerup(event: PointerEvent) {
		if (dragId !== event.pointerId) return;
		dragId = -1;
		if (!dragMoved) scatter();
		if (event.pointerType !== 'mouse') pointerTarget = 0;
	}

	function onpointercancel(event: PointerEvent) {
		if (dragId === event.pointerId) dragId = -1;
		pointerTarget = 0;
	}

	function onpointerleave(event: PointerEvent) {
		if (event.pointerType === 'mouse') pointerTarget = 0;
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.target !== event.currentTarget) return;
		const turn = KEY_TURNS[event.key];
		if (turn) {
			yawTarget += turn[0];
			pitchTarget = clamp(pitchTarget + turn[1], -0.3, 0.9);
		} else if (event.key === 'Home') {
			yawTarget = REST_YAW;
			pitchTarget = REST_PITCH;
		} else if (event.key === ' ' || event.key === 'Enter') {
			scatter();
		} else {
			return;
		}
		event.preventDefault();
		held = 0;
		schedule();
	}

	function togglePause() {
		paused = !paused;
		held = 0;
		schedule();
	}

	onMount(() => {
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = motionQuery.matches;
		const compact =
			window.matchMedia('(max-width: 640px), (pointer: coarse)').matches ||
			(navigator.hardwareConcurrency ?? 8) <= 4;
		const density = glyphs ? DENSITY.glyphs : DENSITY.points;
		const tier = compact ? 1 : 0;
		particleCount = density.form[tier];
		if (reducedMotion) {
			frame.morph = 1;
			burstAge = Infinity;
		}

		const listeners = new AbortController();
		const { signal } = listeners;
		let resize: ResizeObserver | undefined;
		let visibility: IntersectionObserver | undefined;

		const start = (letters?: ParticleGlyphs) => {
			if (signal.aborted) return;
			const cloud = buildParticleCloud(particleCount, density.dust[tier], density.clusters);
			const options = {
				pointScale: density.size[tier],
				maxPointSize: density.maxSize,
				glyphs: letters
			};
			field = canvas ? ParticleField.create(canvas, cloud, options) : null;
			if (!field || !canvas || !root || !art) {
				field?.dispose();
				field = null;
				status = 'fallback';
				return;
			}
			status = 'live';

			motionQuery.addEventListener(
				'change',
				(event) => {
					reducedMotion = event.matches;
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
					field = null;
					status = 'fallback';
				},
				{ signal }
			);

			const host = root;
			const anchor = art;
			const fit = () => {
				const box = host.getBoundingClientRect();
				const region = anchor.getBoundingClientRect();
				const focus: FieldFocus = {
					x: region.left - box.left + region.width / 2,
					y: region.top - box.top + region.height / 2,
					radius: Math.min(region.width, region.height) * FORM_FILL
				};
				const pixelRatio = Math.min(
					window.devicePixelRatio || 1,
					MAX_PIXEL_RATIO,
					Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, box.width * box.height))
				);
				field?.resize(box.width, box.height, pixelRatio, focus);
				schedule();
			};
			fit();
			resize = new ResizeObserver(fit);
			resize.observe(host);
			resize.observe(anchor);

			visibility = new IntersectionObserver(([entry]) => {
				inView = entry.isIntersecting;
				if (inView) schedule();
				else halt();
			});
			visibility.observe(host);
		};

		// Letters wait for the headline font, so the atlas is set in the face the copy uses.
		if (glyphs && copyBox) {
			void glyphs(copyBox, particleCount + density.dust[tier]).then(start, () => {
				if (!signal.aborted) status = 'fallback';
			});
		} else {
			start();
		}

		return () => {
			listeners.abort();
			resize?.disconnect();
			visibility?.disconnect();
			halt();
			field?.dispose();
			field = null;
		};
	});
</script>

<!-- The whole hero is the artwork's canvas: open space takes drag, tap and hover; text keeps its own. -->
<div
	id="particle-hero"
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

	<div class="stage">
		<div bind:this={copyBox} class="copy" data-hero-ui>
			{@render copy()}
		</div>

		<!-- The art region hosts no element of its own; the keys are the keyboard equivalent of dragging. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			bind:this={art}
			class="art"
			role="group"
			aria-label={`Conceptual ${glyphs ? 'letterform' : 'particle'} artwork: ${form.title}`}
			aria-describedby="particle-hero-hint particle-hero-note"
			tabindex={status === 'live' ? 0 : -1}
			{onkeydown}
		>
			<span class="crop crop-tl" aria-hidden="true"></span>
			<span class="crop crop-tr" aria-hidden="true"></span>
			<span class="crop crop-bl" aria-hidden="true"></span>
			<span class="crop crop-br" aria-hidden="true"></span>

			<div class="plate-bar" aria-hidden="true">
				<span>Form {pad(formIndex + 1)} / {pad(PARTICLE_FORMS.length)}</span>
				<span>
					{particleCount ? `${particleCount.toLocaleString('en')} ${unit} · ` : ''}Procedural
				</span>
			</div>

			{#if status === 'fallback'}
				<div class="fallback">
					<img src={`${base}/images/landing/capture.webp`} alt="" />
					<p>This browser cannot draw the interactive artwork, so a still diagram is shown.</p>
				</div>
			{/if}
		</div>

		{#if foot}
			<div class="foot" data-hero-ui>
				{@render foot()}
			</div>
		{/if}
	</div>

	<div class="rail" data-hero-ui>
		<div class="caption">
			<span class="kicker">Conceptual artwork · not a scan</span>
			<p class="title">{form.title}</p>
			<p id="particle-hero-note" class="note">
				{form.note} Vermillion clusters stand for the annotations an edition attaches to its model.
				{#if glyphs}
					Each particle is a letter set from the text on this page.
				{/if}
			</p>
		</div>
		<div class="tools">
			{#if status === 'live'}
				<div class="controls">
					<div class="forms" role="group" aria-label="Choose a form">
						{#each PARTICLE_FORMS as item, index (item.id)}
							<button
								type="button"
								aria-pressed={index === formIndex}
								onclick={() => showForm(index)}
							>
								<span class="index" aria-hidden="true">{pad(index + 1)}</span>
								<span class="label">{item.label}</span>
							</button>
						{/each}
					</div>
					{#if !reducedMotion}
						<button type="button" class="pause" aria-pressed={paused} onclick={togglePause}>
							Pause motion
						</button>
					{/if}
				</div>
				<p id="particle-hero-hint" class="hint">
					{reducedMotion
						? 'Drag or use the arrow keys to turn the focused form; Home resets the view.'
						: 'Move across the form to disperse it. Click, tap or press Space to scatter and reassemble; drag or use the arrow keys to turn it.'}
				</p>
			{:else}
				<p id="particle-hero-hint" class="hint">
					A procedural point cloud standing for the objects PURE3D editions document.
				</p>
			{/if}
		</div>
	</div>
</div>

<style>
	#particle-hero {
		--hero-ink: 18, 18, 17;
		--hero-paper: 244, 241, 235;
		position: relative;
		isolation: isolate;
		overflow: hidden;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		min-height: clamp(640px, calc(100vh - 77px), 1040px);
		min-height: clamp(640px, calc(100svh - 77px), 1040px);
		background:
			radial-gradient(ellipse 58% 72% at 72% 44%, #2c3631 0%, #191a18 55%, #121211 100%),
			var(--color-ink);
		color: var(--color-paper);
		touch-action: pan-y;
		cursor: grab;
	}
	#particle-hero:active {
		cursor: grabbing;
	}
	#particle-hero::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background-image:
			linear-gradient(rgba(var(--hero-paper), 0.045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(var(--hero-paper), 0.045) 1px, transparent 1px);
		background-size: 72px 72px;
		mask-image: radial-gradient(ellipse 70% 80% at 72% 46%, black 10%, transparent 72%);
	}

	canvas {
		position: absolute;
		inset: 0;
		z-index: 0;
		display: block;
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 1.4s ease;
	}
	.is-live canvas {
		opacity: 1;
	}

	/*
	 * Keeps the copy on a calm, dark field whatever the particles are doing behind it. The stops
	 * follow the centred copy column rather than the viewport edge, so wide screens stay covered.
	 */
	.veil {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background:
			linear-gradient(
				90deg,
				rgba(var(--hero-ink), 0.94) 0%,
				rgba(var(--hero-ink), 0.82) calc(50% - 160px),
				rgba(var(--hero-ink), 0.4) calc(50% - 20px),
				rgba(var(--hero-ink), 0) calc(50% + 120px)
			),
			linear-gradient(0deg, rgba(var(--hero-ink), 0.92) 0%, rgba(var(--hero-ink), 0) 24%);
	}

	.stage,
	.rail {
		position: relative;
		z-index: 2;
		width: 100%;
		max-width: 1320px;
		margin: 0 auto;
		padding-inline: clamp(20px, 4vw, 48px);
	}
	.stage {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
		grid-template-rows: minmax(0, 1fr) auto;
		column-gap: clamp(32px, 5vw, 72px);
		row-gap: 12px;
		padding-block: clamp(48px, 6vw, 88px) 20px;
	}
	.copy {
		grid-column: 1;
		grid-row: 1 / span 2;
		align-self: center;
		display: grid;
		gap: 32px;
		min-width: 0;
		cursor: auto;
	}

	.art {
		position: relative;
		grid-column: 2;
		grid-row: 1;
		min-height: clamp(400px, 58vh, 700px);
		min-height: clamp(400px, 58svh, 700px);
		border-radius: var(--radius-surface);
		cursor: inherit;
	}
	.art:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 4px;
	}

	.crop {
		position: absolute;
		width: 22px;
		height: 22px;
		border-color: var(--color-vermillion);
		border-style: solid;
		border-width: 0;
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
		right: 34px;
		left: 34px;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(var(--hero-paper), 0.72);
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
		opacity: 0.85;
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

	.foot {
		grid-column: 2;
		grid-row: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 16px;
		min-width: 0;
		cursor: auto;
	}

	.rail {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
		align-items: start;
		gap: 20px clamp(32px, 5vw, 72px);
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
	.title {
		margin: 0;
		font: 500 22px/1.15 var(--font-sans);
		letter-spacing: -0.015em;
		color: var(--color-paper);
	}
	.note {
		margin: 0;
		max-width: 56ch;
		font: italic 400 15px/1.45 var(--font-serif);
		color: rgba(var(--hero-paper), 0.74);
	}

	.tools {
		display: grid;
		gap: 10px;
		min-width: 0;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	/* Eight forms sit in two even rows of four at every width, so the labels never overflow. */
	.forms {
		flex: 1 1 100%;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
	}
	.forms button {
		min-width: 0;
		padding: 0 10px;
	}
	.label {
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.controls button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 14px;
		border: 1px solid rgba(var(--hero-paper), 0.28);
		border-radius: var(--radius-control);
		background: rgba(var(--hero-ink), 0.55);
		color: var(--color-paper);
		font: 500 14px/1 var(--font-sans);
		cursor: pointer;
		transition:
			border-color 0.18s ease,
			background 0.18s ease;
	}
	.controls button:hover {
		border-color: var(--color-paper);
	}
	.controls button[aria-pressed='true'] {
		border-color: var(--color-paper);
		background: var(--color-paper);
		color: var(--color-ink);
	}
	.controls button:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 3px;
	}
	.index {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		color: #f4b5a0;
	}
	[aria-pressed='true'] .index {
		color: var(--color-vermillion-ink);
	}
	.controls .pause {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.hint {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.5;
		letter-spacing: 0.02em;
		color: rgba(var(--hero-paper), 0.66);
	}

	@media (max-width: 960px) {
		#particle-hero {
			min-height: 0;
			background:
				radial-gradient(ellipse 90% 34% at 50% 20%, #2c3631 0%, #191a18 60%, #121211 100%),
				var(--color-ink);
		}
		#particle-hero::before {
			mask-image: radial-gradient(ellipse 90% 30% at 50% 20%, black 10%, transparent 80%);
		}
		.veil {
			background: linear-gradient(
				180deg,
				rgba(var(--hero-ink), 0) 0,
				rgba(var(--hero-ink), 0) min(76vw, 440px),
				rgba(var(--hero-ink), 0.7) calc(min(76vw, 440px) + 160px),
				rgba(var(--hero-ink), 0.78) 100%
			);
		}
		.stage {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: none;
			row-gap: 20px;
			padding-block: 20px 12px;
		}
		.art {
			order: -1;
			grid-column: 1;
			grid-row: auto;
			min-height: 0;
			height: clamp(280px, 76vw, 440px);
			max-height: 56svh;
		}
		.copy {
			grid-column: 1;
			grid-row: auto;
			padding-top: 12px;
		}
		.foot {
			grid-column: 1;
			grid-row: auto;
		}
		.rail {
			grid-template-columns: minmax(0, 1fr);
			padding-top: 20px;
		}
	}

	@media (max-width: 640px) {
		.plate-bar {
			right: 30px;
			left: 30px;
			font-size: 10px;
		}
		.forms button {
			flex-direction: column;
			justify-content: center;
			gap: 3px;
			padding: 6px 4px;
			font-size: 13px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		canvas,
		.controls button {
			transition: none;
		}
	}
</style>
