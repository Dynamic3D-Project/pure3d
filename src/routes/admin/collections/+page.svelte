<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import { CollectionRole, COLLECTION_ROLE_LABELS } from '$lib/types/roles';
	import { logAudit } from '$lib/utils/audit';
	import toast from 'svelte-french-toast';

	interface AdminCollection {
		id: string;
		title: string;
		isVisible: boolean;
		pubNum: number;
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
	let expandedId = $state<string | null>(null);
	let members = $state<CollectionMember[]>([]);
	let membersLoading = $state(false);
	let allUsers = $state<AppUser[]>([]);
	let savingMemberId = $state<string | null>(null);

	// Add member form
	let addUserId = $state('');
	let addRole = $state<CollectionRole>(CollectionRole.Viewer);
	let isAdding = $state(false);

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
				title: r.title,
				isVisible: r.isVisible,
				pubNum: r.pubNum
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
			const result = await pb.collection('users').getList(1, 500);
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

	function availableUsers(): AppUser[] {
		const existingIds = new Set(members.map((m) => m.userId));
		return allUsers.filter((u) => !existingIds.has(u.id));
	}
</script>

<div id="admin-collections-page" class="mx-auto max-w-6xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Collection Management</h1>
		<p class="mt-2 text-base-content/60">
			Manage collection members and their roles. {collections.length} collections.
		</p>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else}
		<div class="space-y-2">
			{#each collections as collection (collection.id)}
				<div class="collapse-arrow collapse border border-base-300 bg-base-100">
					<input
						type="radio"
						name="collection-accordion"
						checked={expandedId === collection.id}
						onchange={() => toggleExpand(collection.id)}
					/>
					<div class="collapse-title font-medium">
						<div class="flex items-center gap-3">
							<span>{collection.title}</span>
							{#if !collection.isVisible}
								<span class="badge badge-xs badge-warning">Hidden</span>
							{/if}
							{#if collection.pubNum}
								<span class="badge badge-ghost badge-xs">#{collection.pubNum}</span>
							{/if}
						</div>
					</div>
					<div class="collapse-content">
						{#if expandedId === collection.id}
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
										<select
											id="add-user-{collection.id}"
											class="select-bordered select w-48 select-sm"
											bind:value={addUserId}
										>
											<option value="">Select user...</option>
											{#each availableUsers() as user (user.id)}
												<option value={user.id}>
													{user.nickname || user.email}
												</option>
											{/each}
										</select>
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
				</div>
			{/each}
		</div>

		{#if collections.length === 0}
			<div class="py-8 text-center text-base-content/60">No collections found.</div>
		{/if}
	{/if}
</div>
