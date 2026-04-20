<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import MemberManager from '$lib/components/admin/MemberManager.svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import {
		CollectionRole,
		COLLECTION_ROLE_LABELS,
		EditionStatus,
		GlobalRole,
		Permission,
		type UserRoleContext
	} from '$lib/types/roles';
	import { hasPermission } from '$lib/utils/permissions';
	import { resolvePageContext } from '$lib/utils/page-permissions';
	import { logAudit } from '$lib/utils/audit';
	import toast from 'svelte-french-toast';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let collection = $derived(data.collection);
	let editions = $derived(data.editions);

	let permissionContext = $state<UserRoleContext>({ globalRole: GlobalRole.Viewer });
	let manageOpen = $state(false);
	let manageTab = $state<'details' | 'members' | 'danger'>('details');
	let deleteConfirmOpen = $state(false);
	let isDeleting = $state(false);
	let isCreating = $state(false);

	// Edit-details form
	let editTitle = $state('');
	let editDescription = $state('');
	let editIsVisible = $state(true);
	let isSaving = $state(false);

	const collectionRoleValues = Object.values(CollectionRole) as string[];

	let canEdit = $derived(hasPermission(permissionContext, Permission.CollectionEdit));
	let canManageUsers = $derived(hasPermission(permissionContext, Permission.CollectionManageUsers));
	let canDelete = $derived(hasPermission(permissionContext, Permission.CollectionDelete));
	let canCreateEdition = $derived(hasPermission(permissionContext, Permission.EditionCreate));
	let canManagePage = $derived(canManageUsers || canDelete);

	onMount(async () => {
		editTitle = collection.title;
		editDescription = collection.description;
		editIsVisible = collection.isVisible;

		if (!authStore.isAuthenticated || !authStore.appUserId) {
			permissionContext = { globalRole: authStore.globalRole };
			return;
		}

		permissionContext = await resolvePageContext({
			globalRole: authStore.globalRole,
			userProfileId: authStore.appUserId,
			collectionId: collection.id
		});
	});

	async function saveDetails() {
		isSaving = true;
		try {
			await pb.collection('collections').update(collection.id, {
				title: editTitle,
				dcAbstract: editDescription,
				isVisible: editIsVisible
			});
			await logAudit('user_updated', 'collection', collection.id, authStore.user?.email || '', {
				title: editTitle,
				isVisible: editIsVisible
			});
			collection.title = editTitle;
			collection.description = editDescription;
			collection.isVisible = editIsVisible;
			toast.success('Collection updated');
		} catch (error) {
			console.error('Error saving collection:', error);
			toast.error('Failed to save collection');
		} finally {
			isSaving = false;
		}
	}

	async function deleteCollection() {
		isDeleting = true;
		try {
			await pb.collection('collections').delete(collection.id);
			await logAudit('user_deleted', 'collection', collection.id, authStore.user?.email || '', {
				title: collection.title
			});
			toast.success('Collection deleted');
			goto(`${base}/collections`);
		} catch (error) {
			console.error('Error deleting collection:', error);
			toast.error('Failed to delete collection (it may still contain editions).');
			isDeleting = false;
		}
	}

	async function createEdition() {
		isCreating = true;
		try {
			const record = await pb.collection('editions').create({
				title: 'Untitled Edition',
				dcTitle: 'Untitled Edition',
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
					// Non-critical
				}
			}

			goto(`${base}/editions/${record.id}/workflow`);
		} catch (e: any) {
			toast.error(e?.message || 'Failed to create edition');
		} finally {
			isCreating = false;
		}
	}
</script>

