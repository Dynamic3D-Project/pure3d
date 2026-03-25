<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { EditionRole } from '$lib/types/roles';
	import { logAudit } from '$lib/utils/audit';
	import { notify } from '$lib/utils/notifications';
	import { NotificationType } from '$lib/types/notifications';
	import { base } from '$app/paths';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';
	import toast from 'svelte-french-toast';

	interface Props {
		editionId: string;
		isReadOnly?: boolean;
	}

	interface EditionUser {
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

	let { editionId, isReadOnly = false }: Props = $props();

	let members = $state<EditionUser[]>([]);
	let allUsers = $state<AppUser[]>([]);
	let isLoading = $state(true);
	let actionLoading = $state(false);
	let addUserId = $state('');
	let addRole = $state<EditionRole>(EditionRole.Author);

	// Filter out users already in the edition and reviewers
	let availableUsers = $derived(allUsers.filter((u) => !members.some((m) => m.userId === u.id)));

	// Only show Author and Collaborator roles for adding
	const addableRoles = [EditionRole.Author, EditionRole.Collaborator] as const;

	onMount(loadMembers);

	async function loadMembers() {
		isLoading = true;
		try {
			const [edUsers, userProfiles] = await Promise.all([
				pb.collection('editionUsers').getList(1, 100, {
					filter: `editionId = "${editionId}" && role != "reviewer"`
				}),
				pb.collection('userProfiles').getList(1, 500)
			]);

			const profileMap = new Map(
				userProfiles.items.map((u) => [u.id, { nickname: u.nickname || '', email: u.email || '' }])
			);

			members = edUsers.items.map((r) => {
				const profile = profileMap.get(r.userId) || { nickname: '', email: '' };
				return {
					id: r.id,
					userId: r.userId,
					nickname: profile.nickname,
					email: profile.email,
					role: r.role as EditionRole
				};
			});

			allUsers = userProfiles.items.map((r) => ({
				id: r.id,
				nickname: r.nickname || '',
				email: r.email || ''
			}));
		} catch (error) {
			console.error('Error loading collaborators:', error);
		} finally {
			isLoading = false;
		}
	}

	async function addMember() {
		if (!addUserId) return;
		actionLoading = true;
		try {
			await pb.collection('editionUsers').create({
				editionId,
				userId: addUserId,
				user: addUserId,
				role: addRole
			});

			await logAudit('collaborator_added', 'edition', editionId, authStore.user?.email || '', {
				userId: addUserId,
				role: addRole
			});

			await notify(
				addUserId,
				NotificationType.CollaboratorAdded,
				'You have been added to an edition',
				`You have been added as ${addRole} to an edition.`,
				editionId,
				`${base}/editions/${editionId}/workflow`
			);

			addUserId = '';
			addRole = EditionRole.Author;
			await loadMembers();
			toast.success('Collaborator added');
		} catch (error) {
			console.error('Error adding collaborator:', error);
			toast.error('Failed to add collaborator');
		} finally {
			actionLoading = false;
		}
	}

	async function removeMember(member: EditionUser) {
		actionLoading = true;
		try {
			await pb.collection('editionUsers').delete(member.id);

			await logAudit('collaborator_removed', 'edition', editionId, authStore.user?.email || '', {
				userId: member.userId,
				role: member.role
			});

			await notify(
				member.userId,
				NotificationType.CollaboratorRemoved,
				'You have been removed from an edition',
				`You have been removed from an edition.`,
				editionId
			);

			await loadMembers();
			toast.success('Collaborator removed');
		} catch (error) {
			console.error('Error removing collaborator:', error);
			toast.error('Failed to remove collaborator');
		} finally {
			actionLoading = false;
		}
	}
</script>

<div id="collaborator-manager">
	{#if isLoading}
		<div class="flex items-center justify-center py-4">
			<span class="loading loading-sm loading-spinner"></span>
		</div>
	{:else}
		<!-- Member list -->
		{#if members.length > 0}
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Name</th>
							<th>Email</th>
							<th>Role</th>
							{#if !isReadOnly}
								<th></th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each members as member (member.id)}
							<tr>
								<td>{member.nickname || '-'}</td>
								<td class="text-base-content/60">{member.email}</td>
								<td>
									<span
										class="badge badge-sm {member.role === EditionRole.Author
											? 'badge-primary'
											: 'badge-ghost'}"
									>
										{member.role}
									</span>
								</td>
								{#if !isReadOnly}
									<td>
										<button
											class="btn text-error btn-ghost btn-xs"
											onclick={() => removeMember(member)}
											disabled={actionLoading}
											aria-label="Remove {member.nickname || member.email}"
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
			<p class="py-2 text-sm text-base-content/60">No collaborators added yet.</p>
		{/if}

		<!-- Add form -->
		{#if !isReadOnly}
			<div class="mt-3 flex flex-wrap items-end gap-2">
				<div class="form-control">
					<UserSearchSelect
						users={availableUsers}
						bind:value={addUserId}
						placeholder="Search user..."
					/>
				</div>
				<select class="select-bordered select select-sm" bind:value={addRole}>
					{#each addableRoles as role}
						<option value={role}>{role}</option>
					{/each}
				</select>
				<button
					class="btn btn-sm btn-primary"
					onclick={addMember}
					disabled={!addUserId || actionLoading}
				>
					{#if actionLoading}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Add
				</button>
			</div>
		{/if}
	{/if}
</div>
