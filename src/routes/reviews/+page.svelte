<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import toast from 'svelte-french-toast';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { EditionStatus, STATUS_LABELS } from '$lib/types/roles';
	import type { ReviewAssignment, EditionReview } from '$lib/types/reviews';
	import { ReviewDecision } from '$lib/types/reviews';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import WorkflowTimeline from '$lib/components/workflow/WorkflowTimeline.svelte';
	import { getEditionThumbnailUrl } from '$lib/utils/asset-urls';

	interface DashEdition {
		id: string;
		title: string;
		status: EditionStatus;
		collectionTitle: string;
		thumbnail: string;
		created: string;
	}

	let activeTab = $state<'reviews' | 'editions'>('editions');
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
					const col = r.expand?.collection;
					const collectionPubNum = col?.pubNum || 0;
					const editionPubNum = r.pubNum || 0;
					const thumbnail =
						r.thumbnail ||
						(collectionPubNum > 0 && editionPubNum > 0
							? getEditionThumbnailUrl(collectionPubNum, editionPubNum)
							: '');
					editionMap.set(r.id, {
						id: r.id,
						title: r.dcTitle || r.title,
						status: (r.status as EditionStatus) || EditionStatus.Draft,
						collectionTitle: col?.title || '',
						thumbnail,
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
		if (!dateStr) return '';
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	let deletingId = $state<string | null>(null);

	async function deleteDraft(edition: DashEdition) {
		if (edition.status !== EditionStatus.Draft) return;
		const confirmed = confirm(`Delete draft "${edition.title}"? This cannot be undone.`);
		if (!confirmed) return;

		deletingId = edition.id;
		try {
			await pb.collection('editions').delete(edition.id);
			myEditions = myEditions.filter((e) => e.id !== edition.id);
			toast.success(`Deleted "${edition.title}"`);
		} catch (err) {
			console.error('Delete failed:', err);
			toast.error((err as Error).message || 'Failed to delete edition');
		} finally {
			deletingId = null;
		}
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

	function workflowStepHref(editionId: string, status: EditionStatus): string {
		const workflowPath = `${base}/editions/${editionId}/workflow`;

		switch (status) {
			case EditionStatus.Draft:
			case EditionStatus.ConceptSubmitted:
			case EditionStatus.EditorialReview:
			case EditionStatus.ConceptAccepted:
			case EditionStatus.ConceptRejected:
				return `${workflowPath}#concept`;
			case EditionStatus.AlphaReview:
			case EditionStatus.AlphaRevisions:
			case EditionStatus.AlphaAccepted:
			case EditionStatus.AlphaRejected:
				return `${workflowPath}#alpha`;
			case EditionStatus.FinalReview:
			case EditionStatus.FinalRevisions:
				return `${workflowPath}#final`;
			case EditionStatus.Published:
				return `${workflowPath}#published`;
			default:
				return workflowPath;
		}
	}
</script>

<div id="reviews-dashboard" class="mx-auto max-w-4xl p-4 lg:p-8">
	<div class="mb-6">
		<h1 class="text-2xl font-bold">My Work</h1>
		<p class="mt-1 text-base-content/60">Your authored editions and review assignments.</p>
	</div>

	<!-- Tabs -->
	<div class="tabs-bordered mb-6 tabs">
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
							<div class="flex gap-4">
								{#if edition.thumbnail}
									<img
										src={edition.thumbnail}
										alt={edition.title}
										class="size-16 shrink-0 rounded-lg object-cover"
									/>
								{:else}
									<div
										class="flex size-16 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base-content/30"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
											class="size-6"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
											/>
										</svg>
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center justify-between gap-3">
										<div class="flex flex-wrap items-center gap-3">
											<span class="font-medium">{edition.title}</span>
											<StatusBadge status={edition.status} />
										</div>
										<div class="flex items-center gap-2">
											{#if edition.status === EditionStatus.Draft}
												<button
													type="button"
													class="btn text-error btn-ghost btn-sm"
													disabled={deletingId === edition.id}
													onclick={() => deleteDraft(edition)}
													aria-label="Delete draft"
												>
													{deletingId === edition.id ? 'Deleting…' : 'Delete'}
												</button>
											{/if}
											<a href="{base}/editions/{edition.id}/workflow" class="btn btn-ghost btn-sm">
												View Workflow
											</a>
										</div>
									</div>
									{#if edition.collectionTitle}
										<p class="mt-1 text-sm text-base-content/50">in {edition.collectionTitle}</p>
									{/if}
								</div>
							</div>
							<div class="mt-3">
								<WorkflowTimeline
									currentStatus={edition.status}
									hrefForStatus={(status) => workflowStepHref(edition.id, status)}
								/>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>
