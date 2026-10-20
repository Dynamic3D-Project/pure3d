<script lang="ts">
	import { resolve } from '$app/paths';
	import { pb } from '$lib/database/client';
	import {
		EditionStatus,
		EDITION_STATUS_TRANSITIONS,
		GlobalRole,
		STATUS_LABELS,
		type UserRoleContext
	} from '$lib/types/roles';
	import { canUserTransitionStatus } from '$lib/utils/permissions';
	import toast from 'svelte-french-toast';

	interface Props {
		editionId: string;
		status: EditionStatus;
		context: UserRoleContext;
		onchanged?: (newStatus: EditionStatus) => void;
	}

	let { editionId, status, context, onchanged }: Props = $props();

	let transitioning = $state(false);
	let overrideDialog: HTMLDialogElement;
	let overrideTarget = $state<EditionStatus | null>(null);
	let overrideReason = $state('');

	let transitions = $derived(
		(EDITION_STATUS_TRANSITIONS[status] || []).filter((target) =>
			canUserTransitionStatus(context, status, target)
		)
	);

	async function transitionTo(target: EditionStatus) {
		transitioning = true;
		try {
			const isPublished = target === EditionStatus.Published;

			await pb.collection('editions').update(editionId, {
				status: target,
				isPublished
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

	function openOverride(target: EditionStatus) {
		overrideTarget = target;
		overrideReason = '';
		overrideDialog.showModal();
	}

	async function applyOverride() {
		if (!overrideTarget || !overrideReason.trim()) return;
		transitioning = true;
		try {
			await pb.send(`/api/pure3d/editions/${editionId}/admin-workflow-override`, {
				method: 'POST',
				body: {
					status: overrideTarget,
					expectedStatus: status,
					reason: overrideReason.trim()
				}
			});
			overrideDialog.close();
			toast.success(`Administrative transition applied: ${STATUS_LABELS[overrideTarget]}`);
			onchanged?.(overrideTarget);
		} catch (error) {
			console.error('Error applying administrative transition:', error);
			toast.error(
				error instanceof Error ? error.message : 'Failed to apply administrative transition'
			);
		} finally {
			transitioning = false;
		}
	}
</script>

<div id="status-transition-panel">
	{#if [EditionStatus.AlphaReview, EditionStatus.FinalReview, EditionStatus.PublicationRequested].includes(status)}
		<a
			class="btn btn-outline btn-sm"
			href={resolve('/editions/[slug]/workflow', { slug: editionId })}
			>Review feedback & editorial decision</a
		>
	{:else if transitions.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each transitions as target (target)}
				{#if [EditionStatus.ConceptSubmitted, EditionStatus.AlphaReview, EditionStatus.FinalReview, EditionStatus.PublicationRequested].includes(target)}
					<a
						class="btn btn-outline btn-sm"
						href={resolve('/editions/[slug]/workflow', { slug: editionId })}
						>{target === EditionStatus.ConceptSubmitted
							? 'Complete proposal submission'
							: 'Prepare submission request'}</a
					>
				{:else}
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
				{/if}
			{/each}
		</div>
		{#if context.globalRole === GlobalRole.Admin}
			<div class="mt-3 rounded-box bg-base-200/70 p-3 text-sm">
				<p class="text-base-content/70">
					For imported editions that cannot complete the current submission requirements, use an
					audited administrative transition. It follows the same stage order and never publishes an
					edition.
				</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each transitions as target (target)}
						<button
							type="button"
							class="btn btn-outline btn-sm"
							disabled={transitioning}
							onclick={() => openOverride(target)}
						>
							Advance legacy record to {STATUS_LABELS[target]}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	{:else}
		<p class="text-sm text-base-content/60">No transitions available from this status.</p>
	{/if}

	<dialog bind:this={overrideDialog} class="modal" aria-labelledby="admin-workflow-override-title">
		<div class="modal-box">
			<h2 id="admin-workflow-override-title" class="text-lg font-semibold">
				Advance legacy edition
			</h2>
			<p class="mt-2 text-sm text-base-content/70">
				Move from {STATUS_LABELS[status]} to {overrideTarget ? STATUS_LABELS[overrideTarget] : ''}.
				This intervention is recorded in the audit log. It does not create reviews, release
				feedback, or publish the edition.
			</p>
			<label class="mt-4 block" for="admin-workflow-override-reason">
				<span class="mb-1 block text-sm font-medium">Reason for this audit entry</span>
				<textarea
					id="admin-workflow-override-reason"
					class="textarea-bordered textarea w-full"
					bind:value={overrideReason}
					maxlength="5000"
					required
				></textarea>
			</label>
			<div class="modal-action">
				<button
					type="button"
					class="btn btn-outline"
					disabled={transitioning}
					onclick={() => overrideDialog.close()}>Cancel</button
				>
				<button
					type="button"
					class="btn btn-primary"
					disabled={transitioning || !overrideReason.trim()}
					onclick={applyOverride}>Apply transition</button
				>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button aria-label="Close administrative transition dialog">close</button>
		</form>
	</dialog>
</div>
