<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import { editionsStore, collectionsStore, fetchAllData, isStale } from '$lib/stores/data.store';

	// Reactive data from persisted stores - shows cached data immediately
	let featuredEditions = $derived($editionsStore.items.slice(0, 8));
	let collections = $derived($collectionsStore.items);
	let totalEditions = $derived($editionsStore.total);
	let totalCollections = $derived($collectionsStore.total);

	// Only show loading if we have no cached data
	let hasCachedData = $derived(
		$editionsStore.items.length > 0 || $collectionsStore.items.length > 0
	);
	let isLoading = $state(true);

	/**
	 * Preloads images for the /collections and /editions pages during browser idle time.
	 *
	 * WHY: When users navigate from the home page to collections/editions, images would
	 * normally load on demand, causing a visible "pop-in" effect. By preloading the first
	 * fold of thumbnails (~30 images) while the user is viewing the home page, we ensure
	 * instant image display on navigation, creating a smoother browsing experience.
	 *
	 * HOW: Uses requestIdleCallback to load images only when the browser is idle, avoiding
	 * any performance impact on the current page. Images are loaded sequentially (one at a
	 * time) to avoid competing with user-initiated requests. Once loaded, images are cached
	 * by the browser and served instantly when the user navigates.
	 *
	 * LIMITS: Only preloads ~30 images (first fold) to balance UX improvement vs bandwidth
	 * cost (~1.5-3MB). Users on slow connections won't notice any slowdown since loading
	 * happens during idle time with low priority.
	 */
	function preloadImages(urls: string[]) {
		const validUrls = urls.filter(Boolean);
		if (!validUrls.length) return;

		const loadNext = (index: number) => {
			if (index >= validUrls.length) return;

			const img = new Image();
			img.onload = img.onerror = () => {
				if ('requestIdleCallback' in window) {
					requestIdleCallback(() => loadNext(index + 1), { timeout: 1000 });
				} else {
					setTimeout(() => loadNext(index + 1), 50);
				}
			};
			img.src = validUrls[index];
		};

		// Start preloading after initial render completes
		if ('requestIdleCallback' in window) {
			requestIdleCallback(() => loadNext(0), { timeout: 2000 });
		} else {
			setTimeout(() => loadNext(0), 500);
		}
	}

	// Carousel state
	let carouselContainer: HTMLDivElement | undefined = $state();

	function scrollCarousel(direction: 'left' | 'right') {
		if (!carouselContainer) return;
		const scrollAmount = 320;
		carouselContainer.scrollBy({
			left: direction === 'left' ? -scrollAmount : scrollAmount,
			behavior: 'smooth'
		});
	}

	onMount(async () => {
		// If we have cached data and it's not stale, skip the loading spinner
		const editionsStale = isStale($editionsStore.lastFetched);
		const collectionsStale = isStale($collectionsStore.lastFetched);

		if (hasCachedData && !editionsStale && !collectionsStale) {
			isLoading = false;
			// Still preload images for other pages
			const firstFoldThumbnails = [
				...$editionsStore.items.slice(0, 15).map((e) => e.thumbnail),
				...$collectionsStore.items.slice(0, 15).map((c) => c.thumbnail)
			];
			preloadImages(firstFoldThumbnails);
			return;
		}

		// Fetch fresh data (stores will update automatically)
		try {
			const { editions, collections: cols } = await fetchAllData();

			// Preload first fold of thumbnails for collections/editions pages (~30 total)
			const firstFoldThumbnails = [
				...editions.slice(0, 15).map((e) => e.thumbnail),
				...cols.slice(0, 15).map((c) => c.thumbnail)
			];
			preloadImages(firstFoldThumbnails);
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			isLoading = false;
		}
	});
</script>

<svelte:head>
	<title>Pure 3D | Explore 3D Scholarly Editions</title>
	<meta
		name="description"
		content="Explore our 3D Scholarly Editions and create your own. Pure3D is a platform for digital humanities and heritage 3D collections."
	/>
</svelte:head>

