<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import MemberManager from '$lib/components/admin/MemberManager.svelte';
	import CoverImageUpload from '$lib/components/uploads/CoverImageUpload.svelte';
	import FloatingModal from '$lib/components/ui/FloatingModal.svelte';
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
	import { getCollectionCoverUrl } from '$lib/utils/asset-urls';
	import toast from 'svelte-french-toast';
	import type { RecordModel } from 'pocketbase';
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
	let collectionRecord = $state<RecordModel | null>(null);
	let descriptionExpanded = $state(false);
	let manageButtonElement: HTMLButtonElement | undefined = $state();

	const DESCRIPTION_CLAMP_LENGTH = 320;

	function stripHtml(html: string): string {
		return html.replace(/<[^>]*>/g, '').trim();
	}

	let descriptionIsLong = $derived(
		stripHtml(collection.description).length > DESCRIPTION_CLAMP_LENGTH
	);

	function formatCreators(creators: string[]): string {
		if (creators.length === 0) return '';
		if (creators.length <= 3) return creators.join(', ');
		return `${creators.slice(0, 2).join(', ')}, +${creators.length - 2} more`;
	}

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
	let canManagePage = $derived(canEdit || canManageUsers || canDelete);

	// Group editions by status for version-aware display
	let editionGroups = $derived.by(() => {
		const groups: Record<string, typeof editions> = {};
		for (const edition of editions) {
			const key = (edition as any).status || 'Unknown';
			if (!groups[key]) groups[key] = [];
			groups[key].push(edition);
		}
		// Sort groups: want "published" or "current" first, then others
		const priority: Record<string, number> = { published: 0, current: 0, draft: 2, review: 1 };
		const sortedKeys = Object.keys(groups).sort((a, b) => {
			const pa = priority[a.toLowerCase()] ?? 3;
			const pb = priority[b.toLowerCase()] ?? 3;
			return pa - pb;
		});
		return sortedKeys.map((key) => ({ status: key, editions: groups[key] }));
	});

	// Latest edition (highest pubNum)
	let latestEdition = $derived(
		editions.length > 0
			? editions.reduce((a, b) => (((a as any).pubNum || 0) > ((b as any).pubNum || 0) ? a : b))
			: null
	);

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

		try {
			collectionRecord = await pb.collection('collections').getOne(collection.id);
		} catch (error) {
			console.error('Error loading collection record:', error);
		}
	});

	function onCoverChanged(r: RecordModel) {
		collectionRecord = r;
		collection.thumbnail = getCollectionCoverUrl(r, r.pubNum) || '';
	}

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

	function openManageModal() {
		if (manageTab === 'details' && !canEdit) {
			manageTab = canManageUsers ? 'members' : 'danger';
		} else if (manageTab === 'members' && !canManageUsers) {
			manageTab = canEdit ? 'details' : 'danger';
		} else if (manageTab === 'danger' && !canDelete) {
			manageTab = canEdit ? 'details' : 'members';
		}
		manageOpen = true;
	}

	function closeManageModal() {
		manageOpen = false;
		deleteConfirmOpen = false;
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

		<div
			class="relative grid gap-8 md:grid-cols-[minmax(0,320px)_1fr] md:items-start md:gap-10 lg:gap-14"
		>
			<!-- Cover -->
			<figure
				class="relative aspect-square w-full overflow-hidden rounded-2xl bg-base-200 shadow-lg ring-1 ring-base-300 md:sticky md:top-24"
			>
				{#if collection.thumbnail}
					<img
						src={collection.thumbnail}
						alt={collection.title}
						class="h-full w-full object-cover"
						loading="eager"
					/>
				{:else}
					<div class="flex h-full w-full items-center justify-center text-base-content/20">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-24 w-24"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.25"
								d="M4.5 4.5h15v15h-15z M4.5 15l4-4 4 4 3-3 4 4"
							/>
						</svg>
					</div>
				{/if}
			</figure>

			<!-- Info column -->
			<div class="flex min-w-0 flex-col">
				{#if canManagePage || canCreateEdition}
					<div
						class="mb-3 flex flex-wrap justify-end gap-2 md:absolute md:top-0 md:right-0 md:z-10 md:mb-0"
					>
						{#if canManagePage}
							<button
								bind:this={manageButtonElement}
								class="btn btn-ghost btn-sm"
								onclick={() => (manageOpen ? closeManageModal() : openManageModal())}
								aria-expanded={manageOpen}
								aria-haspopup="dialog"
								aria-controls="collection-manage-modal"
							>
								Manage
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

				<div class="mb-4 flex flex-wrap items-start gap-3">
					<h1 class="text-3xl leading-tight font-bold md:text-4xl lg:text-5xl">
						{collection.title}
					</h1>
					{#if !collection.isVisible}
						<span class="mt-2 badge badge-warning">Hidden</span>
					{/if}
				</div>

				<!-- Creators byline -->
				{#if collection.dcCreator.length > 0}
					<p class="mb-3 text-sm text-base-content/70">
						<span class="text-base-content/50">by</span>
						{formatCreators(collection.dcCreator)}
					</p>
				{/if}

				<!-- Meta chips -->
				<div class="mb-5 flex flex-wrap items-center gap-2 text-sm">
					<span class="badge badge-ghost">
						{editions.length}
						{editions.length === 1 ? 'edition' : 'editions'}
					</span>
					{#if collection.dcCoveragePeriod}
						<span class="badge badge-outline">{collection.dcCoveragePeriod}</span>
					{/if}
					{#if collection.dcCoveragePlace}
						<span class="badge badge-outline">{collection.dcCoveragePlace}</span>
					{/if}
					{#each collection.dcLanguage as lang (lang)}
						<span class="badge badge-outline">{lang}</span>
					{/each}
				</div>

				{#if collection.description}
					<div class="relative">
						<div
							class="prose max-w-prose text-base leading-relaxed text-base-content/80"
							class:line-clamp-6={descriptionIsLong && !descriptionExpanded}
						>
							{@html collection.description}
						</div>
						{#if descriptionIsLong}
							<button
								type="button"
								class="mt-2 text-sm font-medium text-primary hover:underline"
								onclick={() => (descriptionExpanded = !descriptionExpanded)}
							>
								{descriptionExpanded ? 'Show less' : 'Show more'}
							</button>
						{/if}
					</div>
				{/if}

				{#if collection.dcInstitution.length > 0}
					<p class="mt-4 text-sm text-base-content/60">
						<span class="text-xs font-semibold tracking-wider text-base-content/50 uppercase">
							Institutions
						</span>
						<br />
						{collection.dcInstitution.join(', ')}
					</p>
				{/if}

				{#if collection.dcSubject.length > 0}
					<div class="mt-5 flex flex-wrap gap-1.5">
						{#each collection.dcSubject as subject (subject)}
							<span class="badge badge-sm badge-neutral">{subject}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Editions Section -->
	<div class="mb-8">
		<h2 class="mb-6 text-2xl font-semibold">Editions</h2>

		{#if editions.length > 0}
			<!-- Version summary -->
			{#if latestEdition && (latestEdition as any).pubNum > 1}
				<div class="mb-4 text-sm text-base-content/60">
					{editions.length} editions · Latest: Ed. {String((latestEdition as any).pubNum).padStart(
						2,
						'0'
					)} ·
					<a
						href="{base}/editions/{latestEdition.id}"
						data-sveltekit-preload-data="hover"
						class="link link-hover"
					>
						{latestEdition.title}
					</a>
				</div>
			{/if}

			<!-- Grouped by status -->
			{#if editionGroups.length > 1}
				{#each editionGroups as group}
					<div class="mb-6">
						<h3
							class="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wider text-base-content/50 uppercase"
						>
							{group.status}
							<span class="badge badge-sm">{group.editions.length}</span>
						</h3>
						<div
							class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
						>
							{#each group.editions as edition (edition.id)}
								<EditionCard edition={edition as any} />
							{/each}
						</div>
					</div>
				{/each}
			{:else}
				<div
					class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
				>
					{#each editions as edition (edition.id)}
						<EditionCard edition={edition as any} />
					{/each}
				</div>
			{/if}
		{:else}
			<div
				class="rounded-lg border border-dashed border-base-300 bg-base-200/40 px-4 py-8 text-center text-sm text-base-content/60"
			>
				No editions available in this collection yet.
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

{#if canManagePage}
	<FloatingModal
		open={manageOpen}
		referenceElement={manageButtonElement}
		id="collection-manage-modal"
		labelledby="collection-manage-title"
		onclose={() => {
			if (!deleteConfirmOpen) closeManageModal();
		}}
	>
		{#snippet header()}
			<div class="flex items-start justify-between gap-4">
				<h2 id="collection-manage-title" class="text-lg font-semibold">Manage Collection</h2>
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					onclick={closeManageModal}
					aria-label="Close manage collection modal"
				>
					x
				</button>
			</div>

			<div role="tablist" class="tabs-bordered mt-4 tabs">
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
		{/snippet}

		{#if manageTab === 'details' && canEdit}
			<form
				id="collection-details-form"
				class="space-y-4"
				onsubmit={(e) => {
					e.preventDefault();
					saveDetails();
				}}
			>
				{#if collectionRecord}
					<div class="form-control">
						<span class="label-text mb-2 block font-semibold">Cover Image</span>
						<div class="w-full max-w-xs">
							<CoverImageUpload
								bind:record={collectionRecord}
								collectionName="collections"
								onuploaded={onCoverChanged}
								onremoved={onCoverChanged}
							/>
						</div>
					</div>
				{/if}
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
					Deleting this collection is permanent. Editions inside the collection must be removed or
					reassigned first.
				</p>
			</div>
		{/if}

		{#snippet footer()}
			<div class="flex justify-end gap-2">
				<button type="button" class="btn btn-ghost btn-sm" onclick={closeManageModal}>Close</button>
				{#if manageTab === 'details' && canEdit}
					<button
						type="submit"
						form="collection-details-form"
						class="btn btn-sm btn-primary"
						disabled={isSaving}
					>
						{#if isSaving}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Save Changes
					</button>
				{:else if manageTab === 'danger' && canDelete}
					<button
						type="button"
						class="btn btn-sm btn-error"
						onclick={() => (deleteConfirmOpen = true)}
						disabled={isDeleting}
					>
						Delete Collection
					</button>
				{/if}
			</div>
		{/snippet}
	</FloatingModal>
{/if}

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
