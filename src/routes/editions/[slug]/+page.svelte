<script lang="ts">
	import { base } from '$app/paths';
	import { dev } from '$app/environment';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import VoyagerViewer, { type VoyagerAPI } from '$lib/components/voyager/VoyagerViewer.svelte';
	import VoyagerAPIDemo from '$lib/components/voyager/VoyagerAPIDemo.svelte';
	import ReviewFeedbackList from '$lib/components/workflow/ReviewFeedbackList.svelte';
	import ImagineModal from '$lib/components/ui/ImagineModal.svelte';
	import StatusTransitionPanel from '$lib/components/workflow/StatusTransitionPanel.svelte';
	import MemberManager from '$lib/components/admin/MemberManager.svelte';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import {
		EditionRole,
		EditionStatus,
		EDITION_ROLE_LABELS,
		EDITION_STATUS_TRANSITIONS,
		GlobalRole,
		Permission,
		type UserRoleContext
	} from '$lib/types/roles';
	import { hasPermission, canUserTransitionStatus } from '$lib/utils/permissions';
	import { resolvePageContext } from '$lib/utils/page-permissions';
	import { logAudit } from '$lib/utils/audit';
	import toast from 'svelte-french-toast';

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

	let { data }: { data: PageData } = $props();

	// Voyager API reference for controlling the viewer
	let voyagerAPI = $state<VoyagerAPI | null>(null);

	// Make these reactive so they update when data changes on navigation
	let edition = $derived(data.edition as PageData['edition'] & Record<string, any>);
	let viewerHelp = $derived(data.viewerHelp);
	let viewerHelpVideoUrl = $derived(data.viewerHelpVideoUrl);

	// Get view presets from edition (if available)
	const viewPresets = $derived<ViewPreset[]>((edition as any).viewPresets || []);

	// Check if Voyager's built-in menu should be shown (default: true for regular editions)
	// When Voyager menu is hidden, custom controls are shown instead
	const showVoyagerMenu = $derived<boolean>((edition as any).showVoyagerMenu !== false);

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
				offsetZ: preset.offsetZ
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

	let activeTab = $state<'description' | 'metadata' | 'peer-review' | 'printables'>('description');
	let isSidebarCollapsed = $state(false);
	let helpModalOpen = $state(false);
	let imagineModalOpen = $state(false);
	let loadedModelSize = $state<number | null>(null);
	let isFullWindow = $state(false);

	// Determine if we have local assets available for direct mode
	const useDirectMode = $derived(!!edition.voyagerRoot);

	// Format bytes to human readable string
	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function handleModelLoaded(totalBytes: number) {
		loadedModelSize = totalBytes;
	}

	function handleViewerReady(api: VoyagerAPI) {
		voyagerAPI = api;
	}

	function toggleSidebar() {
		isSidebarCollapsed = !isSidebarCollapsed;
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

	// Handle escape key to exit full window mode
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isFullWindow) {
			isFullWindow = false;
		}
	}

	// --- Manage panel (permission-gated CRUD on this page) ---
	let permissionContext = $state<UserRoleContext>({ globalRole: GlobalRole.Viewer });
	let manageOpen = $state(false);
	let manageTab = $state<'workflow' | 'members' | 'danger'>('workflow');
	let currentStatus = $state<EditionStatus>(EditionStatus.Draft);
	let deleteConfirmOpen = $state(false);
	let isDeleting = $state(false);

	const editionRoleValues = Object.values(EditionRole) as string[];

	let canManageMembers = $derived(
		hasPermission(permissionContext, Permission.EditionEdit) &&
			(permissionContext.globalRole === GlobalRole.Admin ||
				permissionContext.collectionRole === 'owner' ||
				permissionContext.editionRole === EditionRole.Author)
	);

	let hasActionableTransition = $derived(
		(EDITION_STATUS_TRANSITIONS[currentStatus] ?? []).some((target) =>
			canUserTransitionStatus(permissionContext, currentStatus, target)
		)
	);

	let canManagePage = $derived(
		hasPermission(permissionContext, Permission.EditionDelete) ||
			canManageMembers ||
			hasActionableTransition
	);

	let canDelete = $derived(hasPermission(permissionContext, Permission.EditionDelete));
	let canEditMetadata = $derived(hasPermission(permissionContext, Permission.EditionEdit));

	onMount(async () => {
		if (edition.id === 'demo') return;
		currentStatus =
			((edition as unknown as { status?: EditionStatus }).status as EditionStatus) ||
			EditionStatus.Draft;

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

	function handleStatusChanged(newStatus: EditionStatus) {
		currentStatus = newStatus;
	}

	async function deleteEdition() {
		isDeleting = true;
		try {
			await pb.collection('editions').delete(edition.id);
			await logAudit('user_deleted', 'edition', edition.id, authStore.user?.email || '', {
				title: edition.title
			});
			toast.success('Edition deleted');
			goto(`${base}/editions`);
		} catch (error) {
			console.error('Error deleting edition:', error);
			toast.error('Failed to delete edition');
			isDeleting = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>{edition.title} | Pure 3D</title>
	<meta name="description" content={edition.description} />

	<!-- Preconnect to Voyager API for faster loading -->
	<link rel="preconnect" href="https://3d-api.si.edu" crossorigin="anonymous" />
	<link rel="dns-prefetch" href="https://3d-api.si.edu" />
</svelte:head>

<div class="bg-base-100">
	<div class="container mx-auto max-w-7xl px-4 py-8">
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

		<!-- Title and Authors -->
		<div class="mb-6 flex items-start gap-4">
			{#if edition.hasPeerReview}
				<div class="flex-shrink-0" title="This edition has been peer reviewed">
					<img
						src="{base}/images/peer-reviewed-badge.svg"
						alt="Peer Reviewed"
						class="h-16 w-16 md:h-20 md:w-20"
					/>
				</div>
			{/if}
			<div class="flex-1">
				<h1 class="mb-1 text-3xl font-bold md:text-4xl">{edition.title}</h1>
				<p class="text-base-content/70">{edition.authors}</p>
			</div>
			{#if canManagePage}
				<button
					class="btn btn-sm btn-primary"
					onclick={() => (manageOpen = !manageOpen)}
					aria-expanded={manageOpen}
				>
					{manageOpen ? 'Close Manage' : 'Manage'}
				</button>
			{/if}
			<!-- Sidebar toggle button -->
			<button
				onclick={toggleSidebar}
				class="btn hidden btn-ghost btn-sm lg:flex"
				aria-label={isSidebarCollapsed ? 'Show details' : 'Hide details'}
			>
				{isSidebarCollapsed ? 'Show details' : 'Hide details'}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4 transition-transform duration-300"
					class:rotate-180={isSidebarCollapsed}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>

		{#if manageOpen && canManagePage}
			<div class="mb-6 rounded-box border border-base-300 bg-base-200 p-4">
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<div class="flex items-center gap-3">
						<h2 class="text-lg font-semibold">Manage Edition</h2>
						<StatusBadge status={currentStatus} />
					</div>
					<div class="flex gap-2">
						{#if canEditMetadata}
							<a href="{base}/editions/{edition.id}/workflow" class="btn btn-outline btn-sm">
								Edit in Workflow
							</a>
						{/if}
					</div>
				</div>

				<div role="tablist" class="tabs-bordered mb-4 tabs">
					<button
						role="tab"
						class="tab"
						class:tab-active={manageTab === 'workflow'}
						onclick={() => (manageTab = 'workflow')}
					>
						Workflow
					</button>
					{#if canManageMembers}
						<button
							role="tab"
							class="tab"
							class:tab-active={manageTab === 'members'}
							onclick={() => (manageTab = 'members')}
						>
							Members
						</button>
					{/if}
					{#if canDelete}
						<button
							role="tab"
							class="tab"
							class:tab-active={manageTab === 'danger'}
							onclick={() => (manageTab = 'danger')}
						>
							Danger Zone
						</button>
					{/if}
				</div>

				{#if manageTab === 'workflow'}
					<StatusTransitionPanel
						editionId={edition.id}
						title={edition.title}
						status={currentStatus}
						context={permissionContext}
						onchanged={handleStatusChanged}
					/>
				{:else if manageTab === 'members' && canManageMembers}
					<MemberManager
						membershipCollection="editionUsers"
						parentField="editionId"
						parentId={edition.id}
						roleValues={editionRoleValues}
						roleLabels={EDITION_ROLE_LABELS}
						defaultRole={EditionRole.Collaborator}
						auditTargetType="edition"
					/>
				{:else if manageTab === 'danger' && canDelete}
					<div class="space-y-3">
						<p class="text-sm text-base-content/70">
							Deleting this edition is permanent and cannot be undone.
						</p>
						<button
							class="btn btn-sm btn-error"
							onclick={() => (deleteConfirmOpen = true)}
							disabled={isDeleting}
						>
							Delete Edition
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Main Content Grid -->
		<div
			class="relative flex flex-col gap-8 transition-all duration-300 lg:flex-row lg:items-start"
		>
			<!-- Left Column - 3D Viewer -->
			<div class="min-w-0 flex-1 space-y-6">
				<!-- Voyager 3D Viewer -->
				<div
					class="card overflow-hidden bg-base-200 shadow-xl transition-all duration-300"
					class:full-window-viewer={isFullWindow}
				>
					<div class="relative card-body h-full p-0">
						<VoyagerViewer
							url={useDirectMode ? edition.voyagerRoot : edition.voyagerUrl}
							document={edition.sceneFile}
							title={edition.title}
							direct={useDirectMode}
							voyagerVersion={edition.voyagerVersion}
							resourceRoot={edition.voyagerResourceRoot}
							uiMode="menu|title|language"
							onModelLoaded={handleModelLoaded}
							onReady={handleViewerReady}
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
								class="absolute left-3 z-10 flex flex-col gap-2 transition-all duration-300"
								class:top-3={!isFullWindow}
								class:top-20={isFullWindow}
							>
								<!-- Annotations toggle -->
								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.toggleAnnotations()}
									title="Toggle annotations"
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
											d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
										/>
									</svg>
								</button>

								<!-- Reader toggle -->
								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.toggleReader()}
									title="Toggle reader"
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
											d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
										/>
									</svg>
								</button>

								<!-- Tours toggle -->
								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.toggleTours()}
									title="Toggle tours"
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
											d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
										/>
									</svg>
								</button>

								<!-- Tools toggle -->
								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.toggleTools()}
									title="Toggle tools"
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
											d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
										/>
									</svg>
								</button>

								<!-- Measurement toggle -->
								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.toggleMeasurement()}
									title="Toggle measurement"
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
											d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
										/>
									</svg>
								</button>

								<!-- Reset camera -->
								<button
									type="button"
									class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
									onclick={() => voyagerAPI?.resetCamera()}
									title="Reset camera"
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
											d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
										/>
									</svg>
								</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Viewer info row -->
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/50">
					{#if edition.voyagerVersion}
						<span>Voyager v{edition.voyagerVersion}</span>
					{/if}
					{#if loadedModelSize}
						<span>Model: {formatBytes(loadedModelSize)}</span>
					{/if}
					<span>{edition.usageConditions}</span>
					{#if edition.alternativeVersion}
						<a href={edition.alternativeVersion} class="link link-hover">Alternative version</a>
					{/if}
				</div>
			</div>

			<!-- Right Column - Tabs and Content -->
			<div
				class="shrink-0 transition-all duration-300 ease-in-out"
				class:lg:w-96={!isSidebarCollapsed}
				class:lg:w-0={isSidebarCollapsed}
			>
				<div class="lg:sticky lg:top-4">
					<div
						class="card overflow-hidden bg-base-200 shadow-xl transition-all duration-300"
						class:lg:w-0={isSidebarCollapsed}
						class:lg:opacity-0={isSidebarCollapsed}
						class:lg:invisible={isSidebarCollapsed}
					>
						<div class="card-body w-96 p-0">
							<!-- Tabs -->
							<div role="tablist" class="tabs-bordered tabs bg-base-300">
								<button
									role="tab"
									class="tab flex-1"
									class:tab-active={activeTab === 'description'}
									onclick={() => (activeTab = 'description')}
								>
									Description
								</button>
								<button
									role="tab"
									class="tab flex-1"
									class:tab-active={activeTab === 'metadata'}
									onclick={() => (activeTab = 'metadata')}
								>
									Metadata
								</button>
								<button
									role="tab"
									class="tab flex-1"
									class:tab-active={activeTab === 'peer-review'}
									onclick={() => (activeTab = 'peer-review')}
								>
									Peer Review
								</button>
								<button
									role="tab"
									class="tab flex-1"
									class:tab-active={activeTab === 'printables'}
									onclick={() => (activeTab = 'printables')}
								>
									Printables
								</button>
							</div>

							<!-- Tab Content -->
							<div class="prose prose-sm max-w-none p-6">
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
									<div class="space-y-4">
										<div>
											<h3 class="text-sm font-semibold text-base-content/60">Created</h3>
											<p>{new Date(edition.created).toLocaleDateString()}</p>
										</div>
										<div>
											<h3 class="text-sm font-semibold text-base-content/60">Authors</h3>
											<p>{edition.authors}</p>
										</div>
										<div>
											<h3 class="text-sm font-semibold text-base-content/60">License</h3>
											<p>{edition.usageConditions}</p>
										</div>
										<div>
											<h3 class="text-sm font-semibold text-base-content/60">Edition ID</h3>
											<p class="font-mono text-xs break-all">{edition.id}</p>
										</div>
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
										{#if edition.id}
											<div class="mt-4">
												<h3 class="mb-2 text-sm font-semibold">Detailed Feedback</h3>
												<ReviewFeedbackList editionId={edition.id} />
											</div>
										{/if}
									{:else}
										<div class="py-8 text-center text-base-content/60">
											<p>This edition has not been peer reviewed.</p>
										</div>
									{/if}
								{:else if activeTab === 'printables'}
									<div class="py-8 text-center text-base-content/60">
										<p>Printable resources will be available here.</p>
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

{#if dev && edition.id === 'demo'}
	<VoyagerAPIDemo />
{/if}

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

<!-- Delete confirmation modal -->
{#if canDelete}
	<dialog class="modal" class:modal-open={deleteConfirmOpen}>
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete this edition?</h3>
			<p class="py-4 text-base-content/70">
				"{edition.title}" will be permanently removed. This action cannot be undone.
			</p>
			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={() => (deleteConfirmOpen = false)}
					disabled={isDeleting}
				>
					Cancel
				</button>
				<button type="button" class="btn btn-error" onclick={deleteEdition} disabled={isDeleting}>
					{#if isDeleting}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Delete
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => (deleteConfirmOpen = false)}>close</button>
		</form>
	</dialog>
{/if}

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
		margin: 0 !important;
		max-height: none !important;
		height: auto !important;
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
</style>
