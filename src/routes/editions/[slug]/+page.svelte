<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const edition = data.edition;

	let activeTab = $state<'description' | 'metadata' | 'peer-review' | 'printables'>('description');
	let iframeElement: HTMLIFrameElement | undefined = $state();
	let isSidebarCollapsed = $state(false);

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
</script>

<svelte:head>
	<title>{edition.title} | Pure 3D</title>
	<meta name="description" content={edition.description} />

	<!-- Preconnect to Voyager API for faster loading -->
	<link rel="preconnect" href="https://3d-api.si.edu" crossorigin />
	<link rel="dns-prefetch" href="https://3d-api.si.edu" />
</svelte:head>

<div class="min-h-screen bg-base-100">
		<div class="container mx-auto px-4 py-8 max-w-7xl">
			<!-- Breadcrumbs -->
			<nav class="text-sm breadcrumbs mb-6">
				<ul>
					<li><a href="/" data-sveltekit-preload-data="hover" class="link link-hover">Home</a></li>
					<li><a href="/editions" data-sveltekit-preload-data="hover" class="link link-hover">Editions</a></li>
					<li class="text-base-content/70">{edition.title}</li>
				</ul>
			</nav>

			<!-- Main Content Grid -->
			<div class="relative flex flex-col lg:flex-row gap-8 transition-all duration-300">
				<!-- Left Column - 3D Viewer -->
				<div class="flex-1 space-y-6 min-w-0">
					<!-- Title and Authors -->
					<div>
						<div class="flex items-start gap-4">
							<h1 class="text-3xl md:text-4xl font-bold mb-2 flex-1">{edition.title}</h1>
							{#if edition.hasPeerReview}
								<div class="flex-shrink-0" title="This edition has been peer reviewed">
									<img
										src="/images/peer-reviewed-badge.svg"
										alt="Peer Reviewed"
										class="w-16 h-16 md:w-20 md:h-20"
									/>
								</div>
							{/if}
						</div>
						<p class="text-base-content/70">{edition.authors}</p>
					</div>

					<!-- Voyager 3D Viewer -->
					<div class="card bg-base-200 shadow-xl overflow-hidden">
						<div class="card-body p-0">
							<div class="relative w-full" style="padding-top: 75%; background: radial-gradient(ellipse at center, #35424F 0%, #03070B 100%);">
								<!-- Iframe with eager loading - persists across navigation -->
								<iframe
									bind:this={iframeElement}
									name="Smithsonian Voyager"
									src={edition.voyagerUrl}
									title={edition.title}
									class="absolute top-0 left-0 w-full h-full border-0"
									loading="eager"
									allow="xr; xr-spatial-tracking; fullscreen"
								></iframe>
							</div>
						</div>
					</div>

					<!-- Toolbar -->
					<div class="flex gap-2 justify-center">
						<button class="btn btn-sm btn-outline">Tools</button>
					</div>

					<!-- Usage Conditions -->
					<div class="alert alert-info">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="stroke-current shrink-0 w-6 h-6"
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
					class="transition-all duration-300 ease-in-out shrink-0"
					class:lg:w-80={!isSidebarCollapsed}
					class:lg:w-12={isSidebarCollapsed}
				>
					<!-- Collapsed State - Expand button -->
					<button
						onclick={toggleSidebar}
						class="hidden btn btn-circle btn-ghost bg-base-200 shadow-xl sticky top-4"
						class:lg:flex={isSidebarCollapsed}
						aria-label="Expand sidebar"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
					</button>

					<div
						class="card bg-base-200 shadow-xl sticky top-4 transition-all duration-300 overflow-hidden"
						class:lg:scale-x-0={isSidebarCollapsed}
						class:lg:opacity-0={isSidebarCollapsed}
						class:lg:origin-right={isSidebarCollapsed}
						class:lg:w-0={isSidebarCollapsed}
						class:lg:invisible={isSidebarCollapsed}
					>
						<div class="card-body p-0">
							<!-- Collapse Button -->
							<button
								onclick={toggleSidebar}
								class="hidden lg:flex absolute -left-3 top-6 btn btn-circle btn-sm btn-ghost bg-base-300 shadow z-10"
								aria-label="Collapse sidebar"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
								</svg>
							</button>

							<!-- Tabs -->
							<div class="tabs tabs-boxed bg-base-300 rounded-t-2xl">
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
							<div class="p-6 prose prose-sm max-w-none">
								{#if activeTab === 'description'}
									<p class="text-base-content/80 leading-relaxed">
										{edition.description}
									</p>

									<!-- Tags -->
									<div class="mt-6">
										<h3 class="text-sm font-semibold mb-2">Tags</h3>
										<div class="flex flex-wrap gap-2">
											{#each edition.tags as tag (tag)}
												<span class="badge badge-primary">{tag}</span>
											{/each}
										</div>
									</div>

									<!-- Links Section (Orange boxes from wireframe) -->
									<div class="mt-6 not-prose">
										<h3 class="text-sm font-semibold mb-3">Links to scene (deeplink)</h3>
										<div class="space-y-2">
											<div class="alert alert-warning">
												<span class="text-sm">
													(Voyager API id to the step/scene) add it to the url for sharing and
													cite?
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
									<div class="text-center text-base-content/60 py-8">
										<p>Peer review information will be displayed here.</p>
									</div>
								{:else if activeTab === 'printables'}
									<div class="text-center text-base-content/60 py-8">
										<p>Printable resources will be available here.</p>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>

		<!-- Back Button -->
		<div class="flex justify-center mt-12">
			<a href="/editions" data-sveltekit-preload-data="hover" class="btn btn-outline btn-lg">
				← Back to Editions
			</a>
		</div>
	</div>
</div>
