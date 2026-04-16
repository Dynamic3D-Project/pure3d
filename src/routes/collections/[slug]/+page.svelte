<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { hasPermission } from '$lib/utils/permissions';
	import { Permission, CollectionRole, type UserRoleContext } from '$lib/types/roles';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Make reactive so they update on navigation
	let collection = $derived(data.collection);
	let editions = $derived(data.editions);

	let collectionRole = $state<CollectionRole | undefined>(undefined);

	let roleContext = $derived<UserRoleContext>({
		globalRole: authStore.globalRole,
		collectionRole
	});

	let canEdit = $derived(hasPermission(roleContext, Permission.CollectionEdit));
	let canCreateEdition = $derived(hasPermission(roleContext, Permission.EditionCreate));

	onMount(() => {
		fetchCollectionRole();
	});

	async function fetchCollectionRole() {
		if (!authStore.appUserId || !collection.id) return;
		try {
			const result = await pb.collection('collectionUsers').getList(1, 1, {
				filter: `collection = "${collection.id}" && userId = "${authStore.appUserId}"`
			});
			if (result.items.length > 0) {
				collectionRole = result.items[0].role as CollectionRole;
			}
		} catch {
			// User has no collection role — that's fine
		}
	}
</script>

<svelte:head>
	<title>{collection.title} | Pure 3D</title>
	<meta name="description" content={collection.description} />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-7xl">
		<!-- Collection Header -->
		<div class="mb-12">
			<nav class="text-sm breadcrumbs mb-6">
				<ul>
					<li><a href="{base}/" data-sveltekit-preload-data="hover" class="link link-hover">Home</a></li>
					<li><a href="{base}/collections" data-sveltekit-preload-data="hover" class="link link-hover">Collections</a></li>
					<li class="text-base-content/70">{collection.title}</li>
				</ul>
			</nav>

			<div class="text-center max-w-4xl mx-auto">
				<h1 class="text-4xl md:text-5xl font-bold mb-6">{collection.title}</h1>
				<div class="text-lg text-base-content/70 leading-relaxed prose max-w-none mx-auto">
					{@html collection.description}
				</div>
			</div>

			{#if canEdit || canCreateEdition}
				<div class="flex justify-center gap-3 mt-6">
					{#if canEdit}
						<a href="{base}/collections/{collection.slug}/edit" class="btn btn-outline btn-sm">
							Edit Collection
						</a>
					{/if}
					{#if canCreateEdition}
						<a href="{base}/collections/{collection.slug}/editions/new" class="btn btn-primary btn-sm">
							+ New Edition
						</a>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Editions Section -->
		<div class="mb-8">
			<h2 class="text-2xl font-semibold mb-6">Editions</h2>

			{#if editions.length > 0}
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
					{#each editions as edition (edition.id)}
						<EditionCard {edition} />
					{/each}
				</div>
			{:else}
				<div class="alert alert-info">
					<span>No editions available in this collection yet.</span>
				</div>
			{/if}
		</div>

	<!-- Back Button -->
	<div class="flex justify-center mt-12">
		<a href="{base}/collections" data-sveltekit-preload-data="hover" class="btn btn-outline btn-lg">
			← Back to Collections
		</a>
	</div>
</div>
