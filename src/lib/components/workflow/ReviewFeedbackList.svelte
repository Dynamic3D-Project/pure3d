<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { FeedbackCategory } from '$lib/types/reviews';
	import type { ReviewFeedback } from '$lib/types/reviews';
	import { logAudit } from '$lib/utils/audit';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { ReviewStage } from '$lib/types/roles';
	import toast from 'svelte-french-toast';

	interface Props {
		editionId: string;
		reviewStage?: number;
		canResolve?: boolean;
		isAnonymized?: boolean;
		userLookup?: Map<string, string>;
	}

	let {
		editionId,
		reviewStage,
		canResolve = false,
		isAnonymized = false,
		userLookup
	}: Props = $props();

	let feedbackItems = $state<ReviewFeedback[]>([]);
	let localUserLookup = $state<Map<string, string>>(new Map());
	let isLoading = $state(true);

	let displayLookup = $derived(userLookup ?? localUserLookup);

	onMount(loadFeedback);

	export async function loadFeedback() {
		isLoading = true;
		try {
			let filter = `editionId = "${editionId}"`;
			if (reviewStage !== undefined) {
				filter += ` && reviewStage = ${reviewStage}`;
			}
			const result = await pb.collection('reviewFeedback').getList(1, 500, {
				filter,
				sort: '-created'
			});

			feedbackItems = result.items.map((r) => ({
				id: r.id,
				editionId: r.editionId,
				reviewerId: r.reviewerId,
				reviewStage: r.reviewStage,
				category: r.category as FeedbackCategory,
				targetLabel: r.targetLabel || null,
				comment: r.comment,
				resolved: r.resolved || false,
				created: r.created,
				updated: r.updated
			}));

			// Build user lookup if not provided
			if (!userLookup) {
				const reviewerIds = [...new Set(feedbackItems.map((f) => f.reviewerId))];
				if (reviewerIds.length > 0) {
					const userResult = await pb.collection('userProfiles').getList(1, 100, {
						filter: reviewerIds.map((id) => `id = "${id}"`).join(' || ')
					});
					localUserLookup = new Map(
						userResult.items.map((u) => [u.id, u.nickname || u.email || 'Unknown'])
					);
				}
			}
		} catch (error) {
			console.error('Error loading feedback:', error);
		} finally {
			isLoading = false;
		}
	}

	function getReviewerName(reviewerId: string, stage: number): string {
		if (!isAnonymized || stage === ReviewStage.Final) {
			return displayLookup.get(reviewerId) || 'Unknown Reviewer';
		}
		// For anonymized alpha-stage feedback, use a numbered label
		const uniqueReviewers = [...new Set(feedbackItems.map((f) => f.reviewerId))].sort();
		const idx = uniqueReviewers.indexOf(reviewerId);
		return idx >= 0 ? `Reviewer ${idx + 1}` : 'Reviewer';
	}

	async function toggleResolved(item: ReviewFeedback) {
		try {
			const newResolved = !item.resolved;
			await pb.collection('reviewFeedback').update(item.id, { resolved: newResolved });
			item.resolved = newResolved;
			feedbackItems = [...feedbackItems];

			if (newResolved) {
				await logAudit('feedback_resolved', 'edition', editionId, authStore.user?.email || '', {
					feedbackId: item.id
				});
			}

			toast.success(newResolved ? 'Marked as resolved' : 'Marked as unresolved');
		} catch (error) {
			console.error('Error toggling resolved:', error);
			toast.error('Failed to update feedback');
		}
	}

	function getCategoryBadge(category: FeedbackCategory): string {
		switch (category) {
			case FeedbackCategory.General:
				return 'badge-ghost';
			case FeedbackCategory.Annotation:
				return 'badge-info';
			case FeedbackCategory.Article:
				return 'badge-accent';
			default:
				return 'badge-ghost';
		}
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div id="review-feedback-list">
	{#if isLoading}
		<div class="flex items-center justify-center py-4">
			<span class="loading loading-sm loading-spinner"></span>
		</div>
	{:else if feedbackItems.length === 0}
		<p class="py-2 text-sm text-base-content/60">No feedback items yet.</p>
	{:else}
		<div class="space-y-2">
			{#each feedbackItems as item (item.id)}
				<div
					class="rounded-lg border p-3 {item.resolved
						? 'border-base-200 bg-base-200/50'
						: 'border-base-300'}"
				>
					<div class="flex flex-wrap items-center gap-2">
						<span class="badge badge-sm {getCategoryBadge(item.category)} capitalize">
							{item.category}
						</span>
						{#if item.targetLabel}
							<span class="text-xs font-medium text-base-content/60">
								{item.targetLabel}
							</span>
						{/if}
						<span class="ml-auto text-xs text-base-content/40">
							{getReviewerName(item.reviewerId, item.reviewStage)} - {formatDate(item.created)}
						</span>
					</div>
					<p class="mt-1 text-sm {item.resolved ? 'text-base-content/40 line-through' : ''}">
						{item.comment}
					</p>
					{#if canResolve}
						<div class="mt-2">
							<label class="label cursor-pointer justify-start gap-2">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={item.resolved}
									onchange={() => toggleResolved(item)}
								/>
								<span class="label-text text-xs">
									{item.resolved ? 'Resolved' : 'Mark as resolved'}
								</span>
							</label>
						</div>
					{:else if item.resolved}
						<span class="mt-1 badge inline-block badge-sm badge-success">Resolved</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
