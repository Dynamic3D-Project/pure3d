<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import { CollectionRole, COLLECTION_ROLE_LABELS } from '$lib/types/roles';
	import { logAudit } from '$lib/utils/audit';
	import toast from 'svelte-french-toast';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';

	interface AdminCollection {
		id: string;
		title: string;
		description: string;
		isVisible: boolean;
		pubNum: number;
		thumbnailUrl: string;
	}

	interface CollectionMember {
		id: string;
		userId: string;
		nickname: string;
		email: string;
		role: CollectionRole;
	}

	interface AppUser {
		id: string;
		nickname: string;
		email: string;
	}

	let collections = $state<AdminCollection[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let expandedId = $state<string | null>(null);
	let activeTab = $state<'details' | 'members'>('details');
	let filteredCollections = $derived(
		searchQuery
			? collections.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
			: collections
	);
	let members = $state<CollectionMember[]>([]);
	let membersLoading = $state(false);
	let allUsers = $state<AppUser[]>([]);
	let savingMemberId = $state<string | null>(null);

	// Add member form
	let addUserId = $state('');
	let addRole = $state<CollectionRole>(CollectionRole.Viewer);
	let isAdding = $state(false);

	// Create collection form
	let showCreateModal = $state(false);
	let createTitle = $state('');
	let createDescription = $state('');
	let isCreatingCollection = $state(false);

	// Edit collection form
	let editTitle = $state('');
	let editDescription = $state('');
	let editIsVisible = $state(false);
	let editThumbnailFile = $state<File | null>(null);
	let editThumbnailPreview = $state('');
	let isSavingDetails = $state(false);
	let isDeleting = $state(false);
	let showDeleteConfirm = $state(false);

	const collectionRoleValues = Object.values(CollectionRole);

	onMount(() => {
		loadCollections();
		loadAllUsers();
	});

	async function loadCollections() {
		try {
			isLoading = true;
			const result = await pb.collection('collections').getList(1, 500, {
				sort: 'pubNum'
			});
			collections = result.items.map((r) => ({
				id: r.id,
				title: r.dcTitle || r.title || '',
				description: r.dcAbstract || '',
				isVisible: r.isVisible,
				pubNum: r.pubNum,
				thumbnailUrl: r.thumbnailFile ? pb.files.getURL(r, r.thumbnailFile, { thumb: '80x80' }) : ''
			}));
		} catch (error) {
			console.error('Error loading collections:', error);
			toast.error('Failed to load collections');
		} finally {
			isLoading = false;
		}
	}

	async function loadAllUsers() {
		try {
			const result = await pb.collection('userProfiles').getList(1, 500);
			allUsers = result.items.map((r) => ({
				id: r.id,
				nickname: r.nickname || '',
				email: r.email || ''
			}));
		} catch {
			// Users list used for add member dropdown; silent fail is acceptable
		}
	}

	async function toggleExpand(collectionId: string) {
		if (expandedId === collectionId) {
			expandedId = null;
			members = [];
			return;
		}
		expandedId = collectionId;
		activeTab = 'details';

		// Populate edit form
		const col = collections.find((c) => c.id === collectionId);
		if (col) {
			editTitle = col.title;
			editDescription = col.description;
			editIsVisible = col.isVisible;
			editThumbnailFile = null;
			editThumbnailPreview = col.thumbnailUrl;
		}

		await loadMembers(collectionId);
	}

	async function loadMembers(collectionId: string) {
		membersLoading = true;
		try {
			const result = await pb.collection('collectionUsers').getList(1, 500, {
				filter: `collection = "${collectionId}"`,
				expand: 'userId'
			});
			members = result.items.map((r) => ({
				id: r.id,
				userId: r.userId,
				nickname: r.expand?.userId?.nickname || '',
				email: r.expand?.userId?.email || r.user || '',
				role: (r.role as CollectionRole) || CollectionRole.Viewer
			}));
		} catch (error) {
			console.error('Error loading members:', error);
			toast.error('Failed to load members');
			members = [];
		} finally {
			membersLoading = false;
		}
	}

	async function saveDetails() {
		if (!expandedId) return;
		if (!editTitle.trim()) {
			toast.error('Title is required');
			return;
		}
		isSavingDetails = true;
		try {
			const formData = new FormData();
			formData.append('title', editTitle.trim());
			formData.append('dcTitle', editTitle.trim());
			formData.append('dcAbstract', editDescription.trim());
			formData.append('isVisible', String(editIsVisible));

			if (editThumbnailFile) {
				formData.append('thumbnailFile', editThumbnailFile);
			}

			await pb.collection('collections').update(expandedId, formData);

			// Update local state
			const col = collections.find((c) => c.id === expandedId);
			if (col) {
				col.title = editTitle.trim();
				col.description = editDescription.trim();
				col.isVisible = editIsVisible;
				if (editThumbnailFile) {
					// Reload to get new thumbnail URL
					const updated = await pb.collection('collections').getOne(expandedId);
					col.thumbnailUrl = updated.thumbnailFile
						? pb.files.getURL(updated, updated.thumbnailFile, { thumb: '80x80' })
						: '';
					editThumbnailPreview = col.thumbnailUrl;
				}
				collections = [...collections];
			}

			editThumbnailFile = null;
			toast.success('Collection updated');
		} catch (error) {
			console.error('Error saving collection:', error);
			toast.error('Failed to save collection');
		} finally {
			isSavingDetails = false;
		}
	}

	function handleThumbnailChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			editThumbnailFile = file;
			editThumbnailPreview = URL.createObjectURL(file);
		}
	}

	async function deleteCollection() {
		if (!expandedId) return;
		isDeleting = true;
		try {
			// Remove all collection members first
			const memberResult = await pb.collection('collectionUsers').getList(1, 500, {
				filter: `collection = "${expandedId}"`
			});
			for (const m of memberResult.items) {
				await pb.collection('collectionUsers').delete(m.id);
			}

			await pb.collection('collections').delete(expandedId);

			await logAudit('user_removed', 'collection', expandedId, authStore.user?.email || '', {
				action: 'collection_deleted',
				title: editTitle
			});

			expandedId = null;
			showDeleteConfirm = false;
			toast.success('Collection deleted');
			await loadCollections();
		} catch (error) {
			console.error('Error deleting collection:', error);
			toast.error('Failed to delete collection');
		} finally {
			isDeleting = false;
		}
	}

	async function updateMemberRole(memberId: string, newRole: CollectionRole) {
		savingMemberId = memberId;
		try {
			const member = members.find((m) => m.id === memberId);
			const oldRole = member?.role;

			await pb.collection('collectionUsers').update(memberId, { role: newRole });

			await logAudit('role_change', 'collection', expandedId || '', authStore.user?.email || '', {
				memberId,
				from: oldRole,
				to: newRole,
				nickname: member?.nickname
			});

			if (member) {
				member.role = newRole;
				members = [...members];
			}
			toast.success('Role updated');
		} catch (error) {
			console.error('Error updating member role:', error);
			toast.error('Failed to update role');
		} finally {
			savingMemberId = null;
		}
	}

	async function removeMember(memberId: string) {
		try {
			const member = members.find((m) => m.id === memberId);

			await pb.collection('collectionUsers').delete(memberId);

			await logAudit('user_removed', 'collection', expandedId || '', authStore.user?.email || '', {
				memberId,
				nickname: member?.nickname,
				role: member?.role
			});

			members = members.filter((m) => m.id !== memberId);
			toast.success('Member removed');
		} catch (error) {
			console.error('Error removing member:', error);
			toast.error('Failed to remove member');
		}
	}

	async function addMember() {
		if (!addUserId || !expandedId) return;
		isAdding = true;
		try {
			const user = allUsers.find((u) => u.id === addUserId);

			await pb.collection('collectionUsers').create({
				collection: expandedId,
				userId: addUserId,
				user: addUserId,
				role: addRole
			});

			await logAudit('user_assigned', 'collection', expandedId, authStore.user?.email || '', {
				userId: addUserId,
				nickname: user?.nickname,
				role: addRole
			});

			addUserId = '';
			addRole = CollectionRole.Viewer;
			await loadMembers(expandedId);
			toast.success('Member added');
		} catch (error) {
			console.error('Error adding member:', error);
			toast.error('Failed to add member');
		} finally {
			isAdding = false;
		}
	}

	async function createCollection() {
		if (!createTitle.trim()) {
			toast.error('Title is required');
			return;
		}
		isCreatingCollection = true;
		try {
			const record = await pb.collection('collections').create({
				title: createTitle.trim(),
				dcTitle: createTitle.trim(),
				dcAbstract: createDescription.trim() || null,
				isVisible: false
			});

			await logAudit('collection_created', 'collection', record.id, authStore.user?.email || '', {
				title: createTitle.trim()
			});

			showCreateModal = false;
			createTitle = '';
			createDescription = '';
			toast.success('Collection created');
			await loadCollections();
		} catch (error) {
			console.error('Error creating collection:', error);
			toast.error('Failed to create collection');
		} finally {
			isCreatingCollection = false;
		}
	}

	function availableUsers(): AppUser[] {
		const existingIds = new Set(members.map((m) => m.userId));
		return allUsers.filter((u) => !existingIds.has(u.id));
	}
