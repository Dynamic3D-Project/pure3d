<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { base } from '$app/paths';
	import { ReliefRenderer, type ReliefFrame } from './relief-renderer';
	import { RELIEF_MARKS, bakeReliefMap, buildReliefMesh } from './relief-surface';

	interface Props {
		/** Opening copy: headline, lede and calls to action. */
		intro: Snippet;
	}

	type Status = 'pending' | 'live' | 'fallback';
	type Eased = 'raise' | 'print' | 'scan' | 'contour' | 'marks' | 'grid' | 'tilt' | 'yaw';

	interface Scene extends Pick<ReliefFrame, Eased> {
		numeral: string;
		caption: string;
		/** A fixed lamp as [azimuth, elevation] in degrees; without one the lamp sweeps. */
		lamp?: [number, number];
		/** Still image shown when the tablet cannot be drawn. */
		still: string;
	}

	let { intro }: Props = $props();

	/** One scene per chapter; the opening shows the tablet under a sweeping, raking lamp. */
	const SCENES: Scene[] = [
		{
			numeral: '',
			caption: 'Raking light over a carved tablet',
			raise: 1,
			print: 0,
			scan: 0,
			contour: 0,
			marks: 0,
			grid: 0,
			tilt: 0.5,
			yaw: -0.34,
			still: '/images/landing/capture.webp'
		},
		{
			numeral: 'I',
			caption: 'The tablet as a printed plate: one view, one light',
			raise: 0,
			print: 1,
			scan: 0,
			contour: 0,
			marks: 0,
			grid: 0,
			tilt: 0.62,
			yaw: 0.1,
			lamp: [125, 52],
			still: '/images/landing/capture.webp'
		},
		{
			numeral: 'II',
			caption: 'A sweep records the surface as a mesh',
			raise: 1,
			print: 0,
			scan: 1,
			contour: 0,
			marks: 0,
			grid: 0,
			tilt: 0.4,
			yaw: 0.36,
			still: '/images/landing/capture.webp'
		},
		{
			numeral: 'III',
			caption: 'Contours of the carving and four annotation marks',
			raise: 1,
			print: 0,
			scan: 0,
			contour: 1,
			marks: 1,
			grid: 0,
			tilt: 0.26,
			yaw: -0.16,
			still: '/images/landing/annotate.webp'
		},
		{
			numeral: 'IV',
			caption: 'A fixed view against a reference grid',
			raise: 1,
			print: 0,
			scan: 0,
			contour: 0,
			marks: 0.4,
			grid: 1,
			tilt: 0.02,
			yaw: 0,
			lamp: [135, 38],
			still: '/images/landing/review.webp'
		}
	];

	const CHAPTERS = [
		{
			id: 'plate',
			numeral: 'I',
			kicker: 'The plate',
			title: 'Objects have long entered scholarship flat.',
			text: 'A photograph or an engraving, a caption, a footnote. The plate fixes one view under one light, and the reader cannot turn the object to check what it leaves out.'
		},
		{
			id: 'model',
			numeral: 'II',
			kicker: 'The model',
			title: 'Publish the object itself, in the round.',
			text: 'A 3D Scholarly Edition starts from a scan, mesh, point cloud, or reconstruction. Readers turn it, zoom in, and inspect it for themselves in an interactive 3D viewer.'
		},
		{
			id: 'evidence',
			numeral: 'III',
			kicker: 'The evidence',
			title: 'Tie each claim to the surface it concerns.',
			text: 'Annotations connect parts of the model to provenance, uncertainty, bibliography, and interpretation. Choose a mark to see what a note on this tablet could hold.'
		},
		{
			id: 'record',
			numeral: 'IV',
			kicker: 'The record',
			title: 'Review it, cite it, keep it.',
			text: 'Editors and reviewers evaluate the model, metadata, annotations, and interpretation before publication. The published edition is a citable, permalinked record, kept accessible for the long term.'
		}
	];

	/** What a published edition's page carries alongside its model. */
	const RECORD = [
		['Citation', 'A formatted citation, ready to copy.'],
		['DOI', 'Shown with the edition where one has been assigned.'],
		['Rights & access', 'The licence and rights holder, stated with the edition.'],
		['Peer review', 'Its status is shown with the edition; reviewed editions carry a badge.'],
		['Versions', 'The version history stays with the edition.']
	];

	const EASED: Eased[] = ['raise', 'print', 'scan', 'contour', 'marks', 'grid', 'tilt', 'yaw'];
	const MAX_PIXEL_RATIO = 1.75;
	const COMPACT_PIXEL_RATIO = 1.25;
	/** Caps the drawing buffer on very large screens; each pixel marches a shadow ray. */
	const MAX_CANVAS_PIXELS = 2_400_000;
	const REST_AZIMUTH = 150;
	const REST_ELEVATION = 14;
	const DIRECTIONS = [
		'from the right',
		'from the upper right',
		'from above',
		'from the upper left',
		'from the left',
		'from the lower left',
		'from below',
		'from the lower right'
	];

	let stage = $state<HTMLElement>();
	let canvas = $state<HTMLCanvasElement>();
	let chapterNodes = $state<HTMLElement[]>([]);
	let status = $state<Status>('pending');
	let active = $state(0);
	let markFocus = $state(-1);
	let paused = $state(false);
	let manual = $state(false);
	let reducedMotion = $state(false);
	let azimuthDegrees = $state(REST_AZIMUTH);
	let elevationDegrees = $state(REST_ELEVATION);

	const scene = $derived(SCENES[active]);
	const direction = $derived(DIRECTIONS[Math.round(azimuthDegrees / 45) % 8]);

	const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
	const toDegrees = (radians: number) => (radians * 180) / Math.PI;
	/** The same angle, between -π and π, so the lamp always takes the short way round. */
	const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

	// Frame state changes every frame, so it stays outside Svelte's reactivity.
	let renderer: ReliefRenderer | null = null;
	const frame: ReliefFrame = {
		raise: 1,
		print: 0,
		scan: 0,
		scanAt: 0.45,
		contour: 0,
		marks: 0,
		markFocus: -1,
		grid: 0,
		tilt: SCENES[0].tilt,
		yaw: SCENES[0].yaw,
		azimuth: toRadians(REST_AZIMUTH),
		elevation: toRadians(REST_ELEVATION),
		time: 0
	};
	let lampAzimuth = frame.azimuth;
	let lampElevation = frame.elevation;
	/** The lamp follows a hovering mouse or a finger on the tablet, and returns when it leaves. */
	let pointerLamp = false;
	let pointerId = -1;
	let clock = 0;
	let raf = 0;
	let last = 0;
	let lastSync = 0;
	let inView = false;
	let pageVisible = true;

	function aimLamp(animate: boolean) {
		if (pointerLamp || manual) return;
		const fixed = SCENES[active].lamp;
		if (fixed) {
			lampAzimuth = toRadians(fixed[0]);
			lampElevation = toRadians(fixed[1]);
		} else if (animate) {
			// Swing the lamp low across the top of the tablet, from one side to the other.
			lampAzimuth = Math.PI / 2 + 1.25 * Math.sin(clock * 0.3);
			lampElevation = 0.2 + 0.09 * Math.sin(clock * 0.21 + 1);
		}
	}

	function settled() {
		const target = SCENES[active];
		for (const key of EASED) {
			if (Math.abs(target[key] - frame[key]) > 0.001) return false;
		}
		return (
			Math.abs(wrap(lampAzimuth - frame.azimuth)) < 0.001 &&
			Math.abs(lampElevation - frame.elevation) < 0.001
		);
	}

	function syncDials() {
		azimuthDegrees = Math.round(((toDegrees(frame.azimuth) % 360) + 360) % 360);
		elevationDegrees = Math.round(toDegrees(frame.elevation));
	}

	function step(now: number) {
		raf = 0;
		if (!renderer) return;
		const dt = Math.min((now - last) / 1000, 0.05);
		last = now;
		const target = SCENES[active];
		const moving = !paused && !reducedMotion;
		// Only scenes with something to show keep the loop alive between transitions.
		const animated =
			moving && (target.scan > 0 || target.marks > 0 || (!target.lamp && !manual && !pointerLamp));
		if (animated) clock += dt;

		aimLamp(animated);
		const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 2.4);
		const lampEase = reducedMotion ? 1 : 1 - Math.exp(-dt * (pointerLamp ? 9 : 3));
		for (const key of EASED) frame[key] += (target[key] - frame[key]) * ease;
		frame.azimuth += wrap(lampAzimuth - frame.azimuth) * lampEase;
		frame.elevation += (lampElevation - frame.elevation) * lampEase;
		frame.markFocus = markFocus;
		frame.time = clock;
		frame.scanAt = animated ? 1.12 - ((clock * 0.2) % 1.35) : 0.45;
		renderer.render(frame);

		if (animated || !settled()) raf = requestAnimationFrame(step);
		if (!manual && !pointerLamp && (!raf || now - lastSync > 250)) {
			lastSync = now;
			syncDials();
		}
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

	function setActive(index: number) {
		if (index === active) return;
		active = index;
		schedule();
	}

	/** Controls, captions and links keep their own pointer behaviour; open space moves the lamp. */
	function onInterface(target: EventTarget | null) {
		return (
			target instanceof Element && !!target.closest('a, button, input, label, [data-stage-ui]')
		);
	}

	function lampFromPointer(event: PointerEvent) {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		const y = 1 - ((event.clientY - rect.top) / rect.height) * 2;
		// Near the middle the lamp stands high; towards the edges it drops to a raking angle.
		lampAzimuth = Math.atan2(y, x);
		lampElevation = toRadians(70 - 64 * Math.min(1, Math.hypot(x, y)));
		azimuthDegrees = Math.round(((toDegrees(lampAzimuth) % 360) + 360) % 360);
		elevationDegrees = Math.round(toDegrees(lampElevation));
		schedule();
	}

	function releaseLamp() {
		if (!pointerLamp) return;
		pointerLamp = false;
		schedule();
	}

	function onpointermove(event: PointerEvent) {
		if (status !== 'live') return;
		if (event.pointerType === 'mouse') {
			if (onInterface(event.target)) {
				releaseLamp();
				return;
			}
			pointerLamp = true;
			lampFromPointer(event);
		} else if (event.pointerId === pointerId) {
			lampFromPointer(event);
		}
	}

	function onpointerdown(event: PointerEvent) {
		if (status !== 'live' || event.pointerType === 'mouse' || onInterface(event.target)) return;
		pointerId = event.pointerId;
		pointerLamp = true;
		lampFromPointer(event);
	}

	function onpointerend(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		pointerId = -1;
		releaseLamp();
	}

	function onpointerleave(event: PointerEvent) {
		if (event.pointerType === 'mouse') releaseLamp();
	}

	/** The dials hold the lamp where they put it until the reader returns it. */
	function takeLamp(azimuth: number, elevation: number) {
		manual = true;
		azimuthDegrees = azimuth;
		elevationDegrees = elevation;
		lampAzimuth = toRadians(azimuth);
		lampElevation = toRadians(elevation);
		schedule();
	}

	function returnLamp() {
		manual = false;
		schedule();
	}

	function showMark(index: number) {
		const mark = RELIEF_MARKS[index];
		markFocus = index;
		setActive(3);
		takeLamp(mark.azimuth, mark.elevation);
	}

	function togglePause() {
		paused = !paused;
		schedule();
	}

	onMount(() => {
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = motionQuery.matches;
		const compact =
			window.matchMedia('(max-width: 900px), (pointer: coarse)').matches ||
			(navigator.hardwareConcurrency ?? 8) <= 4;

		const listeners = new AbortController();
		const { signal } = listeners;
		let resize: ResizeObserver | undefined;
		let visibility: IntersectionObserver | undefined;

		// The chapter being read sets the scene, drawn or not. In one column the pinned stage covers
		// the top of the screen, so the reading line sits lower.
		const stacked = window.matchMedia('(max-width: 900px)').matches;
		const chapters = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const index = Number((entry.target as HTMLElement).dataset.chapter);
					if (Number.isInteger(index)) setActive(index);
				}
			},
			{ rootMargin: stacked ? '-70% 0px -22% 0px' : '-48% 0px -44% 0px' }
		);
		for (const node of chapterNodes) if (node) chapters.observe(node);

		motionQuery.addEventListener(
			'change',
			(event) => {
				reducedMotion = event.matches;
				schedule();
			},
			{ signal }
		);

		const start = async () => {
			const surface = canvas;
			const host = stage;
			if (signal.aborted || !surface || !host) return;
			try {
				const mesh = buildReliefMesh(compact ? 72 : 120);
				const map = await bakeReliefMap(compact ? 300 : 432, signal);
				if (signal.aborted) return;
				renderer = ReliefRenderer.create(surface, mesh, map, {
					shadowSteps: compact ? 8 : 14,
					marks: RELIEF_MARKS
				});
			} catch {
				if (signal.aborted) return;
				renderer = null;
			}
			if (!renderer) {
				status = 'fallback';
				return;
			}
			status = 'live';

			document.addEventListener(
				'visibilitychange',
				() => {
					pageVisible = document.visibilityState === 'visible';
					if (pageVisible) schedule();
					else halt();
				},
				{ signal }
			);
			surface.addEventListener(
				'webglcontextlost',
				(event) => {
					event.preventDefault();
					halt();
					renderer = null;
					status = 'fallback';
				},
				{ signal }
			);

			const fit = () => {
				const box = surface.getBoundingClientRect();
				const pixelRatio = Math.min(
					window.devicePixelRatio || 1,
					compact ? COMPACT_PIXEL_RATIO : MAX_PIXEL_RATIO,
					Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, box.width * box.height))
				);
				renderer?.resize(box.width, box.height, pixelRatio);
				schedule();
			};
			fit();
			resize = new ResizeObserver(fit);
			resize.observe(surface);

			visibility = new IntersectionObserver(([entry]) => {
				inView = entry.isIntersecting;
				if (inView) schedule();
				else halt();
			});
			visibility.observe(host);
		};

		// The surface is baked in slices after the first paint, so the copy never waits for it.
		void start();

		return () => {
			listeners.abort();
			chapters.disconnect();
			resize?.disconnect();
			visibility?.disconnect();
			halt();
			renderer?.dispose();
			renderer = null;
		};
	});
