<script lang="ts">
	import { ReviewDecision } from '$lib/types/reviews';
	import { ReviewStage } from '$lib/types/roles';
	import { pb } from '$lib/database/client';
	import toast from 'svelte-french-toast';

	let {
		editionId,
		reviewStage,
		reviewerId,
		onsubmit: onSubmitCallback,
		existingReview,
		stacked = false
	}: {
		editionId: string;
		reviewStage: number;
		reviewerId: string;
		onsubmit: () => void;
		existingReview?: { decision: ReviewDecision; comment: string | null };
		stacked?: boolean;
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
		[ReviewDecision.Approve]: 'border-success bg-success/10',
		[ReviewDecision.Reject]: 'border-error bg-error/10',
		[ReviewDecision.RequestRevisions]: 'border-warning bg-warning/10'
	};
	const indicatorStyles: Record<ReviewDecision, string> = {
		[ReviewDecision.Approve]: 'text-success',
		[ReviewDecision.Reject]: 'text-error',
		[ReviewDecision.RequestRevisions]: 'text-warning'
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
	<fieldset>
		<legend class="mb-2 font-semibold">Verdict</legend>
		<div class="grid gap-3 {stacked ? '' : availableDecisions.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}">
			{#each availableDecisions as d (d)}
				<label
					class="flex cursor-pointer flex-col justify-between {stacked ? 'gap-1 p-3' : 'min-h-28 gap-4 p-4'} rounded-xl border-2 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-base-content/60 {decision ===
					d
						? decisionStyles[d]
						: 'border-base-300 hover:border-base-content/40 hover:bg-base-200/50'}"
				>
					<input
						type="radio"
						name="review-verdict"
						value={d}
						checked={decision === d}
						onchange={() => (decision = d)}
						class="sr-only"
					/>
					<span class="flex items-center justify-between gap-3 text-base font-semibold">
						{decisionLabels[d]}
						<span
							aria-hidden="true"
							class="flex size-5 shrink-0 items-center justify-center rounded-full border-2 {decision ===
							d
								? 'border-current ' + indicatorStyles[d]
								: 'border-base-content/40'}"
						>
							{#if decision === d}<span class="size-2.5 rounded-full bg-current"></span>{/if}
						</span>
					</span>
					<span class="text-sm leading-snug text-base-content/70">{decisionDescriptions[d]}</span>
				</label>
			{/each}
		</div>
	</fieldset>

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
