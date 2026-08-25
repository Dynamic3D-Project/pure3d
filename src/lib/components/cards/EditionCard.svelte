<script lang="ts">
	import { base } from '$app/paths';
	import type { Edition } from '$lib/types/collection';
	import type { RecordModel } from 'pocketbase';
	import { getEditionCoverUrl } from '$lib/utils/asset-urls';
	import TrashIcon from '~icons/lucide/trash-2';

	interface Props {
		edition: Edition;
		onRemove?: () => void;
		removeDisabled?: boolean;
		discovery?: boolean;
	}

	let { edition, onRemove, removeDisabled = false, discovery = false }: Props = $props();
	let imageError = $state(false);
	let hasPrefetched = false;

	let coverUrl = $derived(getEditionCoverUrl(edition as unknown as RecordModel));

	function handleImageError() {
		imageError = true;
	}

	function handleRemove(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		onRemove?.();
	}

	/**
	 * Prefetch 3D assets on hover for faster loading
	 * - Prefetches the scene.svx.json file
	 * - Parses it to find and prefetch GLB model files
	 */
	async function prefetch3DAssets() {
		// Only prefetch once per card, and only if we have a valid voyagerUrl (root path)
		if (hasPrefetched || !edition.voyagerUrl) return;
		hasPrefetched = true;

		const root = edition.voyagerUrl;
		const sceneFile = edition.settingsSceneFile || 'scene.svx.json';
		const sceneUrl = `${root}${sceneFile}`;

		try {
			// Prefetch scene file with high priority
			const sceneLink = document.createElement('link');
			sceneLink.rel = 'prefetch';
			sceneLink.href = sceneUrl;
			sceneLink.as = 'fetch';
			document.head.appendChild(sceneLink);

			// Fetch and parse scene to find model files
			const response = await fetch(sceneUrl, { priority: 'low' } as RequestInit);
			if (!response.ok) return;

			const scene = await response.json();

			// Extract model URLs from scene (GLB/GLTF files)
			const modelUrls = new Set<string>();

			// Models are typically in scene.models[].uri or scene.nodes[].model.uri
			if (scene.models) {
				for (const model of scene.models) {
					if (model.uri) modelUrls.add(model.uri);
					// Also check derivatives for different quality levels
					if (model.derivatives) {
						for (const derivative of model.derivatives) {
							if (derivative.assets) {
								for (const asset of derivative.assets) {
									if (asset.uri?.endsWith('.glb') || asset.uri?.endsWith('.gltf')) {
										modelUrls.add(asset.uri);
									}
								}
							}
						}
					}
				}
			}

			// Prefetch each model file (limit to first 3 to avoid over-fetching)
			let count = 0;
			for (const modelUri of modelUrls) {
				if (count >= 3) break;
				const modelUrl = modelUri.startsWith('http') ? modelUri : `${root}${modelUri}`;
				const modelLink = document.createElement('link');
				modelLink.rel = 'prefetch';
				modelLink.href = modelUrl;
				modelLink.as = 'fetch';
				document.head.appendChild(modelLink);
				count++;
			}
		} catch {
			// Silently fail - prefetching is an optimization, not critical
		}
	}
</script>

<div
	class="group ds-card overflow-clip"
	class:discovery-card={discovery}
>
	<figure
		class="relative overflow-clip rounded-t-xl bg-base-200"
		class:aspect-square={!discovery || !coverUrl || imageError}
	>
		{#if edition.isPublished === false}
			<div
				class="absolute top-2 right-2 z-10 rounded-md border border-red-800 bg-red-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm"
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
					class="w-10 h-10 drop-shadow-md"
				/>
			</div>
		{/if}
		{#if onRemove}
			<button
				type="button"
				class="btn btn-square btn-neutral btn-xs absolute right-2 bottom-2 z-20 shadow"
				title="Remove edition from this collection"
				aria-label="Remove edition from this collection"
				onclick={handleRemove}
				disabled={removeDisabled}
			>
				<TrashIcon class="h-3.5 w-3.5" />
			</button>
		{/if}
		<!-- Mesh/Texture info chip -->
		{#if (edition as any).modelSize && !discovery}
			<div class="absolute bottom-2 left-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
				{(edition as any).modelSize}
			</div>
		{/if}
		<!-- Placeholder: show on error -->
		<div
			class="absolute inset-0 flex items-center justify-center text-base-content/30"
			class:hidden={coverUrl && !imageError}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
			</svg>
		</div>
		<!-- Actual image with format fallback -->
		{#if coverUrl && !imageError}
			{@const isLocalAsset = coverUrl.includes('/project/')}
			<div class:h-full={!discovery} class="w-full">
				{#if isLocalAsset}
					<picture class:h-full={!discovery} class="block w-full">
						<source srcset={coverUrl.replace('.png', '.avif')} type="image/avif" />
						<source srcset={coverUrl.replace('.png', '.webp')} type="image/webp" />
						<img
							src={coverUrl}
							alt={edition.title}
							class="card-cover-image w-full object-cover"
							class:card-parallax-image={!discovery}
							class:card-masonry-image={discovery}
							class:h-full={!discovery}
							loading="lazy"
							onerror={handleImageError}
						/>
					</picture>
				{:else}
					<img
						src={coverUrl}
						alt={edition.title}
						class="card-cover-image w-full object-cover"
						class:card-parallax-image={!discovery}
						class:card-masonry-image={discovery}
						class:h-full={!discovery}
						loading="lazy"
						onerror={handleImageError}
					/>
				{/if}
			</div>
		{/if}
		<a
			href={`${base}/editions/${edition.slug}`}
			data-sveltekit-preload-data="hover"
			onmouseenter={prefetch3DAssets}
			class="absolute inset-0 z-[5]"
			aria-label={`View ${edition.title}`}
		></a>
	</figure>
	<div class="card-body gap-1" class:p-1={discovery} class:p-4={!discovery}>
		<a
			href={`${base}/editions/${edition.slug}`}
			data-sveltekit-preload-data="hover"
			onmouseenter={prefetch3DAssets}
		>
			<h3 class="card-title text-sm line-clamp-2 transition-colors group-hover:text-primary">
				{edition.title}
			</h3>
		</a>
		{#if edition.authors && !discovery}
			<p class="text-xs text-base-content/60 line-clamp-1">{edition.authors}</p>
		{/if}
	</div>
</div>
