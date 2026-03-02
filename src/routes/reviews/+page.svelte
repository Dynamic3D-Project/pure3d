<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { EditionStatus, STATUS_LABELS } from '$lib/types/roles';
	import type { ReviewAssignment, EditionReview } from '$lib/types/reviews';
	import { ReviewDecision } from '$lib/types/reviews';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import WorkflowTimeline from '$lib/components/workflow/WorkflowTimeline.svelte';

	interface DashEdition {
		id: string;
		title: string;
		status: EditionStatus;
		collectionTitle: string;
		created: string;
	}

	let activeTab = $state<'reviews' | 'editions'>('reviews');
	let isLoading = $state(true);

	// My Reviews data
	let myAssignments = $state<(ReviewAssignment & { edition?: DashEdition })[]>([]);
	let myReviews = $state<EditionReview[]>([]);

	// My Editions data
	let myEditions = $state<DashEdition[]>([]);

	let pendingAssignments = $derived(
		myAssignments.filter((a) => {
			const hasReview = myReviews.some(
				(r) => r.editionId === a.editionId && r.reviewStage === a.reviewStage
			);
			return !hasReview;
		})
	);

	let completedAssignments = $derived(
		myAssignments.filter((a) => {
			return myReviews.some((r) => r.editionId === a.editionId && r.reviewStage === a.reviewStage);
		})
	);

	onMount(async () => {
		if (!authStore.isAuthenticated || !authStore.appUserId) {
			goto(`${base}/`);
			return;
		}
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		const userId = authStore.appUserId!;

		try {
			// Load reviewer assignments for this user
			const [assignResult, reviewResult, edUserResult] = await Promise.all([
				pb.collection('reviewAssignments').getList(1, 500, {
					filter: `reviewerId = "${userId}"`,
					sort: '-created'
				}),
				pb.collection('editionReviews').getList(1, 500, {
					filter: `reviewerId = "${userId}"`,
					sort: '-created'
				}),
				pb.collection('editionUsers').getList(1, 500, {
					filter: `userId = "${userId}" && role = "author"`
				})
			]);

			myReviews = reviewResult.items.map((r) => ({
				id: r.id,
				editionId: r.editionId,
				reviewerId: r.reviewerId,
				reviewStage: r.reviewStage,
				decision: r.decision as ReviewDecision,
				comment: r.comment || null,
				created: r.created,
				updated: r.updated
			}));

			// Collect all edition IDs we need
			const assignmentEditionIds = assignResult.items.map((r) => r.editionId);
			const authorEditionIds = edUserResult.items.map((r) => r.editionId);
			const allEditionIds = [...new Set([...assignmentEditionIds, ...authorEditionIds])];

			// Load edition details
			const editionMap = new Map<string, DashEdition>();
			if (allEditionIds.length > 0) {
				const edResult = await pb.collection('editions').getList(1, 500, {
					filter: allEditionIds.map((id) => `id = "${id}"`).join(' || '),
					expand: 'collection'
				});
				for (const r of edResult.items) {
					editionMap.set(r.id, {
						id: r.id,
						title: r.dcTitle || r.title,
						status: (r.status as EditionStatus) || EditionStatus.Draft,
						collectionTitle: r.expand?.collection?.title || '',
						created: r.created
					});
				}
			}

			myAssignments = assignResult.items.map((r) => ({
				id: r.id,
				editionId: r.editionId,
				reviewerId: r.reviewerId,
				reviewStage: r.reviewStage,
				assignedBy: r.assignedBy,
				status: r.status,
				created: r.created,
				updated: r.updated,
				edition: editionMap.get(r.editionId)
			}));

			myEditions = authorEditionIds
				.map((id) => editionMap.get(id))
				.filter((e): e is DashEdition => !!e);
		} catch (error) {
			console.error('Error loading dashboard data:', error);
		} finally {
			isLoading = false;
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getStageLabel(stage: number): string {
		switch (stage) {
			case 1:
				return 'Concept';
			case 2:
				return 'Alpha';
			case 3:
				return 'Final';
			default:
				return `Stage ${stage}`;
		}
	}
</script>

<div id="reviews-dashboard" class="mx-auto max-w-4xl p-4 lg:p-8">
	<div class="mb-6">
		<h1 class="text-2xl font-bold">My Work</h1>
		<p class="mt-1 text-base-content/60">Your review assignments and authored editions.</p>
	</div>

	<!-- Tabs -->
	<div class="tabs-bordered mb-6 tabs">
		<button
			class="tab"
			class:tab-active={activeTab === 'reviews'}
			onclick={() => (activeTab = 'reviews')}
		>
			My Reviews
			{#if pendingAssignments.length > 0}
				<span class="ml-1 badge badge-sm badge-primary">{pendingAssignments.length}</span>
			{/if}
		</button>
		<button
			class="tab"
			class:tab-active={activeTab === 'editions'}
			onclick={() => (activeTab = 'editions')}
		>
			My Editions
			{#if myEditions.length > 0}
				<span class="ml-1 badge badge-sm">{myEditions.length}</span>
			{/if}
		</button>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else}
		<!-- My Reviews Tab -->
		{#if activeTab === 'reviews'}
			{#if pendingAssignments.length > 0}
				<h2 class="mb-3 text-lg font-semibold">Pending Reviews</h2>
				<div class="mb-6 space-y-2">
					{#each pendingAssignments as assignment (assignment.id)}
						{@const edition = assignment.edition}
						<div class="rounded-box border border-base-300 bg-base-100 p-4">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="flex flex-wrap items-center gap-3">
									<span class="font-medium">{edition?.title || 'Unknown Edition'}</span>
									{#if edition}
										<StatusBadge status={edition.status} />
									{/if}
									<span class="badge badge-ghost badge-sm">
										{getStageLabel(assignment.reviewStage)}
									</span>
								</div>
								<a
									href="{base}/editions/{assignment.editionId}/workflow"
									class="btn btn-sm btn-primary"
								>
									Start Review
								</a>
							</div>
							{#if edition?.collectionTitle}
								<p class="mt-1 text-sm text-base-content/50">in {edition.collectionTitle}</p>
							{/if}
							<p class="mt-1 text-xs text-base-content/40">
								Assigned {formatDate(assignment.created)}
							</p>
						</div>
					{/each}
				</div>
			{/if}

			{#if completedAssignments.length > 0}
				<h2 class="mb-3 text-lg font-semibold">Completed Reviews</h2>
				<div class="space-y-2">
					{#each completedAssignments as assignment (assignment.id)}
						{@const edition = assignment.edition}
						{@const review = myReviews.find(
							(r) =>
								r.editionId === assignment.editionId && r.reviewStage === assignment.reviewStage
						)}
						<div class="rounded-box border border-base-200 bg-base-200/30 p-4">
							<div class="flex flex-wrap items-center gap-3">
								<span class="font-medium">{edition?.title || 'Unknown Edition'}</span>
								{#if edition}
									<StatusBadge status={edition.status} />
								{/if}
								<span class="badge badge-ghost badge-sm">
									{getStageLabel(assignment.reviewStage)}
								</span>
								{#if review}
									<span
										class="badge badge-sm {review.decision === ReviewDecision.Approve
											? 'badge-success'
											: review.decision === ReviewDecision.Reject
												? 'badge-error'
												: 'badge-warning'}"
									>
										{review.decision === ReviewDecision.Approve
											? 'Approved'
											: review.decision === ReviewDecision.Reject
												? 'Rejected'
												: 'Revisions'}
									</span>
								{/if}
							</div>
							<p class="mt-1 text-xs text-base-content/40">
								Reviewed {review ? formatDate(review.created) : ''}
							</p>
						</div>
					{/each}
				</div>
			{/if}

			{#if myAssignments.length === 0}
				<p class="py-8 text-center text-base-content/60">No review assignments yet.</p>
			{/if}
		{/if}

		<!-- My Editions Tab -->
		{#if activeTab === 'editions'}
			{#if myEditions.length === 0}
				<p class="py-8 text-center text-base-content/60">
					You are not listed as an author on any editions.
				</p>
			{:else}
				<div class="space-y-3">
					{#each myEditions as edition (edition.id)}
						<div class="rounded-box border border-base-300 bg-base-100 p-4">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="flex flex-wrap items-center gap-3">
									<span class="font-medium">{edition.title}</span>
									<StatusBadge status={edition.status} />
								</div>
								<a href="{base}/editions/{edition.id}/workflow" class="btn btn-ghost btn-sm">
									View Workflow
								</a>
							</div>
							{#if edition.collectionTitle}
								<p class="mt-1 text-sm text-base-content/50">in {edition.collectionTitle}</p>
							{/if}
							<div class="mt-3">
								<WorkflowTimeline currentStatus={edition.status} />
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>
