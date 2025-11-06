<script lang="ts">
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const { collection, editions } = data;
</script>

<svelte:head>
	<title>{collection.title} | Pure 3D</title>
	<meta name="description" content={collection.description} />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-7xl">
		<!-- Collection Header -->
		<div class="mb-12">
			<nav class="text-sm breadcrumbs mb-6">
				<ul>
					<li><a href="/" data-sveltekit-preload-data="hover" class="link link-hover">Home</a></li>
					<li><a href="/collections" data-sveltekit-preload-data="hover" class="link link-hover">Collections</a></li>
					<li class="text-base-content/70">{collection.title}</li>
				</ul>
			</nav>

			<div class="text-center max-w-4xl mx-auto">
				<h1 class="text-4xl md:text-5xl font-bold mb-6">{collection.title}</h1>
				<p class="text-lg text-base-content/70 leading-relaxed">
					{collection.description}
				</p>
			</div>
		</div>

		<!-- Editions Section -->
		<div class="mb-8">
			<h2 class="text-2xl font-semibold mb-6">Editions</h2>

			{#if editions.length > 0}
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
					{#each editions as edition (edition.id)}
						<EditionCard {edition} />
					{/each}
				</div>
			{:else}
				<div class="alert alert-info">
					<span>No editions available in this collection yet.</span>
				</div>
			{/if}
		</div>

	<!-- Back Button -->
	<div class="flex justify-center mt-12">
		<a href="/collections" data-sveltekit-preload-data="hover" class="btn btn-outline btn-lg">
			← Back to Collections
		</a>
	</div>
</div>
