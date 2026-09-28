<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { ParticleField, type FieldFrame } from './particle-field';
	import { PARTICLE_FORMS, buildParticleCloud } from './particle-forms';

	type Status = 'pending' | 'live' | 'fallback';

	const MAX_PIXEL_RATIO = 1.75;
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

	let stage = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let status = $state<Status>('pending');
	let formIndex = $state(0);
	let paused = $state(false);
	let reducedMotion = $state(false);
	let particleCount = $state(0);

	const form = $derived(PARTICLE_FORMS[formIndex]);
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

	function trackPointer(event: PointerEvent) {
		if (!stage) return;
		const rect = stage.getBoundingClientRect();
		frame.pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		frame.pointerY = 1 - ((event.clientY - rect.top) / rect.height) * 2;
		if (!reducedMotion) pointerTarget = 1;
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0) return;
		dragId = event.pointerId;
		dragX = event.clientX;
		dragY = event.clientY;
		dragMoved = false;
		stage?.setPointerCapture(event.pointerId);
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
		particleCount = compact ? 9000 : 18000;
		if (reducedMotion) {
			frame.morph = 1;
			burstAge = Infinity;
		}

		field = canvas ? ParticleField.create(canvas, buildParticleCloud(particleCount), 2.2) : null;
		if (!field || !canvas || !stage) {
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

		const target = stage;
		const fit = () => {
			const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
			field?.resize(target.clientWidth, target.clientHeight, pixelRatio);
			schedule();
		};
		fit();
		const resize = new ResizeObserver(fit);
		resize.observe(target);

		const visibility = new IntersectionObserver(([entry]) => {
			inView = entry.isIntersecting;
			if (inView) schedule();
			else halt();
		});
		visibility.observe(target);

		return () => {
			listeners.abort();
			resize.disconnect();
			visibility.disconnect();
			halt();
			field?.dispose();
			field = null;
		};
	});
</script>

