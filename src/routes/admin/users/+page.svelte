<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import { GlobalRole, ROLE_LABELS } from '$lib/types/roles';
	import { logAudit } from '$lib/utils/audit';
	import toast from 'svelte-french-toast';

	interface AppUser {
		id: string;
		user: string;
		email: string;
		nickname: string;
		role: GlobalRole;
	}

	let users = $state<AppUser[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let savingUserId = $state<string | null>(null);
	let filteredUsers = $derived(
		searchQuery
			? users.filter(
					(u) =>
						(u.nickname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
						(u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
				)
			: users
	);

	const globalRoleValues = Object.values(GlobalRole);

	onMount(() => {
		loadUsers();
	});

	async function loadUsers() {
		try {
			isLoading = true;
			const result = await pb.collection('users').getList(1, 500);
			users = result.items.map((record) => ({
				id: record.id,
				user: record.user || '',
				email: record.email || '',
				nickname: record.nickname || '',
				role: (record.role as GlobalRole) || GlobalRole.Viewer
			}));
		} catch (error) {
			console.error('Error loading users:', error);
			toast.error('Failed to load users');
		} finally {
			isLoading = false;
		}
	}

	async function updateRole(userId: string, newRole: GlobalRole) {
		savingUserId = userId;
		try {
			const user = users.find((u) => u.id === userId);
			const oldRole = user?.role;

			await pb.collection('users').update(userId, { role: newRole });

			await logAudit('role_change', 'user', userId, authStore.user?.email || '', {
				from: oldRole,
				to: newRole,
				nickname: user?.nickname
			});

			if (user) {
				user.role = newRole;
				users = [...users];
			}

			toast.success('Role updated');
		} catch (error) {
			console.error('Error updating role:', error);
			toast.error('Failed to update role');
		} finally {
			savingUserId = null;
		}
	}
</script>

<div id="admin-users-page" class="mx-auto max-w-6xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">User Management</h1>
		<p class="mt-2 text-base-content/60">
			Manage user roles across the platform. {users.length} total users.
		</p>
	</div>

	<!-- Search -->
	<div class="mb-6">
		<input
			type="text"
			placeholder="Search by name or email..."
			class="input-bordered input w-full max-w-md"
			bind:value={searchQuery}
		/>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100 shadow-md">
			<table class="table">
				<thead>
					<tr>
						<th>Nickname</th>
						<th>Email</th>
						<th>Current Role</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredUsers as user (user.id)}
						<tr>
							<td class="font-medium">{user.nickname || '—'}</td>
							<td class="text-base-content/70">{user.email}</td>
							<td>
								<span class="badge badge-sm badge-neutral">
									{ROLE_LABELS[user.role] || user.role}
								</span>
							</td>
							<td>
								<div class="flex items-center gap-2">
									<select
										class="select-bordered select w-44 select-sm"
										value={user.role}
										onchange={(e) => {
											const target = e.currentTarget;
											updateRole(user.id, target.value as GlobalRole);
										}}
										disabled={savingUserId === user.id}
									>
										{#each globalRoleValues as roleValue (roleValue)}
											<option value={roleValue} selected={user.role === roleValue}>
												{ROLE_LABELS[roleValue]}
											</option>
										{/each}
									</select>
									{#if savingUserId === user.id}
										<span class="loading loading-sm loading-spinner"></span>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if filteredUsers.length === 0}
				<div class="py-8 text-center text-base-content/60">
					{#if searchQuery}
						No users match "{searchQuery}"
					{:else}
						No users found
					{/if}
				</div>
			{/if}
		</div>

		<div class="mt-4 text-sm text-base-content/50">
			Showing {filteredUsers.length} of {users.length} users
		</div>
	{/if}
</div>
