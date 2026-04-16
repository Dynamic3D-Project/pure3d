<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import {
		collectionsStore,
		fetchCollections,
		isStale
	} from '$lib/stores/data.store';

	// Reactive data from persisted store
	let collections = $derived($collectionsStore.items ?? []);
	let hasCachedData = $derived(($collectionsStore.items ?? []).length > 0);
	let isLoading = $state(true);

	onMount(async () => {
		// If we have fresh cached data, skip loading
		if (hasCachedData && !isStale($collectionsStore.lastFetched)) {
			isLoading = false;
			return;
		}

		try {
			await fetchCollections();
		} catch (error) {
			console.error('Error loading collections:', error);
		} finally {
			isLoading = false;
		}
	});

	// Search state
	let searchQuery = $state('');
	let showSuggestions = $state(false);
	let selectedIndex = $state(-1);
	let inputElement: HTMLInputElement | undefined = $state();
	let suggestionsElement: HTMLUListElement | undefined = $state();

	// Filter collections based on search query
	const filteredCollections = $derived.by(() => {
		if (!searchQuery.trim()) return collections;
		const query = searchQuery.toLowerCase();
		return collections.filter(
			(c) =>
				c.title.toLowerCase().includes(query) ||
				c.description.toLowerCase().includes(query)
		);
	});

	// Suggestions for autocomplete (max 6)
	const suggestions = $derived.by(() => {
		if (!searchQuery.trim()) return [];
		return filteredCollections.slice(0, 6);
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
					navigateToCollection(suggestions[selectedIndex]);
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

	function navigateToCollection(collection: typeof collections[0]) {
		showSuggestions = false;
		selectedIndex = -1;
		searchQuery = '';
		goto(`${base}/collections/${collection.id}`);
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
</script>

<svelte:window onclick={handleClickOutside} />

<svelte:head>
	<title>Explore Our Collections | Pure 3D</title>
	<meta
		name="description"
		content="Discover our curated 3D collections showcasing digital humanities and cultural heritage artifacts."
	/>
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-7xl">
	<!-- Hero Section -->
	<div class="text-center mb-12">
		<h1 class="text-4xl md:text-5xl font-bold mb-4">Explore our Collections</h1>
		<p class="text-lg text-base-content/70 max-w-2xl mx-auto">
			A Virtual Research Environment for 3D Digital Humanities And Heritage
		</p>
	</div>

	<!-- Search Section -->
	<div class="mb-8 max-w-xl mx-auto">
		<div class="search-container relative">
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
					placeholder="Search collections..."
					class="input input-bordered w-full pl-10 pr-10"
					role="combobox"
					aria-expanded={showSuggestions}
					aria-haspopup="listbox"
					aria-autocomplete="list"
					aria-controls="collection-suggestions"
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
					id="collection-suggestions"
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
								onclick={() => navigateToCollection(suggestion)}
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
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
										</svg>
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<div class="font-medium truncate">{suggestion.title}</div>
									{#if suggestion.description}
										<div class="text-sm opacity-60 truncate">{suggestion.description.slice(0, 60)}{suggestion.description.length > 60 ? '...' : ''}</div>
									{/if}
								</div>
								{#if suggestion.editionCount !== undefined}
									<span class="badge badge-sm {isSelected ? 'badge-primary-content' : 'badge-ghost'}">{suggestion.editionCount} editions</span>
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

		<!-- Results count when filtering -->
		{#if searchQuery.trim()}
			<div class="text-sm text-base-content/70 mt-2 text-center">
				Showing {filteredCollections.length} of {collections.length} collections
			</div>
		{/if}
	</div>

	<!-- Masonry Grid -->
	{#if isLoading && !hasCachedData}
		<div class="masonry-grid">
			{#each Array(8) as _}
				<div class="masonry-item">
					<div class="h-64 skeleton rounded-xl"></div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="masonry-grid">
			{#each filteredCollections as collection (collection.id)}
				<div class="masonry-item">
					<CollectionCard {collection} />
				</div>
			{/each}
		</div>
	{/if}

	<!-- Empty state -->
	{#if filteredCollections.length === 0 && searchQuery.trim()}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<svg
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
			<h3 class="text-lg font-medium mb-2">No collections found</h3>
			<p class="text-base-content/60 max-w-md">
				No collections match "{searchQuery}". Try a different search term.
			</p>
			<button class="btn btn-primary btn-sm mt-4" onclick={clearSearch}>
				Clear search
			</button>
		</div>
	{/if}
</div>

<style>
	.masonry-grid {
		column-count: 1;
		column-gap: 1.5rem;
	}

	@media (min-width: 640px) {
		.masonry-grid {
			column-count: 2;
		}
	}

	@media (min-width: 1024px) {
		.masonry-grid {
			column-count: 3;
		}
	}

	@media (min-width: 1280px) {
		.masonry-grid {
			column-count: 4;
		}
	}

	.masonry-item {
		break-inside: avoid;
		margin-bottom: 1.5rem;
		display: inline-block;
		width: 100%;
	}
</style>
