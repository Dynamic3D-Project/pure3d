<script lang="ts">
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import {
		EditionStatus,
		EDITION_STATUS_TRANSITIONS,
		STATUS_LABELS,
		type UserRoleContext
	} from '$lib/types/roles';
	import { canUserTransitionStatus } from '$lib/utils/permissions';
	import { logAudit } from '$lib/utils/audit';
	import toast from 'svelte-french-toast';

	interface Props {
		editionId: string;
		title: string;
		status: EditionStatus;
		context: UserRoleContext;
		onchanged?: (newStatus: EditionStatus) => void;
	}

	let { editionId, title, status, context, onchanged }: Props = $props();

	let transitioning = $state(false);

	let transitions = $derived(
		(EDITION_STATUS_TRANSITIONS[status] || []).filter((target) =>
			canUserTransitionStatus(context, status, target)
		)
	);

	async function transitionTo(target: EditionStatus) {
		transitioning = true;
		try {
			const oldStatus = status;
			const isPublished = target === EditionStatus.Published;

			await pb.collection('editions').update(editionId, {
				status: target,
				isPublished
			});

			await logAudit('status_transition', 'edition', editionId, authStore.user?.email || '', {
				from: oldStatus,
				to: target,
				title
			});

			toast.success(`Status changed to ${STATUS_LABELS[target]}`);
			onchanged?.(target);
		} catch (error) {
			console.error('Error transitioning status:', error);
			toast.error('Failed to change status');
		} finally {
			transitioning = false;
		}
	}
</script>

{#if transitions.length > 0}
	<div class="flex flex-wrap gap-2">
		{#each transitions as target (target)}
			<button
				class="btn btn-outline btn-sm"
				onclick={() => transitionTo(target)}
				disabled={transitioning}
			>
				{#if transitioning}
					<span class="loading loading-xs loading-spinner"></span>
				{/if}
				Move to {STATUS_LABELS[target]}
			</button>
		{/each}
	</div>
{:else}
	<p class="text-sm text-base-content/60">No transitions available from this status.</p>
{/if}
