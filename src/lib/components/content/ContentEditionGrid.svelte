<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { readCredits } from '$lib/utils/credits';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import type { Edition } from '$lib/types/collection';

	interface Props {
		ids: string[];
	}

	let { ids }: Props = $props();
	let editions = $state<Edition[]>([]);

	onMount(async () => {
		if (!ids.length) return;
		try {
			const filter = pb.filter(
				`isPublished = true && (${ids.map((_, index) => `id = {:id${index}}`).join(' || ')})`,
				Object.fromEntries(ids.map((id, index) => [`id${index}`, id]))
			);
			const records = await pb.collection('editions').getFullList({ filter });
			const byId = new Map(records.map((record) => [record.id, record]));
			editions = ids.flatMap((id) => {
				const record = byId.get(id);
				return record
					? [
							{
								...record,
								slug: record.id,
								title: record.dcTitle || record.title || 'Untitled edition',
								credits: readCredits(record.credits),
								voyagerUrl: ''
							} as Edition
						]
					: [];
			});
		} catch {
			editions = [];
		}
	});
</script>

<div id="content-edition-grid" class="not-prose my-6 grid gap-4 sm:grid-cols-2">
	{#each editions as edition (edition.id)}
		<EditionCard {edition} />
	{/each}
</div>
