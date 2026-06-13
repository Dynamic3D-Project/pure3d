<script lang="ts">
	import { ReviewDecision } from '$lib/types/reviews';
	import { ReviewStage } from '$lib/types/roles';
	import { pb } from '$lib/database/client';
	import { logAudit } from '$lib/utils/audit';
	import { notifyMany } from '$lib/utils/notifications';
	import { NotificationType } from '$lib/types/notifications';
	import { getAdminUserIds } from '$lib/utils/review-helpers';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import toast from 'svelte-french-toast';

	let {
		editionId,
		reviewStage,
		reviewerId,
		onsubmit: onSubmitCallback,
		existingReview
	}: {
		editionId: string;
		reviewStage: number;
		reviewerId: string;
		onsubmit: () => void;
		existingReview?: { decision: ReviewDecision; comment: string | null };
	} = $props();

	let decision = $state<ReviewDecision | null>(existingReview?.decision ?? null);
	let comment = $state(existingReview?.comment ?? '');
	let isSubmitting = $state(false);

	// Stage 3 (Final) has no full reject option
	const availableDecisions = $derived(
		reviewStage === ReviewStage.Final
			? [ReviewDecision.Approve, ReviewDecision.RequestRevisions]
			: [ReviewDecision.Approve, ReviewDecision.Reject, ReviewDecision.RequestRevisions]
	);

	const decisionLabels: Record<ReviewDecision, string> = {
		[ReviewDecision.Approve]: 'Approve',
		[ReviewDecision.Reject]: 'Reject',
		[ReviewDecision.RequestRevisions]: 'Request Revisions'
	};

	const decisionDescriptions: Record<ReviewDecision, string> = {
		[ReviewDecision.Approve]: 'The edition meets requirements and should proceed.',
		[ReviewDecision.Reject]: 'The edition does not meet requirements.',
		[ReviewDecision.RequestRevisions]: 'The edition needs changes before it can be approved.'
	};

	const decisionStyles: Record<ReviewDecision, string> = {
		[ReviewDecision.Approve]: 'border-success/50 bg-success/5',
		[ReviewDecision.Reject]: 'border-error/50 bg-error/5',
		[ReviewDecision.RequestRevisions]: 'border-warning/50 bg-warning/5'
	};

	async function handleSubmit() {
		if (!decision) {
			toast.error('Please select a verdict');
			return;
		}

		isSubmitting = true;
		try {
			await pb.collection('editionReviews').create({
				editionId,
				reviewerId,
				reviewStage,
				decision,
				comment: comment || ''
			});

			await logAudit('review_submitted', 'edition', editionId, authStore.user?.email || '', {
				reviewStage,
				decision,
				reviewerId
			});

			// Notify admins about the submitted review
			const adminIds = await getAdminUserIds();
			await notifyMany(
				adminIds,
				NotificationType.ReviewSubmitted,
				'Review submitted',
				`A reviewer has submitted their review for stage ${reviewStage}.`,
				editionId
			);

			toast.success('Review submitted');
			onSubmitCallback();
		} catch (error) {
			console.error('Error submitting review:', error);
			toast.error('Failed to submit review');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<form
	id="review-form"
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
	class="space-y-4"
>
	<div>
		<span class="label">
			<span class="label-text font-semibold">Verdict</span>
		</span>
		<div class="grid gap-2 sm:grid-cols-{availableDecisions.length}">
			{#each availableDecisions as d (d)}
				<button
					type="button"
					class="cursor-pointer rounded-lg border-2 p-3 text-left transition-all {decision === d
						? decisionStyles[d] + ' ring-2 ring-offset-1'
						: 'border-base-300 hover:border-base-content/20'}"
					onclick={() => (decision = d)}
				>
					<div class="font-medium">{decisionLabels[d]}</div>
					<div class="mt-1 text-xs text-base-content/60">{decisionDescriptions[d]}</div>
				</button>
			{/each}
		</div>
	</div>

	<div>
		<label class="label" for="review-comment">
			<span class="label-text font-semibold">Comments</span>
			<span class="label-text-alt"
				>Optional, but recommended for rejections or revision requests</span
			>
		</label>
		<textarea
			id="review-comment"
			class="textarea-bordered textarea w-full"
			rows="4"
			placeholder="Provide feedback for the author..."
			bind:value={comment}
		></textarea>
	</div>

	<div class="flex justify-end">
		<button type="submit" class="btn btn-primary" disabled={!decision || isSubmitting}>
			{#if isSubmitting}
				<span class="loading loading-sm loading-spinner"></span>
			{/if}
			Submit Review
		</button>
	</div>
</form>
