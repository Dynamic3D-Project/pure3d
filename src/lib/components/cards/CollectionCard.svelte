<script lang="ts">
	import type { Collection } from '$lib/types/collection';

	interface Props {
		collection: Collection;
	}

	let { collection }: Props = $props();
</script>

<a
	href={`/collections/${collection.slug}`}
	data-sveltekit-preload-data="hover"
	class="group card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden"
>
	<figure class="relative overflow-hidden aspect-[3/4]">
		<img
			src={collection.thumbnail}
			alt={collection.title}
			class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
		/>
		<div
			class="absolute inset-0 bg-gradient-to-t from-base-300/90 via-base-300/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
		></div>
	</figure>
	<div class="card-body p-4">
		<h3 class="card-title text-base line-clamp-2 group-hover:text-primary transition-colors">
			{collection.title}
		</h3>
		<p class="text-sm text-base-content/70 line-clamp-2">{collection.description}</p>
		<div class="card-actions justify-end mt-2">
			<div class="badge badge-outline text-xs">{collection.editionCount || collection.editionIds?.length || 0} editions</div>
		</div>
	</div>
</a>
