<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { EditionRole, GlobalRole } from '$lib/types/roles';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';
	import FloatingSelect from '$lib/components/ui/FloatingSelect.svelte';
	import toast from 'svelte-french-toast';
	import type { Credit } from '$lib/types/credits';
	import { normalizeOrcid } from '$lib/utils/credits';

	interface Props {
		editionId: string;
		isReadOnly?: boolean;
		credits: Credit[];
		/** The parent persists credits through its own save coordination. */
		oncreditssaved: (credits: Credit[]) => Promise<void>;
	}

	interface EditionUser {
		id: string;
		userId: string;
		nickname: string;
		orcid: string;
		orcidVerifiedAt: string;
		role: EditionRole;
	}

	interface AppUser {
		id: string;
		nickname: string;
		orcid: string;
		orcidVerifiedAt: string;
	}

	let { editionId, isReadOnly = false, credits, oncreditssaved }: Props = $props();
	let isAdmin = $derived(authStore.globalRole === GlobalRole.Admin);

	let members = $state<EditionUser[]>([]);
	let allUsers = $state<AppUser[]>([]);
	let isLoading = $state(true);
	let actionLoading = $state(false);
	let addUserId = $state('');
	let addRole = $state<EditionRole>(
		authStore.globalRole === GlobalRole.Admin ? EditionRole.Author : EditionRole.Collaborator
	);

	// Filter out users already in the edition and reviewers
	let availableUsers = $derived(
		allUsers.filter(
			(u) =>
				!members.some((m) => m.userId === u.id) &&
				(addRole !== EditionRole.Author || (!!normalizeOrcid(u.orcid) && !!u.orcidVerifiedAt))
		)
	);

	let addableRoles = $derived(
		isAdmin ? [EditionRole.Author, EditionRole.Collaborator] : [EditionRole.Collaborator]
	);
	let addableRoleOptions = $derived(addableRoles.map((role) => ({ value: role, label: role })));

	onMount(loadMembers);

	async function loadMembers() {
		isLoading = true;
		try {
			const [edUsers, userProfiles] = await Promise.all([
				pb.collection('editionUsers').getFullList({
					filter: `editionId = "${editionId}" && role != "reviewer"`
				}),
				pb.collection('users').getFullList()
			]);

			const profileMap = new Map(
				userProfiles.map((u) => [
					u.id,
					{
						nickname: u.nickname || '',
						orcid: u.orcid || '',
						orcidVerifiedAt: u.orcidVerifiedAt || ''
					}
				])
			);

			members = edUsers.map((r) => {
				const profile = profileMap.get(r.userId) || {
					nickname: '',
					orcid: '',
					orcidVerifiedAt: ''
				};
				return {
					id: r.id,
					userId: r.userId,
					nickname: profile.nickname,
					orcid: profile.orcid,
					orcidVerifiedAt: profile.orcidVerifiedAt,
					role: r.role as EditionRole
				};
			});

			allUsers = userProfiles.map((r) => ({
				id: r.id,
				nickname: r.nickname || '',
				orcid: r.orcid || '',
				orcidVerifiedAt: r.orcidVerifiedAt || ''
			}));
		} catch (error) {
			console.error('Error loading collaborators:', error);
			toast.error('Failed to load collaborators');
		} finally {
			isLoading = false;
		}
	}

	async function addMember() {
		if (isReadOnly || actionLoading || !addUserId || !addableRoles.includes(addRole)) return;
		if (!availableUsers.some((user) => user.id === addUserId)) {
			toast.error('Authors must verify their ORCID through sign-in first');
			return;
		}
		actionLoading = true;
		try {
			await pb.collection('editionUsers').create({
				editionId,
				userId: addUserId,
				user: addUserId,
				role: addRole
			});

			addUserId = '';
			addRole = isAdmin ? EditionRole.Author : EditionRole.Collaborator;
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
		if (isReadOnly || actionLoading || (!isAdmin && member.role !== EditionRole.Collaborator))
			return;
		actionLoading = true;
		try {
			await pb.collection('editionUsers').delete(member.id);

			await loadMembers();
			toast.success('Collaborator removed');
		} catch (error) {
			console.error('Error removing collaborator:', error);
			toast.error('Failed to remove collaborator');
		} finally {
			actionLoading = false;
		}
	}

	async function addCredit(member: EditionUser) {
		if (isReadOnly || actionLoading) return;
		if (credits.some((credit) => credit.userId === member.userId)) return;
		const orcid = member.orcidVerifiedAt ? normalizeOrcid(member.orcid) : null;
		if (!orcid) return;
		actionLoading = true;
		try {
			const credit: Credit = {
				type: 'person',
				name: member.nickname || 'Unnamed user',
				orcid,
				userId: member.userId,
				role: member.role === EditionRole.Author ? 'creator' : 'contributor',
				provenance: 'oauth'
			};
			await oncreditssaved([...credits, credit]);
			toast.success('Credit added. Access roles are unchanged.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to add credit');
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
							<th>ORCID</th>
							<th>Credit</th>
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
								<td class="text-base-content/60"
									>{member.orcid || 'Not linked'}{#if member.orcid && member.orcidVerifiedAt}<span
											class="block text-xs">ORCID verified</span
										>{/if}</td
								>
								<td
									>{#if credits.some((credit) => credit.userId === member.userId)}Credited{:else}<span
											class="text-warning">Member, not credited</span
										>{#if !isReadOnly}<button
												class="btn btn-ghost btn-xs"
												disabled={actionLoading ||
													!member.orcidVerifiedAt ||
													!normalizeOrcid(member.orcid)}
												onclick={() => addCredit(member)}>Add credit</button
											>{#if !member.orcidVerifiedAt || !normalizeOrcid(member.orcid)}
												<p class="mt-1 text-xs text-base-content/60">
													Link ORCID to add account credit; use the credit editor for an unlinked
													contributor.
												</p>
											{/if}{/if}{/if}</td
								>
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
										{#if isAdmin || member.role === EditionRole.Collaborator}
											<button
												class="btn text-error btn-ghost btn-xs"
												onclick={() => removeMember(member)}
												disabled={actionLoading}
												aria-label="Remove {member.nickname || member.orcid || 'user'}"
											>
												Remove
											</button>
										{/if}
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

		<p class="mt-3 text-sm text-base-content/60">
			Membership grants access, not attribution. Adding a credit does not grant access. Authors
			require OAuth-verified ORCID.
		</p>
		{#each credits.filter((credit) => credit.userId && !members.some((member) => member.userId === credit.userId)) as credit (credit)}
			<p class="text-sm text-warning">{credit.name}: credited, no collaborator membership.</p>
		{/each}
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
				<FloatingSelect
					value={addRole}
					options={addableRoleOptions}
					class="w-36"
					onchange={(role) => (addRole = role as EditionRole)}
				/>
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
