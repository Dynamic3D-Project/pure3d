<script lang="ts">
	import { FeedbackCategory } from '$lib/types/reviews';
	import { createReviewFeedback } from '$lib/server/pocketbase';
	import { logAudit } from '$lib/utils/audit';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { notifyMany } from '$lib/utils/notifications';
	import { NotificationType } from '$lib/types/notifications';
	import { pb } from '$lib/database/client';
	import { base } from '$app/paths';
	import toast from 'svelte-french-toast';

	interface Props {
		editionId: string;
		reviewStage: number;
		reviewerId: string;
		onsubmit?: () => void;
	}

	let { editionId, reviewStage, reviewerId, onsubmit }: Props = $props();

	let category = $state<FeedbackCategory>(FeedbackCategory.General);
	let targetLabel = $state('');
	let comment = $state('');
	let isSubmitting = $state(false);

	let showTargetLabel = $derived(
		category === FeedbackCategory.Annotation || category === FeedbackCategory.Article
	);

	async function handleSubmit() {
		if (!comment.trim()) {
			toast.error('Comment is required');
			return;
		}
		isSubmitting = true;
		try {
			await createReviewFeedback(
				editionId,
				reviewerId,
				reviewStage,
				category,
				comment.trim(),
				showTargetLabel ? targetLabel.trim() : undefined
			);

			await logAudit('feedback_created', 'edition', editionId, authStore.user?.email || '', {
				category,
				targetLabel: showTargetLabel ? targetLabel : null
			});

			// Notify authors
			const edUsers = await pb.collection('editionUsers').getList(1, 50, {
				filter: `editionId = "${editionId}" && role = "author"`
			});
			const authorIds = edUsers.items.map((r) => r.userId);
			if (authorIds.length > 0) {
				await notifyMany(
					authorIds,
					NotificationType.FeedbackReceived,
					'New review feedback',
					`A reviewer has left ${category} feedback on your edition.`,
					editionId,
					`${base}/editions/${editionId}/workflow`
				);
			}

			comment = '';
			targetLabel = '';
			category = FeedbackCategory.General;
			toast.success('Feedback submitted');
			onsubmit?.();
		} catch (error) {
			console.error('Error submitting feedback:', error);
			toast.error('Failed to submit feedback');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div id="review-feedback-form" class="space-y-3">
	<h3 class="text-sm font-semibold">Add Feedback Item</h3>

	<!-- Category selection -->
	<div class="flex flex-wrap gap-3">
		{#each Object.values(FeedbackCategory) as cat}
			<label class="label cursor-pointer gap-2">
				<input
					type="radio"
					name="feedback-category"
					class="radio radio-sm"
					value={cat}
					checked={category === cat}
					onchange={() => (category = cat)}
				/>
				<span class="label-text capitalize">{cat}</span>
			</label>
		{/each}
	</div>

	<!-- Target label (for annotation/article) -->
	{#if showTargetLabel}
		<div class="form-control">
			<label class="label" for="feedback-target">
				<span class="label-text text-sm">
					{category === FeedbackCategory.Annotation ? 'Annotation name' : 'Article title'}
				</span>
			</label>
			<input
				id="feedback-target"
				type="text"
				class="input-bordered input input-sm w-full"
				bind:value={targetLabel}
				placeholder={category === FeedbackCategory.Annotation
					? 'Which annotation?'
					: 'Which article?'}
			/>
		</div>
	{/if}

	<!-- Comment -->
	<div class="form-control">
		<textarea
			class="textarea-bordered textarea w-full"
			rows="3"
			bind:value={comment}
			placeholder="Write your feedback..."
		></textarea>
	</div>

	<button
		class="btn btn-sm btn-primary"
		onclick={handleSubmit}
		disabled={isSubmitting || !comment.trim()}
	>
		{#if isSubmitting}
			<span class="loading loading-xs loading-spinner"></span>
		{/if}
		Add Feedback
	</button>
</div>
