<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import FilterSidebar from '$lib/components/filters/FilterSidebar.svelte';
	import FloatingDropdown from '$lib/components/ui/FloatingDropdown.svelte';
	import type { FilterState } from '$lib/types/collection';
	import { editionsStore, fetchEditions, isStale } from '$lib/stores/data.store';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import { EditionStatus, GlobalRole } from '$lib/types/roles';
	import toast from 'svelte-french-toast';

	interface UserProfileSummary {
		id: string;
		name: string;
		profilePictureUrl: string;
		titleRole: string;
		affiliation: string;
		orcid: string;
		bio: string;
		verified: boolean;
	}

	let showHiddenEditions = $state(false);
	let canShowHiddenEditions = $derived(authStore.globalRole === GlobalRole.Admin);
	let allEditions = $derived($editionsStore.items);
	let hiddenEditionCount = $derived(allEditions.filter((edition) => !edition.isPublished).length);

	// Reactive data from persisted store
	let editions = $derived(
		canShowHiddenEditions && showHiddenEditions
			? allEditions
			: allEditions.filter((edition) => edition.isPublished)
	);
	let hasCachedData = $derived($editionsStore.items.length > 0);
	let isLoading = $state(true);
	let selectedUserProfile = $state<UserProfileSummary | null>(null);
	let selectedUserQuery = $state('');

	onMount(async () => {
		const query = new URLSearchParams(window.location.search).get('q');
		if (query) {
			searchQuery = query;
			await loadUserProfileForQuery(query);
		}

		// If we have fresh cached data, skip loading
		if (!authStore.isAuthenticated && hasCachedData && !isStale($editionsStore.lastFetched)) {
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
	let showSelectedUserProfile = $derived(
		!!selectedUserProfile && normalize(searchQuery) === normalize(selectedUserQuery)
	);

	// Autocomplete state
	let showSuggestions = $state(false);
	let selectedIndex = $state(-1);
	let inputElement: HTMLInputElement | undefined = $state();
	let suggestionsElement: HTMLDivElement | undefined = $state();

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

	function normalize(value: string) {
		return value.trim().toLowerCase();
	}

	function profileNames(user: any) {
		const names = [user.nickname, user.name, user.username, user.email].filter(Boolean).map(String);
		return names.flatMap((name) => {
			const clean = name.replace(/\s*\([^)]*\)\s*$/g, '').trim();
			const comma = clean.match(/^([^,]+),\s+(.+)$/);
			return comma ? [name, clean, `${comma[2]} ${comma[1]}`] : [name, clean];
		});
	}

	function plainText(value: string) {
		return value
			.replace(/&nbsp;/g, ' ')
			.replace(/<[^>]*>/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	async function loadUserProfileForQuery(query: string) {
		const normalizedQuery = normalize(query);
		if (!normalizedQuery) return;

		try {
			const result = await pb.collection('users').getList(1, 500, { $autoCancel: false });
			const user = result.items.find((record) =>
				profileNames(record).some((name) => normalize(name) === normalizedQuery)
			);

			if (!user) return;

			const profilePicture = user.profilePicture || user.avatar || '';
			selectedUserProfile = {
				id: user.id,
				name: user.nickname || user.name || user.username || user.email || 'User',
				profilePictureUrl: profilePicture
					? pb.files.getURL(user, profilePicture, { thumb: '200x200' })
					: '',
				titleRole: user.titleRole || '',
				affiliation: user.affiliation || '',
				orcid: user.orcid || '',
				bio: plainText(user.bio || ''),
				verified: !!user.verified
			};
			selectedUserQuery = query;
		} catch {
			selectedUserProfile = null;
			selectedUserQuery = '';
		}
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
			const selected = suggestionsElement?.querySelector(
				`[data-index="${selectedIndex}"]`
			) as HTMLElement | null;
			selected?.scrollIntoView({ block: 'nearest' });
		});
	}

	function navigateToEdition(edition: (typeof editions)[0]) {
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

	function clearSearch() {
		searchQuery = '';
		selectedUserProfile = null;
		selectedUserQuery = '';
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
	<input id="filter-drawer" type="checkbox" class="drawer-toggle" bind:checked={drawerOpen} />

	<!-- Main content -->
	<div class="drawer-content">
		<div class="container mx-auto max-w-7xl px-4 py-8">
			<!-- Header -->
			<div class="mb-8 flex items-start justify-between gap-4">
				<div>
					<h1 class="mb-2 text-3xl font-bold md:text-4xl">Editions</h1>
					<p class="text-base-content/70">Browse our collection of 3D scholarly editions</p>
				</div>
				{#if authStore.globalRole === GlobalRole.Admin}
					<div class="flex flex-none flex-wrap items-center justify-end gap-3">
						<label class="flex cursor-pointer items-center gap-2 rounded-full border border-base-300 bg-base-100 px-4 py-2 text-sm shadow-sm">
							<input
								type="checkbox"
								class="toggle toggle-sm toggle-primary"
								bind:checked={showHiddenEditions}
							/>
							<span>Show non-public</span>
							{#if hiddenEditionCount > 0}
								<span class="badge badge-sm badge-ghost">{hiddenEditionCount}</span>
							{/if}
						</label>
						<button class="btn btn-sm btn-primary" onclick={createEdition} disabled={isCreating}>
							{#if isCreating}
								<span class="loading loading-xs loading-spinner"></span>
							{/if}
							+ New Edition
						</button>
					</div>
				{/if}
			</div>

			<!-- Search and Filter Button (mobile) -->
			<div class="mb-6 flex gap-3">
				<!-- Mobile filter button -->
				<label
					for="filter-drawer"
					class="btn flex-none btn-outline lg:hidden"
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
						<span class="badge badge-sm badge-primary">{activeFilterCount}</span>
					{/if}
				</label>

				<!-- Search input with autocomplete -->
				<div class="search-container flex-1">
					<div class="relative">
						<svg
							class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-base-content/50"
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
							class="input-bordered input w-full bg-base-100 pr-10 pl-10"
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
								class="btn absolute top-1/2 right-3 btn-circle -translate-y-1/2 btn-ghost btn-xs"
								aria-label="Clear search"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						{/if}
					</div>

					<!-- Autocomplete Suggestions Dropdown -->
					<FloatingDropdown
						open={showSuggestions && suggestions.length > 0}
						referenceElement={inputElement}
						bind:element={suggestionsElement}
						role="listbox"
						maxHeight={320}
						class="shadow-xl"
						onclose={() => {
							showSuggestions = false;
							selectedIndex = -1;
						}}
					>
						{#each suggestions as suggestion, index (suggestion.id)}
							{@const isSelected = selectedIndex === index}
							<div role="option" aria-selected={isSelected}>
								<button
									type="button"
									data-index={index}
									class="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-base-content transition-colors hover:bg-base-200 hover:text-base-content"
									class:bg-base-200={isSelected}
									onclick={() => navigateToEdition(suggestion)}
									onmouseenter={() => (selectedIndex = index)}
								>
									{#if suggestion.thumbnail}
										<img
											src={suggestion.thumbnail}
											alt=""
											class="h-10 w-10 shrink-0 rounded object-cover"
										/>
									{:else}
										<div
											class="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-base-300"
										>
											<svg
												class="h-5 w-5 opacity-50"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
												/>
											</svg>
										</div>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="truncate font-medium">{suggestion.title}</div>
										{#if suggestion.authors}
											<div class="truncate text-sm opacity-60">{suggestion.authors}</div>
										{:else if suggestion.description}
											<div class="truncate text-sm opacity-60">
												{suggestion.description.slice(0, 60)}{suggestion.description.length > 60
													? '...'
													: ''}
											</div>
										{/if}
									</div>
									{#if suggestion.isPublished === false}
										<span class="badge badge-sm border-red-800 bg-red-700 text-white">Not public</span>
									{/if}
									{#if suggestion.hasPeerReview}
										<span class="badge badge-sm badge-success">Peer reviewed</span>
									{/if}
								</button>
							</div>
						{/each}
						<div
							class="flex items-center gap-4 border-t border-base-200 px-3 py-2 text-xs text-base-content/50"
						>
							<span><kbd class="kbd kbd-xs">↑</kbd><kbd class="kbd kbd-xs">↓</kbd> navigate</span>
							<span><kbd class="kbd kbd-xs">Enter</kbd> select</span>
							<span><kbd class="kbd kbd-xs">Esc</kbd> close</span>
						</div>
					</FloatingDropdown>
				</div>
			</div>

			{#if showSelectedUserProfile && selectedUserProfile}
				<section class="mb-6 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
					<div class="flex min-w-0 gap-4">
						<div class="avatar placeholder shrink-0">
								{#if selectedUserProfile.profilePictureUrl}
									<div class="h-28 w-20 overflow-hidden rounded-xl">
										<img class="h-full w-full object-cover object-top" src={selectedUserProfile.profilePictureUrl} alt="{selectedUserProfile.name} profile" />
									</div>
								{:else}
									<div class="h-28 w-20 rounded-xl bg-neutral text-neutral-content">
										<span class="text-2xl">{selectedUserProfile.name.charAt(0).toUpperCase()}</span>
									</div>
								{/if}
							</div>

						<div class="min-w-0 pt-1">
							<h2 class="text-2xl font-semibold leading-tight">{selectedUserProfile.name}</h2>
								{#if selectedUserProfile.titleRole || selectedUserProfile.affiliation}
									<p class="mt-1 text-sm text-base-content/70">
										{#if selectedUserProfile.titleRole}{selectedUserProfile.titleRole}{/if}{#if selectedUserProfile.titleRole && selectedUserProfile.affiliation} at {/if}{#if selectedUserProfile.affiliation}{selectedUserProfile.affiliation}{/if}
									</p>
								{/if}
								{#if selectedUserProfile.orcid}
									<a class="link mt-1 block text-sm" href={selectedUserProfile.orcid} target="_blank" rel="noreferrer">
										ORCID
									</a>
								{/if}
								{#if selectedUserProfile.bio}
									<p class="mt-3 line-clamp-2 max-w-3xl text-sm text-base-content/70">
										{selectedUserProfile.bio}
									</p>
								{/if}
							</div>
					</div>
				</section>
			{/if}

			<!-- Results count -->
			{#if !isLoading || hasCachedData}
				<div class="mb-4 text-sm text-base-content/70">
					Showing {filteredEditions.length} of {editions.length} editions
				</div>
			{/if}

			<!-- Editions Grid -->
			{#if isLoading && !hasCachedData}
				<div
					class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5"
				>
					{#each Array(15) as _}
						<div class="h-64 skeleton rounded-xl"></div>
					{/each}
				</div>
			{:else if filteredEditions.length > 0}
				<div
					class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5"
				>
					{#each filteredEditions as edition (edition.id)}
						<EditionCard {edition} />
					{/each}
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mb-4 h-16 w-16 text-base-content/30"
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
					<h3 class="mb-2 text-lg font-medium">No editions found</h3>
					<p class="max-w-md text-base-content/60">
						No editions match your current filters. Try adjusting your search or clearing some
						filters.
					</p>
					{#if activeFilterCount > 0}
						<button
							class="btn mt-4 btn-sm btn-primary"
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
		<div class="min-h-full w-72 border-r border-base-300 bg-base-100 p-4 pt-20 lg:pt-4">
			<!-- Close button for mobile -->
			<div class="mb-4 flex items-center justify-between lg:hidden">
				<span class="font-semibold">Filters</span>
				<button
					class="btn btn-circle btn-ghost btn-sm"
					onclick={closeDrawer}
					aria-label="Close filters"
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
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<FilterSidebar {editions} {filters} onFilterChange={handleFilterChange} />
		</div>
	</div>
</div>
