<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { hasPermission } from '$lib/utils/permissions';
	import { Permission, CollectionRole, EditionStatus, type UserRoleContext } from '$lib/types/roles';
	import toast from 'svelte-french-toast';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let collection = $derived(data.collection);

	let title = $state('');
	let creating = $state(false);
	let authorized = $state<boolean | null>(null);
	let collectionRole = $state<CollectionRole | undefined>(undefined);
	let roleContext = $derived<UserRoleContext>({
		globalRole: authStore.globalRole,
		collectionRole
	});
	let canCreate = $derived(hasPermission(roleContext, Permission.EditionCreate));

	onMount(async () => {
		if (authStore.appUserId && collection.id) {
			try {
				const result = await pb.collection('collectionUsers').getList(1, 1, {
					filter: `collection = "${collection.id}" && userId = "${authStore.appUserId}"`
				});
				if (result.items.length > 0) {
					collectionRole = result.items[0].role as CollectionRole;
				}
			} catch {
				/* no-op */
			}
		}
		authorized = canCreate;
	});

	async function createDraftAndRedirect() {
		if (creating) return;
		if (!title.trim()) {
			toast.error('Title is required');
			return;
		}
		creating = true;
		try {
			const record = await pb.collection('editions').create({
				title: title.trim(),
				collection: collection.id,
				status: EditionStatus.Draft,
				isPublished: false
			});
			if (authStore.appUserId) {
				try {
					await pb.collection('editionUsers').create({
						edition: record.id,
						editionId: record.id,
						user: authStore.appUserId,
						userId: authStore.appUserId,
						role: 'author'
					});
				} catch {
					/* non-critical */
				}
			}
			goto(`${base}/editions/${record.id}/workflow`);
		} catch (e: unknown) {
			toast.error((e as Error)?.message || 'Failed to create edition');
			creating = false;
		}
	}
</script>

<svelte:head>
	<title>New Edition | {collection.title} | Pure 3D</title>
</svelte:head>

<div class="container mx-auto max-w-xl px-4 py-12">
	<nav class="breadcrumbs mb-4 text-sm">
		<ul>
			<li><a href="{base}/" class="link link-hover">Home</a></li>
			<li><a href="{base}/collections" class="link link-hover">Collections</a></li>
			<li><a href="{base}/collections/{collection.id}" class="link link-hover">{collection.title}</a></li>
			<li class="text-base-content/70">New Edition</li>
		</ul>
	</nav>

	{#if authorized === null}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if !authorized}
		<div class="alert alert-error">
			<span>You don't have permission to create editions in this collection.</span>
		</div>
	{:else}
		<div class="space-y-4">
			<div>
				<h1 class="text-2xl font-bold">New Edition</h1>
				<p class="text-sm text-base-content/60">in <strong>{collection.title}</strong></p>
			</div>
			<form onsubmit={(e) => { e.preventDefault(); createDraftAndRedirect(); }} class="space-y-3">
				<div class="form-control">
					<label class="label" for="title">
						<span class="label-text font-medium">Title *</span>
					</label>
					<input
						id="title"
						type="text"
						class="input-bordered input"
						bind:value={title}
						required
						placeholder="Edition title"
						disabled={creating}
					/>
					<p class="mt-1 text-xs text-base-content/50">
						You'll continue editing — including uploading files — on the next page.
					</p>
				</div>
				<div class="flex justify-end gap-2">
					<a href="{base}/collections/{collection.id}" class="btn btn-ghost btn-sm">Cancel</a>
					<button type="submit" class="btn btn-primary btn-sm" disabled={creating || !title.trim()}>
						{#if creating}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Continue
					</button>
				</div>
			</form>
		</div>
	{/if}
</div>
