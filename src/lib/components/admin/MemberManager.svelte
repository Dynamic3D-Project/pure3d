<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { logAudit, type AuditTargetType } from '$lib/utils/audit';
	import toast from 'svelte-french-toast';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';

	type RoleString = string;

	interface Props {
		/** PocketBase collection holding the membership rows. */
		membershipCollection: 'collectionUsers' | 'editionUsers';
		/** Field in that collection that references the parent entity. */
		parentField: 'collection' | 'editionId';
		/** ID of the parent collection or edition. */
		parentId: string;
		/** Available roles (enum values) for the dropdown. */
		roleValues: readonly RoleString[];
		/** Display labels for each role. */
		roleLabels: Record<string, string>;
		/** Role assigned by default when adding a new member. */
		defaultRole: RoleString;
		/** Audit log target type for member mutations. */
		auditTargetType: AuditTargetType;
		/** When true, hides add form and remove/role-change controls. */
		isReadOnly?: boolean;
		/** Extra filter appended to the membership query (e.g. exclude reviewers). */
		extraFilter?: string;
	}

	interface Member {
		id: string;
		userId: string;
		nickname: string;
		email: string;
		role: RoleString;
	}

	interface AppUser {
		id: string;
		nickname: string;
		email: string;
	}

	let {
		membershipCollection,
		parentField,
		parentId,
		roleValues,
		roleLabels,
		defaultRole,
		auditTargetType,
		isReadOnly = false,
		extraFilter
	}: Props = $props();

	let members = $state<Member[]>([]);
	let allUsers = $state<AppUser[]>([]);
	let isLoading = $state(true);
	let savingMemberId = $state<string | null>(null);
	let isAdding = $state(false);
	let addUserId = $state('');
	// eslint-disable-next-line svelte/prefer-const -- intentional: init from prop once
	let addRole = $state<RoleString>('');
	$effect(() => {
		if (!addRole) addRole = defaultRole;
	});

	let availableUsers = $derived(() => {
		const existing = new Set(members.map((m) => m.userId));
		return allUsers.filter((u) => !existing.has(u.id));
	});

	onMount(() => {
		load();
	});

	async function load() {
		isLoading = true;
		try {
			const filter = extraFilter
				? `${parentField} = "${parentId}" && ${extraFilter}`
				: `${parentField} = "${parentId}"`;

			const [memberRes, userRes] = await Promise.all([
				pb.collection(membershipCollection).getList(1, 500, {
					filter,
					expand: 'userId'
				}),
				pb.collection('userProfiles').getList(1, 500)
			]);

			const profileMap = new Map(
				userRes.items.map((u) => [u.id, { nickname: u.nickname || '', email: u.email || '' }])
			);

			members = memberRes.items.map((r) => {
				const profile = profileMap.get(r.userId) || { nickname: '', email: '' };
				return {
					id: r.id,
					userId: r.userId,
					nickname: profile.nickname,
					email: profile.email,
					role: r.role as RoleString
				};
			});

			allUsers = userRes.items.map((r) => ({
				id: r.id,
				nickname: r.nickname || '',
				email: r.email || ''
			}));
		} catch (error) {
			console.error('Error loading members:', error);
			toast.error('Failed to load members');
			members = [];
		} finally {
			isLoading = false;
		}
	}

	async function updateRole(memberId: string, newRole: RoleString) {
		savingMemberId = memberId;
		try {
			const member = members.find((m) => m.id === memberId);
			const oldRole = member?.role;

			await pb.collection(membershipCollection).update(memberId, { role: newRole });

			await logAudit('role_change', auditTargetType, parentId, authStore.user?.email || '', {
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
			console.error('Error updating role:', error);
			toast.error('Failed to update role');
		} finally {
			savingMemberId = null;
		}
	}

	async function remove(memberId: string) {
		try {
			const member = members.find((m) => m.id === memberId);

			await pb.collection(membershipCollection).delete(memberId);

			await logAudit('user_removed', auditTargetType, parentId, authStore.user?.email || '', {
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

	async function add() {
		if (!addUserId) return;
		isAdding = true;
		try {
			const user = allUsers.find((u) => u.id === addUserId);

			const payload: Record<string, string> = {
				[parentField]: parentId,
				userId: addUserId,
				user: addUserId,
				role: addRole
			};
			await pb.collection(membershipCollection).create(payload);

			await logAudit('user_assigned', auditTargetType, parentId, authStore.user?.email || '', {
				userId: addUserId,
				nickname: user?.nickname,
				role: addRole
			});

			addUserId = '';
			addRole = defaultRole;
			await load();
			toast.success('Member added');
		} catch (error) {
			console.error('Error adding member:', error);
			toast.error('Failed to add member');
		} finally {
			isAdding = false;
		}
	}
</script>

<div class="member-manager">
	{#if isLoading}
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
							{#if !isReadOnly}
								<th>Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each members as member (member.id)}
							<tr>
								<td class="font-medium">{member.nickname || '—'}</td>
								<td class="text-base-content/70">{member.email}</td>
								<td>
									{#if isReadOnly}
										<span class="badge badge-sm badge-ghost">{roleLabels[member.role] ?? member.role}</span>
									{:else}
										<select
											class="select-bordered select w-36 select-sm"
											value={member.role}
											onchange={(e) => updateRole(member.id, e.currentTarget.value)}
											disabled={savingMemberId === member.id}
										>
											{#each roleValues as rv (rv)}
												<option value={rv} selected={member.role === rv}>
													{roleLabels[rv] ?? rv}
												</option>
											{/each}
										</select>
									{/if}
								</td>
								{#if !isReadOnly}
									<td>
										<button
											class="btn text-error btn-ghost btn-sm"
											onclick={() => remove(member.id)}
										>
											Remove
										</button>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="py-2 text-base-content/60">No members assigned.</p>
		{/if}

		{#if !isReadOnly}
			<div class="mt-4 flex flex-wrap items-end gap-2 border-t border-base-300 pt-4">
				<div class="form-control">
					<label class="label" for="member-add-user-{parentId}">
						<span class="label-text">User</span>
					</label>
					<UserSearchSelect
						users={availableUsers()}
						bind:value={addUserId}
						id="member-add-user-{parentId}"
						placeholder="Search user..."
					/>
				</div>
				<div class="form-control">
					<label class="label" for="member-add-role-{parentId}">
						<span class="label-text">Role</span>
					</label>
					<select
						id="member-add-role-{parentId}"
						class="select-bordered select w-36 select-sm"
						bind:value={addRole}
					>
						{#each roleValues as rv (rv)}
							<option value={rv}>{roleLabels[rv] ?? rv}</option>
						{/each}
					</select>
				</div>
				<button
					class="btn btn-sm btn-primary"
					onclick={add}
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