<div class="min-h-screen">
	<!-- Hero Section -->
	<section class="container mx-auto px-4 py-16 text-center">
		<h1 class="mb-6 text-4xl leading-tight font-bold md:text-5xl lg:text-6xl">
			Explore our <span class="text-primary">3D Scholarly Editions</span>
			<br />
			and create your own
		</h1>
		<p class="mx-auto mb-8 max-w-3xl text-lg text-base-content/70 md:text-xl">
			Pure3D is a platform for publishing and exploring interactive 3D experiences for digital
			humanities and cultural heritage research.
		</p>
		<div class="flex flex-wrap justify-center gap-4">
			<a href="{base}/editions" class="btn btn-lg btn-primary">
				Browse Editions
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="ml-1 h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 7l5 5m0 0l-5 5m5-5H6"
					/>
				</svg>
			</a>
			<a href="{base}/collections" class="btn btn-outline btn-lg">View Collections</a>
		</div>
	</section>

	<!-- Stats Section -->
	<section class="bg-base-200/50 py-8">
		<div class="container mx-auto px-4">
			<div class="flex flex-wrap justify-center gap-8 md:gap-16">
				<div class="text-center">
					{#if isLoading && !hasCachedData}
						<div class="loading loading-md loading-spinner text-primary"></div>
					{:else}
						<div class="text-4xl font-bold text-primary">{totalEditions}</div>
					{/if}
					<div class="text-sm tracking-wide text-base-content/70 uppercase">3D Editions</div>
				</div>
				<div class="text-center">
					{#if isLoading && !hasCachedData}
						<div class="loading loading-md loading-spinner text-primary"></div>
					{:else}
						<div class="text-4xl font-bold text-primary">{totalCollections}</div>
					{/if}
					<div class="text-sm tracking-wide text-base-content/70 uppercase">Projects</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Featured Editions Carousel -->
	<section class="py-16">
		<div class="container mx-auto px-4">
			<div class="mb-8 flex items-center justify-between">
				<h2 class="text-2xl font-bold md:text-3xl">Featured 3D Editions</h2>
				<div class="flex gap-2">
					<button
						onclick={() => scrollCarousel('left')}
						class="btn btn-circle btn-outline btn-sm"
						aria-label="Scroll left"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>
					<button
						onclick={() => scrollCarousel('right')}
						class="btn btn-circle btn-outline btn-sm"
						aria-label="Scroll right"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
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
				</div>
			</div>

			{#if isLoading && !hasCachedData}
				<div class="flex gap-4 overflow-hidden">
					{#each Array(4) as _}
						<div class="h-80 w-64 flex-none skeleton rounded-xl"></div>
					{/each}
				</div>
			{:else if featuredEditions.length > 0}
				<div
					bind:this={carouselContainer}
					class="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
					style="scroll-behavior: smooth; -webkit-overflow-scrolling: touch;"
				>
					{#each featuredEditions as edition (edition.id)}
						<div class="w-64 flex-none snap-start">
							<EditionCard {edition} />
						</div>
					{/each}
				</div>
			{:else}
				<div class="py-12 text-center text-base-content/50">No editions available yet.</div>
			{/if}

			<div class="mt-8 text-center">
				<a href="{base}/editions" class="btn btn-outline">
					View All Editions
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="ml-1 h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 7l5 5m0 0l-5 5m5-5H6"
						/>
					</svg>
				</a>
			</div>
		</div>
	</section>

	<!-- Collections/Projects Section -->
	<section class="bg-base-200/30 py-16">
		<div class="container mx-auto px-4">
			<div class="mb-10 text-center">
				<h2 class="mb-3 text-2xl font-bold md:text-3xl">3D Projects</h2>
				<p class="mx-auto max-w-2xl text-base-content/70">
					Explore curated collections of 3D scholarly editions organized by research projects
				</p>
			</div>

			{#if isLoading && !hasCachedData}
				<div
					class="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
				>
					{#each Array(4) as _}
						<div class="h-96 skeleton rounded-xl"></div>
					{/each}
				</div>
			{:else if collections.length > 0}
				<div
					class="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
				>
					{#each collections.slice(0, 4) as collection (collection.id)}
						<CollectionCard {collection} />
					{/each}
				</div>

				{#if collections.length > 4}
					<div class="mt-10 text-center">
						<a href="{base}/collections" class="btn btn-outline">
							View All Projects
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="ml-1 h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 7l5 5m0 0l-5 5m5-5H6"
								/>
							</svg>
						</a>
					</div>
				{/if}
			{:else}
				<div class="py-12 text-center text-base-content/50">No projects available yet.</div>
			{/if}
		</div>
	</section>

	<!-- CTA Section - Publish With Us -->
	<section class="py-20">
		<div class="container mx-auto px-4">
			<div
				class="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-primary/20 via-base-200 to-secondary/20 p-8 text-center md:p-12"
			>
				<h2 class="mb-4 text-2xl font-bold md:text-3xl">Publish with us</h2>
				<p class="mx-auto mb-8 max-w-2xl text-base-content/70">
					Are you working on a 3D scholarly edition? Pure3D provides the infrastructure and tools to
					publish your interactive 3D research. Join our growing community of digital humanities
					scholars.
				</p>
				<a href="{base}/documentation/submission" class="btn btn-lg btn-primary">
					Submission Guidelines
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="ml-1 h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 7l5 5m0 0l-5 5m5-5H6"
						/>
					</svg>
				</a>
			</div>
		</div>
	</section>

	<!-- Partners Section -->
	<section class="border-t border-base-300 py-12">
		<div class="container mx-auto px-4">
			<p class="mb-6 text-center text-sm tracking-wide text-base-content/50 uppercase">
				Supported by
			</p>
			<div class="flex flex-wrap items-center justify-center gap-8 opacity-60 md:gap-12">
				<div class="text-sm text-base-content/50">Maastricht University</div>
				<div class="text-sm text-base-content/50">Platform Digital Infrastructure</div>
				<div class="text-sm text-base-content/50">KNAW Digital Infrastructure</div>
			</div>
		</div>
	</section>
</div>

<style>
	/* Hide scrollbar but keep functionality */
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
