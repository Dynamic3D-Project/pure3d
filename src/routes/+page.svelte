<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import {
		editionsStore,
		collectionsStore,
		fetchAllData,
		isStale
	} from '$lib/stores/data.store';

	// Reactive data from persisted stores - shows cached data immediately
	let featuredEditions = $derived($editionsStore.items.slice(0, 8));
	let collections = $derived($collectionsStore.items);
	let totalEditions = $derived($editionsStore.total);
	let totalCollections = $derived($collectionsStore.total);

	// Only show loading if we have no cached data
	let hasCachedData = $derived($editionsStore.items.length > 0 || $collectionsStore.items.length > 0);
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
		<h1 class="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
			Explore our <span class="text-primary">3D Scholarly Editions</span>
			<br />
			and create your own
		</h1>
		<p class="text-lg md:text-xl text-base-content/70 max-w-3xl mx-auto mb-8">
			Pure3D is a platform for publishing and exploring interactive 3D experiences for digital
			humanities and cultural heritage research.
		</p>
		<div class="flex flex-wrap gap-4 justify-center">
			<a href="{base}/editions" class="btn btn-primary btn-lg">
				Browse Editions
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 ml-1"
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
						<div class="loading loading-spinner loading-md text-primary"></div>
					{:else}
						<div class="text-4xl font-bold text-primary">{totalEditions}</div>
					{/if}
					<div class="text-sm text-base-content/70 uppercase tracking-wide">3D Editions</div>
				</div>
				<div class="text-center">
					{#if isLoading && !hasCachedData}
						<div class="loading loading-spinner loading-md text-primary"></div>
					{:else}
						<div class="text-4xl font-bold text-primary">{totalCollections}</div>
					{/if}
					<div class="text-sm text-base-content/70 uppercase tracking-wide">Projects</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Featured Editions Carousel -->
	<section class="py-16">
		<div class="container mx-auto px-4">
			<div class="flex items-center justify-between mb-8">
				<h2 class="text-2xl md:text-3xl font-bold">Featured 3D Editions</h2>
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
						<div class="flex-none w-64 h-80 skeleton rounded-xl"></div>
					{/each}
				</div>
			{:else if featuredEditions.length > 0}
				<div
					bind:this={carouselContainer}
					class="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
					style="scroll-behavior: smooth; -webkit-overflow-scrolling: touch;"
				>
					{#each featuredEditions as edition (edition.id)}
						<div class="flex-none w-64 snap-start">
							<EditionCard {edition} />
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-12 text-base-content/50">
					No editions available yet.
				</div>
			{/if}

			<div class="text-center mt-8">
				<a href="{base}/editions" class="btn btn-outline">
					View All Editions
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 ml-1"
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
			<div class="text-center mb-10">
				<h2 class="text-2xl md:text-3xl font-bold mb-3">3D Projects</h2>
				<p class="text-base-content/70 max-w-2xl mx-auto">
					Explore curated collections of 3D scholarly editions organized by research projects
				</p>
			</div>

			{#if isLoading && !hasCachedData}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-6xl mx-auto">
					{#each Array(4) as _}
						<div class="h-96 skeleton rounded-xl"></div>
					{/each}
				</div>
			{:else if collections.length > 0}
				<div
					class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-6xl mx-auto"
				>
					{#each collections.slice(0, 4) as collection (collection.id)}
						<CollectionCard {collection} />
					{/each}
				</div>

				{#if collections.length > 4}
					<div class="text-center mt-10">
						<a href="{base}/collections" class="btn btn-outline">
							View All Projects
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4 ml-1"
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
				<div class="text-center py-12 text-base-content/50">
					No projects available yet.
				</div>
			{/if}
		</div>
	</section>

	<!-- CTA Section - Publish With Us -->
	<section class="py-20">
		<div class="container mx-auto px-4">
			<div
				class="bg-gradient-to-br from-primary/20 via-base-200 to-secondary/20 rounded-3xl p-8 md:p-12 text-center max-w-4xl mx-auto"
			>
				<h2 class="text-2xl md:text-3xl font-bold mb-4">Publish with us</h2>
				<p class="text-base-content/70 mb-8 max-w-2xl mx-auto">
					Are you working on a 3D scholarly edition? Pure3D provides the infrastructure and tools
					to publish your interactive 3D research. Join our growing community of digital humanities
					scholars.
				</p>
				<a href="{base}/about" class="btn btn-primary btn-lg">
					Learn More
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 ml-1"
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
			<p class="text-center text-sm text-base-content/50 mb-6 uppercase tracking-wide">
				Supported by
			</p>
			<div class="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60">
				<div class="text-base-content/50 text-sm">Maastricht University</div>
				<div class="text-base-content/50 text-sm">Platform Digital Infrastructure</div>
				<div class="text-base-content/50 text-sm">KNAW Digital Infrastructure</div>
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