<figure id="particle-specimen" aria-labelledby="particle-specimen-title">
	<!-- The stage hosts a WebGL canvas; the keys below are the keyboard equivalent of the pointer. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={stage}
		class="stage"
		class:is-live={status === 'live'}
		role="group"
		aria-label={`Conceptual particle artwork: ${form.title}`}
		aria-describedby="particle-specimen-hint"
		tabindex={status === 'live' ? 0 : -1}
		{onkeydown}
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		{onpointercancel}
		{onpointerleave}
	>
		<canvas bind:this={canvas} aria-hidden="true"></canvas>

		<span class="crop crop-tl" aria-hidden="true"></span>
		<span class="crop crop-tr" aria-hidden="true"></span>
		<span class="crop crop-bl" aria-hidden="true"></span>
		<span class="crop crop-br" aria-hidden="true"></span>

		<div class="plate-bar" aria-hidden="true">
			<span>Form {pad(formIndex + 1)} / {pad(PARTICLE_FORMS.length)}</span>
			<span>
				{particleCount ? `${particleCount.toLocaleString('en')} points · ` : ''}Procedural
			</span>
		</div>

		{#if status === 'fallback'}
			<div class="fallback">
				<img src={`${base}/images/landing/capture.webp`} alt="" />
				<p>This browser cannot draw the interactive artwork, so a still diagram is shown.</p>
			</div>
		{/if}
	</div>

	{#if status === 'live'}
		<div class="controls">
			<div class="forms" role="group" aria-label="Choose a form">
				{#each PARTICLE_FORMS as item, index (item.id)}
					<button type="button" aria-pressed={index === formIndex} onclick={() => showForm(index)}>
						<span class="index" aria-hidden="true">{pad(index + 1)}</span>
						{item.label}
					</button>
				{/each}
			</div>
			{#if !reducedMotion}
				<button type="button" class="pause" aria-pressed={paused} onclick={togglePause}>
					Pause motion
				</button>
			{/if}
		</div>
		<p id="particle-specimen-hint" class="hint">
			{reducedMotion
				? 'Drag or use the arrow keys to turn the focused form; Home resets the view.'
				: 'Move across the form to disperse it. Click, tap or press Space to scatter and reassemble; drag or use the arrow keys to turn it.'}
		</p>
	{:else}
		<p id="particle-specimen-hint" class="hint">
			A procedural point cloud standing for the objects PURE3D editions document.
		</p>
	{/if}

	<figcaption class="label">
		<span class="label-kicker">Conceptual artwork · not a scan</span>
		<p id="particle-specimen-title" class="title">{form.title}</p>
		<p class="note">
			{form.note} Vermillion clusters stand for the annotations an edition attaches to its model.
		</p>
	</figcaption>
</figure>

<style>
	#particle-specimen {
		margin: 0;
		display: grid;
		gap: 14px;
	}

	.stage {
		position: relative;
		overflow: hidden;
		isolation: isolate;
		aspect-ratio: 4 / 4.4;
		max-height: min(78vh, 720px);
		width: 100%;
		border-radius: var(--radius-surface);
		background:
			radial-gradient(ellipse at 50% 46%, #2c3631 0%, #171816 58%, #121211 100%), var(--color-ink);
		box-shadow:
			0 40px 90px -30px rgba(20, 20, 19, 0.55),
			inset 0 0 0 1px rgba(244, 241, 235, 0.08);
		touch-action: pan-y;
		cursor: grab;
	}
	.stage::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		background-image:
			linear-gradient(rgba(244, 241, 235, 0.045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(244, 241, 235, 0.045) 1px, transparent 1px);
		background-size: 48px 48px;
		mask-image: radial-gradient(ellipse at center, transparent 38%, black 95%);
	}
	.stage:active {
		cursor: grabbing;
	}
	.stage:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 4px;
	}

	canvas {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: block;
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 1.2s ease;
	}
	.is-live canvas {
		opacity: 1;
	}

	.crop {
		position: absolute;
		z-index: 3;
		width: 22px;
		height: 22px;
		border-color: var(--color-vermillion);
		border-style: solid;
		border-width: 0;
		pointer-events: none;
	}
	.crop-tl {
		top: 14px;
		left: 14px;
		border-top-width: 2px;
		border-left-width: 2px;
	}
	.crop-tr {
		top: 14px;
		right: 14px;
		border-top-width: 2px;
		border-right-width: 2px;
	}
	.crop-bl {
		bottom: 14px;
		left: 14px;
		border-bottom-width: 2px;
		border-left-width: 2px;
	}
	.crop-br {
		right: 14px;
		bottom: 14px;
		border-right-width: 2px;
		border-bottom-width: 2px;
	}

	.plate-bar {
		position: absolute;
		top: 18px;
		right: 48px;
		left: 48px;
		z-index: 3;
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(244, 241, 235, 0.72);
		pointer-events: none;
	}

	.fallback {
		position: absolute;
		inset: 0;
		z-index: 4;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 16px;
		padding: 48px 32px;
		background: var(--color-paper);
		text-align: center;
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

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.forms {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.controls button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 14px;
		border: 1px solid color-mix(in srgb, var(--color-base-content) 20%, transparent);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font: 500 14px/1 var(--font-sans);
		cursor: pointer;
		transition:
			border-color 0.18s ease,
			background 0.18s ease;
	}
	.controls button:hover {
		border-color: var(--color-ink);
	}
	.controls button[aria-pressed='true'] {
		border-color: var(--color-ink);
		background: var(--color-ink);
		color: var(--color-paper);
	}
	.controls button:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 3px;
	}
	.index {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		color: var(--color-vermillion-ink);
	}
	[aria-pressed='true'] .index {
		color: #f4b5a0;
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
		color: var(--color-ink-3);
	}

	.label {
		display: grid;
		gap: 6px;
		padding: 18px 0 0;
		border-top: 1px solid color-mix(in srgb, var(--color-base-content) 20%, transparent);
	}
	.label-kicker {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-vermillion-ink);
	}
	.title {
		margin: 0;
		font: 500 22px/1.15 var(--font-sans);
		letter-spacing: -0.015em;
	}
	.note {
		margin: 0;
		max-width: 56ch;
		font: italic 400 15px/1.45 var(--font-serif);
		color: var(--color-ink-3);
	}

	@media (max-width: 640px) {
		.stage {
			aspect-ratio: 1;
		}
		.plate-bar {
			right: 44px;
			left: 44px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		canvas,
		.controls button {
			transition: none;
		}
	}
</style>
