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
	}

	let {
		url,
		document: documentPath,
		title,
		direct = false,
		showControls = false
	}: Props = $props();

	let voyagerElement: HTMLElement | undefined = $state();
	let isScriptLoaded = $state(false);
	let annotations = $state<any[]>([]);
	let articles = $state<any[]>([]);

	// Camera orbit state
	let cameraYaw = $state(0);
	let cameraPitch = $state(-25);

	onMount(async () => {
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
		} catch (err) {
			console.error('Error loading content:', err);
		}
	}

	// API Methods
	function setCameraOrbit() {
		if (!voyagerElement) return;
		(voyagerElement as any).setCameraOrbit?.(cameraYaw, cameraPitch);
	}

	function setActiveAnnotation(id: string) {
		if (!voyagerElement) return;
		(voyagerElement as any).setActiveAnnotation?.(id);
	}

	function setActiveArticle(id: string) {
		if (!voyagerElement) return;
		(voyagerElement as any).setActiveArticle?.(id);
	}

	function toggleAnnotations() {
		if (!voyagerElement) return;
		(voyagerElement as any).toggleAnnotations?.();
	}

	function toggleReader() {
		if (!voyagerElement) return;
		(voyagerElement as any).toggleReader?.();
	}

	function toggleTours() {
		if (!voyagerElement) return;
		(voyagerElement as any).toggleTours?.();
	}

	function resetCamera() {
		cameraYaw = 0;
		cameraPitch = -25;
		setCameraOrbit();
	}
</script>

{#if direct}
	<!-- Direct Embedding Mode with Full API Control -->
	<div class="voyager-container">
		{#if showControls && isScriptLoaded}
			<!-- Control Toolbar -->
			<div class="voyager-controls card bg-base-300 shadow-lg p-4 mb-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Camera Controls -->
					<div class="space-y-2">
						<h3 class="font-semibold text-sm">Camera Control</h3>
						<div class="form-control">
							<label class="label py-1">
								<span class="label-text text-xs">Yaw: {cameraYaw}°</span>
							</label>
							<input
								type="range"
								min="-180"
								max="180"
								bind:value={cameraYaw}
								onchange={setCameraOrbit}
								class="range range-xs"
							/>
						</div>
						<div class="form-control">
							<label class="label py-1">
								<span class="label-text text-xs">Pitch: {cameraPitch}°</span>
							</label>
							<input
								type="range"
								min="-90"
								max="90"
								bind:value={cameraPitch}
								onchange={setCameraOrbit}
								class="range range-xs"
							/>
						</div>
						<button class="btn btn-sm btn-outline w-full" onclick={resetCamera}>
							Reset Camera
						</button>
					</div>

					<!-- Display Toggles -->
					<div class="space-y-2">
						<h3 class="font-semibold text-sm">Display Controls</h3>
						<div class="flex flex-col gap-2">
							<button class="btn btn-sm btn-outline" onclick={toggleAnnotations}>
								Toggle Annotations
							</button>
							<button class="btn btn-sm btn-outline" onclick={toggleReader}>
								Toggle Reader
							</button>
							<button class="btn btn-sm btn-outline" onclick={toggleTours}>
								Toggle Tours
							</button>
						</div>
					</div>
				</div>

				<!-- Annotations List -->
				{#if annotations.length > 0}
					<div class="mt-4">
						<h3 class="font-semibold text-sm mb-2">Annotations</h3>
						<div class="flex flex-wrap gap-2">
							{#each annotations as annotation}
								<button
									class="badge badge-primary badge-lg cursor-pointer"
									onclick={() => setActiveAnnotation(annotation.id)}
								>
									{annotation.title || annotation.id}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Articles List -->
				{#if articles.length > 0}
					<div class="mt-4">
						<h3 class="font-semibold text-sm mb-2">Articles</h3>
						<div class="flex flex-wrap gap-2">
							{#each articles as article}
								<button
									class="badge badge-secondary badge-lg cursor-pointer"
									onclick={() => setActiveArticle(article.id)}
								>
									{article.title || article.id}
								</button>
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
				/>
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
