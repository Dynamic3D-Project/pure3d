<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { createEdition } from '$lib/database/edition-helpers';
	import { GlobalRole } from '$lib/types/roles';
	import { logAudit } from '$lib/utils/audit';
	import toast from 'svelte-french-toast';

	interface CollectionOption {
		id: string;
		title: string;
	}

	let isLoading = $state(true);
	let isCreating = $state(false);
	let canCreate = $state(false);
	let isCollectionOwner = $state(false);

	// Form state
	let title = $state('');
	let description = $state('');
	let peerReviewRequested = $state(true);
	let collectionId = $state('');
	let collections = $state<CollectionOption[]>([]);

	let isAdmin = $derived(authStore.globalRole === GlobalRole.Admin);

	onMount(async () => {
		if (!authStore.isAuthenticated) {
			goto(`${base}/`);
			return;
		}

		try {
			if (isAdmin) {
				canCreate = true;
				const result = await pb.collection('collections').getList(1, 500);
				collections = result.items.map((r) => ({ id: r.id, title: r.title }));
			} else if (authStore.appUserId) {
				const owned = await pb.collection('collectionUsers').getList(1, 100, {
					filter: `userId = "${authStore.appUserId}" && role = "owner"`,
					expand: 'collection'
				});
				if (owned.items.length > 0) {
					canCreate = true;
					isCollectionOwner = true;
					peerReviewRequested = false;
					collections = owned.items.map((r) => ({
						id: r.collection,
						title: r.expand?.collection?.title || ''
					}));
					if (collections.length === 1) {
						collectionId = collections[0].id;
					}
				}
			}

			if (!canCreate) {
				toast.error('You do not have permission to create editions');
				goto(`${base}/editions`);
				return;
			}
		} catch (error) {
			console.error('Error checking permissions:', error);
			toast.error('Failed to load page');
			goto(`${base}/editions`);
			return;
		} finally {
			isLoading = false;
		}
	});

	async function handleCreate() {
		if (!title.trim()) {
			toast.error('Title is required');
			return;
		}
		if (isCollectionOwner && !collectionId) {
			toast.error('Please select a collection');
			return;
		}
		if (!authStore.appUserId) {
			toast.error('User profile not found');
			return;
		}

		isCreating = true;
		try {
			const newId = await createEdition({
				title: title.trim(),
				description: description.trim(),
				peerReviewRequested,
				collectionId: collectionId || undefined,
				creatorUserId: authStore.appUserId
			});

			await logAudit('edition_created', 'edition', newId, authStore.user?.email || '', {
				title: title.trim(),
				collectionId: collectionId || null,
				peerReviewRequested
			});

			toast.success('Edition created');
			goto(`${base}/editions/${newId}/workflow`);
		} catch (error) {
			console.error('Error creating edition:', error);
			toast.error('Failed to create edition');
		} finally {
			isCreating = false;
		}
	}
</script>

{#if isLoading}
	<div class="flex min-h-[50vh] items-center justify-center">
		<span class="loading loading-lg loading-spinner"></span>
	</div>
{:else}
	<div id="new-edition-page" class="container mx-auto max-w-2xl px-4 py-8">
		<!-- Breadcrumbs -->
		<div class="breadcrumbs mb-6 text-sm">
			<ul>
				<li><a href="{base}/editions">Editions</a></li>
				<li>New Edition</li>
			</ul>
		</div>

		<h1 class="mb-2 text-3xl font-bold">New Edition</h1>
		<p class="mb-8 text-base-content/70">
			Create a new edition draft. After creation you can flesh out the concept proposal and submit
			it for review.
		</p>

		<div class="flex flex-col gap-4">
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Title *</legend>
				<input
					id="edition-title"
					type="text"
					class="input w-full"
					placeholder="Enter edition title"
					bind:value={title}
				/>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Description</legend>
				<textarea
					id="edition-description"
					class="textarea w-full"
					rows="4"
					placeholder="Brief description or abstract (optional)"
					bind:value={description}
				></textarea>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Collection</legend>
				<select id="edition-collection" class="select w-full" bind:value={collectionId}>
					{#if !isCollectionOwner}
						<option value="">None</option>
					{/if}
					{#each collections as col (col.id)}
						<option value={col.id}>{col.title}</option>
					{/each}
				</select>
				{#if isCollectionOwner}
					<p class="mt-1 text-xs text-base-content/50">
						Editions are created within your collection.
					</p>
				{/if}
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Review Process</legend>
				<label id="edition-peer-review" class="flex cursor-pointer items-center gap-3">
					<input type="checkbox" class="checkbox" bind:checked={peerReviewRequested} />
					<span>Request peer review</span>
				</label>
				<p class="mt-1 text-xs text-base-content/50">
					{#if peerReviewRequested}
						The edition will go through the full peer-review pipeline before publication.
					{:else}
						The edition will go through editorial review only.
					{/if}
				</p>
			</fieldset>
		</div>

		<div class="mt-8 flex gap-3">
			<a href="{base}/editions" class="btn">Cancel</a>
			<button
				id="create-edition-btn"
				class="btn btn-primary"
				onclick={handleCreate}
				disabled={isCreating}
			>
				{#if isCreating}
					<span class="loading loading-sm loading-spinner"></span>
				{/if}
				Create Edition
			</button>
		</div>
	</div>
{/if}
