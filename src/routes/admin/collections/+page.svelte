<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import { CollectionRole, COLLECTION_ROLE_LABELS, GlobalRole } from '$lib/types/roles';
	import toast from 'svelte-french-toast';
	import MemberManager from '$lib/components/admin/MemberManager.svelte';
	import FloatingSelect from '$lib/components/ui/FloatingSelect.svelte';

	interface AdminCollection {
		id: string;
		title: string;
		isVisible: boolean;
		pubNum: number;
		thumbnailUrl: string;
	}

	let collections = $state<AdminCollection[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let visibilityFilter = $state('');
	let expandedId = $state<string | null>(null);
	let filteredCollections = $derived(
		collections.filter((c) => {
			const query = searchQuery.toLowerCase();
			const matchesSearch = !query || c.title.toLowerCase().includes(query);
			const matchesVisibility =
				!visibilityFilter ||
				(visibilityFilter === 'visible' && c.isVisible) ||
				(visibilityFilter === 'hidden' && !c.isVisible);

			return matchesSearch && matchesVisibility;
		})
	);
	let hasActiveFilters = $derived(Boolean(searchQuery || visibilityFilter));

	const collectionRoleValues = Object.values(CollectionRole) as string[];
	const visibilityFilterOptions = [
		{ value: '', label: 'All visibility' },
		{ value: 'visible', label: 'Visible' },
		{ value: 'hidden', label: 'Hidden' }
	];

	let canManageAllMembers = $derived(
		authStore.globalRole === GlobalRole.Admin
	);

	onMount(() => {
		loadCollections();
	});

	async function loadCollections() {
		try {
			isLoading = true;
			const result = await pb.collection('collections').getList(1, 500, {
				sort: 'pubNum'
			});
			collections = result.items.map((r) => ({
				id: r.id,
				title: r.title,
				isVisible: r.isVisible,
				pubNum: r.pubNum,
				thumbnailUrl: r.thumbnail || ''
			}));
		} catch (error) {
			console.error('Error loading collections:', error);
			toast.error('Failed to load collections');
		} finally {
			isLoading = false;
		}
	}

	function toggleExpand(collectionId: string) {
		expandedId = expandedId === collectionId ? null : collectionId;
	}

	let isCreating = $state(false);

	async function createCollection() {
		if (!authStore.isAuthenticated || !authStore.appUserId) {
			toast.error('Please sign in to create a collection');
			return;
		}
		isCreating = true;
		try {
			const record = await pb.collection('collections').create({
				title: 'Untitled Collection',
				dcTitle: 'Untitled Collection',
				isVisible: false
			});

			try {
				await pb.collection('collectionUsers').create({
					collection: record.id,
					user: authStore.appUserId,
					userId: authStore.appUserId,
					role: CollectionRole.Owner
				});
			} catch {
				// Non-critical
			}

			goto(`${base}/collections/${record.id}`);
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to create collection';
			toast.error(message);
		} finally {
			isCreating = false;
		}
	}
</script>

<div id="admin-collections-page" class="mx-auto max-w-6xl">
	<div class="mb-8 flex items-start justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">Collection Management</h1>
			<p class="mt-2 text-base-content/60">
				Manage collection members and their roles. {collections.length} collections.
			</p>
		</div>
		<button
			class="btn btn-primary btn-sm flex-none"
			onclick={createCollection}
			disabled={isCreating}
		>
			{#if isCreating}
				<span class="loading loading-xs loading-spinner"></span>
			{/if}
			+ New Collection
		</button>
	</div>

	<div class="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div>
				<h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/70">Filters</h2>
				<p class="text-xs text-base-content/50">Filter collections by name and visibility.</p>
			</div>
			{#if hasActiveFilters}
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					onclick={() => {
						searchQuery = '';
						visibilityFilter = '';
					}}
				>
					Clear
				</button>
			{/if}
		</div>
		<div class="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_13rem]">
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Search</span></span>
				<input
					type="text"
					placeholder="Collection title..."
					class="input input-bordered w-full bg-base-200/40"
					bind:value={searchQuery}
				/>
			</label>
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Visibility</span></span>
				<FloatingSelect
					id="collection-visibility-filter"
					bind:value={visibilityFilter}
					options={visibilityFilterOptions}
					class="w-full bg-base-200/40"
				/>
			</label>
		</div>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else}
		<div class="space-y-2">
			{#each filteredCollections as collection (collection.id)}
				<div class="rounded-box border border-base-300 bg-base-100">
					<button
						class="flex w-full cursor-pointer items-center justify-between p-4 font-medium"
						onclick={() => toggleExpand(collection.id)}
					>
						<div class="flex items-center gap-3">
							{#if collection.thumbnailUrl}
								<img
									src={collection.thumbnailUrl}
									alt={collection.title}
									class="size-10 rounded object-cover"
								/>
							{:else}
								<div
									class="flex size-10 items-center justify-center rounded bg-base-300 text-base-content/40"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="size-5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
										/>
									</svg>
								</div>
							{/if}
							<span>{collection.title}</span>
							{#if !collection.isVisible}
								<span class="badge badge-xs badge-warning">Hidden</span>
							{/if}
							{#if collection.pubNum}
								<span class="badge badge-ghost badge-xs">#{collection.pubNum}</span>
							{/if}
						</div>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="size-4 transition-transform duration-200"
							class:rotate-180={expandedId === collection.id}
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
						</svg>
					</button>
					{#if expandedId === collection.id}
						<div class="border-t border-base-300 px-4 pt-2 pb-4">
							<MemberManager
								membershipCollection="collectionUsers"
								parentField="collection"
								parentId={collection.id}
								roleValues={collectionRoleValues}
								roleLabels={COLLECTION_ROLE_LABELS}
								defaultRole={CollectionRole.Viewer}
								auditTargetType="collection"
								isReadOnly={!canManageAllMembers}
							/>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if filteredCollections.length === 0}
			<div class="py-8 text-center text-base-content/60">
				{#if hasActiveFilters}
					No collections match the selected filters.
				{:else}
					No collections found.
				{/if}
			</div>
		{/if}

		{#if filteredCollections.length > 0 && hasActiveFilters}
			<p class="mt-4 text-sm text-base-content/60">
				Showing {filteredCollections.length} of {collections.length} collections
			</p>
		{/if}
	{/if}
</div>
