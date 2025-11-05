<script lang="ts">
	/**
	 * VoyagerViewer Component
	 *
	 * This component provides two modes for displaying Voyager 3D content:
	 *
	 * 1. IFRAME MODE (default): Uses Smithsonian's hosted Voyager
	 *    - Simple embedding via iframe
	 *    - No programmatic control (cross-origin restrictions)
	 *    - Best for displaying Smithsonian collection items
	 *
	 * 2. DIRECT MODE: Embeds Voyager component directly
	 *    - Full API access for programmatic control
	 *    - Requires self-hosted or CORS-enabled content
	 *    - Enables camera control, annotation management, etc.
	 */

	import { onMount } from 'svelte';

	interface Props {
		/** URL for iframe mode OR root path for direct mode */
		url: string;
		/** Document path (only for direct mode) */
		document?: string;
		/** Title for accessibility */
		title: string;
		/** Use direct embedding instead of iframe */
		direct?: boolean;
		/** Show control toolbar (only available in direct mode) */
		showControls?: boolean;
		/** UI mode - controls which UI elements are visible initially (e.g., "none", "none|title", "all") */
		uiMode?: string;
		/** Enable/disable camera controls */
		enableControls?: boolean;
		/** Show/hide interaction prompt */
		showPrompt?: boolean;
		/** Show/hide reader initially */
		showReader?: boolean;
	}

	let {
		url,
		document: documentPath,
		title,
		direct = false,
		showControls = false,
		uiMode = 'none',
		enableControls = true,
		showPrompt = false,
		showReader = false
	}: Props = $props();

	let voyagerElement: HTMLElement | undefined = $state();
	let isScriptLoaded = $state(false);
	let annotations = $state<any[]>([]);
	let articles = $state<any[]>([]);
	let tours = $state<any[]>([]);

	// Camera orbit state
	let cameraYaw = $state(0);
	let cameraPitch = $state(-25);

	// Camera offset state
	let cameraOffsetX = $state(0);
	let cameraOffsetY = $state(0);
	let cameraOffsetZ = $state(0);

	// Language state
	let selectedLanguage = $state('EN');

	// UI visibility toggle
	let showVoyagerUI = $state(false);

	onMount(() => {
		if (direct) {
			// Load Voyager Explorer script from locally hosted version
			const script = document.createElement('script');
			script.src = '/voyager/js/voyager-explorer.min.js';
			script.onload = () => {
				isScriptLoaded = true;
				// Wait for element to be created and initialized
				setTimeout(loadContent, 500);
			};
			document.head.appendChild(script);

			return () => {
				// Cleanup script
				document.head.removeChild(script);
			};
		}
	});

	function loadContent() {
		if (!voyagerElement) return;

		// Listen for model load event
		voyagerElement.addEventListener('model-load', (e: any) => {
			console.log('Model loaded:', e.detail);
			// Load available content
			getContent();
		});

		// Listen for annotation changes
		voyagerElement.addEventListener('annotation-active', (e: any) => {
			console.log('Active annotation:', e.detail);
		});
	}

	function getContent() {
		if (!voyagerElement || typeof (voyagerElement as any).getAnnotations !== 'function') return;

		try {
			const annots = (voyagerElement as any).getAnnotations();
			if (annots) annotations = annots;

			const arts = (voyagerElement as any).getArticles();
			if (arts) articles = arts;

			const toursData = (voyagerElement as any).getTours?.();
			if (toursData) tours = toursData;
		} catch (err) {
			console.error('Error loading content:', err);
		}
	}

	// API Methods - Camera Control
	function setCameraOrbit() {
		if (!voyagerElement) return;
		(voyagerElement as any).setCameraOrbit?.(cameraYaw, cameraPitch);
	}

	function getCameraOrbit(type?: string) {
		if (!voyagerElement) return;
		return (voyagerElement as any).getCameraOrbit?.(type);
	}

	function setCameraOffset(x: number, y: number, z: number) {
		if (!voyagerElement) return;
		(voyagerElement as any).setCameraOffset?.(x, y, z);
	}

	function applyCameraOffset() {
		setCameraOffset(cameraOffsetX, cameraOffsetY, cameraOffsetZ);
	}

	function getCameraOffset(type?: string) {
		if (!voyagerElement) return;
		return (voyagerElement as any).getCameraOffset?.(type);
	}

	function resetCamera() {
		cameraYaw = 0;
		cameraPitch = -25;
		cameraOffsetX = 0;
		cameraOffsetY = 0;
		cameraOffsetZ = 0;
		setCameraOrbit();
		applyCameraOffset();
	}

	function getCurrentCameraPosition() {
		if (!voyagerElement) return;
		const orbit = getCameraOrbit('active');
		const offset = getCameraOffset('active');
		console.log('Camera Orbit:', orbit);
		console.log('Camera Offset:', offset);
		alert(`Camera Position:\nOrbit: ${JSON.stringify(orbit)}\nOffset: ${JSON.stringify(offset)}`);
	}

	// API Methods - Annotations
	function setActiveAnnotation(id: string) {
		if (!voyagerElement) return;
		// Make sure annotations are visible first
		const annotationsVisible = (voyagerElement as any).getAnnotationsVisible?.();
		if (annotationsVisible === false) {
			(voyagerElement as any).toggleAnnotations?.();
		}
		(voyagerElement as any).setActiveAnnotation?.(id);
	}

	function toggleAnnotations() {
		if (!voyagerElement) return;
		(voyagerElement as any).toggleAnnotations?.();
	}

	// API Methods - Articles
	function setActiveArticle(id: string) {
		if (!voyagerElement) return;
		// Show reader if hidden, then set active article
		const readerElement = (voyagerElement as any).querySelector?.('.sv-reader');
		if (!readerElement || readerElement.style.display === 'none') {
			(voyagerElement as any).toggleReader?.();
		}
		(voyagerElement as any).setActiveArticle?.(id);
	}

	function toggleReader() {
		if (!voyagerElement) return;
		(voyagerElement as any).toggleReader?.();
	}

	function openArticle(id: string) {
		if (!voyagerElement) return;
		console.log('📖 Opening article:', id);

		// Just set the active article - user should toggle reader manually
		try {
			(voyagerElement as any).setActiveArticle?.(id);
			console.log('✅ Article activated. Toggle Reader to view.');
		} catch (err) {
			console.error('❌ Error opening article:', err);
		}
	}

	// API Methods - Tours
	function setTourStep(tourIdx: number, stepIdx: number, interpolate?: boolean) {
		if (!voyagerElement) return;
		(voyagerElement as any).setTourStep?.(tourIdx, stepIdx, interpolate);
	}

	function toggleTours() {
		if (!voyagerElement) return;
		(voyagerElement as any).toggleTours?.();
	}

	// API Methods - UI Controls
	function toggleTools() {
		if (!voyagerElement) return;
		(voyagerElement as any).toggleTools?.();
	}

	function toggleMeasurement() {
		if (!voyagerElement) return;
		(voyagerElement as any).toggleMeasurement?.();
	}

	function setBackgroundStyle(style: 'Solid' | 'LinearGradient' | 'RadialGradient') {
		if (!voyagerElement) return;
		(voyagerElement as any).setBackgroundStyle?.(style);
	}

	function setBackgroundColor(color0: string, color1?: string) {
		if (!voyagerElement) return;
		(voyagerElement as any).setBackgroundColor?.(color0, color1);
	}

	function setLanguage(languageCode: string) {
		if (!voyagerElement) return;
		selectedLanguage = languageCode;
		(voyagerElement as any).setLanguage?.(languageCode);
	}

	function enableAR() {
		if (!voyagerElement) return;
		(voyagerElement as any).enableAR?.();
	}

	// Available languages
	const languages = [
		{ code: 'EN', name: 'English' },
		{ code: 'ES', name: 'Español' },
		{ code: 'FR', name: 'Français' },
		{ code: 'DE', name: 'Deutsch' },
		{ code: 'IT', name: 'Italiano' },
		{ code: 'NL', name: 'Nederlands' },
		{ code: 'JA', name: '日本語' },
		{ code: 'AR', name: 'العربية' }
	];

	function toggleVoyagerUI() {
		showVoyagerUI = !showVoyagerUI;
		// Re-mount the voyager element with new uiMode
		isScriptLoaded = false;
		setTimeout(() => {
			isScriptLoaded = true;
			setTimeout(loadContent, 500);
		}, 100);
	}
