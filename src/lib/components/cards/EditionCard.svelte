<script lang="ts">
	import { base } from '$app/paths';
	import type { Edition } from '$lib/types/collection';
	import type { RecordModel } from 'pocketbase';
	import { getEditionCoverUrl } from '$lib/utils/asset-urls';

	interface Props {
		edition: Edition;
	}

	let { edition }: Props = $props();
	let imageError = $state(false);
	let hasPrefetched = false;

	let coverUrl = $derived(getEditionCoverUrl(edition as unknown as RecordModel));

	function handleImageError() {
		imageError = true;
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

<a
	href={`${base}/editions/${edition.slug}`}
	data-sveltekit-preload-data="hover"
	onmouseenter={prefetch3DAssets}
	class="group card bg-base-100 shadow-md hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
>
	<figure class="relative overflow-hidden aspect-square bg-base-200">
		<!-- Peer Review Badge -->
		{#if edition.hasPeerReview}
			<div class="absolute top-2 right-2 z-10" title="Peer Reviewed">
				<img
					src="{base}/images/peer-reviewed-badge.svg"
					alt="Peer Reviewed"
					class="w-10 h-10 drop-shadow-md"
				/>
			</div>
		{/if}
		{#if edition.pubNum}
			<div class="absolute top-2 left-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
				#{edition.pubNum}
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
			{#if isLocalAsset}
				<picture class="block w-full h-full">
					<source srcset={coverUrl.replace('.png', '.avif')} type="image/avif" />
					<source srcset={coverUrl.replace('.png', '.webp')} type="image/webp" />
					<img
						src={coverUrl}
						alt={edition.title}
						class="w-full h-full object-cover"
						loading="lazy"
						onerror={handleImageError}
					/>
				</picture>
			{:else}
				<img
					src={coverUrl}
					alt={edition.title}
					class="w-full h-full object-cover"
					loading="lazy"
					onerror={handleImageError}
				/>
			{/if}
		{/if}
	</figure>
	<div class="card-body gap-1 p-4">
		<h3 class="card-title text-sm line-clamp-2 group-hover:text-primary transition-colors">
			{edition.title}
		</h3>
		{#if edition.authors}
			<p class="text-xs text-base-content/60 line-clamp-1">{edition.authors}</p>
		{/if}
	</div>
</a>
