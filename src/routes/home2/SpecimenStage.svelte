<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { ensureViewerScript } from '$lib/components/voyager/viewer-resources';
	import type { VoyagerElement } from '$lib/components/voyager/viewer-runtime';
	import { DEFAULT_VOYAGER_VERSION, getVoyagerResourceRoot } from '$lib/utils/asset-urls';
	import {
		fetchSceneEvidence,
		formatBytes,
		formatCount,
		supportsWebGL,
		type SceneEvidence,
		type Specimen
	} from './specimens';

	interface Props {
		specimen: Specimen;
		/** Start loading as soon as the stage is on screen instead of waiting for a click. */
		autoload?: boolean;
		plate: string;
	}

	interface RuntimeComponent {
		start?: () => void;
		stop?: () => void;
		outs?: {
			sceneLoaded?: { value: boolean };
			busy?: { value: boolean };
		};
	}

	interface RuntimeViewer extends VoyagerElement {
		application?: {
			system?: { components?: { get?: (type: string) => RuntimeComponent | undefined } };
		};
	}

	type Phase = 'poster' | 'loading' | 'ready' | 'error' | 'unsupported';

	let { specimen, autoload = false, plate }: Props = $props();

	const LOAD_TIMEOUT_MS = 60_000;
	const resourceRoot = getVoyagerResourceRoot(DEFAULT_VOYAGER_VERSION);
	const scriptUrl = `${resourceRoot}js/voyager-explorer.min.js`;

	let stage = $state<HTMLDivElement>();
	let viewer = $state<RuntimeViewer>();
	let phase = $state<Phase>('poster');
	let mounted = $state(false);
	let problem = $state('');
	let evidence = $state<SceneEvidence | null>(null);
	let engaged = false;
	let inView = false;
	let pageVisible = true;
	let disposed = false;
	let readyTimer: ReturnType<typeof setTimeout> | undefined;
	const listeners = new AbortController();

	const statusText = $derived(
		phase === 'loading'
			? 'Loading the 3D model'
			: phase === 'ready'
				? 'Interactive 3D model ready'
				: phase === 'error'
					? 'The 3D model could not be shown'
					: phase === 'unsupported'
						? '3D is not available in this browser'
						: ''
	);

	function runtime(type: string) {
		return viewer?.application?.system?.components?.get?.(type);
	}

	/** Render only while the stage is on screen and the tab is visible. */
	function syncPulse() {
		if (phase !== 'ready') return;
		const pulse = runtime('CPulse');
		if (inView && pageVisible) pulse?.start?.();
		else pulse?.stop?.();
	}

	function fail(message: string) {
		if (disposed || phase === 'ready') return;
		problem = message;
		phase = 'error';
		release();
	}

	function waitForScene(startedAt = performance.now()) {
		if (disposed || phase !== 'loading') return;
		const loaded = runtime('CVViewer')?.outs?.sceneLoaded?.value;
		const busy = runtime('CVAssetManager')?.outs?.busy?.value;
		if (loaded && busy === false) {
			phase = 'ready';
			syncPulse();
			return;
		}
		if (performance.now() - startedAt > LOAD_TIMEOUT_MS) {
			fail('The model is taking too long to load.');
			return;
		}
		readyTimer = setTimeout(() => waitForScene(startedAt), 200);
	}

	async function activate() {
		if (phase !== 'poster' || disposed) return;
		if (!supportsWebGL()) {
			phase = 'unsupported';
			return;
		}
		phase = 'loading';
		try {
			await ensureViewerScript(document, customElements, scriptUrl);
		} catch (error) {
			fail(error instanceof Error ? error.message : 'The 3D viewer could not be loaded.');
			return;
		}
		if (disposed) return;
		mounted = true;
		await tick();
		if (!viewer || disposed) return;
		const onError = () => fail('The model files could not be loaded.');
		viewer.addEventListener('error', onError, { signal: listeners.signal });
		viewer.addEventListener('load-error', onError, { signal: listeners.signal });
		waitForScene();
	}

	function readOrbit(): [number, number] {
		const value = viewer?.getCameraOrbit?.('active');
		const pair = Array.isArray(value)
			? value
			: value && typeof value === 'object'
				? [(value as { yaw?: unknown }).yaw, (value as { pitch?: unknown }).pitch]
				: [];
		const yaw = Number(pair[0]);
		const pitch = Number(pair[1]);
		return [Number.isFinite(yaw) ? yaw : 0, Number.isFinite(pitch) ? pitch : -20];
	}

	function orbit(deltaYaw: number, deltaPitch: number) {
		if (phase !== 'ready') return;
		const [yaw, pitch] = readOrbit();
		viewer?.setCameraOrbit?.(yaw + deltaYaw, Math.max(-85, Math.min(85, pitch + deltaPitch)));
	}

	function resetView() {
		if (phase === 'ready') viewer?.resetViewer?.();
	}

	/** Scrolling past the hero must not zoom the model until the reader has engaged with it. */
	function keepPageScroll(event: WheelEvent) {
		if (!engaged) event.stopPropagation();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.target !== event.currentTarget || phase !== 'ready') return;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-15, 0],
			ArrowRight: [15, 0],
			ArrowUp: [0, 10],
			ArrowDown: [0, -10]
		};
		const move = moves[event.key];
		if (move) {
			event.preventDefault();
			orbit(...move);
		} else if (event.key === 'Home') {
			event.preventDefault();
			resetView();
		}
	}

	/** Stop rendering and hand the WebGL context back to the browser. */
	function release() {
		clearTimeout(readyTimer);
		runtime('CPulse')?.stop?.();
		const canvas = viewer?.shadowRoot?.querySelector('canvas');
		const context = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
		context?.getExtension('WEBGL_lose_context')?.loseContext();
	}

	async function loadEvidence(signal: AbortSignal) {
		try {
			evidence = await fetchSceneEvidence(specimen, signal);
		} catch {
			evidence = null;
		}
	}

	onMount(() => {
		const evidenceRequest = new AbortController();
		void loadEvidence(evidenceRequest.signal);

		const observer = new IntersectionObserver(
			([entry]) => {
				inView = entry.isIntersecting;
				syncPulse();
				if (inView && autoload) void activate();
			},
			{ rootMargin: '160px 0px' }
		);
		if (stage) observer.observe(stage);

		const onVisibility = () => {
			pageVisible = document.visibilityState === 'visible';
			syncPulse();
		};
		document.addEventListener('visibilitychange', onVisibility, { signal: listeners.signal });

		return () => {
			disposed = true;
			evidenceRequest.abort();
			observer.disconnect();
			listeners.abort();
			release();
		};
	});
