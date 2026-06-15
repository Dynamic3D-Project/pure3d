<script lang="ts">
	import { EditionStatus, STATUS_LABELS } from '$lib/types/roles';

	let {
		currentStatus,
		hrefForStatus
	}: {
		currentStatus: EditionStatus;
		hrefForStatus?: (status: EditionStatus) => string | null | undefined;
	} = $props();

	// Main pipeline path
	const mainStages: { status: EditionStatus; label: string }[] = [
		{ status: EditionStatus.Draft, label: 'Draft' },
		{ status: EditionStatus.ConceptSubmitted, label: 'Concept' },
		{ status: EditionStatus.EditorialReview, label: 'Editorial' },
		{ status: EditionStatus.ConceptAccepted, label: 'Accepted' },
		{ status: EditionStatus.AlphaReview, label: 'Alpha' },
		{ status: EditionStatus.AlphaAccepted, label: 'Approved' },
		{ status: EditionStatus.FinalReview, label: 'Final' },
		{ status: EditionStatus.Published, label: 'Published' }
	];

	// Branch statuses that sit off the main path
	const branchStatuses: EditionStatus[] = [
		EditionStatus.ConceptRejected,
		EditionStatus.AlphaRejected,
		EditionStatus.AlphaRevisions,
		EditionStatus.FinalRevisions
	];

	// Ordered status index for determining completed/current/future
	const statusOrder: EditionStatus[] = [
		EditionStatus.Draft,
		EditionStatus.ConceptSubmitted,
		EditionStatus.EditorialReview,
		EditionStatus.ConceptAccepted,
		EditionStatus.AlphaReview,
		EditionStatus.AlphaAccepted,
		EditionStatus.FinalReview,
		EditionStatus.Published
	];

	function getStageState(
		stageStatus: EditionStatus
	): 'completed' | 'current' | 'future' | 'branch' {
		// If current status is a branch status, map it to the main path equivalent
		const effectiveStatus = mapBranchToMain(currentStatus);
		const currentIdx = statusOrder.indexOf(effectiveStatus);
		const stageIdx = statusOrder.indexOf(stageStatus);

		if (stageIdx < currentIdx) return 'completed';
		if (stageIdx === currentIdx) return 'current';
		return 'future';
	}

	function mapBranchToMain(status: EditionStatus): EditionStatus {
		switch (status) {
			case EditionStatus.ConceptRejected:
				return EditionStatus.EditorialReview;
			case EditionStatus.AlphaRejected:
			case EditionStatus.AlphaRevisions:
				return EditionStatus.AlphaReview;
			case EditionStatus.FinalRevisions:
				return EditionStatus.FinalReview;
			default:
				return status;
		}
	}

	const isBranch = $derived(branchStatuses.includes(currentStatus));

	function getStageHref(status: EditionStatus): string | null {
		return hrefForStatus?.(status) || null;
	}
</script>

<div id="workflow-timeline" class="w-full">
	<!-- Main timeline -->
	<div class="flex items-center gap-0">
		{#each mainStages as stage, i (stage.status)}
			{@const state = getStageState(stage.status)}
			{@const href = getStageHref(stage.status)}
			{#if i > 0}
				<div
					class="h-0.5 flex-1"
					class:bg-success={state === 'completed' || state === 'current'}
					class:bg-base-300={state === 'future'}
				></div>
			{/if}
			<svelte:element
				this={href ? 'a' : 'div'}
				href={href || undefined}
				class="group flex flex-col items-center gap-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
					class="max-w-16 text-center text-[11px] {href ? 'group-hover:underline' : ''} {state ===
					'current'
						? 'font-semibold'
						: 'text-base-content/60'} {state === 'future' ? 'text-base-content/40' : ''}"
				>
					{stage.label}
				</span>
			</svelte:element>
		{/each}
	</div>

	<!-- Branch status indicator -->
	{#if isBranch}
		<div class="mt-3 flex items-center gap-2">
			<span class="badge badge-sm badge-warning">{STATUS_LABELS[currentStatus]}</span>
			<span class="text-xs text-base-content/60">
				{#if currentStatus === EditionStatus.ConceptRejected}
					Concept was rejected. Author can revise and resubmit.
				{:else if currentStatus === EditionStatus.AlphaRejected}
					Alpha review rejected. Author can revise and resubmit from draft.
				{:else if currentStatus === EditionStatus.AlphaRevisions}
					Revisions requested. Author can edit and resubmit.
				{:else if currentStatus === EditionStatus.FinalRevisions}
					Final revisions requested. Author can edit and resubmit.
				{/if}
			</span>
		</div>
	{/if}
</div>
