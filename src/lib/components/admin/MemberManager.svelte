<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import toast from 'svelte-french-toast';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';
	import FloatingSelect from '$lib/components/ui/FloatingSelect.svelte';
	import CreditsEditor from '$lib/components/ui/CreditsEditor.svelte';
	import type { Credit } from '$lib/types/credits';
	import { normalizeOrcid, readCredits, validateCredits } from '$lib/utils/credits';

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
		/** When true, hides add form and remove/role-change controls. */
		isReadOnly?: boolean;
		/** Extra filter appended to the membership query (e.g. exclude reviewers). */
		extraFilter?: string;
		credits?: Credit[];
		oncreditssaved?: (credits: Credit[]) => void;
	}

	interface Member {
		id: string;
		userId: string;
		nickname: string;
		orcid: string;
		orcidVerifiedAt: string;
		role: RoleString;
	}

	interface AppUser {
		id: string;
		nickname: string;
		orcid: string;
		orcidVerifiedAt: string;
	}

	let {
		membershipCollection,
		parentField,
		parentId,
		roleValues,
		roleLabels,
		defaultRole,
		isReadOnly = false,
		extraFilter,
		credits: parentCredits,
		oncreditssaved
	}: Props = $props();

	let members = $state<Member[]>([]);
	let allUsers = $state<AppUser[]>([]);
	let isLoading = $state(true);
	let loadError = $state(false);
	let savingMemberId = $state<string | null>(null);
	let isAdding = $state(false);
	let addUserId = $state('');
	let credits = $state<Credit[]>([]);
	let savedCredits = $state<Credit[]>([]);
	let savingCredits = $state(false);
	let parentPublished = $state(false);
	let parentCollection = $derived(
		membershipCollection === 'editionUsers' ? 'editions' : 'collections'
	);
	let addRole = $state<RoleString>('');
	$effect(() => {
		if (!addRole) addRole = defaultRole;
	});

	let availableUsers = $derived(() => {
		const existing = new Set(members.map((m) => m.userId));
		return allUsers.filter(
			(u) =>
				!existing.has(u.id) &&
				(addRole !== 'author' || (!!normalizeOrcid(u.orcid) && !!u.orcidVerifiedAt))
		);
	});

	let roleOptions = $derived(
		roleValues.map((role) => ({
			value: role,
			label: roleLabels[role] ?? role
		}))
	);

	onMount(() => {
		load(true);
	});

	async function load(initializeCredits = false) {
		isLoading = true;
		loadError = false;
		try {
			const filter = extraFilter
				? `${parentField} = "${parentId}" && ${extraFilter}`
				: `${parentField} = "${parentId}"`;

			const [memberRes, userRes, parent] = await Promise.all([
				pb.collection(membershipCollection).getFullList({
					filter,
					expand: 'userId'
				}),
				pb.collection('users').getFullList(),
				pb.collection(parentCollection).getOne(parentId)
			]);
			if (initializeCredits) credits = readCredits(parentCredits ?? parent.credits);
			savedCredits = readCredits(parent.credits);
			parentPublished = !!(parent.isPublished || parent.isVisible);

			const profileMap = new Map(
				userRes.map((u) => [
					u.id,
					{
						nickname: u.nickname || '',
						orcid: u.orcid || '',
						orcidVerifiedAt: u.orcidVerifiedAt || ''
					}
				])
			);

			members = memberRes.map((r) => {
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
					role: r.role as RoleString
				};
			});

			allUsers = userRes.map((r) => ({
				id: r.id,
				nickname: r.nickname || '',
				orcid: r.orcid || '',
				orcidVerifiedAt: r.orcidVerifiedAt || ''
			}));
		} catch (error) {
			console.error('Error loading members:', error);
			toast.error('Failed to load members');
			loadError = true;
		} finally {
			isLoading = false;
		}
	}

	async function updateRole(memberId: string, newRole: RoleString) {
		const target = members.find((member) => member.id === memberId);
		if (newRole === 'author' && (!normalizeOrcid(target?.orcid) || !target?.orcidVerifiedAt)) {
			toast.error('Authors must verify their ORCID through sign-in first');
			return;
		}
		savingMemberId = memberId;
		try {
			const member = members.find((m) => m.id === memberId);

			await pb.collection(membershipCollection).update(memberId, { role: newRole });

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
			await pb.collection(membershipCollection).delete(memberId);

			members = members.filter((m) => m.id !== memberId);
			toast.success('Member removed');
		} catch (error) {
			console.error('Error removing member:', error);
			toast.error('Failed to remove member');
		}
	}

	async function add() {
		if (!addUserId) return;
		if (!availableUsers().some((user) => user.id === addUserId)) {
			toast.error('Choose an eligible user for this role');
			return;
		}
		isAdding = true;
		try {
			const payload: Record<string, string> = {
				[parentField]: parentId,
				userId: addUserId,
				user: addUserId,
				role: addRole
			};
			await pb.collection(membershipCollection).create(payload);

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

	function addCredit(member: Member) {
		if (isReadOnly || savingCredits || loadError) return;
		if (credits.some((credit) => credit.userId === member.userId)) return;
		const orcid = member.orcidVerifiedAt ? normalizeOrcid(member.orcid) : null;
		if (!orcid) return;
		credits = [
			...credits,
			{
				type: 'person',
				name: member.nickname || 'Unnamed user',
				orcid,
				userId: member.userId,
				role: member.role === 'author' ? 'creator' : 'contributor',
				provenance: 'oauth'
			}
		];
	}

	async function saveCredits() {
		if (isReadOnly || savingCredits || loadError) return;
		const issue = validateCredits(credits, parentPublished);
		if (issue) {
			toast.error(issue);
			return;
		}
		savingCredits = true;
		try {
			const record = await pb.collection(parentCollection).update(parentId, { credits });
			credits = readCredits(record.credits);
			savedCredits = readCredits(record.credits);
			oncreditssaved?.(readCredits(record.credits));
			toast.success('Credits saved. Access roles are unchanged.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to save credits');
		} finally {
			savingCredits = false;
		}
	}
</script>

<div id="member-manager" class="member-manager">
	{#if isLoading}
		<div class="flex justify-center py-4">
			<span class="loading loading-sm loading-spinner"></span>
		</div>
	{:else if loadError}
		<p class="text-error" role="alert">
			Could not load members and credits. Reopen this panel to retry.
		</p>
	{:else}
		{#if members.length > 0}
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>User</th>
							<th>ORCID</th>
							<th>Credit</th>
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
								<td class="text-base-content/70"
									>{member.orcid || 'Not linked'}{#if member.orcid && member.orcidVerifiedAt}<span
											class="block text-xs">ORCID verified</span
										>{/if}</td
								>
								<td>
									{#if savedCredits.some((credit) => credit.userId === member.userId)}Credited
									{:else}<span class="text-warning">Member, not credited</span>{/if}
									{#if !isReadOnly && !credits.some((credit) => credit.userId === member.userId)}<button
											class="btn btn-ghost btn-xs"
											disabled={savingCredits ||
												!member.orcidVerifiedAt ||
												!normalizeOrcid(member.orcid)}
											onclick={() => addCredit(member)}>Add credit</button
										>{#if !member.orcidVerifiedAt || !normalizeOrcid(member.orcid)}
											<p class="mt-1 text-xs text-base-content/60">
												Link ORCID to add account credit; use the credit editor for an unlinked
												contributor.
											</p>
										{/if}{/if}
								</td>
								<td>
									{#if isReadOnly}
										<span class="badge badge-ghost badge-sm"
											>{roleLabels[member.role] ?? member.role}</span
										>
									{:else}
										<FloatingSelect
											value={member.role}
											options={roleOptions}
											disabled={savingMemberId === member.id}
											onchange={(nextRole) => updateRole(member.id, nextRole)}
										/>
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
					<FloatingSelect
						id="member-add-role-{parentId}"
						bind:value={addRole}
						options={roleOptions}
					/>
				</div>
				<button class="btn btn-sm btn-primary" onclick={add} disabled={!addUserId || isAdding}>
					{#if isAdding}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Add Member
				</button>
			</div>
		{/if}
		<p class="mt-3 text-sm text-base-content/60">
			Membership grants access, not attribution. Credits grant attribution, not access. Authors
			require OAuth-verified ORCID.
		</p>
		{#each savedCredits.filter((credit) => credit.userId && !members.some((member) => member.userId === credit.userId)) as credit (credit)}
			<p class="text-sm text-warning">{credit.name}: credited, no membership in this list.</p>
		{/each}
		<div class="mt-4 border-t border-base-300 pt-4">
			<CreditsEditor bind:credits disabled={isReadOnly || savingCredits} />
			{#if !isReadOnly}
				<button class="btn mt-3 btn-sm btn-primary" disabled={savingCredits} onclick={saveCredits}
					>Save credits for this {membershipCollection === 'editionUsers'
						? 'edition'
						: 'collection'}</button
				>
			{/if}
		</div>
	{/if}
</div>
