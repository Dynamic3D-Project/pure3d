<script lang="ts">
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const editions = data.editions;

	let searchQuery = $state('');
	let selectedTag = $state<string | null>(null);

	// Extract all unique tags
	const allTags = $derived.by(() => {
		const tagSet = new Set<string>();
		editions.forEach((edition) => {
			edition.tags.forEach((tag) => tagSet.add(tag));
		});
		return Array.from(tagSet).sort();
	});

	// Filter editions based on search and tag
	const filteredEditions = $derived.by(() => {
		let result = editions;

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(edition) =>
					edition.title.toLowerCase().includes(query) ||
					edition.description.toLowerCase().includes(query) ||
					edition.authors.toLowerCase().includes(query)
			);
		}

		const tag = selectedTag;
		if (tag !== null) {
			result = result.filter((edition) => edition.tags.includes(tag));
		}

		return result;
	});
</script>

<svelte:head>
	<title>All Editions | Pure 3D</title>
	<meta
		name="description"
		content="Browse all 3D editions in our digital humanities and heritage collection."
	/>

	<!-- Preconnect to Voyager API domain for faster iframe loading -->
	<link rel="preconnect" href="https://3d-api.si.edu" crossorigin />
	<link rel="dns-prefetch" href="https://3d-api.si.edu" />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-7xl">
	<!-- Hero Section -->
	<div class="text-center mb-12">
		<h1 class="text-4xl md:text-5xl font-bold mb-4">Editions</h1>
		<p class="text-lg text-base-content/70 max-w-2xl mx-auto">
			Each edition should have a name displayed
		</p>
	</div>

	<!-- Filter Section -->
	<div class="mb-8 space-y-4">
		<!-- Search Bar -->
		<div class="flex justify-center">
			<div class="form-control w-full max-w-md">
				<div class="input-group">
					<input
						type="text"
						placeholder="Search editions..."
						class="input input-bordered w-full"
						bind:value={searchQuery}
					/>
					<button class="btn btn-square" aria-label="Search">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
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
					</button>
				</div>
			</div>
		</div>

		<!-- Tag Filters -->
		<div class="flex flex-wrap justify-center gap-2">
			<button
				class="badge badge-lg transition-all"
				class:badge-primary={selectedTag === null}
				class:badge-outline={selectedTag !== null}
				onclick={() => (selectedTag = null)}
			>
				All
			</button>
			{#each allTags as tag}
				<button
					class="badge badge-lg transition-all"
					class:badge-primary={selectedTag === tag}
					class:badge-outline={selectedTag !== tag}
					onclick={() => (selectedTag = selectedTag === tag ? null : tag)}
				>
					{tag}
				</button>
			{/each}
		</div>

		<!-- Results Count -->
		<div class="text-center text-sm text-base-content/70">
			Showing {filteredEditions.length} of {editions.length} editions
		</div>
	</div>

	<!-- Editions Grid -->
	{#if filteredEditions.length > 0}
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
			{#each filteredEditions as edition (edition.id)}
				<EditionCard {edition} />
			{/each}
		</div>
	{:else}
		<div class="alert alert-warning max-w-md mx-auto">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<span>No editions match your search criteria. Try different keywords or tags.</span>
		</div>
	{/if}
</div>
