<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import {
		EditionRole,
		EditionStatus,
		EDITION_ROLE_LABELS,
		STATUS_LABELS,
		EDITION_STATUS_TRANSITIONS
	} from '$lib/types/roles';
	import { canUserTransitionStatus } from '$lib/utils/permissions';
	import { logAudit } from '$lib/utils/audit';
	import toast from 'svelte-french-toast';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';

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

	interface EditionMember {
		id: string;
		userId: string;
		nickname: string;
		email: string;
		role: EditionRole;
	}

	interface AppUser {
		id: string;
		nickname: string;
		email: string;
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
	let members = $state<EditionMember[]>([]);
	let membersLoading = $state(false);
	let allUsers = $state<AppUser[]>([]);
	let savingMemberId = $state<string | null>(null);
	let transitioningStatus = $state(false);

	// Add member form
	let addUserId = $state('');
	let addRole = $state<EditionRole>(EditionRole.Collaborator);
	let isAdding = $state(false);

	const editionRoleValues = Object.values(EditionRole);

	const statusBadgeClass: Record<EditionStatus, string> = {
		[EditionStatus.Draft]: 'badge-ghost',
		[EditionStatus.Submitted]: 'badge-info',
		[EditionStatus.InReview]: 'badge-warning',
		[EditionStatus.Approved]: 'badge-success',
		[EditionStatus.Rejected]: 'badge-error',
		[EditionStatus.Published]: 'badge-primary'
	};

	onMount(() => {
		loadEditions();
		loadAllUsers();
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
				thumbnailUrl: r.thumbnailFile
					? pb.files.getURL(r, r.thumbnailFile, { thumb: '80x80' })
					: '',
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

	async function loadAllUsers() {
		try {
			const result = await pb.collection('userProfiles').getList(1, 500);
			allUsers = result.items.map((r) => ({
				id: r.id,
				nickname: r.nickname || '',
				email: r.email || ''
			}));
		} catch {
			// silent fail
		}
	}

	async function toggleExpand(editionId: string) {
		if (expandedId === editionId) {
			expandedId = null;
			members = [];
			return;
		}
		expandedId = editionId;
		await loadMembers(editionId);
	}

	async function loadMembers(editionId: string) {
		membersLoading = true;
		try {
			const result = await pb.collection('editionUsers').getList(1, 500, {
				filter: `editionId = "${editionId}"`,
				expand: 'userId'
			});
			members = result.items.map((r) => ({
				id: r.id,
				userId: r.userId,
				nickname: r.expand?.userId?.nickname || '',
				email: r.expand?.userId?.email || r.user || '',
				role: (r.role as EditionRole) || EditionRole.Collaborator
			}));
		} catch (error) {
			console.error('Error loading edition members:', error);
			toast.error('Failed to load members');
			members = [];
		} finally {
			membersLoading = false;
		}
	}

	function getAvailableTransitions(edition: AdminEdition): EditionStatus[] {
		const possible = EDITION_STATUS_TRANSITIONS[edition.status] || [];
		const context = { globalRole: authStore.globalRole };
		return possible.filter((target) => canUserTransitionStatus(context, edition.status, target));
	}

	async function transitionStatus(edition: AdminEdition, newStatus: EditionStatus) {
		transitioningStatus = true;
		try {
			const oldStatus = edition.status;
			const isPublished = newStatus === EditionStatus.Published;

			await pb.collection('editions').update(edition.id, {
				status: newStatus,
				isPublished
			});

			await logAudit('status_transition', 'edition', edition.id, authStore.user?.email || '', {
				from: oldStatus,
				to: newStatus,
				title: edition.title
			});

			edition.status = newStatus;
			edition.isPublished = isPublished;
			editions = [...editions];
			toast.success(`Status changed to ${STATUS_LABELS[newStatus]}`);
		} catch (error) {
			console.error('Error transitioning status:', error);
			toast.error('Failed to change status');
		} finally {
			transitioningStatus = false;
		}
	}

	async function updateMemberRole(memberId: string, newRole: EditionRole) {
		savingMemberId = memberId;
		try {
			const member = members.find((m) => m.id === memberId);
			const oldRole = member?.role;

			await pb.collection('editionUsers').update(memberId, { role: newRole });

			await logAudit('role_change', 'edition', expandedId || '', authStore.user?.email || '', {
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

			await pb.collection('editionUsers').delete(memberId);

			await logAudit('user_removed', 'edition', expandedId || '', authStore.user?.email || '', {
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

			await pb.collection('editionUsers').create({
				editionId: expandedId,
				userId: addUserId,
				user: addUserId,
				role: addRole
			});

			await logAudit('user_assigned', 'edition', expandedId, authStore.user?.email || '', {
				userId: addUserId,
				nickname: user?.nickname,
				role: addRole
			});

			addUserId = '';
			addRole = EditionRole.Collaborator;
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
							<span class="badge badge-sm {statusBadgeClass[edition.status]}">
								{STATUS_LABELS[edition.status]}
							</span>
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
						{@const transitions = getAvailableTransitions(edition)}
						<div class="border-t border-base-300 px-4 pt-2 pb-4">
							<!-- Workflow transitions -->
							{#if transitions.length > 0}
								<div class="mb-4 border-b border-base-300 pb-4">
									<h3 class="mb-2 text-sm font-semibold text-base-content/60 uppercase">
										Workflow
									</h3>
									<div class="flex flex-wrap gap-2">
										{#each transitions as target (target)}
											<button
												class="btn btn-outline btn-sm"
												onclick={() => transitionStatus(edition, target)}
												disabled={transitioningStatus}
											>
												{#if transitioningStatus}
													<span class="loading loading-xs loading-spinner"></span>
												{/if}
												Move to {STATUS_LABELS[target]}
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Members -->
							<h3 class="mb-2 text-sm font-semibold text-base-content/60 uppercase">Members</h3>

							{#if membersLoading}
								<div class="flex justify-center py-4">
									<span class="loading loading-sm loading-spinner"></span>
								</div>
							{:else}
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
																	updateMemberRole(member.id, e.currentTarget.value as EditionRole)}
																disabled={savingMemberId === member.id}
															>
																{#each editionRoleValues as rv (rv)}
																	<option value={rv} selected={member.role === rv}>
																		{EDITION_ROLE_LABELS[rv]}
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
										<label class="label" for="add-user-{edition.id}">
											<span class="label-text">User</span>
										</label>
										<UserSearchSelect
											users={availableUsers()}
											bind:value={addUserId}
											id="add-user-{edition.id}"
											placeholder="Search user..."
										/>
									</div>
									<div class="form-control">
										<label class="label" for="add-role-{edition.id}">
											<span class="label-text">Role</span>
										</label>
										<select
											id="add-role-{edition.id}"
											class="select-bordered select w-36 select-sm"
											bind:value={addRole}
										>
											{#each editionRoleValues as rv (rv)}
												<option value={rv}>
													{EDITION_ROLE_LABELS[rv]}
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
