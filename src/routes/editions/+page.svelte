<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import FilterSidebar from '$lib/components/filters/FilterSidebar.svelte';
	import type { FilterState } from '$lib/types/collection';
	import {
		editionsStore,
		fetchEditions,
		isStale
	} from '$lib/stores/data.store';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import { EditionStatus } from '$lib/types/roles';
	import toast from 'svelte-french-toast';

	// Reactive data from persisted store
	let editions = $derived($editionsStore.items);
	let hasCachedData = $derived($editionsStore.items.length > 0);
	let isLoading = $state(true);

	onMount(async () => {
		// If we have fresh cached data, skip loading
		if (hasCachedData && !isStale($editionsStore.lastFetched)) {
			isLoading = false;
			return;
		}

		try {
			await fetchEditions();
		} catch (error) {
			console.error('Error loading editions:', error);
		} finally {
			isLoading = false;
		}
	});

	let searchQuery = $state('');
	let drawerOpen = $state(false);

	// Autocomplete state
	let showSuggestions = $state(false);
	let selectedIndex = $state(-1);
	let inputElement: HTMLInputElement | undefined = $state();
	let suggestionsElement: HTMLUListElement | undefined = $state();

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

	// Suggestions for autocomplete (max 6)
	const suggestions = $derived.by(() => {
		if (!searchQuery.trim()) return [];
		return filteredEditions.slice(0, 6);
	});

	function handleInput() {
		showSuggestions = searchQuery.trim().length > 0 && suggestions.length > 0;
		selectedIndex = -1;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!showSuggestions || suggestions.length === 0) {
			if (event.key === 'Escape') {
				searchQuery = '';
				inputElement?.blur();
			}
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectedIndex = selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0;
				scrollToSelected();
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1;
				scrollToSelected();
				break;
			case 'Enter':
				event.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
					navigateToEdition(suggestions[selectedIndex]);
				}
				break;
			case 'Escape':
				event.preventDefault();
				showSuggestions = false;
				selectedIndex = -1;
				break;
			case 'Tab':
				showSuggestions = false;
				selectedIndex = -1;
				break;
		}
	}

	function scrollToSelected() {
		requestAnimationFrame(() => {
			const selected = suggestionsElement?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
			selected?.scrollIntoView({ block: 'nearest' });
		});
	}

	function navigateToEdition(edition: typeof editions[0]) {
		showSuggestions = false;
		selectedIndex = -1;
		searchQuery = '';
		goto(`${base}/editions/${edition.id}`);
	}

	function handleFocus() {
		if (searchQuery.trim() && suggestions.length > 0) {
			showSuggestions = true;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.search-container')) {
			showSuggestions = false;
			selectedIndex = -1;
		}
	}

	function clearSearch() {
		searchQuery = '';
		showSuggestions = false;
		selectedIndex = -1;
		inputElement?.focus();
	}

	function handleFilterChange(newFilters: FilterState) {
		filters = newFilters;
	}

	function closeDrawer() {
		drawerOpen = false;
	}

	let isCreating = $state(false);

	async function createEdition() {
		if (!authStore.isAuthenticated || !authStore.appUserId) {
			toast.error('Please sign in to create an edition');
			return;
		}
		isCreating = true;
		try {
			const record = await pb.collection('editions').create({
				title: 'Untitled Edition',
				dcTitle: 'Untitled Edition',
				status: EditionStatus.Draft,
				isPublished: false
			});

			try {
				await pb.collection('editionUsers').create({
					edition: record.id,
					editionId: record.id,
					user: authStore.appUserId,
					userId: authStore.appUserId,
					role: 'author'
				});
			} catch {
				// Non-critical
			}

			goto(`${base}/editions/${record.id}/workflow`);
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to create edition';
			toast.error(message);
		} finally {
			isCreating = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

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
			<div class="mb-8 flex items-start justify-between gap-4">
				<div>
					<h1 class="text-3xl md:text-4xl font-bold mb-2">Editions</h1>
					<p class="text-base-content/70">
						Browse our collection of 3D scholarly editions
					</p>
				</div>
				{#if authStore.isAuthenticated}
					<button
						class="btn btn-primary btn-sm flex-none"
						onclick={createEdition}
						disabled={isCreating}
					>
						{#if isCreating}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						+ New Edition
					</button>
				{/if}
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

				<!-- Search input with autocomplete -->
				<div class="flex-1 search-container relative">
					<div class="relative">
						<svg
							class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-base-content/50"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						<input
							type="text"
							bind:this={inputElement}
							bind:value={searchQuery}
							oninput={handleInput}
							onfocus={handleFocus}
							onkeydown={handleKeydown}
							placeholder="Search editions..."
							class="input input-bordered w-full pl-10 pr-10"
							role="combobox"
							aria-expanded={showSuggestions}
							aria-haspopup="listbox"
							aria-autocomplete="list"
							aria-controls="edition-suggestions"
						/>
						{#if searchQuery}
							<button
								type="button"
								onclick={clearSearch}
								class="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
								aria-label="Clear search"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</div>

					<!-- Autocomplete Suggestions Dropdown -->
					{#if showSuggestions && suggestions.length > 0}
						<ul
							bind:this={suggestionsElement}
							id="edition-suggestions"
							class="absolute z-50 w-full mt-1 bg-base-100 rounded-box shadow-xl border border-base-300 max-h-80 overflow-y-auto"
							role="listbox"
						>
							{#each suggestions as suggestion, index (suggestion.id)}
								{@const isSelected = selectedIndex === index}
								<li role="option" aria-selected={isSelected}>
									<button
										type="button"
										data-index={index}
										class="w-full px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 text-left {isSelected ? 'bg-primary text-primary-content' : 'hover:bg-base-200'}"
										onclick={() => navigateToEdition(suggestion)}
										onmouseenter={() => (selectedIndex = index)}
									>
										{#if suggestion.thumbnail}
											<img
												src={suggestion.thumbnail}
												alt=""
												class="w-10 h-10 rounded object-cover shrink-0"
											/>
										{:else}
											<div class="w-10 h-10 rounded bg-base-300 flex items-center justify-center shrink-0">
												<svg class="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
												</svg>
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<div class="font-medium truncate">{suggestion.title}</div>
											{#if suggestion.authors}
												<div class="text-sm opacity-60 truncate">{suggestion.authors}</div>
											{:else if suggestion.description}
												<div class="text-sm opacity-60 truncate">{suggestion.description.slice(0, 60)}{suggestion.description.length > 60 ? '...' : ''}</div>
											{/if}
										</div>
										{#if suggestion.hasPeerReview}
											<span class="badge badge-sm {isSelected ? 'badge-primary-content' : 'badge-success'}">Peer reviewed</span>
										{/if}
									</button>
								</li>
							{/each}
							<li class="px-3 py-2 text-xs text-base-content/50 border-t border-base-200 flex items-center gap-4">
								<span><kbd class="kbd kbd-xs">↑</kbd><kbd class="kbd kbd-xs">↓</kbd> navigate</span>
								<span><kbd class="kbd kbd-xs">Enter</kbd> select</span>
								<span><kbd class="kbd kbd-xs">Esc</kbd> close</span>
							</li>
						</ul>
					{/if}
				</div>
			</div>

			<!-- Results count -->
			{#if !isLoading || hasCachedData}
				<div class="text-sm text-base-content/70 mb-4">
					Showing {filteredEditions.length} of {editions.length} editions
				</div>
			{/if}

			<!-- Editions Grid -->
			{#if isLoading && !hasCachedData}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4"
				>
					{#each Array(15) as _}
						<div class="h-64 skeleton rounded-xl"></div>
					{/each}
				</div>
			{:else if filteredEditions.length > 0}
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