</script>

<figure id="specimen-stage" aria-labelledby="specimen-stage-title">
	<!-- The stage hosts a WebGL canvas; arrow keys are the keyboard equivalent of dragging it. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={stage}
		class="stage"
		class:is-ready={phase === 'ready'}
		role="group"
		aria-label={`3D model of ${specimen.title}`}
		aria-describedby="specimen-stage-hint"
		tabindex={phase === 'ready' ? 0 : -1}
		onkeydown={handleKeydown}
		onpointerdown={() => (engaged = true)}
		onpointerleave={() => (engaged = false)}
		onwheelcapture={keepPageScroll}
	>
		<span class="crop crop-tl" aria-hidden="true"></span>
		<span class="crop crop-tr" aria-hidden="true"></span>
		<span class="crop crop-bl" aria-hidden="true"></span>
		<span class="crop crop-br" aria-hidden="true"></span>

		<div class="plate-bar" aria-hidden="true">
			<span>{plate}</span>
			<span class="live" class:is-live={phase === 'ready'}>
				{phase === 'ready' ? 'Live 3D' : 'Still'}
			</span>
		</div>

		{#if mounted}
			<voyager-explorer
				bind:this={viewer}
				class="runtime"
				root={specimen.root}
				resourceroot={resourceRoot}
				document={specimen.sceneFile}
				title={specimen.title}
				uimode="none"
				controls={true}
				prompt={false}
			></voyager-explorer>
		{/if}

		<img
			class="poster"
			src={specimen.cover}
			alt={phase === 'ready' ? '' : `Cover image of the edition ${specimen.title}`}
			aria-hidden={phase === 'ready'}
			decoding="async"
			fetchpriority="high"
		/>

		{#if phase === 'loading'}
			<div class="scan" aria-hidden="true"></div>
		{/if}

		{#if phase === 'poster'}
			<button type="button" class="activate" onclick={activate}>
				<span class="activate-ring" aria-hidden="true"></span>
				<span>Load interactive 3D model</span>
				{#if evidence?.bytes}
					<small>{formatBytes(evidence.bytes)} download</small>
				{/if}
			</button>
		{:else if phase === 'error' || phase === 'unsupported'}
			<div class="notice">
				<p>
					{phase === 'unsupported'
						? 'This browser cannot display WebGL, so the edition is shown as a still image.'
						: problem}
				</p>
				<a href={resolve('/editions/[slug]', { slug: specimen.id })}>Open the full edition</a>
			</div>
		{/if}

		<p class="sr-only" role="status" aria-live="polite">{statusText}</p>
	</div>

	{#if phase === 'ready'}
		<div class="controls" role="toolbar" aria-label="Model view">
			<button type="button" onclick={() => orbit(-15, 0)} aria-label="Rotate left">←</button>
			<button type="button" onclick={() => orbit(15, 0)} aria-label="Rotate right">→</button>
			<button type="button" onclick={() => orbit(0, 10)} aria-label="Tilt up">↑</button>
			<button type="button" onclick={() => orbit(0, -10)} aria-label="Tilt down">↓</button>
			<button type="button" class="reset" onclick={resetView}>Reset view</button>
		</div>
	{/if}
	<p id="specimen-stage-hint" class="hint">
		{phase === 'ready'
			? 'Drag to rotate; pinch, or click and scroll, to zoom. Arrow keys rotate the focused model; Home resets.'
			: 'A published edition from the Pure3D catalogue, shown with its own Voyager scene.'}
	</p>

	<figcaption class="label">
		<div class="label-head">
			<span class="label-kicker">Edition</span>
			<h2 id="specimen-stage-title">
				<a href={resolve('/editions/[slug]', { slug: specimen.id })}>{specimen.title}</a>
			</h2>
			{#if specimen.creators}<p class="creators">{specimen.creators}</p>{/if}
		</div>
		<dl class="record">
			{#if specimen.collectionTitle}
				<div>
					<dt>Collection</dt>
					<dd>{specimen.collectionTitle}</dd>
				</div>
			{/if}
			{#if specimen.period || specimen.place}
				<div>
					<dt>Coverage</dt>
					<dd>{[specimen.period, specimen.place].filter(Boolean).join(' · ')}</dd>
				</div>
			{/if}
			{#if specimen.license || specimen.rightsHolder}
				<div>
					<dt>Rights</dt>
					<dd>{[specimen.rightsHolder, specimen.license].filter(Boolean).join(' · ')}</dd>
				</div>
			{/if}
			{#if evidence}
				{#if evidence.faces}
					<div>
						<dt>Faces</dt>
						<dd>{formatCount(evidence.faces)}</dd>
					</div>
				{/if}
				{#if evidence.annotations || evidence.articles || evidence.tours}
					<div>
						<dt>Scene content</dt>
						<dd>
							{[
								evidence.annotations && `${evidence.annotations} annotations`,
								evidence.articles && `${evidence.articles} articles`,
								evidence.tours && `${evidence.tours} tours`
							]
								.filter(Boolean)
								.join(' · ')}
						</dd>
					</div>
				{/if}
				{#if evidence.generator || evidence.units}
					<div>
						<dt>Scene record</dt>
						<dd>
							{[evidence.generator, evidence.units && `units ${evidence.units}`]
								.filter(Boolean)
								.join(' · ')}
						</dd>
					</div>
				{/if}
				{#if evidence.copyright}
					<div>
						<dt>Scene copyright</dt>
						<dd>{evidence.copyright}</dd>
					</div>
				{/if}
			{/if}
		</dl>
	</figcaption>
</figure>

<style>
	#specimen-stage {
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
		background: radial-gradient(ellipse at 50% 58%, #2f3a35 0%, #141413 72%), var(--color-ink);
		box-shadow:
			0 40px 90px -30px rgba(20, 20, 19, 0.55),
			inset 0 0 0 1px rgba(244, 241, 235, 0.08);
	}
	.stage::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
		background-image:
			linear-gradient(rgba(244, 241, 235, 0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgba(244, 241, 235, 0.05) 1px, transparent 1px);
		background-size: 48px 48px;
		mask-image: radial-gradient(ellipse at center, transparent 40%, black 95%);
	}
	.stage:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 4px;
	}

	.runtime {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: block;
		width: 100%;
		height: 100%;
		contain: layout;
	}

	.poster {
		position: absolute;
		inset: 0;
		z-index: 2;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition:
			opacity 0.9s ease,
			transform 1.4s cubic-bezier(0.2, 0.7, 0.1, 1);
	}
	.is-ready .poster {
		opacity: 0;
		transform: scale(1.04);
		pointer-events: none;
	}

	.crop {
		position: absolute;
		z-index: 4;
		width: 22px;
		height: 22px;
		border-color: var(--color-vermillion);
		border-style: solid;
		border-width: 0;
		pointer-events: none;
		animation: crop-in 0.9s cubic-bezier(0.2, 0.7, 0.1, 1) 0.2s both;
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
	@keyframes crop-in {
		from {
			opacity: 0;
			scale: 1.8;
		}
	}

	.plate-bar {
		position: absolute;
		top: 18px;
		right: 48px;
		left: 48px;
		z-index: 4;
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
	.live {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.live::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(244, 241, 235, 0.4);
	}
	.live.is-live::before {
		background: var(--color-vermillion);
		box-shadow: 0 0 12px var(--color-vermillion);
	}

	.scan {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
		background: linear-gradient(
			180deg,
			transparent 0%,
			color-mix(in srgb, var(--color-vermillion) 28%, transparent) 49%,
			var(--color-vermillion) 50%,
			transparent 51%
		);
		background-size: 100% 220%;
		mix-blend-mode: screen;
		animation: scan 2.2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
	}
	@keyframes scan {
		from {
			background-position: 0 110%;
		}
		to {
			background-position: 0 -10%;
		}
	}

	.activate {
		position: absolute;
		left: 50%;
		bottom: 28px;
		z-index: 5;
		translate: -50% 0;
		display: inline-flex;
		align-items: center;
		gap: 12px;
		min-height: 48px;
		padding: 12px 20px 12px 14px;
		border: 1px solid rgba(244, 241, 235, 0.3);
		border-radius: 999px;
		background: rgba(20, 20, 19, 0.72);
		backdrop-filter: blur(10px);
		color: var(--color-paper);
		font: 500 14px/1.2 var(--font-sans);
		white-space: nowrap;
		cursor: pointer;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}
	.activate:hover {
		background: rgba(20, 20, 19, 0.9);
		border-color: var(--color-paper);
	}
	.activate:focus-visible,
	.controls button:focus-visible,
	.notice a:focus-visible,
	.label a:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 3px;
	}
	.activate small {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		color: rgba(244, 241, 235, 0.6);
	}
	.activate-ring {
		position: relative;
		width: 22px;
		height: 22px;
		border: 1.5px solid var(--color-vermillion);
		border-radius: 50%;
	}
	.activate-ring::after {
		content: '';
		position: absolute;
		inset: 5px;
		border-radius: 50%;
		background: var(--color-vermillion);
		animation: breathe 2.4s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			scale: 0.55;
			opacity: 0.6;
		}
	}

	.notice {
		position: absolute;
		inset: auto 20px 24px;
		z-index: 5;
		padding: 16px 18px;
		border-radius: var(--radius-control);
		background: rgba(20, 20, 19, 0.86);
		color: var(--color-paper);
		font: 400 15px/1.45 var(--font-serif);
	}
	.notice p {
		margin: 0 0 8px;
	}
	.notice a {
		color: #f4b5a0;
		font-family: var(--font-sans);
		font-weight: 500;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.controls button {
		min-width: 44px;
		min-height: 44px;
		padding: 0 14px;
		border: 1px solid color-mix(in srgb, var(--color-base-content) 20%, transparent);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font: 500 14px/1 var(--font-sans);
		cursor: pointer;
	}
	.controls button:hover {
		border-color: var(--color-ink);
	}
	.controls .reset {
		margin-left: auto;
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
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		gap: 20px 28px;
		padding: 20px 0 0;
		border-top: 1px solid color-mix(in srgb, var(--color-base-content) 20%, transparent);
	}
	.label-kicker {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-vermillion-ink);
	}
	.label h2 {
		margin: 6px 0 4px;
		font: 500 22px/1.15 var(--font-sans);
		letter-spacing: -0.015em;
		text-wrap: balance;
	}
	.label h2 a {
		color: var(--color-ink);
		text-decoration: none;
		background: linear-gradient(currentColor, currentColor) 0 100% / 0 1px no-repeat;
		transition: background-size 0.3s ease;
	}
	.label h2 a:hover {
		background-size: 100% 1px;
	}
	.creators {
		margin: 0;
		font: italic 400 15px/1.4 var(--font-serif);
		color: var(--color-ink-3);
	}
	.record {
		margin: 0;
		display: grid;
		gap: 8px;
		align-content: start;
	}
	.record div {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr);
		gap: 12px;
	}
	.record dt {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-4);
		padding-top: 2px;
	}
	.record dd {
		margin: 0;
		font-size: 14px;
		line-height: 1.4;
		color: var(--color-ink-2);
		overflow-wrap: anywhere;
	}

	@media (max-width: 640px) {
		.stage {
			aspect-ratio: 1;
		}
		.label {
			grid-template-columns: 1fr;
		}
		.activate {
			bottom: 20px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.crop,
		.activate-ring::after,
		.scan {
			animation: none;
		}
		.scan {
			opacity: 0.35;
			background-position: 0 50%;
		}
		.poster,
		.label h2 a {
			transition: none;
		}
		.is-ready .poster {
			transform: none;
		}
	}
</style>