</script>

<div id="relief-folio" class:is-live={status === 'live'} class:is-fallback={status === 'fallback'}>
	<header class="chapter opening" data-chapter="0" bind:this={chapterNodes[0]}>
		{@render intro()}
	</header>

	<figure
		bind:this={stage}
		class="stage"
		aria-labelledby="relief-folio-caption"
		{onpointerdown}
		{onpointermove}
		onpointerup={onpointerend}
		onpointercancel={onpointerend}
		{onpointerleave}
	>
		<figcaption id="relief-folio-caption" class="caption" data-stage-ui>
			<span class="fig">{scene.numeral ? `Fig. ${scene.numeral}` : 'Frontispiece'}</span>
			<span class="caption-text">{scene.caption}</span>
			<span class="disclaimer">Conceptual tablet · procedural, not a scan of a real object</span>
		</figcaption>
		<canvas bind:this={canvas} aria-hidden="true"></canvas>

		{#if status === 'fallback'}
			<div class="still">
				<img src={`${base}${scene.still}`} alt="" decoding="async" />
				<p>This browser cannot draw the lit tablet, so a still diagram is shown instead.</p>
			</div>
		{/if}

		<div class="bench" data-stage-ui>
			<nav class="index" aria-label="Chapters">
				{#each CHAPTERS as chapter, i (chapter.id)}
					<a href="#relief-folio-{chapter.id}" aria-current={active === i + 1 ? 'step' : undefined}>
						<span class="index-numeral">{chapter.numeral}</span>
						{chapter.kicker.replace('The ', '')}
					</a>
				{/each}
			</nav>

			{#if status === 'live'}
				<div class="lamp" role="group" aria-label="Lamp" aria-describedby="relief-folio-hint">
					<label class="dial">
						<span class="dial-name">Light direction</span>
						<input
							type="range"
							min="0"
							max="359"
							step="1"
							value={azimuthDegrees}
							oninput={(event) => takeLamp(event.currentTarget.valueAsNumber, elevationDegrees)}
							aria-valuetext={`${azimuthDegrees}°, ${direction}`}
						/>
					</label>
					<label class="dial">
						<span class="dial-name">Light height</span>
						<input
							type="range"
							min="4"
							max="80"
							step="1"
							value={elevationDegrees}
							oninput={(event) => takeLamp(azimuthDegrees, event.currentTarget.valueAsNumber)}
							aria-valuetext={`${elevationDegrees}° above the surface${elevationDegrees < 20 ? ', raking' : ''}`}
						/>
					</label>
					<div class="lamp-buttons">
						{#if !reducedMotion}
							<button type="button" aria-pressed={paused} onclick={togglePause}>
								Pause motion
							</button>
						{/if}
						{#if manual}
							<button type="button" onclick={returnLamp}>Return the lamp</button>
						{/if}
					</div>
				</div>
				<p id="relief-folio-hint" class="hint">
					Move the pointer over the tablet, drag across it on a touch screen, or use the dials to
					move the lamp. Low light shows what flat light hides.
				</p>
			{/if}
		</div>
	</figure>

	{#each CHAPTERS as chapter, i (chapter.id)}
		<article
			id={`relief-folio-${chapter.id}`}
			class="chapter"
			class:is-active={active === i + 1}
			data-chapter={i + 1}
			bind:this={chapterNodes[i + 1]}
			aria-labelledby={`relief-folio-${chapter.id}-title`}
		>
			<p class="numeral" aria-hidden="true">{chapter.numeral}</p>
			<p class="kicker">{chapter.kicker}</p>
			<h2 id={`relief-folio-${chapter.id}-title`}>{chapter.title}</h2>
			<p class="body">{chapter.text}</p>

			{#if chapter.id === 'evidence'}
				<ol class="marks">
					{#each RELIEF_MARKS as mark, index (mark.id)}
						<li>
							{#if status === 'live'}
								<button
									type="button"
									aria-pressed={markFocus === index}
									onclick={() => showMark(index)}
								>
									<span class="mark-letter" aria-hidden="true">{mark.mark}</span>
									<span class="mark-title">{mark.title}</span>
								</button>
							{:else}
								<p class="mark-heading">
									<span class="mark-letter" aria-hidden="true">{mark.mark}</span>
									<span class="mark-title">{mark.title}</span>
								</p>
							{/if}
							<p class="mark-text">{mark.text}</p>
						</li>
					{/each}
				</ol>
			{:else if chapter.id === 'record'}
				<dl class="record">
					{#each RECORD as [term, detail] (term)}
						<div>
							<dt>{term}</dt>
							<dd>{detail}</dd>
						</div>
					{/each}
				</dl>
			{/if}
		</article>
	{/each}
</div>

<style>
	#relief-folio {
		--nav-offset: 64px;
		--gutter: clamp(20px, 4vw, 48px);
		--edge: max(var(--gutter), calc((100vw - 1320px) / 2 + var(--gutter)));
		--stage-paper: 244, 241, 235;
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	/* ---------- chapters ---------- */
	.chapter {
		grid-column: 1;
		display: grid;
		align-content: center;
		gap: 20px;
		min-height: calc(100vh - var(--nav-offset));
		min-height: calc(100svh - var(--nav-offset));
		padding: clamp(56px, 9vh, 112px) clamp(28px, 4.5vw, 72px) clamp(56px, 9vh, 112px) var(--edge);
		border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 10%, transparent);
	}
	.chapter:last-of-type {
		border-bottom: 0;
	}
	.opening {
		gap: 28px;
	}
	.numeral {
		margin: 0 0 -8px;
		font: italic 300 clamp(64px, 8vw, 128px) / 0.8 var(--font-serif);
		color: transparent;
		-webkit-text-stroke: 1px var(--color-vermillion);
		transition: color 0.6s ease;
	}
	.chapter.is-active .numeral {
		color: var(--color-vermillion);
	}
	.kicker {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11.5px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-vermillion-ink);
	}
	h2 {
		margin: 0;
		max-width: 18ch;
		font: 400 clamp(32px, 3.6vw, 54px) / 1.02 var(--font-serif);
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.body {
		margin: 0;
		max-width: 44ch;
		font-size: clamp(17px, 1.35vw, 19px);
		line-height: 1.55;
		color: var(--color-ink-2);
		text-wrap: pretty;
	}

	.marks {
		display: grid;
		gap: 10px;
		max-width: 52ch;
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
	}
	.marks li {
		display: grid;
		gap: 6px;
		padding-top: 12px;
		border-top: 1px solid color-mix(in srgb, var(--color-ink) 12%, transparent);
	}
	.marks button,
	.mark-heading {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		justify-self: start;
		min-height: 44px;
		margin: 0;
		padding: 0 14px 0 6px;
		border: 1px solid transparent;
		border-radius: var(--radius-round);
		background: none;
		color: var(--color-ink);
		font: 500 16px/1.2 var(--font-sans);
		text-align: left;
	}
	.marks button {
		cursor: pointer;
		transition:
			background 0.18s ease,
			border-color 0.18s ease;
	}
	.marks button:hover {
		border-color: color-mix(in srgb, var(--color-ink) 22%, transparent);
	}
	.marks button[aria-pressed='true'] {
		border-color: var(--color-vermillion);
		background: var(--color-vermillion-wash);
	}
	.mark-letter {
		display: grid;
		place-items: center;
		flex: none;
		width: 32px;
		height: 32px;
		border: 1.5px solid var(--color-vermillion);
		border-radius: 50%;
		font: 500 12px/1 var(--font-mono);
		color: var(--color-vermillion-ink);
	}
	[aria-pressed='true'] .mark-letter {
		background: var(--color-vermillion);
		color: #fff;
	}
	.mark-text {
		margin: 0;
		padding-left: 50px;
		font: 400 15.5px/1.5 var(--font-sans);
		color: var(--color-ink-3);
	}

	.record {
		display: grid;
		max-width: 52ch;
		margin: 12px 0 0;
		border-top: 1px solid var(--color-ink);
	}
	.record div {
		display: grid;
		grid-template-columns: minmax(8rem, 0.4fr) minmax(0, 1fr);
		gap: 16px;
		padding: 12px 0;
		border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 12%, transparent);
	}
	.record dt {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		line-height: 1.6;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.record dd {
		margin: 0;
		font-size: 15.5px;
		line-height: 1.5;
		color: var(--color-ink-2);
	}

	/* ---------- the lit stage ---------- */
	.stage {
		position: sticky;
		top: var(--nav-offset);
		grid-column: 2;
		grid-row: 1 / span 5;
		align-self: start;
		isolation: isolate;
		overflow: hidden;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		height: calc(100vh - var(--nav-offset));
		height: calc(100svh - var(--nav-offset));
		margin: 0;
		background:
			radial-gradient(ellipse 60% 52% at 50% 46%, #2a3a2f 0%, #18221c 58%, #101512 100%),
			var(--color-ink);
		color: var(--color-paper);
		touch-action: pan-y;
		cursor: crosshair;
	}
	/* A soft pool of lamplight on the bench the tablet lies on. */
	.stage::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: radial-gradient(
			ellipse 38% 30% at 50% 58%,
			rgba(255, 226, 190, 0.1),
			transparent 70%
		);
		pointer-events: none;
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

	.still {
		position: absolute;
		inset: 88px clamp(20px, 4vw, 48px) 180px;
		z-index: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 16px;
		padding: 24px;
		border-radius: var(--radius-surface);
		background: var(--color-paper);
		text-align: center;
	}
	.still img {
		width: min(100%, 440px);
		max-height: 60%;
		object-fit: contain;
	}
	.still p {
		margin: 0;
		max-width: 36ch;
		font: italic 400 16px/1.45 var(--font-serif);
		color: var(--color-ink-3);
	}
	.is-fallback .stage {
		cursor: auto;
	}

	.caption,
	.bench {
		position: relative;
		z-index: 1;
		cursor: auto;
	}
	.caption {
		grid-row: 1;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 4px 14px;
		align-items: baseline;
		padding: 22px var(--gutter) 0;
		background: linear-gradient(180deg, rgba(16, 21, 18, 0.72), transparent);
	}
	.fig {
		font: italic 400 22px/1 var(--font-serif);
		color: #f4b5a0;
	}
	.caption-text {
		font: 500 15px/1.35 var(--font-sans);
		color: var(--color-paper);
	}
	.disclaimer {
		grid-column: 2;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(var(--stage-paper), 0.62);
	}

	.bench {
		grid-row: 3;
		display: grid;
		gap: 12px;
		padding: 16px var(--gutter) 22px;
		background: linear-gradient(0deg, rgba(16, 21, 18, 0.9) 30%, transparent);
	}
	.index {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.index a {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 0 12px;
		border: 1px solid rgba(var(--stage-paper), 0.2);
		border-radius: var(--radius-round);
		color: rgba(var(--stage-paper), 0.78);
		font: 500 13px/1 var(--font-sans);
		text-decoration: none;
		transition:
			border-color 0.18s ease,
			color 0.18s ease;
	}
	.index a:hover {
		border-color: rgba(var(--stage-paper), 0.6);
		color: var(--color-paper);
	}
	.index a[aria-current='step'] {
		border-color: #f4b5a0;
		color: var(--color-paper);
	}
	.index-numeral {
		font: italic 400 14px/1 var(--font-serif);
		color: #f4b5a0;
	}

	.lamp {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
		align-items: end;
		gap: 12px 18px;
	}
	.dial {
		display: grid;
		gap: 4px;
		min-width: 0;
	}
	.dial-name {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(var(--stage-paper), 0.7);
	}
	.dial input {
		width: 100%;
		min-height: 36px;
		margin: 0;
		accent-color: var(--color-vermillion);
		cursor: pointer;
	}
	.lamp-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.lamp-buttons button {
		min-height: 40px;
		padding: 0 14px;
		border: 1px solid rgba(var(--stage-paper), 0.3);
		border-radius: var(--radius-control);
		background: rgba(16, 21, 18, 0.6);
		color: var(--color-paper);
		font: 500 11px/1 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			border-color 0.18s ease,
			background 0.18s ease;
	}
	.lamp-buttons button:hover {
		border-color: var(--color-paper);
	}
	.lamp-buttons button[aria-pressed='true'] {
		border-color: var(--color-paper);
		background: var(--color-paper);
		color: var(--color-ink);
	}
	.hint {
		margin: 0;
		max-width: 70ch;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.5;
		color: rgba(var(--stage-paper), 0.66);
	}

	#relief-folio :global(a:focus-visible),
	#relief-folio :global(button:focus-visible),
	#relief-folio :global(input:focus-visible) {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 3px;
	}

	/* ---------- responsive ---------- */
	@media (max-width: 1100px) {
		.lamp {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.lamp-buttons {
			grid-column: 1 / -1;
		}
	}

	/* One column: the stage pins under the site header and the chapters scroll up beneath it. */
	@media (max-width: 900px) {
		#relief-folio {
			grid-template-columns: minmax(0, 1fr);
		}
		.chapter {
			min-height: 0;
			padding: 48px var(--gutter);
		}
		.opening {
			padding-top: 32px;
		}
		.chapter:not(.opening) {
			min-height: 72vh;
			min-height: 72svh;
		}
		.stage {
			z-index: 2;
			grid-column: 1;
			grid-row: auto;
			height: min(52vh, 480px);
			height: min(52svh, 480px);
			border-bottom: 1px solid var(--color-ink);
		}
		.caption {
			padding-top: 14px;
		}
		.fig {
			font-size: 18px;
		}
		.disclaimer {
			font-size: 9.5px;
		}
		.index,
		.hint {
			display: none;
		}
		.bench {
			padding-block: 10px 12px;
		}
		.lamp {
			gap: 8px 14px;
		}
		.lamp-buttons button {
			min-height: 36px;
		}
		.still {
			inset: 72px var(--gutter) 96px;
		}
		.still p {
			font-size: 14px;
		}
	}

	/* Short landscape screens have no room to pin the stage, so it scrolls with the page. */
	@media (max-width: 900px) and (max-height: 560px) {
		.stage {
			position: relative;
			top: auto;
			height: 88vh;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		canvas,
		.numeral,
		.index a,
		.marks button,
		.lamp-buttons button {
			transition: none;
		}
	}
</style>
