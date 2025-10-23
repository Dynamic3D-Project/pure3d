<script lang="ts">
	import type { Edition } from '$lib/types/collection';

	interface Props {
		edition: Edition;
	}

	let { edition }: Props = $props();

	// Prefetch iframe URL on hover
	function prefetchIframe() {
		const link = document.createElement('link');
		link.rel = 'prefetch';
		link.as = 'document';
		link.href = edition.voyagerUrl;
		document.head.appendChild(link);
	}
</script>

<a
	href={`/editions/${edition.slug}`}
	data-sveltekit-preload-data="hover"
	onmouseenter={prefetchIframe}
	class="group card bg-base-100 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
>
	<figure class="relative overflow-hidden aspect-square">
		<img
			src={edition.thumbnail}
			alt={edition.title}
			class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
		/>
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
