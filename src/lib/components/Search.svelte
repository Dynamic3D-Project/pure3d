<script lang="ts">
	import { base } from '$app/paths';
	import { pb } from '$lib/database';
	import { debounce } from '$lib/utils/debounce';
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { computePosition, flip, shift, offset, size, autoUpdate } from '@floating-ui/dom';

	import { getEditionThumbnailUrl, getCollectionThumbnailUrl } from '$lib/utils/asset-urls';

	type SearchResultType = 'edition' | 'collection';

	interface SearchResult {
		type: SearchResultType;
		id: string;
		title: string;
		subtitle?: string;
		thumbnail?: string;
		url: string;
	}

	let searchQuery = $state('');
	let searching = $state(false);
	let results = $state<SearchResult[]>([]);
	let showResults = $state(false);
	let selectedIndex = $state(-1);

	let containerElement: HTMLDivElement | undefined = $state();
	let searchInputElement: HTMLInputElement | undefined = $state();
	let dropdownElement: HTMLDivElement | undefined = $state();
	let resultsListElement: HTMLElement | undefined = $state();
	let cleanupAutoUpdate: (() => void) | undefined;

	async function performSearch(query: string) {
		const trimmedQuery = query.trim();

		if (!trimmedQuery && !showResults) {
			results = [];
			selectedIndex = -1;
			return;
		}

		searching = true;

		try {
			// Use fetch API directly to avoid PocketBase client issues
			const baseUrl = pb.baseUrl;

			const [editionsRes, collectionsRes] = await Promise.all([
				fetch(
					`${baseUrl}/api/collections/editions/records?filter=${encodeURIComponent('isPublished=true')}&expand=collection&perPage=100`
				),
				fetch(
					`${baseUrl}/api/collections/collections/records?filter=${encodeURIComponent('isVisible=true')}&perPage=100`
				)
			]);

			let editionsResult = { items: [] as any[] };
			let collectionsResult = { items: [] as any[] };

			if (editionsRes.ok) {
				const data = await editionsRes.json();
				editionsResult = { items: data.items || [] };
			} else {
				const text = await editionsRes.text();
				console.error('Editions fetch error:', editionsRes.status, text);
			}

			if (collectionsRes.ok) {
				const data = await collectionsRes.json();
				collectionsResult = { items: data.items || [] };
			} else {
				const text = await collectionsRes.text();
				console.error('Collections fetch error:', collectionsRes.status, text);
			}

			// Client-side filtering for more reliable search
			const lowerQuery = trimmedQuery.toLowerCase();

			const filteredEditions = trimmedQuery
				? editionsResult.items.filter((edition: any) => {
						const title = (edition.dcTitle || edition.title || '').toLowerCase();
						const abstract = (edition.dcAbstract || '').toLowerCase();
						const description = (edition.dcDescription || '').toLowerCase();
						const creators = Array.isArray(edition.dcCreator)
							? edition.dcCreator.join(' ').toLowerCase()
							: '';
						return (
							title.includes(lowerQuery) ||
							abstract.includes(lowerQuery) ||
							description.includes(lowerQuery) ||
							creators.includes(lowerQuery)
						);
					})
				: editionsResult.items;

			const filteredCollections = trimmedQuery
				? collectionsResult.items.filter((collection: any) => {
						const title = (collection.dcTitle || collection.title || '').toLowerCase();
						const abstract = (collection.dcAbstract || '').toLowerCase();
						return title.includes(lowerQuery) || abstract.includes(lowerQuery);
					})
				: collectionsResult.items;

			const editions = { items: filteredEditions.slice(0, 8) };
			const collections = { items: filteredCollections.slice(0, 5) };

			// Build combined results using asset-urls helpers (respects R2 / PUBLIC_ASSET_BASE_URL)
			const editionResults: SearchResult[] = editions.items.map((edition: any) => {
				const collectionPubNum = edition.expand?.collection?.pubNum || 0;
				const editionPubNum = edition.pubNum || 1;
				const thumbnail =
					collectionPubNum > 0 ? getEditionThumbnailUrl(collectionPubNum, editionPubNum) : '';

				return {
					type: 'edition' as const,
					id: edition.id,
					title: edition.dcTitle || edition.title || 'Untitled',
					subtitle:
						(Array.isArray(edition.dcCreator) ? edition.dcCreator.join(', ') : '') ||
						edition.dcAbstract?.slice(0, 80),
					thumbnail,
					url: `${base}/editions/${edition.id}`
				};
			});

			const collectionResults: SearchResult[] = collections.items.map((collection: any) => {
				const thumbnail = collection.pubNum > 0 ? getCollectionThumbnailUrl(collection.pubNum) : '';

				return {
					type: 'collection' as const,
					id: collection.id,
					title: collection.dcTitle || collection.title || 'Untitled',
					subtitle: collection.dcAbstract?.slice(0, 80),
					thumbnail,
					url: `${base}/collections/${collection.id}`
				};
			});

			// Prioritize editions, then collections
			results = [...editionResults, ...collectionResults];
			selectedIndex = results.length > 0 ? 0 : -1;
		} catch (err) {
			console.error('Search error:', err);
			results = [];
		} finally {
			searching = false;
		}
	}

	const debouncedSearch = debounce((query: string) => performSearch(query), 250);

	function openSearchResults() {
		showResults = true;
		void performSearch(searchQuery);
	}

	$effect(() => {
		debouncedSearch(searchQuery);
	});

	// Position dropdown using floating-ui
	function updatePosition() {
		if (containerElement && dropdownElement) {
			// Set width immediately to prevent jump
			const containerWidth = containerElement.getBoundingClientRect().width;
			dropdownElement.style.width = `${Math.max(containerWidth, 400)}px`;

			computePosition(containerElement, dropdownElement, {
				placement: 'bottom-start',
				middleware: [
					offset(8),
					flip({ fallbackPlacements: ['top-start'] }),
					shift({ padding: 8 }),
					size({
						apply({ availableHeight }) {
							if (dropdownElement) {
								dropdownElement.style.maxHeight = `${Math.min(availableHeight - 16, 384)}px`;
							}
						},
						padding: 8
					})
				]
			}).then(({ x, y }) => {
				if (dropdownElement) {
					Object.assign(dropdownElement.style, {
						left: `${x}px`,
						top: `${y}px`,
						visibility: 'visible'
					});
				}
			});
		}
	}

	$effect(() => {
		if (showResults && containerElement && dropdownElement) {
			cleanupAutoUpdate?.();
			// Position once, don't follow scroll - keeps dropdown fixed in viewport
			cleanupAutoUpdate = autoUpdate(containerElement, dropdownElement, updatePosition, {
				ancestorScroll: false,
				ancestorResize: true,
				elementResize: true,
				layoutShift: false
			});
		} else {
			cleanupAutoUpdate?.();
			cleanupAutoUpdate = undefined;
		}
	});

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			cleanupAutoUpdate?.();
		};
	});

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.search-container')) {
			showResults = false;
			selectedIndex = -1;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		const isSearchFocused = document.activeElement === searchInputElement;

		// Debug logging
		if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
			console.log(
				'Key:',
				event.key,
				'focused:',
				isSearchFocused,
				'showResults:',
				showResults,
				'results:',
				results.length,
				'selectedIndex:',
				selectedIndex
			);
		}

		if (!isSearchFocused && !showResults) {
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				if (!showResults || results.length === 0) return;
				event.preventDefault();
				selectedIndex = selectedIndex < results.length - 1 ? selectedIndex + 1 : 0;
				console.log('ArrowDown -> selectedIndex:', selectedIndex);
				scrollToSelected();
				break;

			case 'ArrowUp':
				if (!showResults || results.length === 0) return;
				event.preventDefault();
				selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : results.length - 1;
				console.log('ArrowUp -> selectedIndex:', selectedIndex);
				scrollToSelected();
				break;

			case 'Enter':
				if (!showResults || results.length === 0 || selectedIndex === -1) return;
				event.preventDefault();
				console.log('Enter -> navigating to:', results[selectedIndex]);
				navigateToResult(results[selectedIndex]);
				break;

			case 'Escape':
				if (!showResults) return;
				event.preventDefault();
				showResults = false;
				selectedIndex = -1;
				searchInputElement?.blur();
				break;

			case 'Tab':
				if (showResults) {
					showResults = false;
					selectedIndex = -1;
				}
				break;
		}
	}

	function scrollToSelected() {
		requestAnimationFrame(() => {
			const selectedElement = resultsListElement?.querySelector(
				`[data-result-index="${selectedIndex}"]`
			) as HTMLElement | null;

			if (selectedElement) {
				selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			}
		});
	}

	async function navigateToResult(result: SearchResult) {
		showResults = false;
		selectedIndex = -1;
		searchQuery = '';
		await goto(result.url, { invalidateAll: true });
	}

	function handleResultMouseEnter(index: number) {
		selectedIndex = index;
	}

	function getTypeLabel(type: SearchResultType): string {
		switch (type) {
			case 'edition':
				return 'Editions';
			case 'collection':
				return 'Collections';
		}
	}

	function getTypeIcon(type: SearchResultType): string {
		switch (type) {
			case 'edition':
				return 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4';
			case 'collection':
				return 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10';
		}
	}

	function getTypeColor(type: SearchResultType): string {
		switch (type) {
			case 'edition':
				return 'text-primary';
			case 'collection':
				return 'text-secondary';
		}
	}

	// Group results by type for display
	let groupedResults = $derived.by(() => {
		const groups: {
			type: SearchResultType;
			items: Array<SearchResult & { globalIndex: number }>;
		}[] = [];
		let currentType: SearchResultType | null = null;
		let globalIndex = 0;

		for (const result of results) {
			if (result.type !== currentType) {
				currentType = result.type;
				groups.push({ type: result.type, items: [] });
			}
			groups[groups.length - 1].items.push({ ...result, globalIndex });
			globalIndex++;
		}

		return groups;
	});