</script>

<div id="admin-collections-page" class="mx-auto max-w-6xl">
	<div class="mb-8 flex items-start justify-between">
		<div>
			<h1 class="text-3xl font-bold">Collection Management</h1>
			<p class="mt-2 text-base-content/60">
				Manage collections, their details, and members. {collections.length} collections.
			</p>
		</div>
		<button
			id="create-collection-btn"
			class="btn btn-primary"
			onclick={() => (showCreateModal = true)}
		>
			+ Create Collection
		</button>
	</div>

	<div class="mb-6">
		<input
			type="text"
			placeholder="Search collections..."
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
							<!-- Tabs -->
							<div class="tabs-bordered mb-4 tabs">
								<button
									class="tab"
									class:tab-active={activeTab === 'details'}
									onclick={() => (activeTab = 'details')}
								>
									Details
								</button>
								<button
									class="tab"
									class:tab-active={activeTab === 'members'}
									onclick={() => (activeTab = 'members')}
								>
									Members ({members.length})
								</button>
							</div>

							{#if activeTab === 'details'}
								<!-- Details editing form -->
								<div class="flex flex-col gap-4">
									<div class="flex gap-6">
										<!-- Thumbnail -->
										<div class="flex flex-col items-center gap-2">
											{#if editThumbnailPreview}
												<img
													src={editThumbnailPreview}
													alt="Thumbnail"
													class="size-24 rounded object-cover"
												/>
											{:else}
												<div
													class="flex size-24 items-center justify-center rounded bg-base-300 text-base-content/40"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
														stroke-width="1.5"
														stroke="currentColor"
														class="size-8"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
														/>
													</svg>
												</div>
											{/if}
											<label class="btn btn-outline btn-xs">
												Change
												<input
													type="file"
													accept="image/*"
													class="hidden"
													onchange={handleThumbnailChange}
												/>
											</label>
										</div>

										<!-- Title and description -->
										<div class="flex flex-1 flex-col gap-3">
											<fieldset class="fieldset">
												<legend class="fieldset-legend">Title *</legend>
												<input
													id="edit-collection-title"
													type="text"
													class="input w-full"
													bind:value={editTitle}
												/>
											</fieldset>

											<fieldset class="fieldset">
												<legend class="fieldset-legend">Description</legend>
												<textarea
													id="edit-collection-description"
													class="textarea w-full"
													rows="3"
													bind:value={editDescription}
												></textarea>
											</fieldset>
										</div>
									</div>

									<fieldset class="fieldset">
										<legend class="fieldset-legend">Visibility</legend>
										<label
											id="edit-collection-visibility"
											class="flex cursor-pointer items-center gap-3"
										>
											<input type="checkbox" class="checkbox" bind:checked={editIsVisible} />
											<span>Visible to public</span>
										</label>
									</fieldset>

									<div class="flex items-center justify-between">
										<button
											class="btn btn-sm btn-primary"
											onclick={saveDetails}
											disabled={isSavingDetails}
										>
											{#if isSavingDetails}
												<span class="loading loading-xs loading-spinner"></span>
											{/if}
											Save Changes
										</button>

										{#if showDeleteConfirm}
											<div class="flex items-center gap-2">
												<span class="text-sm text-error">Delete this collection?</span>
												<button
													class="btn btn-sm btn-error"
													onclick={deleteCollection}
													disabled={isDeleting}
												>
													{#if isDeleting}
														<span class="loading loading-xs loading-spinner"></span>
													{/if}
													Confirm
												</button>
												<button
													class="btn btn-ghost btn-sm"
													onclick={() => (showDeleteConfirm = false)}
												>
													Cancel
												</button>
											</div>
										{:else}
											<button
												class="btn text-error btn-ghost btn-sm"
												onclick={() => (showDeleteConfirm = true)}
											>
												Delete Collection
											</button>
										{/if}
									</div>
								</div>
							{:else if activeTab === 'members'}
								{#if membersLoading}
									<div class="flex justify-center py-4">
										<span class="loading loading-sm loading-spinner"></span>
									</div>
								{:else}
									<!-- Members table -->
									{#if members.length > 0}
										<div class="overflow-x-auto">
											<table class="table table-sm">
												<thead>
													<tr>
														<th>User</th>
														<th>Email</th>
														<th>Role</th>
														<th>Actions</th>
													</tr>
												</thead>
												<tbody>
													{#each members as member (member.id)}
														<tr>
															<td class="font-medium">{member.nickname || '—'}</td>
															<td class="text-base-content/70">{member.email}</td>
															<td>
																<select
																	class="select-bordered select w-36 select-sm"
																	value={member.role}
																	onchange={(e) =>
																		updateMemberRole(
																			member.id,
																			e.currentTarget.value as CollectionRole
																		)}
																	disabled={savingMemberId === member.id}
																>
																	{#each collectionRoleValues as rv (rv)}
																		<option value={rv} selected={member.role === rv}>
																			{COLLECTION_ROLE_LABELS[rv]}
																		</option>
																	{/each}
																</select>
															</td>
															<td>
																<button
																	class="btn text-error btn-ghost btn-sm"
																	onclick={() => removeMember(member.id)}
																>
																	Remove
																</button>
															</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									{:else}
										<p class="py-2 text-base-content/60">No members assigned.</p>
									{/if}

									<!-- Add member form -->
									<div class="mt-4 flex flex-wrap items-end gap-2 border-t border-base-300 pt-4">
										<div class="form-control">
											<label class="label" for="add-user-{collection.id}">
												<span class="label-text">User</span>
											</label>
											<UserSearchSelect
												users={availableUsers()}
												bind:value={addUserId}
												id="add-user-{collection.id}"
												placeholder="Search user..."
											/>
										</div>
										<div class="form-control">
											<label class="label" for="add-role-{collection.id}">
												<span class="label-text">Role</span>
											</label>
											<select
												id="add-role-{collection.id}"
												class="select-bordered select w-36 select-sm"
												bind:value={addRole}
											>
												{#each collectionRoleValues as rv (rv)}
													<option value={rv}>
														{COLLECTION_ROLE_LABELS[rv]}
													</option>
												{/each}
											</select>
										</div>
										<button
											class="btn btn-sm btn-primary"
											onclick={addMember}
											disabled={!addUserId || isAdding}
										>
											{#if isAdding}
												<span class="loading loading-xs loading-spinner"></span>
											{/if}
											Add Member
										</button>
									</div>
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if filteredCollections.length === 0}
			<div class="py-8 text-center text-base-content/60">
				{#if searchQuery}
					No collections match "{searchQuery}"
				{:else}
					No collections found.
				{/if}
			</div>
		{/if}
	{/if}
</div>

{#if showCreateModal}
	<div id="create-collection-modal" class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Create New Collection</h3>

			<div class="mt-4 flex flex-col gap-3">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Title *</legend>
					<input
						id="create-collection-title"
						type="text"
						class="input w-full"
						placeholder="Collection title"
						bind:value={createTitle}
					/>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">Description</legend>
					<textarea
						id="create-collection-description"
						class="textarea w-full"
						rows="3"
						placeholder="Brief description (optional)"
						bind:value={createDescription}
					></textarea>
				</fieldset>
			</div>

			<div class="modal-action">
				<button
					class="btn"
					onclick={() => (showCreateModal = false)}
					disabled={isCreatingCollection}
				>
					Cancel
				</button>
				<button class="btn btn-primary" onclick={createCollection} disabled={isCreatingCollection}>
					{#if isCreatingCollection}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Create
				</button>
			</div>
		</div>
		<button class="modal-backdrop" onclick={() => (showCreateModal = false)}>close</button>
	</div>
{/if}
