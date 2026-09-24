<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { VALUE_RATINGS, type AlphaProgress } from '$lib/workflow/alpha';
	let { editionId, open = false }: { editionId: string; open?: boolean } = $props();
	let progress = $state<AlphaProgress | null>(null);
	let error = $state('');
	let loading = $state(false);
	async function load() {
		if (loading) return;
		loading = true;
		error = '';
		try {
			progress = await pb.send(`/api/pure3d/editions/${editionId}/alpha-progress`, {
				method: 'GET'
			});
		} catch {
			error = 'Could not load review progress.';
		} finally {
			loading = false;
		}
	}
	onMount(() => {
		if (open) void load();
	});
</script>

<details
	id="alpha-review-progress"
	class="rounded-box border border-base-300 bg-base-100 p-4"
	{open}
	ontoggle={(event) => {
		if (event.currentTarget.open && !progress) void load();
	}}
>
	<summary class="cursor-pointer font-semibold"
		>Alpha Review progress{#if progress?.total}
			· {progress.submitted}/{progress.total} submitted{/if}</summary
	>
	<div class="mt-4 space-y-4">
		{#if progress}<p class="text-sm">
				{progress.released
					? 'Feedback has been released by the editors.'
					: !progress.total
						? 'Waiting for reviewer assignments.'
						: progress.submitted === progress.total
							? 'All reviews received. Awaiting the editorial decision.'
							: `${progress.submitted} of ${progress.total} reviews submitted. Feedback remains private until the editors release it.`}
			</p>{/if}
		{#if error}<p role="alert" class="text-sm text-error">{error}</p>{/if}
		<button type="button" class="btn btn-outline btn-sm" onclick={load} disabled={loading}
			>{loading ? 'Refreshing…' : 'Refresh progress'}</button
		>
		{#each progress?.feedback || [] as feedback, index (`${feedback.round}-${index}`)}
			<article class="space-y-3 rounded-box border border-base-300 p-4">
				<h3 class="font-semibold">{feedback.reviewer} · Round {feedback.round}</h3>
				<dl class="space-y-3 text-sm">
					{#each [['Technical comments', feedback.technicalComments], ['Value rating', VALUE_RATINGS[feedback.valueRating - 1] || 'Not rated'], ['Value explanation', feedback.valueExplanation], ['User experience', feedback.experienceComments], ['General comments', feedback.generalComments]] as [label, text] (label)}<div
						>
							<dt class="font-semibold">{label}</dt>
							<dd class="break-words whitespace-pre-wrap">{text || 'No additional comments.'}</dd>
						</div>{/each}
				</dl>
			</article>
		{/each}
	</div>
</details>
