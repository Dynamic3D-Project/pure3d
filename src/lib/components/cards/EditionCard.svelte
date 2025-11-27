<script lang="ts">
	import type { Edition } from '$lib/types/collection';

	interface Props {
		edition: Edition;
	}

	let { edition }: Props = $props();
	let imageError = $state(false);
	let imageLoaded = $state(false);

	// Prefetch iframe URL on hover
	function prefetchIframe() {
		const link = document.createElement('link');
		link.rel = 'prefetch';
		link.as = 'document';
		link.href = edition.voyagerUrl;
		document.head.appendChild(link);
	}

	function handleImageError() {
		imageError = true;
	}

	function handleImageLoad() {
		imageLoaded = true;
	}
</script>

<a
	href={`/editions/${edition.slug}`}
	data-sveltekit-preload-data="hover"
	onmouseenter={prefetchIframe}
	class="group card bg-base-100 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
>
	<figure class="relative overflow-hidden aspect-square bg-base-200">
		<!-- Peer Review Badge -->
		{#if edition.hasPeerReview}
			<div class="absolute top-2 right-2 z-10" title="Peer Reviewed">
				<img
					src="/images/peer-reviewed-badge.svg"
					alt="Peer Reviewed"
					class="w-10 h-10 drop-shadow-md"
				/>
			</div>
		{/if}
		<!-- Placeholder: show while loading or on error -->
		<div
			class="absolute inset-0 flex items-center justify-center text-base-content/30 transition-opacity duration-300"
			class:opacity-0={imageLoaded && !imageError}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
			</svg>
		</div>
		<!-- Actual image -->
		{#if edition.thumbnail && !imageError}
			<img
				src={edition.thumbnail}
				alt={edition.title}
				class="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
				class:opacity-0={!imageLoaded}
				onerror={handleImageError}
				onload={handleImageLoad}
			/>
		{/if}
		<div
			class="absolute inset-0 bg-gradient-to-t from-base-300/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
		></div>
	</figure>
	<div class="card-body p-4">
		<h3 class="card-title text-sm line-clamp-2 group-hover:text-primary transition-colors">
			{edition.title}
		</h3>
	</div>
</a>
