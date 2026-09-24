<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { RECOMMENDATIONS, type FinalFeedback } from '$lib/workflow/final';
	import { VALUE_RATINGS } from '$lib/workflow/alpha';
	let { editionId, publicView = false }: { editionId: string; publicView?: boolean } = $props();
	let progress = $state<{
		total?: number;
		submitted?: number;
		released?: boolean;
		decision?: string;
		feedback: FinalFeedback[];
	}>();
	let error = $state(''),
		loading = $state(false);
	async function load() {
		loading = true;
		error = '';
		try {
			progress = await pb.send(
				`/api/pure3d/editions/${editionId}/${publicView ? 'public-reviews' : 'final-progress'}`,
				{ method: 'GET' }
			);
		} catch {
			error = 'Could not load Final Review feedback.';
		} finally {
			loading = false;
		}
	}
	onMount(() => {
		void load();
	});
</script>

<section id="final-review-progress" class="space-y-4 rounded-box border border-base-300 p-4">
	<h2 class="text-lg font-semibold">
		{publicView ? 'Published peer reviews' : 'Final Review progress and feedback'}
	</h2>
	{#if !publicView && progress}<p class="text-sm">
			{progress.submitted}/{progress.total} reviews submitted. {progress.released
				? 'The editors have released the feedback.'
				: 'At least two active reviewers must submit before the editorial decision.'}
		</p>
		{#if progress.decision}<p class="text-sm whitespace-pre-wrap">
				<strong>Editorial decision:</strong>
				{progress.decision}
			</p>{/if}{/if}
	{#each progress?.feedback || [] as feedback, index (`${feedback.round}-${index}`)}<details
			class="rounded-box border border-base-300 p-4"
			open
		>
			<summary class="cursor-pointer font-semibold"
				>{feedback.reviewer} · Round {feedback.round}</summary
			>
			<dl class="mt-3 space-y-3 text-sm">
				{#each [['Value rating', VALUE_RATINGS[feedback.valueRating - 1]], ['Value explanation', feedback.valueExplanation], ['User experience', feedback.experienceComments], ['Alpha changes rating', VALUE_RATINGS[feedback.changesRating - 1]], ['Alpha changes explanation', feedback.changesExplanation], ['Publication recommendation', RECOMMENDATIONS[feedback.recommendation as keyof typeof RECOMMENDATIONS]], ['Further comments', feedback.comments]] as [label, text] (label)}<div
					>
						<dt class="font-semibold">{label}</dt>
						<dd class="break-words whitespace-pre-wrap">{text || 'No additional comments.'}</dd>
					</div>{/each}
			</dl>
		</details>{/each}
	{#if progress && !progress.feedback.length}<p class="text-sm text-base-content/70">
			No released Final Reviews yet.
		</p>{/if}
	{#if error}<p role="alert" class="text-sm text-error">{error}</p>{/if}
	<button type="button" class="btn btn-outline btn-sm" disabled={loading} onclick={load}
		>{loading ? 'Loading…' : 'Refresh reviews'}</button
	>
</section>
