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
	import toast from 'svelte-french-toast';

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
		/** Voyager version (e.g., "0.56.2") - determines which Voyager script to load */
		voyagerVersion?: string;
		/** Resource root path for Voyager assets (fonts, css, images, language) */
		resourceRoot?: string;
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
		showReader = false,
		voyagerVersion = '0.56.2',
		resourceRoot
	}: Props = $props();

	let voyagerElement: HTMLElement | undefined = $state();
	let isScriptLoaded = $state(false);
	let hasError = $state(false);
	let errorMessage = $state('');
	let annotations = $state<any[]>([]);
	let articles = $state<any[]>([]);
	let tours = $state<any[]>([]);

	// Loading progress state
	let loadingProgress = $state(0);
	let loadingPhase = $state<'script' | 'document' | 'model' | 'complete'>('script');
	let totalBytes = $state(0);
	let loadedBytes = $state(0);
	let cleanupFetchInterceptor: (() => void) | null = null;

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

	// Format bytes to human readable string
	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	// Install fetch interceptor to track download progress
	function installFetchInterceptor(): () => void {
		const originalFetch = window.fetch;
		const trackedExtensions = [
			'.glb',
			'.gltf',
			'.bin',
			'.jpg',
			'.jpeg',
			'.png',
			'.webp',
			'.ktx2',
			'.draco'
		];

		window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
			const shouldTrack = trackedExtensions.some((ext) => url.toLowerCase().includes(ext));

			if (!shouldTrack) {
				return originalFetch(input, init);
			}

			// First asset request detected - switch to model loading phase
			if (loadingPhase === 'document') {
				loadingPhase = 'model';
			}

			const response = await originalFetch(input, init);
			const contentLength = response.headers.get('content-length');

			// If no content-length or no body, return original response
			if (!contentLength || !response.body) {
				return response;
			}

			const fileSize = parseInt(contentLength);
			totalBytes += fileSize;

			const reader = response.body.getReader();
			const stream = new ReadableStream({
				async start(controller) {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						loadedBytes += value.length;
						loadingProgress = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;
						controller.enqueue(value);
					}
					controller.close();
				}
			});

			return new Response(stream, {
				headers: response.headers,
				status: response.status,
				statusText: response.statusText
			});
		};

		// Return cleanup function
		return () => {
			window.fetch = originalFetch;
		};
	}

	onMount(() => {
		if (direct) {
			// Reset progress state
			loadingProgress = 0;
			totalBytes = 0;
			loadedBytes = 0;
			loadingPhase = 'script';

			// Install fetch interceptor before loading Voyager
			cleanupFetchInterceptor = installFetchInterceptor();

			// Compute script URL based on resourceRoot or voyagerVersion
			const scriptUrl = resourceRoot
				? `${resourceRoot}js/voyager-explorer.min.js`
				: `/voyager/${voyagerVersion}/js/voyager-explorer.min.js`;

			// Load Voyager Explorer script
			const script = document.createElement('script');
			script.src = scriptUrl;
			script.onload = () => {
				isScriptLoaded = true;
				loadingPhase = 'document';
				// Wait for element to be created and initialized
				setTimeout(loadContent, 500);
			};
			document.head.appendChild(script);

			return () => {
				// Cleanup fetch interceptor
				if (cleanupFetchInterceptor) {
					cleanupFetchInterceptor();
					cleanupFetchInterceptor = null;
				}
				// Cleanup script
				document.head.removeChild(script);
			};
		}
	});

	function loadContent() {
		if (!voyagerElement) return;

		// Fix Voyager modal z-index to appear above sticky header (Shadow DOM)
		fixVoyagerModalZIndex();

		// Listen for model load event
		voyagerElement.addEventListener('model-load', (e: any) => {
			console.log('Model loaded:', e.detail);
			hasError = false;
			loadingPhase = 'complete';
			loadingProgress = 100;

			// Clean up fetch interceptor after model loads
			if (cleanupFetchInterceptor) {
				cleanupFetchInterceptor();
				cleanupFetchInterceptor = null;
			}

			// Load available content
			getContent();
		});

		// Listen for annotation changes
		voyagerElement.addEventListener('annotation-active', (e: any) => {
			console.log('Active annotation:', e.detail);
		});

		// Listen for Voyager error events
		voyagerElement.addEventListener('error', handleVoyagerError);
		voyagerElement.addEventListener('load-error', handleVoyagerError);

		// Also listen for global errors that might come from Voyager
		const originalConsoleError = console.error;
		console.error = (...args) => {
			const message = args.join(' ');
			if (message.includes('Failed to load document') || message.includes('schema validation')) {
				handleVoyagerError({ detail: { message } });
			}
			originalConsoleError.apply(console, args);
		};
	}

	function fixVoyagerModalZIndex() {
		if (!voyagerElement) return;

		const shadowRoot = (voyagerElement as any).shadowRoot;
		if (shadowRoot) {
			// Inject styles into Shadow DOM to contain modal within viewer
			const style = document.createElement('style');
			style.textContent = `
				/* Contain modal within the viewer instead of full viewport */
				.ff-modal-plane {
					position: absolute !important;
				}
				/* Ensure popup appears above the modal backdrop */
				.ff-popup,
				.sv-splash,
				.ff-popup.sv-splash {
					z-index: 1001 !important;
				}
			`;
			shadowRoot.appendChild(style);
		}
	}

	function handleVoyagerError(e: any) {
		const message = e?.detail?.message || e?.message || 'Failed to load 3D model';
		hasError = true;
		errorMessage = message;
		toast.error(message, {
			duration: 5000,
			position: 'bottom-center',
			style: 'background: #1f2937; color: #f9fafb; border-radius: 0.5rem;'
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

		// Clean up existing fetch interceptor
		if (cleanupFetchInterceptor) {
			cleanupFetchInterceptor();
			cleanupFetchInterceptor = null;
		}

		// Reset loading state
		loadingProgress = 0;
		totalBytes = 0;
		loadedBytes = 0;
		loadingPhase = 'script';

		// Re-mount the voyager element with new uiMode
		isScriptLoaded = false;
		setTimeout(() => {
			// Reinstall fetch interceptor
			cleanupFetchInterceptor = installFetchInterceptor();
			isScriptLoaded = true;
			loadingPhase = 'document';
			setTimeout(loadContent, 500);
		}, 100);
	}
</script>

{#snippet progressBar()}
	{#if loadingPhase !== 'complete'}
		<div class="absolute bottom-0 left-0 right-0 z-10">
			<progress
				class="progress progress-primary h-1 w-full rounded-none"
				value={loadingPhase === 'model' ? loadingProgress : undefined}
				max="100"
			></progress>
		</div>
	{/if}
{/snippet}

{#if direct}
	<!-- Direct Embedding Mode with Full API Control -->
	<div class="voyager-container">
		{#if showControls && isScriptLoaded}
			<!-- Global UI Toggle -->
			<div class="mb-4">
				<button
					class="btn btn-block btn-lg {showVoyagerUI ? 'btn-warning' : 'btn-success'}"
					onclick={toggleVoyagerUI}
				>
					{showVoyagerUI ? 'Hide Voyager UI' : 'Show Voyager UI'}
				</button>
				<div class="mt-2 text-center text-xs text-base-content/60">
					{showVoyagerUI ? 'Full Voyager interface visible' : 'Clean API-controlled mode'}
				</div>
			</div>

			<!-- Two Column Layout: Viewer Left, Controls Right -->
			<div class="grid gap-4 lg:grid-cols-[1fr_400px]">
				<!-- Left Column: Viewer -->
				<div class="order-2 lg:order-1">
					<!-- Voyager Explorer Component -->
					<div
						class="relative w-full overflow-hidden rounded-lg bg-gradient-to-b from-slate-700 to-slate-900"
						style="padding-top: 75%;"
					>
						{#if isScriptLoaded}
							<voyager-explorer
								bind:this={voyagerElement}
								id="voyager"
								class="absolute top-0 left-0 h-full w-full"
								root={url}
								resourceroot={resourceRoot || `/voyager/${voyagerVersion}/`}
								document={documentPath || 'scene.svx.json'}
								{title}
								uimode={showVoyagerUI ? 'all' : uiMode}
								controls={enableControls}
								prompt={showPrompt}
							></voyager-explorer>
						{:else}
							<div class="absolute inset-0 flex items-center justify-center">
								<div class="loading loading-lg loading-spinner"></div>
							</div>
						{/if}
						{@render progressBar()}
					</div>
				</div>

				<!-- Right Column: Controls -->
				<div class="order-1 lg:order-2">
					<!-- Control Toolbar -->
					<div class="voyager-controls card max-h-[80vh] overflow-y-auto bg-base-300 p-4 shadow-lg">
						<div class="space-y-4">
							<!-- Camera Orbit Controls -->
							<div class="space-y-2">
								<h3 class="text-sm font-semibold">Camera Orbit</h3>
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

							<!-- Camera Actions -->
							<div class="space-y-2">
								<h3 class="text-sm font-semibold">Camera Actions</h3>
								<div class="flex gap-2">
									<button class="btn flex-1 btn-outline btn-sm" onclick={resetCamera}>
										Reset
									</button>
									<button class="btn flex-1 btn-outline btn-sm" onclick={getCurrentCameraPosition}>
										Get Position
									</button>
								</div>
							</div>

							<!-- Camera Offset Controls -->
							<div class="space-y-2">
								<h3 class="text-sm font-semibold">Camera Offset</h3>
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

							<!-- Language & Display Controls -->
							<div class="space-y-4">
								<!-- Language Selector -->
								<div class="space-y-2">
									<h3 class="text-sm font-semibold">Language</h3>
									<select
										class="select-bordered select w-full select-sm"
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
									<h3 class="text-sm font-semibold">Display Toggles</h3>
									<div class="grid grid-cols-3 gap-2">
										<button class="btn btn-outline btn-xs" onclick={toggleAnnotations}>
											Annotations
										</button>
										<button class="btn btn-outline btn-xs" onclick={toggleReader}> Reader </button>
										<button class="btn btn-outline btn-xs" onclick={toggleTours}> Tours </button>
										<button class="btn btn-outline btn-xs" onclick={toggleTools}> Tools </button>
										<button class="btn btn-outline btn-xs" onclick={toggleMeasurement}>
											Measurement
										</button>
										<button class="btn btn-outline btn-xs" onclick={enableAR}> AR Mode </button>
									</div>
								</div>
							</div>

							<!-- Background Controls -->
							<div class="space-y-2">
								<h3 class="text-sm font-semibold">Background Style</h3>
								<div class="mb-3 flex gap-2">
									<button
										class="btn flex-1 btn-outline btn-xs"
										onclick={() => setBackgroundStyle('Solid')}
									>
										Solid
									</button>
									<button
										class="btn flex-1 btn-outline btn-xs"
										onclick={() => setBackgroundStyle('LinearGradient')}
									>
										Linear
									</button>
									<button
										class="btn flex-1 btn-outline btn-xs"
										onclick={() => setBackgroundStyle('RadialGradient')}
									>
										Radial
									</button>
								</div>

								<h3 class="text-sm font-semibold">Quick Colors</h3>
								<div class="grid grid-cols-3 gap-2">
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#1a1a1a', '#0a0a0a')}
										title="Dark gray gradient"
									>
										Dark
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#ffffff', '#e0e0e0')}
										title="White to light gray"
									>
										Light
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#1e3a8a', '#0c1d3f')}
										title="Deep blue gradient"
									>
										Blue
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#7c3aed', '#4c1d95')}
										title="Purple gradient"
									>
										Purple
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#dc2626', '#7f1d1d')}
										title="Red gradient"
									>
										Red
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#059669', '#064e3b')}
										title="Green gradient"
									>
										Green
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#ea580c', '#7c2d12')}
										title="Orange gradient"
									>
										Orange
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#0891b2', '#164e63')}
										title="Cyan gradient"
									>
										Cyan
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#ec4899', '#831843')}
										title="Pink gradient"
									>
										Pink
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#eab308', '#713f12')}
										title="Gold gradient"
									>
										Gold
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#14b8a6', '#134e4a')}
										title="Teal gradient"
									>
										Teal
									</button>
									<button
										class="btn btn-outline btn-xs"
										onclick={() => setBackgroundColor('#f97316', '#9a3412')}
										title="Amber gradient"
									>
										Amber
									</button>
								</div>
							</div>

							<!-- Annotations List -->
							{#if annotations.length > 0}
								<div class="mt-4">
									<h3 class="mb-2 text-sm font-semibold">Annotations ({annotations.length})</h3>
									<div class="flex flex-wrap gap-2">
										{#each annotations as annotation}
											<button
												class="badge cursor-pointer badge-lg badge-primary hover:badge-accent"
												onclick={() => setActiveAnnotation(annotation.id)}
											>
												{annotation.titles?.EN ||
													annotation.titles?.en ||
													annotation.title ||
													annotation.name ||
													annotation.id}
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Articles List -->
							{#if articles.length > 0}
								<div class="mt-4">
									<h3 class="mb-2 text-sm font-semibold">Articles ({articles.length})</h3>
									<div class="flex flex-wrap gap-2">
										{#each articles as article}
											<button
												class="badge cursor-pointer badge-lg badge-secondary hover:badge-accent"
												onclick={() => openArticle(article.id)}
											>
												{article.titles?.EN ||
													article.titles?.en ||
													article.title ||
													article.name ||
													article.id}
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Tours List -->
							{#if tours.length > 0}
								<div class="mt-4">
									<h3 class="mb-2 text-sm font-semibold">Tours</h3>
									<div class="space-y-2">
										{#each tours as tour, tourIdx}
											<div class="card bg-base-200 p-2">
												<div class="mb-1 text-xs font-semibold">
													{tour.title || tour.titles?.EN || `Tour ${tourIdx + 1}`}
												</div>
												{#if tour.steps && tour.steps.length > 0}
													<div class="flex flex-wrap gap-1">
														{#each tour.steps as step, stepIdx}
															<button
																class="btn btn-outline btn-xs"
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
					</div>
				</div>
			</div>
		{:else}
			<!-- Direct Mode without Controls Panel -->
			<div
				class="relative w-full overflow-hidden rounded-lg"
				style="padding-top: 75%; background: radial-gradient(ellipse at center, #35424F 0%, #03070B 100%);"
			>
				{#if isScriptLoaded}
					<voyager-explorer
						bind:this={voyagerElement}
						id="voyager"
						class="absolute top-0 left-0 h-full w-full"
						root={url}
						resourceroot={resourceRoot || `/voyager/${voyagerVersion}/`}
						document={documentPath || 'scene.svx.json'}
						{title}
						uimode={uiMode}
						controls={enableControls}
						prompt={showPrompt}
					></voyager-explorer>
				{:else}
					<div class="absolute inset-0 flex items-center justify-center">
						<div class="loading loading-lg loading-spinner"></div>
					</div>
				{/if}
				{@render progressBar()}
			</div>
		{/if}
	</div>
{:else}
	<!-- Iframe Mode (No API Control) -->
	<div
		class="relative w-full"
		style="padding-top: 75%; background: radial-gradient(ellipse at center, #35424F 0%, #03070B 100%);"
	>
		<iframe
			name="Smithsonian Voyager"
			src={url}
			{title}
			class="absolute top-0 left-0 h-full w-full border-0"
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
		/* Contain fixed/absolute positioned children within the viewer */
		contain: layout;
		isolation: isolate;
	}

	/* Hide Voyager's built-in notification system - we use svelte-french-toast instead */
	:global(voyager-explorer .sv-notification),
	:global(voyager-explorer .ff-notification),
	:global(voyager-explorer .sv-notification-stack),
	:global(voyager-explorer .ff-notification-stack) {
		display: none !important;
	}
</style>
