<script lang="ts">
	import { onMount } from 'svelte';
	import type { RecordModel } from 'pocketbase';
	import { pb } from '$lib/database/client';
	import { RECOMMENDATIONS } from '$lib/workflow/final';
	let {
		editionId,
		status,
		round,
		onchanged
	}: { editionId: string; status: string; round: number; onchanged: () => void } = $props();
	let reviews = $state<RecordModel[]>([]),
		assignments = $state<RecordModel[]>([]);
	let busy = $state(false),
		error = $state(''),
		comment = $state(''),
		dueAt = $state('');
	let authorStatement = $state<Record<string, unknown>>({});
	async function load() {
		busy = true;
		error = '';
		try {
			const filter = pb.filter(
				'editionId = {:editionId} && reviewStage = 3 && reviewRound = {:round}',
				{ editionId, round }
			);
			const [a, r, edition] = await Promise.all([
				pb
					.collection('reviewAssignments')
					.getFullList({ filter: filter + ' && status != "declined"', expand: 'reviewerId' }),
				pb
					.collection('editionReviews')
					.getFullList({ filter: filter + ' && reviewStatus = "submitted"', expand: 'reviewerId' }),
				pb.collection('editions').getOne(editionId)
			]);
			assignments = a;
			reviews = r.filter((review) =>
				a.some((assignment) => assignment.reviewerId === review.reviewerId)
			);
			authorStatement = edition.publicationRequest || {};
		} catch {
			error = 'Could not load editorial review data.';
		} finally {
			busy = false;
		}
	}
	onMount(() => {
		void load();
	});
	async function invite() {
		if (!dueAt) {
			error = 'Choose a review deadline.';
			return;
		}
		busy = true;
		try {
			await pb.send(`/api/pure3d/editions/${editionId}/final-invitations`, {
				method: 'POST',
				body: { dueAt: new Date(dueAt + 'T23:59:59').toISOString() }
			});
			await load();
			onchanged();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not invite reviewers.';
		} finally {
			busy = false;
		}
	}
	async function decide(decision: string) {
		if (!comment.trim()) {
			error = 'Add an editorial explanation first.';
			return;
		}
		if (
			!confirm(
				`Confirm editorial action: ${decision}? This changes the edition workflow and notifies participants.`
			)
		)
			return;
		busy = true;
		try {
			await pb.send(`/api/pure3d/editions/${editionId}/final-decision`, {
				method: 'POST',
				body: { decision, comment }
			});
			onchanged();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not record the decision.';
		} finally {
			busy = false;
		}
	}
</script>

<section id="final-editorial-panel" class="space-y-4 rounded-box border border-base-300 p-4">
	<h2 class="text-lg font-semibold">
		{status === 'publication_requested'
			? 'Publication decision'
			: 'Final Review editorial decision'}
	</h2>
	{#if status === 'final_review'}
		<p class="text-sm">
			{reviews.length}/{assignments.length} reviews submitted. At least two independent reviewers are
			required. Reuse the Alpha reviewers unless an explicit replacement is needed.
		</p>
		<div class="flex flex-wrap items-end gap-3">
			<label class="text-sm" for="final-due-at"
				>Review deadline<input
					id="final-due-at"
					type="date"
					class="input-bordered input block"
					bind:value={dueAt}
				/></label
			><button type="button" class="btn btn-outline btn-sm" disabled={busy} onclick={invite}
				>Invite Alpha reviewers</button
			>
		</div>
		{#each assignments as assignment (assignment.id)}<p class="text-sm">
				{assignment.expand?.reviewerId?.nickname || 'Reviewer'} · {assignment.status}{assignment.dueAt
					? ` · Due ${new Date(assignment.dueAt).toLocaleDateString()}`
					: ''}
			</p>{/each}
		{#each reviews as review (review.id)}<details class="rounded-box border border-base-300 p-3">
				<summary class="cursor-pointer font-semibold"
					>{review.expand?.reviewerId?.nickname || 'Reviewer'} — {RECOMMENDATIONS[
						review.finalAnswers?.recommendation as keyof typeof RECOMMENDATIONS
					] || 'Legacy review'}</summary
				>
				<dl class="mt-3 space-y-3 text-sm">
					{#each Object.entries(review.finalAnswers || {}) as [key, value] (key)}<div>
							<dt class="font-semibold">{key}</dt>
							<dd class="whitespace-pre-wrap">{String(value)}</dd>
						</div>{/each}
				</dl>
			</details>{/each}
	{:else}<p class="text-sm whitespace-pre-wrap">
			<strong>Author statement:</strong>
			{String(authorStatement.comment || 'No additional comments.')}
		</p>
		<p class="text-sm">
			Rights declaration: {authorStatement.rightsConfirmed
				? 'Confirmed by author'
				: 'Not confirmed'}
		</p>
		<p class="text-sm">
			Publishing makes the edition and released Final Reviews public. Alpha feedback remains
			private.
		</p>{/if}
	<label for="final-editor-decision" class="block text-sm"
		>Editorial explanation (required, maximum 500 words)<textarea
			id="final-editor-decision"
			class="textarea-bordered textarea mt-2 w-full"
			rows="3"
			bind:value={comment}
		></textarea></label
	>
	<div class="flex flex-wrap gap-3">
		{#if status === 'final_review'}<button
				type="button"
				class="btn btn-sm btn-primary"
				disabled={busy || assignments.length < 2 || reviews.length !== assignments.length}
				onclick={() => decide('accept')}>Release feedback & complete Final Review</button
			><button
				type="button"
				class="btn btn-outline btn-sm"
				disabled={busy || assignments.length < 2 || reviews.length !== assignments.length}
				onclick={() => decide('revisions')}>Release feedback & request another round</button
			>{:else}<button
				type="button"
				class="btn btn-primary"
				disabled={busy}
				onclick={() => decide('publish')}>Publish edition</button
			><button
				type="button"
				class="btn btn-outline"
				disabled={busy}
				onclick={() => decide('return')}>Return for final corrections</button
			>{/if}<button type="button" class="btn btn-outline btn-sm" disabled={busy} onclick={load}
			>Refresh</button
		>
	</div>
	{#if error}<p role="alert" class="text-sm text-error">{error}</p>{/if}
</section>