</script>

<svelte:window onclick={handleClickOutside} />

<div class="search-container relative" bind:this={containerElement}>
	<label class="input-bordered input flex items-center gap-2">
		<svg class="h-5 w-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
		<input
			type="text"
			bind:this={searchInputElement}
			bind:value={searchQuery}
			placeholder="Search editions, collections..."
			class="grow border-none outline-none focus:ring-0 focus:outline-none"
			onfocus={openSearchResults}
			onclick={openSearchResults}
			role="combobox"
			aria-expanded={showResults}
			aria-haspopup="listbox"
			aria-autocomplete="list"
			aria-controls="search-results"
		/>
		<span class="loading loading-xs loading-spinner" class:invisible={!searching}></span>
	</label>

	{#if showResults}
		<div
			bind:this={dropdownElement}
			id="search-results"
			class="card-compact card fixed z-50 overflow-hidden bg-base-100 shadow-xl"
			style="min-width: 300px; visibility: hidden;"
			role="listbox"
		>
			<div class="card-body p-0">
				{#if searching && results.length === 0}
					<div class="flex items-center justify-center gap-2 p-4 text-sm opacity-70">
						<span class="loading loading-sm loading-spinner"></span>
						<span>Searching...</span>
					</div>
				{:else if results.length === 0}
					<div class="p-4 text-center text-sm opacity-70">
						{#if searchQuery.trim()}
							No results found for "{searchQuery}"
						{:else}
							No editions or collections available
						{/if}
					</div>
				{:else}
					<div class="max-h-80 overflow-y-auto" bind:this={resultsListElement}>
						{#each groupedResults as group}
							<div
								class="sticky top-0 z-10 flex items-center gap-1.5 border-b border-base-200 bg-base-100 px-3 py-1.5 text-xs font-semibold tracking-wide text-base-content/60 uppercase"
							>
								<svg
									class="h-3 w-3 {getTypeColor(group.type)}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d={getTypeIcon(group.type)}
									/>
								</svg>
								{getTypeLabel(group.type)}
							</div>
							{#each group.items as item}
								{@const isSelected = selectedIndex === item.globalIndex}
								<button
									type="button"
									data-result-index={item.globalIndex}
									class="flex w-full items-center gap-3 px-3 py-2 text-left text-base-content transition-colors hover:bg-base-200 hover:text-base-content"
									class:bg-base-200={isSelected}
									onclick={() => navigateToResult(item)}
									onmouseenter={() => handleResultMouseEnter(item.globalIndex)}
									role="option"
									aria-selected={isSelected}
								>
									{#if item.thumbnail}
										<img
											src={item.thumbnail}
											alt=""
											class="h-10 w-10 shrink-0 rounded object-cover"
										/>
									{:else}
										<div
											class="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-base-300"
										>
											<svg
												class="h-5 w-5 opacity-50 {getTypeColor(item.type)}"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d={getTypeIcon(item.type)}
												/>
											</svg>
										</div>
									{/if}
									<div class="min-w-0 flex-1 overflow-hidden">
										<div class="truncate leading-tight font-medium">{item.title}</div>
										{#if item.subtitle}
											<div class="mt-0.5 truncate text-xs leading-tight opacity-60">
												{item.subtitle}
											</div>
										{/if}
									</div>
								</button>
							{/each}
						{/each}
					</div>
					<div class="border-t border-base-200 px-3 py-2 text-xs opacity-50">
						<kbd class="kbd kbd-xs">↑</kbd>
						<kbd class="kbd kbd-xs">↓</kbd> navigate
						<kbd class="ml-2 kbd kbd-xs">Enter</kbd> select
						<kbd class="ml-2 kbd kbd-xs">Esc</kbd> close
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
