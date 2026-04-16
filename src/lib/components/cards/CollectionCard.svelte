<script lang="ts">
	import { base } from '$app/paths';

	interface CollectionCardData {
		id: string;
		slug: string;
		title: string;
		description: string;
		thumbnail: string;
		editionIds?: string[];
		editionCount?: number;
	}

	interface Props {
		collection: CollectionCardData;
	}

	let { collection }: Props = $props();

	let imageError = $state(false);

	function handleImageError() {
		imageError = true;
	}

	// Strip HTML tags for plain-text preview
	function stripHtml(html: string): string {
		return html.replace(/<[^>]*>/g, '').trim();
	}

	let plainDescription = $derived(stripHtml(collection.description || ''));

	// Check if thumbnail is from local static assets
	const isLocalAsset = $derived(collection.thumbnail?.includes('/project/'));
</script>

<a
	href={`${base}/collections/${collection.slug}`}
	data-sveltekit-preload-data="hover"
	class="group card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden"
>
	<figure class="relative overflow-hidden bg-base-200 aspect-[4/3]">
		<!-- Placeholder: show on error -->
		<div
			class="absolute inset-0 flex items-center justify-center text-base-content/30"
			class:hidden={collection.thumbnail && !imageError}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
			</svg>
		</div>
		<!-- Actual image with format fallback -->
		{#if collection.thumbnail && !imageError}
			{#if isLocalAsset}
				<picture>
					<source srcset={collection.thumbnail.replace('.png', '.avif')} type="image/avif" />
					<source srcset={collection.thumbnail.replace('.png', '.webp')} type="image/webp" />
					<img
						src={collection.thumbnail}
						alt={collection.title}
						class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
						loading="lazy"
						onerror={handleImageError}
					/>
				</picture>
			{:else}
				<img
					src={collection.thumbnail}
					alt={collection.title}
					class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
					loading="lazy"
					onerror={handleImageError}
				/>
			{/if}
		{/if}
		<div
			class="absolute inset-0 bg-gradient-to-t from-base-300/90 via-base-300/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
		></div>
	</figure>
	<div class="card-body p-4">
		<h3 class="card-title text-base line-clamp-2 group-hover:text-primary transition-colors">
			{collection.title}
		</h3>
		<p class="text-sm text-base-content/70 line-clamp-2">{plainDescription}</p>
		<div class="card-actions justify-end mt-2">
			<div class="badge badge-outline text-xs">{collection.editionCount || collection.editionIds?.length || 0} editions</div>
		</div>
	</div>
</a>
