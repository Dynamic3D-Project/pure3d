<script lang="ts">
	import { EditionStatus, STATUS_LABELS } from '$lib/types/roles';

	let {
		currentStatus,
		hrefForStatus,
		onselectStatus
	}: {
		currentStatus: EditionStatus;
		hrefForStatus?: (status: EditionStatus) => string | null | undefined;
		onselectStatus?: (status: EditionStatus, event: MouseEvent) => void;
	} = $props();

	const workflowStages: { label: string; statuses: EditionStatus[]; hrefStatus: EditionStatus }[] =
		[
			{ label: 'Proposal', statuses: [EditionStatus.Draft], hrefStatus: EditionStatus.Draft },
			{
				label: 'Proposal review',
				statuses: [
					EditionStatus.ConceptSubmitted,
					EditionStatus.EditorialReview,
					EditionStatus.ConceptAccepted,
					EditionStatus.ConceptRejected
				],
				hrefStatus: EditionStatus.ConceptSubmitted
			},
			{
				label: 'Alpha Review',
				statuses: [
					EditionStatus.AlphaReview,
					EditionStatus.AlphaAccepted,
					EditionStatus.AlphaRevisions,
					EditionStatus.AlphaRejected
				],
				hrefStatus: EditionStatus.AlphaReview
			},
			{
				label: 'Final Review',
				statuses: [EditionStatus.FinalReview, EditionStatus.FinalRevisions],
				hrefStatus: EditionStatus.FinalReview
			},
			{
				label: 'Published',
				statuses: [EditionStatus.Published],
				hrefStatus: EditionStatus.Published
			}
		];

	const currentStageIndex = $derived.by(() => {
		const index = workflowStages.findIndex((stage) => stage.statuses.includes(currentStatus));
		return index === -1 ? 0 : index;
	});

	function getStageState(stageIndex: number): 'completed' | 'current' | 'future' {
		if (stageIndex < currentStageIndex) return 'completed';
		if (stageIndex === currentStageIndex) return 'current';
		return 'future';
	}

	function getStageHref(status: EditionStatus): string | null {
		return hrefForStatus?.(status) || null;
	}

	function handleStageClick(status: EditionStatus, event: MouseEvent) {
		onselectStatus?.(status, event);
	}
</script>

<div id="workflow-timeline" class="w-full">
	<!-- Main timeline -->
	<div class="flex items-center gap-0">
		{#each workflowStages as stage, i (stage.label)}
			{@const state = getStageState(i)}
			{@const href = getStageHref(stage.hrefStatus)}
			{#if i > 0}
				<div
					class="h-0.5 flex-1"
					class:bg-success={state === 'completed' || state === 'current'}
					class:bg-base-300={state === 'future'}
				></div>
			{/if}
			<svelte:element
				this={href ? 'a' : 'button'}
				href={href || undefined}
				type={href ? undefined : 'button'}
				role={href ? 'link' : 'button'}
				onclick={(event: MouseEvent) => handleStageClick(stage.hrefStatus, event)}
				class="group flex flex-col items-center gap-1 rounded-md border-0 bg-transparent p-0 text-inherit focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
				class:cursor-pointer={!!href}
				title={href ? `Open ${stage.label}` : undefined}
				aria-label={href ? `Open ${stage.label} workflow step` : undefined}
			>
				<div
					class="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] transition-transform {href
						? 'group-hover:scale-110'
						: ''} {state === 'completed'
						? 'bg-success text-success-content'
						: state === 'current'
							? 'bg-primary font-semibold text-primary-content'
							: 'bg-base-300 text-base-content/40'}"
				>
					{#if state === 'completed'}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="2"
							stroke="currentColor"
							class="size-3.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
						</svg>
					{:else}
						{i + 1}
					{/if}
				</div>
				<span
					class="max-w-24 text-center text-[11px] {href ? 'group-hover:underline' : ''} {state ===
					'current'
						? 'font-semibold'
						: 'text-base-content/60'} {state === 'future' ? 'text-base-content/40' : ''}"
				>
					{stage.label}
				</span>
			</svelte:element>
		{/each}
	</div>

	{#if STATUS_LABELS[currentStatus] !== workflowStages[currentStageIndex]?.label}
		<div class="mt-3 flex items-center gap-2">
			<span class="badge badge-sm badge-warning">{STATUS_LABELS[currentStatus]}</span>
			<span class="text-xs text-base-content/60">
				{#if currentStatus === EditionStatus.ConceptRejected}
					Proposal was rejected. Author can revise and resubmit.
				{:else if currentStatus === EditionStatus.ConceptSubmitted}
					Proposal has been submitted and is awaiting editorial review.
				{:else if currentStatus === EditionStatus.EditorialReview}
					Proposal is under editorial review.
				{:else if currentStatus === EditionStatus.ConceptAccepted}
					Proposal was accepted and is ready for alpha review.
				{:else if currentStatus === EditionStatus.AlphaRejected}
					Alpha review rejected. Author can revise and resubmit from draft.
				{:else if currentStatus === EditionStatus.AlphaRevisions}
					Revisions requested. Author can edit and resubmit.
				{:else if currentStatus === EditionStatus.AlphaAccepted}
					Alpha review approved and is ready for final review.
				{:else if currentStatus === EditionStatus.FinalRevisions}
					Final revisions requested. Author can edit and resubmit.
				{/if}
			</span>
		</div>
	{/if}
</div>
