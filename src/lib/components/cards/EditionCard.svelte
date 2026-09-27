<script lang="ts">
	import { creatorNames } from '$lib/utils/credits';
	import { base, resolve } from '$app/paths';
	import type { Edition } from '$lib/types/collection';
	import { getEditionCoverUrl } from '$lib/utils/asset-urls';
	import { getCardImageSources } from '$lib/utils/asset-image-sources';
	import TrashIcon from '~icons/lucide/trash-2';

	interface Props {
		edition: Pick<Edition, 'id' | 'slug' | 'title' | 'credits'> & Partial<Edition>;
		onRemove?: () => void;
		removeDisabled?: boolean;
		discovery?: boolean;
		imageLoading?: 'eager' | 'lazy';
		imageFetchPriority?: 'high' | 'low' | 'auto';
	}

	let {
		edition,
		onRemove,
		removeDisabled = false,
		discovery = false,
		imageLoading = 'lazy',
		imageFetchPriority = 'auto'
	}: Props = $props();
	let imageError = $state(false);
	let imageLoaded = $state(false);
	let currentImageUrl = $state<string | null>(null);

	let coverUrl = $derived(getEditionCoverUrl(edition));
	let imageSources = $derived(coverUrl ? getCardImageSources(coverUrl) : null);

	$effect(() => {
		const nextCoverUrl = coverUrl;
		if (nextCoverUrl !== currentImageUrl) {
			currentImageUrl = nextCoverUrl;
			imageError = false;
			imageLoaded = false;
		}
	});

	function handleImageError() {
		imageError = true;
	}

	function handleImageLoad() {
		imageLoaded = true;
	}

	function handleRemove(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		onRemove?.();
	}
</script>

<div
	class="catalogue-card group ds-card flex h-full flex-col overflow-clip p-3"
	class:discovery-card={discovery}
>
	<figure
		class="relative overflow-clip rounded-lg bg-base-200"
		class:aspect-square={!discovery || !coverUrl || imageError}
	>
		{#if edition.isPublished === false}
			<div
				class="absolute top-2 right-2 z-10 rounded-md border border-red-800 bg-red-700 px-2 py-1 text-[11px] font-semibold tracking-wide text-white uppercase shadow-sm"
				style="color: white;"
				title="This edition is hidden and not visible to public visitors"
			>
				Not public
			</div>
		{/if}
		<!-- Peer Review Badge -->
		{#if edition.hasPeerReview && !discovery}
			<div
				class="absolute right-2 z-10"
				class:top-12={edition.isPublished === false}
				class:top-2={edition.isPublished !== false}
				title="Peer Reviewed"
			>
				<img
					src="{base}/images/peer-reviewed-badge.svg"
					alt="Peer Reviewed"
					class="h-10 w-10 drop-shadow-md"
				/>
			</div>
		{/if}
		{#if onRemove}
			<button
				type="button"
				class="btn absolute right-2 bottom-2 z-20 btn-square shadow btn-outline btn-xs btn-error"
				title="Remove edition from this collection"
				aria-label="Remove edition from this collection"
				onclick={handleRemove}
				disabled={removeDisabled}
			>
				<TrashIcon class="h-3.5 w-3.5" />
			</button>
		{/if}
		<!-- Mesh/Texture info chip -->
		{#if edition.modelSize && !discovery}
			<div
				class="absolute bottom-2 left-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
			>
				{edition.modelSize}
			</div>
		{/if}
		<!-- Placeholder: show on error -->
		<div
			class="absolute inset-0 flex items-center justify-center text-base-content/30"
			class:hidden={imageLoaded && !imageError}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-16 w-16"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
				/>
			</svg>
		</div>
		<!-- Actual image -->
		{#if imageSources && !imageError}
			<div class:h-full={!discovery} class="w-full">
				<img
					src={imageSources.src}
					srcset={imageSources.srcset}
					sizes={discovery
						? '(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
						: '(min-width: 1024px) 256px, 50vw'}
					alt={edition.title}
					class="card-cover-image w-full object-cover"
					class:card-parallax-image={!discovery}
					class:card-masonry-image={discovery}
					class:h-full={!discovery}
					loading={imageLoading}
					fetchpriority={imageFetchPriority}
					decoding="async"
					onload={handleImageLoad}
					onerror={handleImageError}
				/>
			</div>
		{/if}
		<a
			href={resolve('/editions/[slug]', { slug: edition.slug })}
			data-sveltekit-preload-data="hover"
			class="absolute inset-0 z-[5]"
			aria-label={`View ${edition.title}`}
		></a>
	</figure>
	<div class="mt-3 flex min-h-24 flex-1 flex-col rounded-md bg-base-200 px-3 py-3">
		<a
			href={resolve('/editions/[slug]', { slug: edition.slug })}
			data-sveltekit-preload-data="hover"
		>
			<h3 class="card-title line-clamp-2 text-base leading-tight font-semibold transition-colors">
				{edition.title}
			</h3>
		</a>
		{#if creatorNames(edition.credits)}
			<p class="mt-2 line-clamp-1 text-sm text-base-content/60">{creatorNames(edition.credits)}</p>
		{/if}
		<div class="mt-auto pt-3 font-mono text-[9px] tracking-[0.12em] text-base-content/45 uppercase">
			{edition.hasPeerReview ? 'Peer-reviewed 3D edition' : '3D scholarly edition'}
		</div>
	</div>
</div>
