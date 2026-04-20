<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import {
		EditionRole,
		EditionStatus,
		EDITION_ROLE_LABELS,
		GlobalRole,
		type UserRoleContext
	} from '$lib/types/roles';
	import toast from 'svelte-french-toast';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import StatusTransitionPanel from '$lib/components/workflow/StatusTransitionPanel.svelte';
	import MemberManager from '$lib/components/admin/MemberManager.svelte';

	interface AdminEdition {
		id: string;
		title: string;
		isPublished: boolean;
		status: EditionStatus;
		pubNum: number;
		thumbnailUrl: string;
		collectionId: string;
		collectionTitle: string;
	}

	let editions = $state<AdminEdition[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let expandedId = $state<string | null>(null);
	let filteredEditions = $derived(
		searchQuery
			? editions.filter(
					(e) =>
						e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
						e.collectionTitle.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: editions
	);

	const editionRoleValues = Object.values(EditionRole) as string[];

	// Admins inherit the full status-transition matrix via their global role
	let adminContext = $derived<UserRoleContext>({ globalRole: authStore.globalRole });

	onMount(() => {
		loadEditions();
	});

	async function loadEditions() {
		try {
			isLoading = true;
			const result = await pb.collection('editions').getList(1, 500, {
				expand: 'collection'
			});
			editions = result.items.map((r) => ({
				id: r.id,
				title: r.dcTitle || r.title,
				isPublished: r.isPublished,
				status: (r.status as EditionStatus) || EditionStatus.Draft,
				pubNum: r.pubNum,
				thumbnailUrl: r.thumbnail || '',
				collectionId: r.collection,
				collectionTitle: r.expand?.collection?.title || ''
			}));
		} catch (error) {
			console.error('Error loading editions:', error);
			toast.error('Failed to load editions');
		} finally {
			isLoading = false;
		}
	}

	function toggleExpand(editionId: string) {
		expandedId = expandedId === editionId ? null : editionId;
	}

	function onStatusChanged(edition: AdminEdition, newStatus: EditionStatus) {
		edition.status = newStatus;
		edition.isPublished = newStatus === EditionStatus.Published;
		editions = [...editions];
	}

	let canManageAllMembers = $derived(
		authStore.globalRole === GlobalRole.SuperAdmin || authStore.globalRole === GlobalRole.Admin
	);
</script>

<div id="admin-editions-page" class="mx-auto max-w-6xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Edition Management</h1>
		<p class="mt-2 text-base-content/60">
			Manage edition members, roles, and workflow status. {editions.length} editions.
		</p>
	</div>

	<div class="mb-6">
		<input
			type="text"
			placeholder="Search editions or collections..."
			class="input-bordered input w-full max-w-md"
			bind:value={searchQuery}
		/>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else}
		<div class="space-y-2">
			{#each filteredEditions as edition (edition.id)}
				<div class="rounded-box border border-base-300 bg-base-100">
					<button
						class="flex w-full cursor-pointer items-center justify-between p-4 font-medium"
						onclick={() => toggleExpand(edition.id)}
					>
						<div class="flex flex-wrap items-center gap-3">
							{#if edition.thumbnailUrl}
								<img
									src={edition.thumbnailUrl}
									alt={edition.title}
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
							<span>{edition.title}</span>
							<StatusBadge status={edition.status} />
							{#if edition.collectionTitle}
								<span class="text-sm text-base-content/50">
									in {edition.collectionTitle}
								</span>
							{/if}
						</div>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="size-4 shrink-0 transition-transform duration-200"
							class:rotate-180={expandedId === edition.id}
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
						</svg>
					</button>
					{#if expandedId === edition.id}
						<div class="border-t border-base-300 px-4 pt-2 pb-4">
							<!-- Workflow transitions -->
							<div class="mb-4 border-b border-base-300 pb-4">
								<h3 class="mb-2 text-sm font-semibold text-base-content/60 uppercase">
									Workflow
								</h3>
								<StatusTransitionPanel
									editionId={edition.id}
									title={edition.title}
									status={edition.status}
									context={adminContext}
									onchanged={(s) => onStatusChanged(edition, s)}
								/>
							</div>

							<!-- Members -->
							<h3 class="mb-2 text-sm font-semibold text-base-content/60 uppercase">Members</h3>
							<MemberManager
								membershipCollection="editionUsers"
								parentField="editionId"
								parentId={edition.id}
								roleValues={editionRoleValues}
								roleLabels={EDITION_ROLE_LABELS}
								defaultRole={EditionRole.Collaborator}
								auditTargetType="edition"
								isReadOnly={!canManageAllMembers}
							/>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if filteredEditions.length === 0}
			<div class="py-8 text-center text-base-content/60">
				{#if searchQuery}
					No editions match "{searchQuery}"
				{:else}
					No editions found.
				{/if}
			</div>
		{/if}
	{/if}
</div>