<svelte:head>
	<title>{collection.title} | Pure 3D</title>
	<meta name="description" content={collection.description} />
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-12">
	<!-- Collection Header -->
	<div class="mb-12">
		<nav class="breadcrumbs mb-6 text-sm">
			<ul>
				<li>
					<a href="{base}/" data-sveltekit-preload-data="hover" class="link link-hover">Home</a>
				</li>
				<li>
					<a href="{base}/collections" data-sveltekit-preload-data="hover" class="link link-hover"
						>Collections</a
					>
				</li>
				<li class="text-base-content/70">{collection.title}</li>
			</ul>
		</nav>

		<div class="mx-auto max-w-4xl text-center">
			<div class="flex items-start justify-center gap-3">
				<h1 class="mb-6 text-4xl font-bold md:text-5xl">{collection.title}</h1>
				{#if !collection.isVisible}
					<span class="mt-2 badge badge-warning">Hidden</span>
				{/if}
			</div>
			<div class="prose mx-auto max-w-none text-lg leading-relaxed text-base-content/70">
				{@html collection.description}
			</div>
			{#if canManagePage || canCreateEdition}
				<div class="mt-4 flex justify-center gap-3">
					{#if canManagePage}
						<button
							class="btn btn-sm btn-primary"
							onclick={() => (manageOpen = !manageOpen)}
							aria-expanded={manageOpen}
						>
							{manageOpen ? 'Close Manage' : 'Manage'}
						</button>
					{/if}
					{#if canCreateEdition}
						<button class="btn btn-sm btn-primary" onclick={createEdition} disabled={isCreating}>
							{#if isCreating}
								<span class="loading loading-xs loading-spinner"></span>
							{/if}
							+ New Edition
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{#if manageOpen && canManagePage}
		<div class="mx-auto mb-8 max-w-4xl rounded-box border border-base-300 bg-base-200 p-4">
			<h2 class="mb-3 text-lg font-semibold">Manage Collection</h2>

			<div role="tablist" class="tabs-bordered tabs mb-4">
				{#if canEdit}
					<button
						role="tab"
						class="tab"
						class:tab-active={manageTab === 'details'}
						onclick={() => (manageTab = 'details')}
					>
						Details
					</button>
				{/if}
				{#if canManageUsers}
					<button
						role="tab"
						class="tab"
						class:tab-active={manageTab === 'members'}
						onclick={() => (manageTab = 'members')}
					>
						Members
					</button>
				{/if}
				{#if canDelete}
					<button
						role="tab"
						class="tab"
						class:tab-active={manageTab === 'danger'}
						onclick={() => (manageTab = 'danger')}
					>
						Danger Zone
					</button>
				{/if}
			</div>

			{#if manageTab === 'details' && canEdit}
				<form
					class="space-y-4"
					onsubmit={(e) => {
						e.preventDefault();
						saveDetails();
					}}
				>
					<div class="form-control">
						<label class="label" for="collection-title">
							<span class="label-text font-semibold">Title</span>
						</label>
						<input
							id="collection-title"
							type="text"
							class="input-bordered input w-full"
							bind:value={editTitle}
							required
						/>
					</div>
					<div class="form-control">
						<label class="label" for="collection-description">
							<span class="label-text font-semibold">Description</span>
						</label>
						<textarea
							id="collection-description"
							class="textarea-bordered textarea w-full"
							rows="4"
							bind:value={editDescription}
						></textarea>
						<p class="mt-1 text-xs text-base-content/60">
							For rich-text editing, use the
							<a href="{base}/collections/{collection.slug}/edit" class="link">full edit page</a>.
						</p>
					</div>
					<div class="form-control">
						<label class="label cursor-pointer justify-start gap-3">
							<input type="checkbox" class="checkbox" bind:checked={editIsVisible} />
							<span class="label-text">Visible on public site</span>
						</label>
					</div>
					<button type="submit" class="btn btn-sm btn-primary" disabled={isSaving}>
						{#if isSaving}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Save Changes
					</button>
				</form>
			{:else if manageTab === 'members' && canManageUsers}
				<MemberManager
					membershipCollection="collectionUsers"
					parentField="collection"
					parentId={collection.id}
					roleValues={collectionRoleValues}
					roleLabels={COLLECTION_ROLE_LABELS}
					defaultRole={CollectionRole.Viewer}
					auditTargetType="collection"
				/>
			{:else if manageTab === 'danger' && canDelete}
				<div class="space-y-3">
					<p class="text-sm text-base-content/70">
						Deleting this collection is permanent. Editions inside the collection must be removed
						or reassigned first.
					</p>
					<button
						class="btn btn-sm btn-error"
						onclick={() => (deleteConfirmOpen = true)}
						disabled={isDeleting}
					>
						Delete Collection
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Editions Section -->
	<div class="mb-8">
		<h2 class="mb-6 text-2xl font-semibold">Editions</h2>

		{#if editions.length > 0}
			<div
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
			>
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
	<div class="mt-12 flex justify-center">
		<a href="{base}/collections" data-sveltekit-preload-data="hover" class="btn btn-outline btn-lg">
			← Back to Collections
		</a>
	</div>
</div>

<!-- Delete confirmation modal -->
{#if canDelete}
	<dialog class="modal" class:modal-open={deleteConfirmOpen}>
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete this collection?</h3>
			<p class="py-4 text-base-content/70">
				"{collection.title}" will be permanently removed. This action cannot be undone.
			</p>
			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={() => (deleteConfirmOpen = false)}
					disabled={isDeleting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-error"
					onclick={deleteCollection}
					disabled={isDeleting}
				>
					{#if isDeleting}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Delete
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => (deleteConfirmOpen = false)}>close</button>
		</form>
	</dialog>
{/if}
