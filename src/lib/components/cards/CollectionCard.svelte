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
		isVisible?: boolean;
	}

	interface Props {
		collection: CollectionCardData;
		showDescription?: boolean;
	}

	let { collection, showDescription = true }: Props = $props();

	let imageError = $state(false);
	let imageFit = $state<'cover' | 'contain'>('contain');

	function handleImageError() {
		imageError = true;
	}

	function handleImageLoad(event: Event) {
		const image = event.currentTarget as HTMLImageElement;
		const ratio = image.naturalWidth / image.naturalHeight;
		imageFit = ratio >= 1 / 1.5 && ratio <= 1.5 ? 'cover' : 'contain';
	}

	// Strip HTML tags for plain-text preview
	function stripHtml(html: string): string {
		return html.replace(/<[^>]*>/g, '').trim();
	}

	let plainDescription = $derived(stripHtml(collection.description || ''));
	let editionCount = $derived(collection.editionCount ?? collection.editionIds?.length ?? 0);

	// Check if thumbnail is from local static assets
	const isLocalAsset = $derived(collection.thumbnail?.includes('/project/'));
</script>

<a
	href={`${base}/collections/${collection.slug}`}
	data-sveltekit-preload-data="hover"
	class="group ds-card flex h-full flex-col overflow-clip"
>
	<figure class="relative aspect-square min-h-0 w-full shrink-0 overflow-clip rounded-t-xl bg-base-200">
		{#if collection.isVisible === false}
			<div
				class="absolute top-2 right-2 z-10 rounded-md border border-red-800 bg-red-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm"
				style="color: white;"
				title="This collection is hidden and not visible to public visitors"
			>
				Not public
			</div>
		{/if}
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
			<div class="h-full w-full">
				{#if isLocalAsset}
					<picture class="block w-full h-full">
						<source srcset={collection.thumbnail.replace('.png', '.avif')} type="image/avif" />
						<source srcset={collection.thumbnail.replace('.png', '.webp')} type="image/webp" />
						<img
							src={collection.thumbnail}
							alt={collection.title}
							class="card-cover-image w-full h-full"
							class:object-cover={imageFit === 'cover'}
							class:object-contain={imageFit === 'contain'}
							loading="lazy"
							onload={handleImageLoad}
							onerror={handleImageError}
						/>
					</picture>
				{:else}
					<img
						src={collection.thumbnail}
						alt={collection.title}
						class="card-cover-image w-full h-full"
						class:object-cover={imageFit === 'cover'}
						class:object-contain={imageFit === 'contain'}
						loading="lazy"
						onload={handleImageLoad}
						onerror={handleImageError}
					/>
				{/if}
			</div>
		{/if}
	</figure>
	<div class="card-body flex-1 p-4">
		<h3 class="card-title text-base line-clamp-2 group-hover:text-primary transition-colors">
			{collection.title}
		</h3>
		{#if showDescription && plainDescription}
			<p class="text-sm text-base-content/70 line-clamp-2">{plainDescription}</p>
		{/if}
		<div class="card-actions mt-auto justify-end pt-2">
			<div
				class="badge badge-outline text-xs"
				style="border-color: var(--color-vermillion); color: var(--color-vermillion);"
			>
				{editionCount} {editionCount === 1 ? 'edition' : 'editions'}
			</div>
		</div>
	</div>
</a>
