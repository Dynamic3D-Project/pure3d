<script lang="ts">
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import { ROLE_LABELS } from '$lib/types/roles';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const joinDate = $derived(
		new Date(data.profile.created).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long'
		})
	);
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<section class="mb-8 rounded-lg border border-base-300 bg-base-100 p-6 shadow-md">
		<div class="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
			<div class="placeholder avatar">
				<div class="w-24 rounded-full bg-primary text-primary-content">
					<span class="text-3xl">{data.profile.name.charAt(0).toUpperCase()}</span>
				</div>
			</div>

			<div class="flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-3xl font-bold">{data.profile.name}</h1>
					{#if data.profile.verified}
						<span class="badge badge-sm badge-success">Verified</span>
					{/if}
				</div>
				<div class="mt-3 flex flex-wrap gap-2 text-sm text-base-content/70">
					{#if data.profile.role}
						<span class="badge badge-neutral"
							>{ROLE_LABELS[data.profile.role] || data.profile.role}</span
						>
					{/if}
					<span>Member since {joinDate}</span>
				</div>
			</div>
		</div>
	</section>

	<section class="mb-10">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-2xl font-semibold">Editions</h2>
			<span class="text-sm text-base-content/60">{data.editions.length} public</span>
		</div>
		{#if data.editions.length}
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each data.editions as edition (edition.id)}
					<EditionCard {edition} />
				{/each}
			</div>
		{:else}
			<p class="rounded-lg border border-base-300 bg-base-100 p-6 text-base-content/60">
				No public editions yet.
			</p>
		{/if}
	</section>

	<section>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-2xl font-semibold">Collections</h2>
			<span class="text-sm text-base-content/60">{data.collections.length} public</span>
		</div>
		{#if data.collections.length}
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.collections as collection (collection.id)}
					<CollectionCard {collection} />
				{/each}
			</div>
		{:else}
			<p class="rounded-lg border border-base-300 bg-base-100 p-6 text-base-content/60">
				No public collections yet.
			</p>
		{/if}
	</section>
</div>
