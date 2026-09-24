<script lang="ts">
	import { onMount } from 'svelte';
	import type { RecordModel } from 'pocketbase';
	import { pb } from '$lib/database/client';
	import { VALUE_RATINGS } from '$lib/workflow/alpha';
	let { editionId, round, onchanged }: { editionId: string; round: number; onchanged: () => void } =
		$props();
	let reviews = $state<RecordModel[]>([]);
	let total = $state(0);
	let busy = $state(false);
	let error = $state('');
	onMount(() => {
		void load();
	});
	async function load() {
		if (busy) return;
		busy = true;
		error = '';
		try {
			const filter = pb.filter(
				'editionId = {:editionId} && reviewStage = 2 && reviewRound = {:round}',
				{ editionId, round }
			);
			const [assigned, submitted] = await Promise.all([
				pb
					.collection('reviewAssignments')
					.getFullList({ filter: filter + ' && status != "declined"' }),
				pb.collection('editionReviews').getFullList({
					filter: filter + ' && reviewStatus = "submitted"',
					expand: 'reviewerId',
					sort: 'created'
				})
			]);
			total = assigned.length;
			reviews = submitted.filter((review) =>
				assigned.some((assignment) => assignment.reviewerId === review.reviewerId)
			);
		} catch {
			error = 'Could not load Alpha reviews.';
		} finally {
			busy = false;
		}
	}
	async function decide(decision: 'accept' | 'revisions') {
		if (
			!confirm(
				`Release anonymous feedback and ${decision === 'accept' ? 'accept Alpha Review' : 'request revisions'}? Confidential recommendations will not be shared.`
			)
		)
			return;
		busy = true;
		error = '';
		try {
			await pb.send(`/api/pure3d/editions/${editionId}/alpha-decision`, {
				method: 'POST',
				body: { decision }
			});
			onchanged();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not release feedback.';
		} finally {
			busy = false;
		}
	}
</script>

<section id="alpha-editorial-panel" class="space-y-4 border-t border-base-300 pt-4">
	<h3 class="font-semibold">Alpha Review · Round {round}</h3>
	<button type="button" class="btn btn-outline btn-sm" disabled={busy} onclick={load}
		>Refresh reviews</button
	>
	<p class="text-sm">
		{reviews.length} of {total} active reviewers have submitted. Authors see no reviewer identities or
		confidential recommendations.
	</p>
	{#each reviews as review (review.id)}<details class="rounded-box border border-base-300 p-4">
			<summary class="cursor-pointer font-semibold"
				>{review.expand?.reviewerId?.nickname || 'Reviewer'} — {review.decision === 'approve'
					? 'Recommends passing Alpha'
					: 'Recommends another Alpha round'}</summary
			>
			<dl class="mt-4 space-y-3 text-sm">
				{#each [['Technical comments', review.technicalComments], ['Value rating', VALUE_RATINGS[review.valueRating - 1]], ['Value explanation', review.valueExplanation], ['User experience', review.experienceComments], ['General comments', review.generalComments], ['Confidential recommendation', review.recommendationExplanation], ['Interested in collaboration (no access granted)', review.collaborationInterest]] as [label, text] (label)}<div
					>
						<dt class="font-semibold">{label}</dt>
						<dd class="whitespace-pre-wrap">{text || 'Not provided'}</dd>
					</div>{/each}
			</dl>
		</details>{/each}
	<div class="flex flex-wrap gap-3">
		<button
			type="button"
			class="btn btn-sm btn-primary"
			disabled={busy || !total || reviews.length !== total}
			onclick={() => decide('accept')}>Release feedback & accept Alpha</button
		><button
			type="button"
			class="btn btn-outline btn-sm"
			disabled={busy || !total || reviews.length !== total}
			onclick={() => decide('revisions')}>Release feedback & request revisions</button
		>
	</div>
	{#if error}<p role="alert" class="text-sm text-error">{error}</p>{/if}
</section>
