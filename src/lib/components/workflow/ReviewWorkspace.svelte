<script lang="ts">
	import type { RecordModel } from 'pocketbase';
	import type { Credit } from '$lib/types/credits';
	import { ReviewStage } from '$lib/types/roles';
	import VoyagerPreview from '$lib/components/uploads/VoyagerPreview.svelte';
	import AlphaReviewForm from './AlphaReviewForm.svelte';
	import FinalReviewForm from './FinalReviewForm.svelte';
	let {
		edition,
		stage,
		reviewerId,
		credits,
		collectionPubNum,
		editionPubNum,
		onsubmitted
	}: {
		edition: RecordModel;
		stage: ReviewStage;
		reviewerId: string;
		credits: Credit[];
		collectionPubNum: number;
		editionPubNum: number;
		onsubmitted: () => void;
	} = $props();
	let expanded = $state(false);
</script>

<div
	id="review-workspace"
	class={expanded
		? 'mx-auto max-w-4xl'
		: 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]'}
>
	<div class:hidden={expanded} class="space-y-4 lg:sticky lg:top-24">
		<VoyagerPreview {edition} {collectionPubNum} {editionPubNum} title={edition.title} />
		<div class="rounded-box border border-base-300 p-4">
			<h2 class="font-semibold">{edition.title}</h2>
			<p class="mt-2 text-sm text-base-content/70">
				This edition is read-only during review. Use the review form to record your feedback.
			</p>
			<ul class="mt-2 text-sm">
				{#each credits as credit, index (index)}<li>{credit.name}</li>{/each}
			</ul>
		</div>
	</div>
	<section class="min-w-0 rounded-box border border-base-300 bg-base-100 p-4">
		<div class="mb-4 flex items-center justify-between border-b border-base-300 pb-3">
			<h2 class="font-semibold">Review</h2>
			<button
				type="button"
				class="btn btn-outline btn-sm"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
				>{expanded ? 'Show edition alongside' : 'Expand review form'}</button
			>
		</div>
		<div class={expanded ? '' : 'lg:max-h-[75dvh] lg:overflow-y-auto lg:pr-2'}>
			{#if stage === ReviewStage.Final}
				<FinalReviewForm
					editionId={edition.id}
					{reviewerId}
					round={edition.finalReviewRound || 0}
					context={edition.finalRequest}
					{onsubmitted}
				/>
			{:else}
				<AlphaReviewForm
					editionId={edition.id}
					{reviewerId}
					round={edition.alphaReviewRound || 0}
					context={edition.alphaRequest}
					{onsubmitted}
				/>
			{/if}
		</div>
	</section>
</div>