</script>

{#if direct}
	<!-- Direct Embedding Mode with Full API Control -->
	<div class="voyager-container">
		{#if showControls && isScriptLoaded}
			<!-- Global UI Toggle -->
			<div class="mb-4">
				<button
					class="btn btn-lg btn-block {showVoyagerUI ? 'btn-warning' : 'btn-success'}"
					onclick={toggleVoyagerUI}
				>
					{showVoyagerUI ? 'Hide Voyager UI' : 'Show Voyager UI'}
				</button>
				<div class="text-xs text-center mt-2 text-base-content/60">
					{showVoyagerUI
						? 'Full Voyager interface visible'
						: 'Clean API-controlled mode'}
				</div>
			</div>

			<!-- Control Toolbar -->
			<div class="voyager-controls card bg-base-300 shadow-lg p-4 mb-4">
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<!-- Camera Orbit Controls -->
					<div class="space-y-2">
						<h3 class="font-semibold text-sm">Camera Orbit</h3>
						<div class="form-control">
							<div class="label py-1">
								<span class="label-text text-xs">Yaw: {cameraYaw}°</span>
							</div>
							<input
								type="range"
								min="-180"
								max="180"
								bind:value={cameraYaw}
								onchange={setCameraOrbit}
								class="range range-xs"
								aria-label="Camera yaw angle"
							/>
						</div>
						<div class="form-control">
							<div class="label py-1">
								<span class="label-text text-xs">Pitch: {cameraPitch}°</span>
							</div>
							<input
								type="range"
								min="-90"
								max="90"
								bind:value={cameraPitch}
								onchange={setCameraOrbit}
								class="range range-xs"
								aria-label="Camera pitch angle"
							/>
						</div>
					</div>

					<!-- Camera Offset Controls -->
					<div class="space-y-2">
						<h3 class="font-semibold text-sm">Camera Offset</h3>
						<div class="form-control">
							<div class="label py-0">
								<span class="label-text text-xs">X: {cameraOffsetX.toFixed(1)}</span>
							</div>
							<input
								type="range"
								min="-5"
								max="5"
								step="0.1"
								bind:value={cameraOffsetX}
								onchange={applyCameraOffset}
								class="range range-xs"
								aria-label="Camera X offset"
							/>
						</div>
						<div class="form-control">
							<div class="label py-0">
								<span class="label-text text-xs">Y: {cameraOffsetY.toFixed(1)}</span>
							</div>
							<input
								type="range"
								min="-5"
								max="5"
								step="0.1"
								bind:value={cameraOffsetY}
								onchange={applyCameraOffset}
								class="range range-xs"
								aria-label="Camera Y offset"
							/>
						</div>
						<div class="form-control">
							<div class="label py-0">
								<span class="label-text text-xs">Z: {cameraOffsetZ.toFixed(1)}</span>
							</div>
							<input
								type="range"
								min="-5"
								max="5"
								step="0.1"
								bind:value={cameraOffsetZ}
								onchange={applyCameraOffset}
								class="range range-xs"
								aria-label="Camera Z offset"
							/>
						</div>
					</div>

					<!-- Camera Actions -->
					<div class="space-y-2">
						<h3 class="font-semibold text-sm">Camera Actions</h3>
						<button class="btn btn-sm btn-outline w-full" onclick={resetCamera}>
							Reset Camera
						</button>
						<button class="btn btn-sm btn-outline w-full" onclick={getCurrentCameraPosition}>
							Get Position
						</button>
					</div>
				</div>

				<!-- Language & Display Controls -->
				<div class="grid md:grid-cols-2 gap-4 mt-4">
					<!-- Language Selector -->
					<div class="space-y-2">
						<h3 class="font-semibold text-sm">Language</h3>
						<select
							class="select select-sm select-bordered w-full"
							bind:value={selectedLanguage}
							onchange={() => setLanguage(selectedLanguage)}
						>
							{#each languages as lang}
								<option value={lang.code}>{lang.name}</option>
							{/each}
						</select>
					</div>

					<!-- Display Toggles -->
					<div class="space-y-2">
						<h3 class="font-semibold text-sm">Display Toggles</h3>
						<div class="grid grid-cols-2 gap-2">
							<button class="btn btn-xs btn-outline" onclick={toggleAnnotations}>
								Annotations
							</button>
							<button class="btn btn-xs btn-outline" onclick={toggleReader}>
								Reader
							</button>
							<button class="btn btn-xs btn-outline" onclick={toggleTours}>
								Tours
							</button>
							<button class="btn btn-xs btn-outline" onclick={toggleTools}>
								Tools
							</button>
							<button class="btn btn-xs btn-outline" onclick={toggleMeasurement}>
								Measurement
							</button>
							<button class="btn btn-xs btn-outline" onclick={enableAR}>
								AR Mode
							</button>
						</div>
					</div>
				</div>

				<!-- Background Controls -->
				<div class="mt-4 grid md:grid-cols-2 gap-4">
					<div class="space-y-2">
						<h3 class="font-semibold text-sm">Background Style</h3>
						<div class="flex gap-2">
							<button
								class="btn btn-xs btn-outline flex-1"
								onclick={() => setBackgroundStyle('Solid')}
							>
								Solid
							</button>
							<button
								class="btn btn-xs btn-outline flex-1"
								onclick={() => setBackgroundStyle('LinearGradient')}
							>
								Linear
							</button>
							<button
								class="btn btn-xs btn-outline flex-1"
								onclick={() => setBackgroundStyle('RadialGradient')}
							>
								Radial
							</button>
						</div>
					</div>
					<div class="space-y-2">
						<h3 class="font-semibold text-sm">Quick Colors</h3>
						<div class="flex gap-2">
							<button
								class="btn btn-xs btn-outline flex-1"
								onclick={() => setBackgroundColor('#1a1a1a', '#0a0a0a')}
							>
								Dark
							</button>
							<button
								class="btn btn-xs btn-outline flex-1"
								onclick={() => setBackgroundColor('#ffffff', '#e0e0e0')}
							>
								Light
							</button>
							<button
								class="btn btn-xs btn-outline flex-1"
								onclick={() => setBackgroundColor('#1e3a8a', '#0c1d3f')}
							>
								Blue
							</button>
						</div>
					</div>
				</div>

				<!-- Annotations List -->
				{#if annotations.length > 0}
					<div class="mt-4">
						<h3 class="font-semibold text-sm mb-2">Annotations ({annotations.length})</h3>
						<div class="flex flex-wrap gap-2">
							{#each annotations as annotation}
								<button
									class="badge badge-primary badge-lg cursor-pointer hover:badge-accent"
									onclick={() => setActiveAnnotation(annotation.id)}
								>
									{annotation.titles?.EN || annotation.titles?.en || annotation.title || annotation.name || annotation.id}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Articles List -->
				{#if articles.length > 0}
					<div class="mt-4">
						<h3 class="font-semibold text-sm mb-2">Articles ({articles.length})</h3>
						<div class="flex flex-wrap gap-2">
							{#each articles as article}
								<button
									class="badge badge-secondary badge-lg cursor-pointer hover:badge-accent"
									onclick={() => openArticle(article.id)}
								>
									{article.titles?.EN || article.titles?.en || article.title || article.name || article.id}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Tours List -->
				{#if tours.length > 0}
					<div class="mt-4">
						<h3 class="font-semibold text-sm mb-2">Tours</h3>
						<div class="space-y-2">
							{#each tours as tour, tourIdx}
								<div class="card bg-base-200 p-2">
									<div class="font-semibold text-xs mb-1">
										{tour.title || tour.titles?.EN || `Tour ${tourIdx + 1}`}
									</div>
									{#if tour.steps && tour.steps.length > 0}
										<div class="flex flex-wrap gap-1">
											{#each tour.steps as step, stepIdx}
												<button
													class="btn btn-xs btn-outline"
													onclick={() => setTourStep(tourIdx, stepIdx, true)}
													title={step.title || step.titles?.EN || `Step ${stepIdx + 1}`}
												>
													{stepIdx + 1}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Voyager Explorer Component -->
		<div class="relative w-full bg-gradient-to-b from-slate-700 to-slate-900" style="padding-top: 75%;">
			{#if isScriptLoaded}
				<voyager-explorer
					bind:this={voyagerElement}
					id="voyager"
					class="absolute top-0 left-0 w-full h-full"
					root={url}
					document={documentPath || 'document.json'}
					{title}
					uimode={showVoyagerUI ? 'all' : uiMode}
					controls={enableControls}
					prompt={showPrompt}
				></voyager-explorer>
			{:else}
				<div class="absolute inset-0 flex items-center justify-center">
					<div class="loading loading-spinner loading-lg"></div>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<!-- Iframe Mode (No API Control) -->
	<div class="relative w-full" style="padding-top: 75%; background: radial-gradient(ellipse at center, #35424F 0%, #03070B 100%);">
		<iframe
			name="Smithsonian Voyager"
			src={url}
			{title}
			class="absolute top-0 left-0 w-full h-full border-0"
			loading="eager"
			allow="xr; xr-spatial-tracking; fullscreen"
		></iframe>
	</div>
{/if}

<style>
	/* Custom element styles */
	:global(voyager-explorer) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
