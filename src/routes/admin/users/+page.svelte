<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import FloatingSelect from '$lib/components/ui/FloatingSelect.svelte';
	import { GlobalRole, GLOBAL_ROLE_LABELS } from '$lib/types/roles';
	import { normalizeOrcid } from '$lib/utils/credits';
	import toast from 'svelte-french-toast';
	import type { RecordModel } from 'pocketbase';

	type PendingIdentity = {
		userId: string;
		pendingOrcid: string | null;
		orcid: string | null;
		orcidVerifiedAt: string | null;
	};
	let users = $state<RecordModel[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let searchQuery = $state('');
	let roleFilter = $state('');
	let editingUser = $state<RecordModel | null>(null);
	let editRole = $state('');
	let pending = $state<PendingIdentity | null>(null);
	let pendingOrcid = $state('');
	let reviewed = $state(false);
	const roleOptions = Object.values(GlobalRole).map((value) => ({
		value,
		label: GLOBAL_ROLE_LABELS[value]
	}));
	let filteredUsers = $derived(
		users.filter(
			(user) =>
				(!roleFilter || user.role === roleFilter) &&
				[user.nickname, user.orcid].some((value) =>
					String(value || '')
						.toLowerCase()
						.includes(searchQuery.toLowerCase())
				)
		)
	);

	onMount(loadUsers);
	async function loadUsers() {
		isLoading = true;
		try {
			users = await pb.collection('users').getFullList({ sort: 'nickname' });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to load users');
		} finally {
			isLoading = false;
		}
	}

	async function editUser(user: RecordModel) {
		editingUser = user;
		editRole = user.role;
		pending = null;
		pendingOrcid = '';
		reviewed = false;
		try {
			const identity = await pb.send<PendingIdentity>(`/api/pure3d/orcid/pending/${user.id}`, {
				method: 'GET'
			});
			if (editingUser?.id !== user.id) return;
			pending = identity;
			pendingOrcid = identity.pendingOrcid || '';
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to load pending mapping');
		}
	}

	async function saveRole() {
		if (!editingUser || editingUser.id === authStore.user?.id || isSaving) return;
		isSaving = true;
		try {
			const user = await pb.collection('users').update(editingUser.id, { role: editRole });
			users = users.map((existing) => (existing.id === user.id ? user : existing));
			editingUser = user;
			toast.success('Role saved');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to save role');
		} finally {
			isSaving = false;
		}
	}

	async function saveMapping() {
		if (!editingUser || !pending || !reviewed || pending.orcidVerifiedAt || isSaving) return;
		const orcid = pendingOrcid.trim() ? normalizeOrcid(pendingOrcid) : null;
		if (pendingOrcid.trim() && !orcid) {
			toast.error('Enter a valid ORCID, including its checksum');
			return;
		}
		isSaving = true;
		try {
			await pb.send(`/api/pure3d/orcid/pending/${editingUser.id}`, {
				method: 'POST',
				body: { orcid }
			});
			pending = await pb.send<PendingIdentity>(`/api/pure3d/orcid/pending/${editingUser.id}`, {
				method: 'GET'
			});
			pendingOrcid = pending.pendingOrcid || '';
			reviewed = false;
			toast.success('Reviewed mapping saved. Ownership still requires ORCID sign-in.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to save mapping');
		} finally {
			isSaving = false;
		}
	}

	async function deleteUser(user: RecordModel) {
		if (user.id === authStore.user?.id || isSaving) return;
		if (
			!confirm(
				`Delete ${user.nickname || 'this user'}? Access links will be removed; credits remain without the account link. This cannot be undone.`
			)
		)
			return;
		isSaving = true;
		try {
			await pb.collection('users').delete(user.id);
			users = users.filter((existing) => existing.id !== user.id);
			toast.success('User deleted');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete user');
		} finally {
			isSaving = false;
		}
	}
</script>

<div id="page" class="mx-auto max-w-6xl">
	<h1 class="text-3xl font-bold">User Management</h1>
	<p class="mt-2 text-base-content/60">
		Accounts are created only through ORCID sign-in. Manage existing roles and reviewed identity
		mappings here.
	</p>
	<div class="my-6 flex flex-wrap gap-3">
		<label class="form-control flex-1"
			>Name or ORCID<input class="input-bordered input w-full" bind:value={searchQuery} /></label
		>
		<label class="form-control"
			>Role<FloatingSelect
				bind:value={roleFilter}
				options={[{ value: '', label: 'All roles' }, ...roleOptions]}
			/></label
		>
	</div>
	{#if isLoading}
		<p role="status">Loading users...</p>
	{:else}
		<div class="overflow-x-auto rounded-box border border-base-300">
			<table class="table">
				<thead
					><tr><th>Name</th><th>ORCID</th><th>Ownership proof</th><th>Role</th><th>Actions</th></tr
					></thead
				>
				<tbody>
					{#each filteredUsers as user (user.id)}
						<tr>
							<td>{user.nickname || 'Unnamed user'}</td>
							<td
								>{#if normalizeOrcid(user.orcid)}<a
										href={`https://orcid.org/${normalizeOrcid(user.orcid)?.slice(18)}`}
										class="link"
										target="_blank"
										rel="noreferrer">{user.orcid}</a
									>{:else}Not linked{/if}</td
							>
							<td
								>{user.orcid && user.orcidVerifiedAt
									? 'ORCID verified'
									: 'Not verified through ORCID'}</td
							>
							<td>{GLOBAL_ROLE_LABELS[user.role as GlobalRole] || user.role}</td>
							<td
								><div class="flex gap-2">
									<button class="btn btn-ghost btn-sm" onclick={() => editUser(user)}>Manage</button
									><button
										class="btn text-error btn-ghost btn-sm"
										disabled={isSaving || user.id === authStore.user?.id}
										onclick={() => deleteUser(user)}>Delete</button
									>
								</div></td
							>
						</tr>
					{:else}<tr><td colspan="5">No matching users.</td></tr>{/each}
				</tbody>
			</table>
		</div>
	{/if}
	{#if editingUser}
		<div
			class="modal-open modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="manage-user-title"
			tabindex="-1"
		>
			<div class="modal-box space-y-4">
				<h2 id="manage-user-title" class="text-xl font-bold">
					Manage {editingUser.nickname || 'user'}
				</h2>
				<p class="text-sm text-base-content/60">
					Profile fields are synced from ORCID. Email verification is not ORCID ownership proof.
				</p>
				<label class="form-control"
					>Role<FloatingSelect
						bind:value={editRole}
						options={roleOptions}
						disabled={isSaving || editingUser.id === authStore.user?.id}
					/></label
				>
				<button
					class="btn btn-sm"
					disabled={isSaving ||
						editingUser.id === authStore.user?.id ||
						editRole === editingUser.role}
					onclick={saveRole}>Save role</button
				>
				<div class="space-y-3 border-t border-base-300 pt-4">
					<h3 class="font-semibold">Reviewed ORCID mapping</h3>
					<p class="text-sm">
						This is a private migration mapping, not ownership proof. The user must sign in with
						this ORCID to verify it. Leave blank to clear the pending mapping.
					</p>
					{#if pending}
						<p class="text-sm">
							Current ORCID: {pending.orcid || 'None'}. {pending.orcidVerifiedAt
								? 'Verified through OAuth; cannot remap.'
								: 'Not verified through OAuth.'}
						</p>
						<label class="form-control"
							>Pending ORCID<input
								class="input-bordered input w-full"
								bind:value={pendingOrcid}
								disabled={isSaving || !!pending.orcidVerifiedAt}
							/></label
						>
						<label class="flex items-start gap-2"
							><input
								type="checkbox"
								class="checkbox"
								bind:checked={reviewed}
								disabled={isSaving || !!pending.orcidVerifiedAt}
							/>I reviewed evidence for this mapping or its removal.</label
						>
						<button
							class="btn btn-sm btn-primary"
							disabled={isSaving || !reviewed || !!pending.orcidVerifiedAt}
							onclick={saveMapping}>Save reviewed mapping</button
						>
					{:else}<p>Pending mapping unavailable. Close and reopen to retry.</p>{/if}
				</div>
				<div class="modal-action">
					<button class="btn" disabled={isSaving} onclick={() => (editingUser = null)}>Close</button
					>
				</div>
			</div>
		</div>
	{/if}
</div>
