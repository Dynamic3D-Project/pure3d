<script lang="ts">
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import type { Collection } from '$lib/types/collection';
	import collectionsData from '$lib/data/collections.json';

	const collections: Collection[] = collectionsData;
</script>

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

	<!-- Masonry Grid -->
	<div class="masonry-grid">
		{#each collections as collection (collection.id)}
			<div class="masonry-item">
				<CollectionCard {collection} />
			</div>
		{/each}
	</div>
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
