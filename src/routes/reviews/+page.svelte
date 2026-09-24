<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import toast from 'svelte-french-toast';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { EditionStatus } from '$lib/types/roles';
	import type { ReviewAssignment, EditionReview } from '$lib/types/reviews';
	import { ReviewDecision, ReviewAssignmentStatus } from '$lib/types/reviews';
	import AlphaReviewProgress from '$lib/components/workflow/AlphaReviewProgress.svelte';
	import FinalReviewProgress from '$lib/components/workflow/FinalReviewProgress.svelte';
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
	let isCreating = $state(false);
	let createdDraftId = $state('');

	async function startProposal() {
		if (isCreating || !authStore.appUserId) return;
		isCreating = true;
		try {
			if (!createdDraftId) {
				const profile = await authStore.refreshSession();
				if (!profile.orcid || !profile.orcidVerifiedAt) {
					throw new Error(
						'An ORCID-verified account is required to start a proposal. Sign out of the demo account and sign in with ORCID.'
					);
				}
				const record = await pb.collection('editions').create({
					title: 'Untitled Proposal',
					dcTitle: 'Untitled Proposal',
					status: EditionStatus.Draft,
					isPublished: false,
					credits: [
						{
							type: 'person',
							name: profile.nickname || 'Author',
							orcid: profile.orcid || null,
							role: 'creator',
							provenance: profile.orcidVerifiedAt ? 'oauth' : 'manual',
							userId: profile.id
						}
					]
				});
				createdDraftId = record.id;
			}
			await goto(resolve('/editions/[slug]/workflow', { slug: createdDraftId }));
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Could not start your proposal. Please try again.'
			);
		} finally {
			isCreating = false;
		}
	}

	// My Reviews data
	let myAssignments = $state<(ReviewAssignment & { edition?: DashEdition })[]>([]);
	let myReviews = $state<EditionReview[]>([]);

	// My Editions data
	let myEditions = $state<DashEdition[]>([]);
	let decliningId = $state('');
	function matchingReview(assignment: ReviewAssignment) {
		return myReviews.find(
			(review) =>
				review.editionId === assignment.editionId &&
				review.reviewStage === assignment.reviewStage &&
				(review.reviewRound || 0) === (assignment.reviewRound || 0)
		);
	}

	let pendingAssignments = $derived(
		myAssignments.filter(
			(a) =>
				['pending', 'accepted'].includes(a.status) &&
				(!matchingReview(a) || matchingReview(a)?.reviewStatus === 'draft')
		)
	);

	let completedAssignments = $derived(
		myAssignments.filter(
			(a) =>
				a.status !== 'declined' &&
				(a.status === 'completed' ||
					(matchingReview(a) && matchingReview(a)?.reviewStatus !== 'draft'))
		)
	);
	async function decline(assignment: ReviewAssignment) {
		if (
			decliningId ||
			!confirm('Decline this review invitation? You will lose reviewer access to the edition.')
		)
			return;
		decliningId = assignment.id;
		try {
			await pb.collection('reviewAssignments').update(assignment.id, { status: 'declined' });
			myAssignments = myAssignments.map((item) =>
				item.id === assignment.id ? { ...item, status: ReviewAssignmentStatus.Declined } : item
			);
			toast.success('Review invitation declined');
		} catch {
			toast.error('Could not decline the invitation.');
		} finally {
			decliningId = '';
		}
	}

	onMount(async () => {
		if (!authStore.isAuthenticated || !authStore.appUserId) {
			goto(resolve('/'));
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
				reviewRound: r.reviewRound || 0,
				reviewStatus: r.reviewStatus,
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
			const editionMap = new SvelteMap<string, DashEdition>();
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
						r.thumbnail && collectionPubNum > 0 && editionPubNum > 0
							? getEditionThumbnailUrl(collectionPubNum, editionPubNum)
							: '';
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
				dueAt: r.dueAt || '',
				reviewRound: r.reviewRound || 0,
				editionTitle: r.editionTitle || '',
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
		const workflowPath = resolve('/editions/[slug]/workflow', { slug: editionId });

		switch (status) {
			case EditionStatus.Draft:
				return `${workflowPath}#proposal`;
			case EditionStatus.ConceptSubmitted:
			case EditionStatus.EditorialReview:
				return `${workflowPath}#proposal-summary`;
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
	<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">My Work</h1>
			<p class="mt-1 text-base-content/60">Your proposals, editions, and review assignments.</p>
		</div>
		<button type="button" class="btn btn-primary" onclick={startProposal} disabled={isCreating}>
			{#if isCreating}<span class="loading loading-xs loading-spinner"></span>{/if}
			{isCreating ? 'Starting proposal…' : 'Start a proposal'}
		</button>
	</div>

	<!-- Tabs -->
	<div class="tabs-bordered mb-6 tabs">
		<button
			class="tab"
			class:tab-active={activeTab === 'editions'}
			onclick={() => (activeTab = 'editions')}
		>
			My Proposals & Editions
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
									<span class="font-medium"
										>{edition?.title || assignment.editionTitle || 'Edition'}</span
									>
									{#if edition}
										<StatusBadge status={edition.status} />
									{/if}
									<span class="badge badge-ghost badge-sm">
										{getStageLabel(assignment.reviewStage)}
									</span>
								</div>
								<a
									href={resolve('/editions/[slug]/workflow', { slug: assignment.editionId })}
									class="btn btn-sm btn-primary"
								>
									{matchingReview(assignment)?.reviewStatus === 'draft'
										? 'Continue review'
										: 'Review edition'}
								</a>
								<button
									type="button"
									class="btn btn-outline btn-sm"
									disabled={decliningId === assignment.id}
									onclick={() => decline(assignment)}>Decline</button
								>
							</div>
							{#if assignment.dueAt}<p class="mt-2 text-sm">
									Review due: {formatDate(assignment.dueAt)}
								</p>{/if}
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
						{@const review = matchingReview(assignment)}
						<div class="rounded-box border border-base-200 bg-base-200/30 p-4">
							<div class="flex flex-wrap items-center gap-3">
								<span class="font-medium"
									>{edition?.title || assignment.editionTitle || 'Edition'}</span
								>
								{#if edition}
									<StatusBadge status={edition.status} />
								{/if}
								<span class="badge badge-ghost badge-sm">
									{getStageLabel(assignment.reviewStage)}
								</span>
								{#if assignment.reviewStage >= 2}<span class="badge badge-sm badge-success"
										>{assignment.reviewStage === 3 ? 'Final' : 'Alpha'} Review submitted</span
									>{:else if review}
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
							{#if assignment.reviewStage >= 2}<p class="mt-3 text-sm text-base-content/70">
									Your review is submitted and cannot be edited. Edition access is closed until you
									receive a new review invitation.
								</p>{/if}
							<p class="mt-1 text-xs text-base-content/40">
								Reviewed {review ? formatDate(review.created) : ''}
							</p>
						</div>
					{/each}
				</div>
			{/if}

			{#if !pendingAssignments.length && !completedAssignments.length}
				<p class="py-8 text-center text-base-content/60">No review assignments yet.</p>
			{/if}
		{/if}

		<!-- My Editions Tab -->
		{#if activeTab === 'editions'}
			{#if myEditions.length === 0}
				<div class="rounded-box border border-base-300 bg-base-100 px-5 py-10 text-center">
					<h2 class="text-lg font-semibold">Your first proposal starts here</h2>
					<p class="mx-auto mt-2 mb-5 max-w-md text-sm text-base-content/65">
						Tell us about your 3D edition. Your draft saves automatically, and you can return to it
						anytime before submitting it for review.
					</p>
					<button
						type="button"
						class="btn btn-primary"
						onclick={startProposal}
						disabled={isCreating}>{isCreating ? 'Starting proposal…' : 'Start a proposal'}</button
					>
				</div>
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
											<a
												class="font-medium break-words link-hover"
												href={resolve('/editions/[slug]/workflow', { slug: edition.id })}
												>{edition.title || 'Untitled Proposal'}</a
											>
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
											<a
												href={resolve('/editions/[slug]/workflow', { slug: edition.id })}
												class="btn btn-ghost btn-sm"
											>
												{edition.status === EditionStatus.Draft
													? 'Continue proposal'
													: [
																EditionStatus.ConceptSubmitted,
																EditionStatus.EditorialReview
														  ].includes(edition.status)
														? 'View proposal'
														: edition.status === EditionStatus.AlphaReview
															? 'View edition'
															: 'View workflow'}
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
							{#if edition.status === EditionStatus.AlphaReview}<p
									class="mt-4 text-sm text-base-content/70"
								>
									Submitted for Alpha Review. Editing is locked until the editorial decision.
								</p>{/if}
							{#if [EditionStatus.FinalReview, EditionStatus.FinalRevisions, EditionStatus.FinalAccepted, EditionStatus.PublicationRequested].includes(edition.status)}<div
									class="mt-3"
								>
									<FinalReviewProgress editionId={edition.id} />
								</div>{/if}
							{#if [EditionStatus.AlphaReview, EditionStatus.AlphaRevisions, EditionStatus.AlphaAccepted].includes(edition.status)}<div
									class="mt-3"
								>
									<AlphaReviewProgress editionId={edition.id} />
								</div>{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>
