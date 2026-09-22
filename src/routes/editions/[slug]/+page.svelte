<script lang="ts">
	import { creditHref, creatorNames, readCredits } from '$lib/utils/credits';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import VoyagerViewer, { type VoyagerAPI } from '$lib/components/voyager/VoyagerViewer.svelte';
	import ReviewFeedbackList from '$lib/components/workflow/ReviewFeedbackList.svelte';
	import ImagineModal from '$lib/components/ui/ImagineModal.svelte';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { EditionStatus, GlobalRole, Permission, type UserRoleContext } from '$lib/types/roles';
	import { hasPermission } from '$lib/utils/permissions';
	import { resolvePageContext } from '$lib/utils/page-permissions';
	import BookOpenIcon from '~icons/lucide/book-open';
	import CopyIcon from '~icons/lucide/copy';
	import LanguagesIcon from '~icons/lucide/languages';
	import MapIcon from '~icons/lucide/map';
	import MessageCircleIcon from '~icons/lucide/message-circle';
	import PanelRightCloseIcon from '~icons/lucide/panel-right-close';
	import PanelRightOpenIcon from '~icons/lucide/panel-right-open';
	import RotateCcwIcon from '~icons/lucide/rotate-ccw';
	import RulerIcon from '~icons/lucide/ruler';
	import Share2Icon from '~icons/lucide/share-2';
	import SmartphoneIcon from '~icons/lucide/smartphone';
	import WrenchIcon from '~icons/lucide/wrench';

	// View preset type for camera positions
	interface ViewPreset {
		name: string;
		yaw: number;
		pitch: number;
		offsetX?: number;
		offsetY?: number;
		offsetZ?: number;
	}

	// Parsed description segment type
	interface DescriptionSegment {
		type: 'text' | 'view-link';
		content: string;
		viewName?: string;
	}

	let { data, embedded = false }: { data: PageData; embedded?: boolean } = $props();

	// Voyager API reference for controlling the viewer
	let voyagerAPI = $state<VoyagerAPI | null>(null);
	let viewerLanguages = $state<string[]>([]);
	let activeViewerLanguage = $state('EN');

	// Make these reactive so they update when data changes on navigation
	let edition = $derived(data.edition);
	let siblingEditions = $derived(data.siblingEditions ?? []);
	let viewerHelp = $derived(data.viewerHelp);
	let viewerHelpVideoUrl = $derived(data.viewerHelpVideoUrl);

	// Get view presets from edition (if available)
	const viewPresets = $derived<ViewPreset[]>((edition as any).viewPresets || []);

	// The app owns the viewer chrome by default; an edition can explicitly restore Voyager's menu.
	const showVoyagerMenu = $derived<boolean>((edition as any).showVoyagerMenu === true);

	// Custom controls are the inverse of Voyager menu visibility
	const showCustomControls = $derived(!showVoyagerMenu);

	/**
	 * Parse description text and extract view link markers
	 * Syntax: [[view:preset-name|display text]]
	 */
	function parseDescription(text: string): DescriptionSegment[] {
		const segments: DescriptionSegment[] = [];
		const regex = /\[\[view:([^\]|]+)\|([^\]]+)\]\]/g;
		let lastIndex = 0;
		let match;

		while ((match = regex.exec(text)) !== null) {
			// Add text before the match
			if (match.index > lastIndex) {
				segments.push({
					type: 'text',
					content: text.slice(lastIndex, match.index)
				});
			}

			// Add the view link
			segments.push({
				type: 'view-link',
				content: match[2], // display text
				viewName: match[1] // preset name
			});

			lastIndex = match.index + match[0].length;
		}

		// Add remaining text
		if (lastIndex < text.length) {
			segments.push({
				type: 'text',
				content: text.slice(lastIndex)
			});
		}

		return segments;
	}

	// Parsed description segments
	const descriptionSegments = $derived(parseDescription(edition.description || ''));
	const credits = $derived(readCredits(edition.credits));
	const creators = $derived(credits.filter((credit) => credit.role === 'creator'));

	/**
	 * Handle click on a view link - change camera position
	 */
	function handleViewClick(presetName: string) {
		if (!voyagerAPI) return;

		const preset = viewPresets.find((p) => p.name === presetName);
		if (preset) {
			voyagerAPI.setView({
				yaw: preset.yaw,
				pitch: preset.pitch,
				offsetX: preset.offsetX,
				offsetY: preset.offsetY,
				offsetZ: preset.offsetZ,
				animate: true,
				durationMs: 2200
			});
		}
	}

	// Convert YouTube URL to embed URL
	function getYouTubeEmbedUrl(url: string): string | null {
		if (!url) return null;
		// Handle various YouTube URL formats
		const patterns = [
			/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
			/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
		];
		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match) return `https://www.youtube.com/embed/${match[1]}`;
		}
		return url; // Return as-is if already an embed URL or other format
	}

	const embedVideoUrl = $derived(getYouTubeEmbedUrl(viewerHelpVideoUrl || ''));

	let activeTab = $state<'description' | 'metadata' | 'peer-review' | 'printables' | 'versions'>(
		'description'
	);
	let isSidebarCollapsed = $state(false);
	let helpModalOpen = $state(false);
	let imagineModalOpen = $state(false);
	let loadedModelSize = $state<number | null>(null);
	let isFullWindow = $state(false);
	let detailsPanelElement: HTMLDivElement | undefined = $state();

	// Version history & citation state
	let citationCopied = $state(false);

	const primaryDoi = $derived(
		((edition as any).dcDoi?.[0] || '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
	);

	// Format citation (Chicago style)
	const citationText = $derived.by(() => {
		const creatorStr = creatorNames(credits) || 'Unknown';
		const year = edition.created ? new Date(edition.created).getFullYear() : '';
		const title = edition.title;
		const pubNum = (edition as any).pubNum;
		const doi = primaryDoi;
		return `${creatorStr}. ${title}. Pure 3D${pubNum ? `, ed. ${String(pubNum).padStart(2, '0')}` : ''}${year ? ` (${year})` : ''}.${doi ? ` doi:${doi}.` : ''}`;
	});

	// Build diff/changelog from dcAbstract comparison with previous edition
	const changelog = $derived.by(() => {
		if (!siblingEditions || siblingEditions.length === 0) return [];
		const prevEdition = siblingEditions.find((s: any) => s.pubNum < ((edition as any).pubNum || 0));
		if (!prevEdition) return [];

		const diffs: Array<{ type: 'add' | 'mod' | 'del'; text: string }> = [];

		// Compare model size
		const currentModel = (edition as any).modelSize || '';
		const prevModel = prevEdition.modelSize || '';
		if (currentModel && prevModel && currentModel !== prevModel) {
			diffs.push({ type: 'mod', text: `Model size: ${prevModel} → ${currentModel}` });
		} else if (currentModel && !prevModel) {
			diffs.push({ type: 'add', text: `Model data: ${currentModel}` });
		}

		// Compare description/abstract
		const currentDesc = edition.description || '';
		const prevDesc = prevEdition.dcAbstract || '';
		if (currentDesc !== prevDesc) {
			if (prevDesc && currentDesc) {
				diffs.push({ type: 'mod', text: 'Description updated' });
			} else if (currentDesc && !prevDesc) {
				diffs.push({ type: 'add', text: 'Description added' });
			}
		}

		// Provenance note
		const provenance = (edition as any).dcProvenance || '';
		if (provenance) {
			diffs.push({ type: 'add', text: `Provenance: ${provenance}` });
		}

		if (diffs.length === 0) {
			diffs.push({ type: 'mod', text: 'Minor updates and refinements' });
		}
		return diffs;
	});

	async function copyDoi() {
		const doi = primaryDoi;
		if (!doi) return;
		try {
			await navigator.clipboard.writeText(`https://doi.org/${doi}`);
			citationCopied = true;
			setTimeout(() => (citationCopied = false), 2000);
		} catch {
			// Fallback
		}
	}

	async function copyCitation() {
		const text = citationText;
		try {
			await navigator.clipboard.writeText(text);
			citationCopied = true;
			setTimeout(() => (citationCopied = false), 2000);
		} catch {
			// Fallback
		}
	}

	// Determine if we have local assets available for direct mode
	const useDirectMode = $derived(!!edition.voyagerRoot);

	// Format bytes to human readable string
	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '—';
		const date = new Date(dateStr);
		return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
	}

	function handleModelLoaded(totalBytes: number) {
		loadedModelSize = totalBytes;
	}

	function handleViewerReady(api: VoyagerAPI) {
		voyagerAPI = api;
		viewerLanguages = api.getLanguages();
		activeViewerLanguage = api.getActiveLanguage();
	}

	function setViewerLanguage(code: string, event: MouseEvent) {
		voyagerAPI?.setLanguage(code);
		activeViewerLanguage = code;
		(event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open');
	}

	async function shareEdition() {
		const shareData = { title: edition.title, url: window.location.href };

		try {
			if (navigator.share) {
				await navigator.share(shareData);
			} else {
				await navigator.clipboard.writeText(shareData.url);
			}
		} catch (error) {
			if ((error as DOMException).name !== 'AbortError') {
				console.error('Unable to share edition', error);
			}
		}
	}

	function toggleSidebar() {
		isSidebarCollapsed = !isSidebarCollapsed;
	}

	function showMetadata() {
		activeTab = 'metadata';
		isSidebarCollapsed = false;
		if (window.innerWidth < 1024) {
			requestAnimationFrame(() =>
				detailsPanelElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
			);
		}
	}

	function toggleFullWindow() {
		isFullWindow = !isFullWindow;
	}

	// Format peer review content - add spacing between reviewers
	function formatPeerReviewContent(content: string | null): string {
		if (!content) return '';
		// First, make all "Reviewer X:" bold
		let formatted = content.replace(/(Reviewer\s+\d+:)/gi, '<strong>$1</strong>');
		// Then add line breaks before all except the first one
		formatted = formatted.replace(/(?<!^)(<strong>Reviewer\s+\d+:<\/strong>)/gi, '<br><br>$1');
		return formatted;
	}

	const formattedPeerReview = $derived(formatPeerReviewContent(edition.peerReviewContent));
	const demoReviewFeedback = $derived((edition as any).demoReviewFeedback || []);
	const printables = $derived((edition as any).printables || []);

	// Handle escape key to exit full window mode
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isFullWindow) {
			isFullWindow = false;
		}
	}

	// --- Manage link visibility ---
	let permissionContext = $state<UserRoleContext>({ globalRole: GlobalRole.User });
	let canManagePage = $derived(hasPermission(permissionContext, Permission.EditionEdit));

	onMount(async () => {
		if (edition.id === 'demo') return;

		if (!authStore.isAuthenticated || !authStore.appUserId) {
			permissionContext = { globalRole: authStore.globalRole };
			return;
		}

		permissionContext = await resolvePageContext({
			globalRole: authStore.globalRole,
			userProfileId: authStore.appUserId,
			collectionId: (edition as unknown as { collectionId?: string }).collectionId || null,
			editionId: edition.id
		});
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>{edition.title} | Pure 3D</title>
	<meta name="description" content={edition.description} />

	<!-- Preconnect to Voyager API for faster loading -->
	<link rel="preconnect" href="https://3d-api.si.edu" crossorigin="anonymous" />
	<link rel="dns-prefetch" href="https://3d-api.si.edu" />
</svelte:head>

<div class="min-h-[calc(100vh-4rem)] bg-base-100">
	<div class="container mx-auto max-w-7xl px-4 py-8">
		{#if !embedded}
			<!-- Breadcrumbs -->
			<nav class="breadcrumbs mb-6 text-sm">
				<ul>
					<li>
						<a href="{base}/" data-sveltekit-preload-data="hover" class="link link-hover">Home</a>
					</li>
					<li>
						<a href="{base}/editions" data-sveltekit-preload-data="hover" class="link link-hover"
							>Editions</a
						>
					</li>
					<li class="text-base-content/70">{edition.title}</li>
				</ul>
			</nav>
		{/if}

		<!-- Title and Authors -->
		<div class="mb-8 flex items-start justify-between gap-6">
			<div class="min-w-0 flex-1">
				<h1 class="max-w-5xl text-3xl leading-tight font-bold md:text-4xl lg:text-5xl">
					{edition.title}
				</h1>
				<p class="mt-3 text-base-content/70">
					{#each creators as credit, index (credit)}
						{@const href = creditHref(credit, base)}
						{#if href}<a
								{href}
								class="link link-hover"
								rel={credit.userId ? undefined : 'external noopener noreferrer'}>{credit.name}</a
							>{:else}{credit.name}{/if}{index < creators.length - 1 ? '; ' : ''}
					{/each}
				</p>
				<!-- Institution -->
				{#if (edition as any).dcInstitution && (edition as any).dcInstitution.length > 0}
					<p class="mt-1 text-sm text-base-content/45">
						{((edition as any).dcInstitution as string[]).join(', ')}
					</p>
				{/if}
			</div>
			<div class="flex shrink-0 flex-col gap-2">
				{#if canManagePage}
					<a href="{base}/editions/{edition.id}/workflow" class="btn btn-sm btn-primary">
						Manage
					</a>
				{/if}
			</div>
		</div>

		<!-- Main Content Grid -->
		<div
			class="relative flex flex-col gap-8 transition-all duration-300 lg:flex-row lg:items-start"
		>
			<!-- Left Column - 3D Viewer -->
			<div class="min-w-0 flex-1 space-y-6">
				<!-- Voyager 3D Viewer -->
				<div
					class="ds-card-frame viewer-frame p-3 transition-all duration-300"
					class:full-window-viewer={isFullWindow}
				>
					<div class="relative overflow-hidden rounded-lg bg-base-200">
						<VoyagerViewer
							url={useDirectMode ? edition.voyagerRoot : edition.voyagerUrl}
							document={edition.sceneFile}
							title={edition.title}
							direct={useDirectMode}
							voyagerVersion={edition.voyagerVersion}
							resourceRoot={edition.voyagerResourceRoot}
							uiMode={showVoyagerMenu ? 'menu|title|language' : 'none'}
							onModelLoaded={handleModelLoaded}
							onReady={handleViewerReady}
							onFullWindowToggle={toggleFullWindow}
							showEditorSwitch
							{isFullWindow}
							{showVoyagerMenu}
						/>

						<!-- Top right controls -->
						<div
							class="absolute right-3 z-10 flex gap-2 transition-all duration-300"
							class:top-3={!isFullWindow}
							class:top-20={isFullWindow}
						>
							<!-- Fullscreen toggle button -->
							<button
								type="button"
								class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
								onclick={toggleFullWindow}
								aria-label={isFullWindow ? 'Exit full window' : 'Full window'}
								title={isFullWindow ? 'Exit full window' : 'Full window'}
							>
								{#if isFullWindow}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="2"
										stroke="currentColor"
										class="h-5 w-5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
										/>
									</svg>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="2"
										stroke="currentColor"
										class="h-5 w-5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
										/>
									</svg>
								{/if}
							</button>

							<!-- Imagine AI button -->
							<button
								type="button"
								class="btn btn-circle border-0 bg-primary/80 text-primary-content shadow-lg btn-sm hover:bg-primary"
								onclick={() => (imagineModalOpen = true)}
								aria-label="Imagine — AI image generation"
								title="Imagine — Generate AI image from this view"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="2"
									stroke="currentColor"
									class="h-5 w-5"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
									/>
								</svg>
							</button>

							<!-- Help info button -->
							{#if viewerHelp || viewerHelpVideoUrl}
								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => (helpModalOpen = true)}
									aria-label="How to use the 3D viewer"
									title="How to use the 3D viewer"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="2"
										stroke="currentColor"
										class="h-5 w-5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
										/>
									</svg>
								</button>
							{/if}
						</div>

						<!-- Custom floating controls (left side) - only visible when enabled and API ready -->
						{#if showCustomControls && voyagerAPI}
							<div
								class="custom-viewer-controls absolute left-3 z-10 flex flex-col gap-2 transition-all duration-300"
								class:top-3={!isFullWindow}
								class:top-20={isFullWindow}
							>
								{#if viewerLanguages.length > 1}
									<details class="dropdown dropdown-right">
										<summary
											class="btn btn-circle list-none border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
											aria-label="Change viewer language"
											title="Language: {activeViewerLanguage}"
										>
											<LanguagesIcon class="h-5 w-5" aria-hidden="true" />
										</summary>
										<ul
											class="dropdown-content menu z-20 ml-2 w-36 rounded-box bg-base-100 p-2 shadow-xl"
										>
											{#each viewerLanguages as language}
												<li>
													<button
														type="button"
														class:menu-active={language === activeViewerLanguage}
														onclick={(event) => setViewerLanguage(language, event)}
													>
														{language.toUpperCase()}
													</button>
												</li>
											{/each}
										</ul>
									</details>
								{/if}

								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.toggleAnnotations()}
									aria-label="Toggle annotations"
									title="Toggle annotations"
								>
									<MessageCircleIcon class="h-5 w-5" aria-hidden="true" />
								</button>

								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.toggleReader()}
									aria-label="Toggle reader"
									title="Toggle reader"
								>
									<BookOpenIcon class="h-5 w-5" aria-hidden="true" />
								</button>

								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.toggleTours()}
									aria-label="Toggle tours"
									title="Toggle tours"
								>
									<MapIcon class="h-5 w-5" aria-hidden="true" />
								</button>

								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={shareEdition}
									aria-label="Share edition"
									title="Share edition"
								>
									<Share2Icon class="h-5 w-5" aria-hidden="true" />
								</button>

								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.toggleTools()}
									aria-label="Toggle tools"
									title="Toggle tools"
								>
									<WrenchIcon class="h-5 w-5" aria-hidden="true" />
								</button>

								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.toggleMeasurement()}
									aria-label="Toggle measurement"
									title="Toggle measurement"
								>
									<RulerIcon class="h-5 w-5" aria-hidden="true" />
								</button>

								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.enableAR()}
									aria-label="View in augmented reality"
									title="View in AR (supported devices only)"
								>
									<SmartphoneIcon class="h-5 w-5" aria-hidden="true" />
								</button>

								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.resetViewer()}
									aria-label="Reset viewer"
									title="Reset viewer"
								>
									<RotateCcwIcon class="h-5 w-5" aria-hidden="true" />
								</button>
							</div>
						{/if}
					</div>

					{#if !isFullWindow}
						<div
							class="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-1 pt-3 text-xs"
						>
							<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-base-content/60">
								{#if edition.usageConditions}
									<span>
										<span class="font-mono text-[9px] tracking-[0.1em] uppercase">License</span>
										<span class="ml-1 font-medium text-base-content/80"
											>{edition.usageConditions}</span
										>
									</span>
								{/if}
								{#if primaryDoi}
									<a
										href={`https://doi.org/${primaryDoi}`}
										target="_blank"
										rel="noreferrer"
										class="font-medium text-base-content/80 underline decoration-base-content/25 underline-offset-4 hover:decoration-base-content"
									>
										Cite this edition
									</a>
								{/if}
							</div>
							<button
								type="button"
								class="min-h-8 font-medium text-base-content/60 transition-colors hover:text-base-content"
								onclick={showMetadata}
							>
								View full metadata →
							</button>
						</div>
					{/if}
				</div>
			</div>

			<!-- Right Column - Tabs and Content -->
			<div
				class="shrink-0 transition-all duration-300 ease-in-out"
				class:lg:w-96={!isSidebarCollapsed}
				class:lg:w-12={isSidebarCollapsed}
			>
				<div bind:this={detailsPanelElement} class="scroll-mt-24 lg:sticky lg:top-24">
					{#if isSidebarCollapsed}
						<button
							type="button"
							class="ds-card-frame hidden h-12 w-12 items-center justify-center lg:flex"
							onclick={toggleSidebar}
							aria-label="Show edition details"
							title="Show edition details"
						>
							<PanelRightOpenIcon class="h-4 w-4" aria-hidden="true" />
						</button>
					{/if}
					<div
						class="ds-card-frame w-full p-3 transition-all duration-300 lg:w-96"
						class:lg:hidden={isSidebarCollapsed}
					>
						<div class="overflow-hidden rounded-lg bg-base-200">
							<div class="flex min-h-11 items-center justify-between gap-3 bg-base-100 px-3 py-2">
								<span class="font-mono text-[9px] tracking-[0.12em] text-base-content/45 uppercase">
									Edition record
								</span>
								<button
									type="button"
									class="hidden h-8 w-8 items-center justify-center rounded-md text-base-content/50 transition-colors hover:bg-base-200 hover:text-base-content lg:flex"
									onclick={toggleSidebar}
									aria-label="Hide edition details"
									title="Hide edition details"
								>
									<PanelRightCloseIcon class="h-4 w-4" aria-hidden="true" />
								</button>
							</div>
							<!-- Tabs -->
							<div
								role="tablist"
								class="scrollbar-hide flex overflow-x-auto border-b border-base-300 bg-base-100 px-2"
							>
								<button
									role="tab"
									aria-selected={activeTab === 'description'}
									class="min-h-11 shrink-0 grow border-b-2 px-3 text-xs whitespace-nowrap transition-colors {activeTab ===
									'description'
										? 'border-accent text-base-content'
										: 'border-transparent text-base-content/50 hover:text-base-content'}"
									onclick={() => (activeTab = 'description')}
								>
									Description
								</button>
								<button
									role="tab"
									aria-selected={activeTab === 'metadata'}
									class="min-h-11 shrink-0 grow border-b-2 px-3 text-xs whitespace-nowrap transition-colors {activeTab ===
									'metadata'
										? 'border-accent text-base-content'
										: 'border-transparent text-base-content/50 hover:text-base-content'}"
									onclick={() => (activeTab = 'metadata')}
								>
									Metadata
								</button>
								<button
									role="tab"
									aria-selected={activeTab === 'peer-review'}
									class="min-h-11 shrink-0 grow border-b-2 px-3 text-xs whitespace-nowrap transition-colors {activeTab ===
									'peer-review'
										? 'border-accent text-base-content'
										: 'border-transparent text-base-content/50 hover:text-base-content'}"
									onclick={() => (activeTab = 'peer-review')}
								>
									Peer Review
								</button>
								{#if siblingEditions && siblingEditions.length > 0}
									<button
										role="tab"
										aria-selected={activeTab === 'versions'}
										class="min-h-11 shrink-0 grow border-b-2 px-3 text-xs whitespace-nowrap transition-colors {activeTab ===
										'versions'
											? 'border-accent text-base-content'
											: 'border-transparent text-base-content/50 hover:text-base-content'}"
										onclick={() => (activeTab = 'versions')}
									>
										Versions
									</button>
								{/if}
								<button
									role="tab"
									aria-selected={activeTab === 'printables'}
									class="min-h-11 shrink-0 grow border-b-2 px-3 text-xs whitespace-nowrap transition-colors {activeTab ===
									'printables'
										? 'border-accent text-base-content'
										: 'border-transparent text-base-content/50 hover:text-base-content'}"
									onclick={() => (activeTab = 'printables')}
								>
									Printables
								</button>
							</div>

							<!-- Tab Content -->
							<div class="prose prose-sm max-h-[75vh] max-w-none overflow-y-auto p-5">
								{#if activeTab === 'description'}
									<p class="leading-relaxed text-base-content/80">
										{#each descriptionSegments as segment}
											{#if segment.type === 'text'}
												{segment.content}
											{:else if segment.type === 'view-link'}
												<button
													type="button"
													class="link cursor-pointer font-semibold link-primary hover:link-secondary"
													onclick={() => handleViewClick(segment.viewName || '')}
													title="Click to change view"
												>
													{segment.content}
												</button>
											{/if}
										{/each}
									</p>

									<!-- Tags -->
									<div class="mt-6">
										<h3 class="mb-2 text-sm font-semibold">Tags</h3>
										<div class="flex flex-wrap gap-2">
											{#each edition.tags as tag (tag)}
												<span class="badge border badge-ghost border-base-300">{tag}</span>
											{/each}
										</div>
									</div>

									<!-- Links Section (Orange boxes from wireframe) -->
									<div class="not-prose mt-6">
										<h3 class="mb-3 text-sm font-semibold">Links to scene (deeplink)</h3>
										<div class="space-y-2">
											<div class="">
												<span class="text-sm opacity-80">
													(Voyager API id to the step/scene) add it to the url for sharing and cite.
												</span>
											</div>
										</div>
									</div>
								{:else if activeTab === 'metadata'}
									<div class="not-prose space-y-0">
										<section class="metadata-section">
											<div class="metadata-heading">
												<h2>Publication record</h2>
											</div>
											<dl class="metadata-list">
												{#if primaryDoi}
													<div class="metadata-row">
														<dt class="text-base-content/50">DOI</dt>
														<dd class="min-w-0">
															<p class="font-mono text-xs break-all">{primaryDoi}</p>
															<button
																type="button"
																class="metadata-action"
																onclick={copyDoi}
																title="Copy DOI"
															>
																<CopyIcon class="h-3 w-3" aria-hidden="true" />
																{citationCopied ? 'Copied' : 'Copy DOI'}
															</button>
														</dd>
													</div>
												{/if}
												<div class="metadata-row">
													<dt class="text-base-content/50">Record created</dt>
													<dd>{formatDate(edition.created)}</dd>
												</div>
												{#if (edition as any).pubNum}
													<div class="metadata-row">
														<dt class="text-base-content/50">Edition number</dt>
														<dd>Ed. {String((edition as any).pubNum).padStart(2, '0')}</dd>
													</div>
												{/if}
												{#if (edition as any).status}
													<div class="metadata-row items-center">
														<dt class="text-base-content/50">Publication status</dt>
														<dd><StatusBadge status={(edition as any).status} /></dd>
													</div>
												{/if}
											</dl>
										</section>

										<section class="metadata-section">
											<div class="metadata-heading">
												<h2>Contributors &amp; institution</h2>
											</div>
											<dl class="metadata-list">
												{#each ['creator', 'contributor'] as role (role)}
													<div class="metadata-row">
														<dt class="text-base-content/50">
															{role === 'creator' ? 'Creators' : 'Contributors'}
														</dt>
														<dd>
															{#each credits.filter((credit) => credit.role === role) as credit (credit)}
																{@const href = creditHref(credit, base)}
																<div>
																	{#if href}<a
																			{href}
																			class="link link-hover"
																			rel={credit.userId
																				? undefined
																				: 'external noopener noreferrer'}>{credit.name}</a
																		>{:else}{credit.name}{/if}{credit.contributionRole
																		? ` (${credit.contributionRole})`
																		: ''}
																</div>
															{:else}<span class="text-base-content/45">Not provided</span>{/each}
														</dd>
													</div>
												{/each}
												{#if (edition as any).dcInstitution && (edition as any).dcInstitution.length > 0}
													<div class="metadata-row">
														<dt class="text-base-content/50">Institution</dt>
														<dd>{((edition as any).dcInstitution as string[]).join(', ')}</dd>
													</div>
												{/if}
											</dl>
										</section>

										<section class="metadata-section">
											<div class="metadata-heading">
												<h2>Rights &amp; access</h2>
											</div>
											<dl class="metadata-list">
												<div class="metadata-row">
													<dt class="text-base-content/50">Usage license</dt>
													<dd>{edition.usageConditions || 'Not specified'}</dd>
												</div>
												{#if edition.alternativeVersion}
													<div class="metadata-row">
														<dt class="text-base-content/50">Other version</dt>
														<dd>
															<a href={edition.alternativeVersion} class="link link-hover"
																>View version</a
															>
														</dd>
													</div>
												{/if}
											</dl>
										</section>

										<section class="metadata-section">
											<div class="metadata-heading">
												<h2>Technical provenance</h2>
											</div>
											<dl class="metadata-list">
												{#if loadedModelSize || (edition as any).modelSize}
													<div class="metadata-row">
														<dt class="text-base-content/50">Model size</dt>
														<dd>
															{loadedModelSize
																? formatBytes(loadedModelSize)
																: String((edition as any).modelSize)}
														</dd>
													</div>
												{/if}
												{#if edition.voyagerVersion}
													<div class="metadata-row">
														<dt class="text-base-content/50">Viewer runtime</dt>
														<dd>Voyager v{edition.voyagerVersion}</dd>
													</div>
												{/if}
												{#if (edition as any).settingsAuthorToolVersion}
													<div class="metadata-row">
														<dt class="text-base-content/50">Authoring tool</dt>
														<dd>
															{(edition as any).settingsAuthorToolName || 'Voyager'}
															v{(edition as any).settingsAuthorToolVersion}
														</dd>
													</div>
												{/if}
												{#if edition.sceneFile}
													<div class="metadata-row">
														<dt class="text-base-content/50">Scene document</dt>
														<dd class="font-mono text-xs break-all">{edition.sceneFile}</dd>
													</div>
												{/if}
												<div class="metadata-row">
													<dt class="text-base-content/50">Record ID</dt>
													<dd class="font-mono text-xs break-all">{edition.id}</dd>
												</div>
											</dl>
										</section>
									</div>
								{:else if activeTab === 'peer-review'}
									{#if edition.hasPeerReview}
										<div class="not-prose space-y-6">
											<!-- Peer Reviewed Badge -->
											<div class="flex justify-center">
												<img
													src="{base}/images/peer-reviewed-badge.svg"
													alt="PURE 3D Peer Reviewed"
													class="h-24 w-24"
												/>
											</div>

											<!-- Review Type -->
											{#if edition.peerReviewKind}
												<div class="rounded-lg bg-base-300 p-4">
													<h3 class="mb-2 text-base font-bold">
														Peer review ({edition.peerReviewKind})
													</h3>
													<!-- Review Content -->
													{#if edition.peerReviewContent}
														<div class="prose prose-sm max-w-none text-base-content/80">
															{@html formattedPeerReview}
														</div>
													{/if}
												</div>
											{/if}
										</div>

										<!-- Detailed feedback items -->
										{#if demoReviewFeedback.length > 0}
											<div class="mt-4">
												<h3 class="mb-2 text-sm font-semibold">Detailed Feedback</h3>
												<div class="not-prose space-y-2">
													{#each demoReviewFeedback as item (item.id)}
														<div class="rounded-lg border border-base-300 p-3">
															<div class="flex flex-wrap items-center gap-2">
																<span class="badge badge-sm capitalize badge-info"
																	>{item.category}</span
																>
																<span class="text-xs font-medium text-base-content/60"
																	>{item.targetLabel}</span
																>
																<span class="ml-auto text-xs text-base-content/40">
																	{item.reviewer} · {formatDate(item.created)}
																</span>
															</div>
															<p class="mt-1 text-sm">{item.comment}</p>
															{#if item.resolved}
																<span class="mt-2 badge inline-block badge-sm badge-success"
																	>Resolved</span
																>
															{/if}
														</div>
													{/each}
												</div>
											</div>
										{:else if edition.id}
											<div class="mt-4">
												<h3 class="mb-2 text-sm font-semibold">Detailed Feedback</h3>
												<ReviewFeedbackList editionId={edition.id} />
											</div>
										{/if}
									{:else}
										<div
											class="not-prose rounded-lg border border-dashed border-base-300 bg-base-100 p-5 text-sm"
										>
											<div class="mb-2 flex items-center gap-2">
												<span class="badge badge-outline badge-sm">Status</span>
												<h3 class="font-semibold">
													{(edition as any).peerReviewRequested
														? 'Peer review requested'
														: 'Not peer reviewed yet'}
												</h3>
											</div>
											<p class="text-base-content/70">
												{#if (edition as any).peerReviewRequested}
													This edition is marked for peer review. Review details and feedback will
													appear here when they are available.
												{:else}
													Peer review is an optional trust signal for Pure 3D editions. If requested
													for this edition, review information will appear here.
												{/if}
											</p>
											{#if canManagePage && !(edition as any).peerReviewRequested}
												<a
													class="btn mt-4 btn-outline btn-xs"
													href="{base}/editions/{edition.id}/workflow"
												>
													Request peer review
												</a>
											{/if}
										</div>
									{/if}
								{:else if activeTab === 'printables'}
									{#if printables.length > 0}
										<div class="not-prose space-y-3">
											{#each printables as item (item.title)}
												<article class="rounded-lg border border-base-300 bg-base-100 p-4">
													<div class="flex items-start justify-between gap-3">
														<div>
															<h3 class="font-semibold">{item.title}</h3>
															<p class="mt-1 text-sm text-base-content/70">{item.description}</p>
														</div>
														<span class="badge shrink-0 badge-outline">{item.type}</span>
													</div>
													<div class="mt-3 flex items-center justify-between gap-3">
														<p class="text-xs text-base-content/50">{item.size}</p>
														{#if item.url}
															<a
																class="btn btn-outline btn-xs"
																href={item.url}
																download={item.filename || true}
															>
																Download
															</a>
														{/if}
													</div>
												</article>
											{/each}
										</div>
									{:else}
										<div
											class="not-prose rounded-lg border border-dashed border-base-300 bg-base-100 p-5 text-sm"
										>
											<div class="mb-2 flex items-center gap-2">
												<span class="badge badge-outline badge-sm">Not provided</span>
												<h3 class="font-semibold">No printables uploaded</h3>
											</div>
											<p class="text-base-content/70">
												Contributors can upload downloadable worksheets, fabrication files, lesson
												materials, or reference sheets for an edition. None have been provided for
												this edition.
											</p>
											{#if canManagePage}
												<a
													class="btn mt-4 btn-outline btn-xs"
													href="{base}/editions/{edition.id}/workflow"
												>
													Manage edition assets
												</a>
											{/if}
										</div>
									{/if}
								{:else if activeTab === 'versions'}
									<div class="space-y-4">
										<!-- Citation Block -->
										<div class="rounded-lg bg-base-300 p-4">
											<h3 class="mb-2 text-sm font-semibold">Citation</h3>
											<div class="text-sm leading-relaxed text-base-content/80">
												{citationText}
											</div>
											<div class="mt-2 flex gap-2">
												<button class="btn btn-xs btn-secondary" onclick={copyCitation}>
													{#if citationCopied}
														Copied!
													{:else}
														Copy citation
													{/if}
												</button>
												{#if primaryDoi}
													<button class="btn btn-ghost btn-xs" onclick={copyDoi}> Copy DOI </button>
												{/if}
											</div>
										</div>

										<!-- Diff / Changelog -->
										{#if changelog.length > 0}
											<div class="rounded-lg bg-base-300 p-4">
												<h3 class="mb-2 text-sm font-semibold">Changes from previous edition</h3>
												<div class="space-y-1">
													{#each changelog as change}
														<div
															class="flex items-start gap-2 rounded px-2 py-1 text-xs {change.type ===
															'add'
																? 'bg-success/10'
																: change.type === 'mod'
																	? 'bg-warning/10'
																	: 'bg-error/10'}"
														>
															<span
																class="mt-px font-mono font-bold {change.type === 'add'
																	? 'text-success'
																	: change.type === 'mod'
																		? 'text-warning'
																		: 'text-error'}"
															>
																{change.type === 'add' ? '+' : change.type === 'mod' ? '~' : '−'}
															</span>
															<span>{change.text}</span>
														</div>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Version History Timeline -->
										<div>
											<h3 class="mb-3 text-sm font-semibold">Version History</h3>
											<div class="space-y-0">
												<!-- Current edition -->
												<article class="flex gap-3 rounded-lg bg-success/5 p-3">
													<div class="flex flex-col items-center">
														<div class="h-3 w-3 rounded-full bg-success"></div>
														<div class="w-px flex-1 bg-base-300"></div>
													</div>
													<div class="flex-1 pb-2">
														<div class="flex items-center gap-2">
															<span class="font-mono text-xs font-semibold"
																>Ed. {String((edition as any).pubNum || 1).padStart(2, '0')}</span
															>
															<span class="badge badge-xs badge-success">Current</span>
														</div>
														<div class="text-sm font-medium">{edition.title}</div>
														{#if primaryDoi}
															<div class="font-mono text-[10px] text-base-content/50">
																{primaryDoi}
															</div>
														{/if}
													</div>
												</article>
												<!-- Sibling editions (version history) -->
												{#each siblingEditions as sibling (sibling.id)}
													<article
														class="flex gap-3 rounded-lg p-3 transition-colors hover:bg-base-300/50"
													>
														<div class="flex flex-col items-center">
															<div class="h-2.5 w-2.5 rounded-full bg-base-content/30"></div>
															<div class="w-px flex-1 bg-base-300"></div>
														</div>
														<a
															href="{base}/editions/{sibling.slug}"
															data-sveltekit-preload-data="hover"
															class="flex-1 pb-2 no-underline"
														>
															<div class="flex items-center gap-2">
																<span class="font-mono text-xs font-semibold"
																	>Ed. {String(sibling.pubNum).padStart(2, '0')}</span
																>
																{#if sibling.status}
																	<span class="badge badge-ghost badge-xs">{sibling.status}</span>
																{/if}
															</div>
															<div
																class="text-sm font-medium text-base-content/80 transition-colors hover:text-primary"
															>
																{sibling.title}
															</div>
															{#if (sibling as any).dcDoi && (sibling as any).dcDoi.length > 0}
																<div class="font-mono text-[10px] text-base-content/50">
																	{(sibling as any).dcDoi[0]}
																</div>
															{/if}
															{#if sibling.modelSize}
																<div class="text-[10px] text-base-content/50">
																	{sibling.modelSize}
																</div>
															{/if}
														</a>
													</article>
												{/each}
											</div>
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Viewer Help Modal -->
{#if viewerHelp || viewerHelpVideoUrl}
	<dialog class="modal" class:modal-open={helpModalOpen}>
		<div class="modal-box max-w-2xl">
			<h3 class="mb-4 text-lg font-bold">How to use the 3D Viewer</h3>

			<!-- Video embed -->
			{#if embedVideoUrl}
				<div class="mb-4 aspect-video w-full">
					<iframe
						src={embedVideoUrl}
						title="3D Viewer Tutorial"
						class="h-full w-full rounded-lg"
						frameborder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
						allowfullscreen
					></iframe>
				</div>
			{/if}

			<!-- Text content -->
			{#if viewerHelp}
				<div class="prose prose-sm max-w-none">
					{@html viewerHelp}
				</div>
			{/if}

			<div class="modal-action">
				<button type="button" class="btn" onclick={() => (helpModalOpen = false)}>Close</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => (helpModalOpen = false)}>close</button>
		</form>
	</dialog>
{/if}

<!-- Imagine AI Modal -->
<ImagineModal
	bind:open={imagineModalOpen}
	edition={edition as any}
	onclose={() => (imagineModalOpen = false)}
/>

<style>
	/* Full window mode for the 3D viewer */
	.full-window-viewer {
		position: fixed !important;
		top: 0; /* Behind the header for transparency effect */
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30; /* Below header (z-50) */
		border-radius: 0 !important;
		border: 0 !important;
		padding: 0 !important;
		background: #000 !important;
		box-shadow: none !important;
		margin: 0 !important;
		max-height: none !important;
		height: auto !important;
	}

	.full-window-viewer > div {
		border-radius: 0 !important;
	}

	.metadata-section {
		padding: 0.125rem 0 0.875rem;
	}

	.metadata-section + .metadata-section {
		padding-top: 0.875rem;
		border-top: 1px solid var(--color-base-300);
	}

	.metadata-heading {
		margin-bottom: 0.3rem;
	}

	.metadata-heading h2 {
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
	}

	.metadata-row {
		display: grid;
		grid-template-columns: 5.75rem minmax(0, 1fr);
		gap: 0.625rem;
		padding: 0.35rem 0;
	}

	.metadata-row:last-child {
		padding-bottom: 0;
	}

	.metadata-row dt {
		font-family: var(--font-mono);
		font-size: 0.5625rem;
		line-height: 1.4;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in oklch, var(--color-base-content) 48%, transparent);
	}

	.metadata-row dd {
		min-width: 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: color-mix(in oklch, var(--color-base-content) 86%, transparent);
	}

	.metadata-action {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 1.625rem;
		margin-top: 0.25rem;
		padding: 0.2rem 0.45rem;
		border: 1px solid var(--color-base-300);
		border-radius: 0.375rem;
		font-size: 0.6875rem;
		font-weight: 500;
		transition:
			border-color 160ms ease-out,
			background 160ms ease-out;
	}

	.metadata-action:hover {
		border-color: color-mix(in oklch, var(--color-base-content) 25%, var(--color-base-300));
		background: var(--color-base-200);
	}

	@media (max-width: 480px) {
		.custom-viewer-controls {
			top: auto !important;
			right: 0.75rem;
			bottom: 0.75rem;
			flex-direction: row;
			flex-wrap: wrap;
		}

		.metadata-row {
			grid-template-columns: 5rem minmax(0, 1fr);
			gap: 0.5rem;
		}
	}

	.full-window-viewer :global(.voyager-container),
	.full-window-viewer :global(voyager-explorer),
	.full-window-viewer :global(iframe) {
		height: 100% !important;
		max-height: none !important;
		aspect-ratio: unset !important;
	}

	/* Hide body scrollbar in fullscreen mode */
	:global(body:has(.full-window-viewer)) {
		overflow: hidden !important;
	}

	.scrollbar-hide {
		scrollbar-width: none;
	}

	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
