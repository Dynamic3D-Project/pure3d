<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import { GlobalRole, GLOBAL_ROLE_LABELS } from '$lib/types/roles';
	import { logAudit } from '$lib/utils/audit';
	import toast from 'svelte-french-toast';

	interface AppUser {
		id: string;
		email: string;
		nickname: string;
		role: GlobalRole;
		pbAuthId: string;
		created: string;
	}

	let users = $state<AppUser[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let isSaving = $state(false);

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

	// Modal states
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showDeleteModal = $state(false);

	// Create form
	let createEmail = $state('');
	let createPassword = $state('');
	let createPasswordConfirm = $state('');
	let createNickname = $state('');
	let createRole = $state<GlobalRole>(GlobalRole.Viewer);

	// Edit form
	let editingUser = $state<AppUser | null>(null);
	let editNickname = $state('');
	let editRole = $state<GlobalRole>(GlobalRole.Viewer);

	// Delete state
	let deletingUser = $state<AppUser | null>(null);

	onMount(() => {
		loadUsers();
	});

	async function loadUsers() {
		try {
			isLoading = true;
			const result = await pb.collection('users').getList(1, 500);
			users = result.items.map((record) => ({
				id: record.id,
				email: record.email || '',
				nickname: record.nickname || '',
				role: (record.role as GlobalRole) || GlobalRole.Viewer,
				pbAuthId: record.pbAuthId || '',
				created: record.created || ''
			}));
		} catch (error) {
			console.error('Error loading users:', error);
			toast.error('Failed to load users');
		} finally {
			isLoading = false;
		}
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '—';
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString();
	}

	function isSelf(user: AppUser): boolean {
		return user.email === authStore.user?.email;
	}

	// --- Create ---
	function openCreateModal() {
		createEmail = '';
		createPassword = '';
		createPasswordConfirm = '';
		createNickname = '';
		createRole = GlobalRole.Viewer;
		showCreateModal = true;
	}

	async function createUser() {
		if (!createEmail || !createPassword) {
			toast.error('Email and password are required');
			return;
		}
		if (createPassword !== createPasswordConfirm) {
			toast.error('Passwords do not match');
			return;
		}
		if (createPassword.length < 8) {
			toast.error('Password must be at least 8 characters');
			return;
		}

		isSaving = true;
		try {
			// 1. Create PB auth user
			const authRecord = await pb.collection('users').create({
				email: createEmail,
				password: createPassword,
				passwordConfirm: createPasswordConfirm
			});

			// 2. Create userProfile linked to auth record
			await pb.collection('users').create({
				email: createEmail,
				nickname: createNickname || createEmail.split('@')[0],
				role: createRole,
				pbAuthId: authRecord.id
			});

			await logAudit('user_created', 'user', authRecord.id, authStore.user?.email || '', {
				email: createEmail,
				role: createRole
			});

			await loadUsers();
			showCreateModal = false;
			toast.success('User created');
		} catch (error: any) {
			console.error('Error creating user:', error);
			const msg =
				error?.response?.data?.email?.message ||
				error?.message ||
				'Failed to create user';
			toast.error(msg);
		} finally {
			isSaving = false;
		}
	}

	// --- Edit ---
	function openEditModal(user: AppUser) {
		editingUser = user;
		editNickname = user.nickname;
		editRole = user.role;
		showEditModal = true;
	}

	async function updateUser() {
		if (!editingUser) return;

		const changes: Record<string, string> = {};
		if (editNickname !== editingUser.nickname) changes.nickname = editNickname;
		if (editRole !== editingUser.role) changes.role = editRole;

		if (Object.keys(changes).length === 0) {
			showEditModal = false;
			return;
		}

		// Prevent self-demotion
		if (isSelf(editingUser) && changes.role) {
			toast.error('You cannot change your own role');
			return;
		}

		isSaving = true;
		try {
			await pb.collection('users').update(editingUser.id, changes);

			await logAudit('user_updated', 'user', editingUser.id, authStore.user?.email || '', {
				email: editingUser.email,
				changes
			});

			await loadUsers();
			showEditModal = false;
			toast.success('User updated');
		} catch (error) {
			console.error('Error updating user:', error);
			toast.error('Failed to update user');
		} finally {
			isSaving = false;
		}
	}

	// --- Delete ---
	function openDeleteModal(user: AppUser) {
		if (isSelf(user)) {
			toast.error('You cannot delete your own account');
			return;
		}
		deletingUser = user;
		showDeleteModal = true;
	}

	async function deleteUser() {
		if (!deletingUser) return;

		isSaving = true;
		try {
			// 1. Clean up collection user assignments
			try {
				const collUsers = await pb.collection('collectionUsers').getList(1, 500, {
					filter: `user = "${deletingUser.id}"`
				});
				for (const cu of collUsers.items) {
					await pb.collection('collectionUsers').delete(cu.id);
				}
			} catch (e) {
				console.warn('Could not clean up collection assignments:', e);
			}

			// 2. Clean up edition user assignments
			try {
				const edUsers = await pb.collection('editionUsers').getList(1, 500, {
					filter: `user = "${deletingUser.id}"`
				});
				for (const eu of edUsers.items) {
					await pb.collection('editionUsers').delete(eu.id);
				}
			} catch (e) {
				console.warn('Could not clean up edition assignments:', e);
			}

			// 3. Delete userProfile
			await pb.collection('users').delete(deletingUser.id);

			// 4. Delete PB auth user
			if (deletingUser.pbAuthId) {
				try {
					await pb.collection('users').delete(deletingUser.pbAuthId);
				} catch (e) {
					console.warn('Could not delete auth record:', e);
				}
			}

			await logAudit('user_deleted', 'user', deletingUser.id, authStore.user?.email || '', {
				email: deletingUser.email,
				nickname: deletingUser.nickname
			});

			await loadUsers();
			showDeleteModal = false;
			toast.success('User deleted');
		} catch (error) {
			console.error('Error deleting user:', error);
			toast.error('Failed to delete user');
		} finally {
			isSaving = false;
		}
	}
</script>

<div id="admin-users-page" class="mx-auto max-w-6xl">
	<div class="mb-8 flex items-start justify-between">
		<div>
			<h1 class="text-3xl font-bold">User Management</h1>
			<p class="mt-2 text-base-content/60">
				Manage user accounts and roles. {users.length} total users.
			</p>
		</div>
		<button class="btn btn-primary" onclick={openCreateModal}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
				/>
			</svg>
			Create User
		</button>
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
						<th>Role</th>
						<th>Created</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredUsers as user (user.id)}
						<tr class={isSelf(user) ? 'bg-base-200/50' : ''}>
							<td class="font-medium">
								{user.nickname || '—'}
								{#if isSelf(user)}
									<span class="badge badge-xs badge-ghost ml-1">you</span>
								{/if}
							</td>
							<td class="text-base-content/70">{user.email}</td>
							<td>
								<span class="badge badge-sm badge-neutral">
									{GLOBAL_ROLE_LABELS[user.role] || user.role}
								</span>
							</td>
							<td class="text-base-content/50 text-sm">
								{formatDate(user.created)}
							</td>
							<td>
								<div class="flex items-center gap-1">
									<button
										class="btn btn-ghost btn-sm"
										title="Edit user"
										onclick={() => openEditModal(user)}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
											/>
										</svg>
									</button>
									<button
										class="btn btn-ghost btn-sm text-error"
										title="Delete user"
										disabled={isSelf(user)}
										onclick={() => openDeleteModal(user)}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fill-rule="evenodd"
												d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
												clip-rule="evenodd"
											/>
										</svg>
									</button>
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

<!-- Create User Modal -->
{#if showCreateModal}
	<div id="create-user-modal" class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Create New User</h3>

			<div class="mt-4 flex flex-col gap-3">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Email *</legend>
					<input
						id="create-email"
						type="email"
						class="input w-full"
						placeholder="user@example.com"
						bind:value={createEmail}
					/>
				</fieldset>

				<div class="grid grid-cols-2 gap-3">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Password *</legend>
						<input
							id="create-password"
							type="password"
							class="input w-full"
							placeholder="Min. 8 characters"
							bind:value={createPassword}
						/>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Confirm Password *</legend>
						<input
							id="create-password-confirm"
							type="password"
							class="input w-full"
							placeholder="Repeat password"
							bind:value={createPasswordConfirm}
						/>
					</fieldset>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Nickname</legend>
						<input
							id="create-nickname"
							type="text"
							class="input w-full"
							placeholder="Defaults to email prefix"
							bind:value={createNickname}
						/>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Role</legend>
						<select
							id="create-role"
							class="select w-full"
							bind:value={createRole}
						>
							{#each globalRoleValues as roleValue (roleValue)}
								<option value={roleValue}
									>{GLOBAL_ROLE_LABELS[roleValue]}</option
								>
							{/each}
						</select>
					</fieldset>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn" onclick={() => (showCreateModal = false)} disabled={isSaving}>
					Cancel
				</button>
				<button class="btn btn-primary" onclick={createUser} disabled={isSaving}>
					{#if isSaving}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Create
				</button>
			</div>
		</div>
		<button class="modal-backdrop" onclick={() => (showCreateModal = false)}>close</button>
	</div>
{/if}

<!-- Edit User Modal -->
{#if showEditModal && editingUser}
	<div id="edit-user-modal" class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Edit User</h3>
			<p class="mt-1 text-sm text-base-content/60">{editingUser.email}</p>

			<div class="mt-4 flex flex-col gap-3">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Nickname</legend>
					<input
						id="edit-nickname"
						type="text"
						class="input w-full"
						bind:value={editNickname}
					/>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">Role</legend>
					<select
						id="edit-role"
						class="select w-full"
						bind:value={editRole}
						disabled={isSelf(editingUser)}
					>
						{#each globalRoleValues as roleValue (roleValue)}
							<option value={roleValue}>{GLOBAL_ROLE_LABELS[roleValue]}</option>
						{/each}
					</select>
					{#if isSelf(editingUser)}
						<p class="mt-1 text-sm text-warning">
							You cannot change your own role
						</p>
					{/if}
				</fieldset>
			</div>

			<div class="modal-action">
				<button class="btn" onclick={() => (showEditModal = false)} disabled={isSaving}>
					Cancel
				</button>
				<button class="btn btn-primary" onclick={updateUser} disabled={isSaving}>
					{#if isSaving}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Save
				</button>
			</div>
		</div>
		<button class="modal-backdrop" onclick={() => (showEditModal = false)}>close</button>
	</div>
{/if}

<!-- Delete User Modal -->
{#if showDeleteModal && deletingUser}
	<div id="delete-user-modal" class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete User</h3>
			<p class="mt-4">
				Are you sure you want to delete
				<strong>{deletingUser.nickname || deletingUser.email}</strong>?
			</p>
			<p class="mt-2 text-sm text-base-content/60">
				This will remove their account, profile, and all collection/edition assignments.
				This action cannot be undone.
			</p>

			<div class="modal-action">
				<button class="btn" onclick={() => (showDeleteModal = false)} disabled={isSaving}>
					Cancel
				</button>
				<button class="btn btn-error" onclick={deleteUser} disabled={isSaving}>
					{#if isSaving}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Delete
				</button>
			</div>
		</div>
		<button class="modal-backdrop" onclick={() => (showDeleteModal = false)}>close</button>
	</div>
{/if}
