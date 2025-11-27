<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const edition = data.edition;
	const viewerHelp = data.viewerHelp;
	const viewerHelpVideoUrl = data.viewerHelpVideoUrl;

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
	let iframeElement: HTMLIFrameElement | undefined = $state();
	let isSidebarCollapsed = $state(false);
	let helpModalOpen = $state(false);

	// Watch for URL changes and update iframe src
	$effect(() => {
		const voyagerUrl = edition.voyagerUrl;
		if (iframeElement && voyagerUrl && iframeElement.src !== voyagerUrl) {
			iframeElement.src = voyagerUrl;
		}
	});

	function toggleSidebar() {
		isSidebarCollapsed = !isSidebarCollapsed;
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
</script>

<svelte:head>
	<title>{edition.title} | Pure 3D</title>
	<meta name="description" content={edition.description} />

	<!-- Preconnect to Voyager API for faster loading -->
	<link rel="preconnect" href="https://3d-api.si.edu" crossorigin />
	<link rel="dns-prefetch" href="https://3d-api.si.edu" />
</svelte:head>

<div class="min-h-screen bg-base-100">
	<div class="container mx-auto max-w-7xl px-4 py-8">
		<!-- Breadcrumbs -->
		<nav class="breadcrumbs mb-6 text-sm">
			<ul>
				<li><a href="/" data-sveltekit-preload-data="hover" class="link link-hover">Home</a></li>
				<li>
					<a href="/editions" data-sveltekit-preload-data="hover" class="link link-hover"
						>Editions</a
					>
				</li>
				<li class="text-base-content/70">{edition.title}</li>
			</ul>
		</nav>

		<!-- Main Content Grid -->
		<div class="relative flex flex-col gap-8 transition-all duration-300 lg:flex-row">
			<!-- Left Column - 3D Viewer -->
			<div class="min-w-0 flex-1 space-y-6">
				<!-- Title and Authors -->
				<div>
					<div class="flex items-start gap-4">
						<h1 class="mb-2 flex-1 text-3xl font-bold md:text-4xl">{edition.title}</h1>
						{#if edition.hasPeerReview}
							<div class="flex-shrink-0" title="This edition has been peer reviewed">
								<img
									src="/images/peer-reviewed-badge.svg"
									alt="Peer Reviewed"
									class="h-16 w-16 md:h-20 md:w-20"
								/>
							</div>
						{/if}
					</div>
					<p class="text-base-content/70">{edition.authors}</p>
				</div>

				<!-- Voyager 3D Viewer -->
				<div class="card overflow-hidden bg-base-200 shadow-xl">
					<div class="card-body p-0">
						<div
							class="relative w-full"
							style="padding-top: 75%; background: radial-gradient(ellipse at center, #35424F 0%, #03070B 100%);"
						>
							<!-- Iframe with eager loading - persists across navigation -->
							<iframe
								bind:this={iframeElement}
								name="Smithsonian Voyager"
								src={edition.voyagerUrl}
								title={edition.title}
								class="absolute top-0 left-0 h-full w-full border-0"
								loading="eager"
								allow="xr; xr-spatial-tracking; fullscreen"
							></iframe>

							<!-- Help info button - top right corner -->
							{#if viewerHelp || viewerHelpVideoUrl}
								<button
									type="button"
									class="btn absolute top-3 right-3 btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
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
					</div>
				</div>

				<!-- Toolbar -->
				<div class="flex justify-center gap-2">
					<button class="btn btn-outline btn-sm">Tools</button>
				</div>

				<!-- Usage Conditions -->
				<div class="alert alert-info">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="h-6 w-6 shrink-0 stroke-current"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<div>
						<div class="font-bold">Usage Conditions: {edition.usageConditions}</div>
						{#if edition.alternativeVersion}
							<div class="text-sm">
								<a href={edition.alternativeVersion} class="link">Alternative version</a>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Right Column - Tabs and Content -->
			<div
				class="shrink-0 transition-all duration-300 ease-in-out"
				class:lg:w-96={!isSidebarCollapsed}
				class:lg:w-0={isSidebarCollapsed}
			>
				<div class="relative lg:sticky lg:top-4">
					<!-- Toggle Button - Attached to sidebar edge -->
					<button
						onclick={toggleSidebar}
						class="btn absolute top-8 -left-4 z-10 hidden h-16 min-h-0 w-4 rounded-l-lg rounded-r-none p-0 shadow-lg btn-sm btn-primary lg:flex"
						aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 transition-transform duration-300"
							class:rotate-180={isSidebarCollapsed}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>

					<div
						class="card overflow-hidden bg-base-200 shadow-xl transition-all duration-300"
						class:lg:w-0={isSidebarCollapsed}
						class:lg:opacity-0={isSidebarCollapsed}
						class:lg:invisible={isSidebarCollapsed}
					>
						<div class="card-body w-96 p-0">
							<!-- Tabs -->
							<div class="tabs-boxed tabs rounded-t-2xl bg-base-300">
								<button
									class="tab flex-1"
									class:tab-active={activeTab === 'description'}
									onclick={() => (activeTab = 'description')}
								>
									Description
								</button>
								<button
									class="tab flex-1"
									class:tab-active={activeTab === 'metadata'}
									onclick={() => (activeTab = 'metadata')}
								>
									Metadata
								</button>
								<button
									class="tab flex-1"
									class:tab-active={activeTab === 'peer-review'}
									onclick={() => (activeTab = 'peer-review')}
								>
									Peer Review
								</button>
								<button
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
										{edition.description}
									</p>

									<!-- Tags -->
									<div class="mt-6">
										<h3 class="mb-2 text-sm font-semibold">Tags</h3>
										<div class="flex flex-wrap gap-2">
											{#each edition.tags as tag (tag)}
												<span class="badge badge-primary">{tag}</span>
											{/each}
										</div>
									</div>

									<!-- Links Section (Orange boxes from wireframe) -->
									<div class="not-prose mt-6">
										<h3 class="mb-3 text-sm font-semibold">Links to scene (deeplink)</h3>
										<div class="space-y-2">
											<div class="alert alert-warning">
												<span class="text-sm">
													(Voyager API id to the step/scene) add it to the url for sharing and cite?
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
													src="/images/peer-reviewed-badge.svg"
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

		<!-- Back Button -->
		<div class="mt-12 flex justify-center">
			<a href="/editions" data-sveltekit-preload-data="hover" class="btn btn-outline btn-lg">
				← Back to Editions
			</a>
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
