<script lang="ts">
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import FilterSidebar from '$lib/components/filters/FilterSidebar.svelte';
	import type { PageData } from './$types';
	import type { FilterState } from '$lib/types/collection';

	let { data }: { data: PageData } = $props();

	const editions = data.editions;

	let searchQuery = $state('');
	let drawerOpen = $state(false);

	// Initialize filter state
	let filters = $state<FilterState>({
		dcSubject: [],
		dcAudience: [],
		dcLanguage: [],
		dcCoverageCountry: [],
		dcCoveragePeriod: []
	});

	// Count active filters for mobile badge
	const activeFilterCount = $derived(
		Object.values(filters).reduce((sum, arr) => sum + arr.length, 0)
	);

	// Filter editions based on search and category filters
	const filteredEditions = $derived.by(() => {
		let result = editions;

		// Text search
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(edition) =>
					edition.title.toLowerCase().includes(query) ||
					edition.description.toLowerCase().includes(query) ||
					edition.authors.toLowerCase().includes(query)
			);
		}

		// Category filters (AND between categories, OR within category)
		for (const [key, selectedValues] of Object.entries(filters) as [
			keyof FilterState,
			string[]
		][]) {
			if (selectedValues.length > 0) {
				result = result.filter((edition) => {
					const editionValues = edition[key];
					if (!Array.isArray(editionValues)) return false;
					// OR logic: edition matches if it has ANY of the selected values
					return selectedValues.some((selected) => editionValues.includes(selected));
				});
			}
		}

		return result;
	});

	function handleFilterChange(newFilters: FilterState) {
		filters = newFilters;
	}

	function closeDrawer() {
		drawerOpen = false;
	}
</script>

<svelte:head>
	<title>All Editions | Pure 3D</title>
	<meta
		name="description"
		content="Browse all 3D editions in our digital humanities and heritage collection."
	/>
	<link rel="preconnect" href="https://3d-api.si.edu" crossorigin="anonymous" />
	<link rel="dns-prefetch" href="https://3d-api.si.edu" />
</svelte:head>

<!-- Drawer wrapper for mobile -->
<div class="drawer lg:drawer-open">
	<input
		id="filter-drawer"
		type="checkbox"
		class="drawer-toggle"
		bind:checked={drawerOpen}
	/>

	<!-- Main content -->
	<div class="drawer-content">
		<div class="container mx-auto px-4 py-8 max-w-7xl">
			<!-- Header -->
			<div class="mb-8">
				<h1 class="text-3xl md:text-4xl font-bold mb-2">Editions</h1>
				<p class="text-base-content/70">
					Browse our collection of 3D scholarly editions
				</p>
			</div>

			<!-- Search and Filter Button (mobile) -->
			<div class="flex gap-3 mb-6">
				<!-- Mobile filter button -->
				<label
					for="filter-drawer"
					class="btn btn-outline lg:hidden flex-none"
					aria-label="Open filters"
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
							d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
						/>
					</svg>
					Filters
					{#if activeFilterCount > 0}
						<span class="badge badge-primary badge-sm">{activeFilterCount}</span>
					{/if}
				</label>

				<!-- Search input -->
				<div class="flex-1">
					<div class="relative">
						<input
							type="text"
							placeholder="Search editions..."
							class="input input-bordered w-full pl-10"
							bind:value={searchQuery}
						/>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</div>
				</div>
			</div>

			<!-- Results count -->
			<div class="text-sm text-base-content/70 mb-4">
				Showing {filteredEditions.length} of {editions.length} editions
			</div>

			<!-- Editions Grid -->
			{#if filteredEditions.length > 0}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4"
				>
					{#each filteredEditions as edition (edition.id)}
						<EditionCard {edition} />
					{/each}
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-16 w-16 text-base-content/30 mb-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<h3 class="text-lg font-medium mb-2">No editions found</h3>
					<p class="text-base-content/60 max-w-md">
						No editions match your current filters. Try adjusting your search or clearing some
						filters.
					</p>
					{#if activeFilterCount > 0}
						<button
							class="btn btn-primary btn-sm mt-4"
							onclick={() => {
								filters = {
									dcSubject: [],
									dcAudience: [],
									dcLanguage: [],
									dcCoverageCountry: [],
									dcCoveragePeriod: []
								};
								searchQuery = '';
							}}
						>
							Clear all filters
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Sidebar drawer -->
	<div class="drawer-side z-40">
		<label for="filter-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<div class="bg-base-100 min-h-full w-72 p-4 pt-20 lg:pt-4 border-r border-base-300">
			<!-- Close button for mobile -->
			<div class="flex justify-between items-center mb-4 lg:hidden">
				<span class="font-semibold">Filters</span>
				<button class="btn btn-ghost btn-sm btn-circle" onclick={closeDrawer} aria-label="Close filters">
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
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<FilterSidebar {editions} {filters} onFilterChange={handleFilterChange} />
		</div>
	</div>
</div>
