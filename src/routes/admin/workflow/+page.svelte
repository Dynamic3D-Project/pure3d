<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { EditionStatus, ReviewStage, STATUS_LABELS } from '$lib/types/roles';
	import { ReviewDecision } from '$lib/types/reviews';
	import type { EditionReview, ReviewAssignment } from '$lib/types/reviews';
	import { updateEditionStatus, assignReviewer } from '$lib/server/pocketbase';
	import { logAudit } from '$lib/utils/audit';
	import { notify, notifyMany } from '$lib/utils/notifications';
	import { NotificationType } from '$lib/types/notifications';
	import {
		anonymizeReviews,
		aggregateVerdicts,
		getTargetStatusFromVerdict,
		getAdminUserIds
	} from '$lib/utils/review-helpers';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import WorkflowTimeline from '$lib/components/workflow/WorkflowTimeline.svelte';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';
	import toast from 'svelte-french-toast';

	interface WfEdition {
		id: string;
		title: string;
		status: EditionStatus;
		collectionTitle: string;
		created: string;
		peerReviewRequested: boolean;
		peerReviewStamp: boolean;
		publishedAt: string | null;
	}

	interface AppUser {
		id: string;
		nickname: string;
		email: string;
	}

	let editions = $state<WfEdition[]>([]);
	let allAssignments = $state<ReviewAssignment[]>([]);
	let allReviews = $state<EditionReview[]>([]);
	let allUsers = $state<AppUser[]>([]);
	let userLookup = $derived(new Map(allUsers.map((u) => [u.id, u.nickname || u.email])));

	let isLoading = $state(true);
	let activeTab = $state<'submissions' | 'editorial' | 'alpha' | 'final' | 'publish' | 'all'>(
		'submissions'
	);
	let expandedId = $state<string | null>(null);
	let actionLoading = $state(false);

	// Reviewer assignment form state
	let assignUserId = $state('');

	// Publish modal state
	let publishModalEdition = $state<WfEdition | null>(null);

	// Filtered editions per tab
	let submissions = $derived(editions.filter((e) => e.status === EditionStatus.ConceptSubmitted));
	let editorialEditions = $derived(
		editions.filter((e) => e.status === EditionStatus.EditorialReview)
	);
	let alphaEditions = $derived(
		editions.filter(
			(e) => e.status === EditionStatus.AlphaReview || e.status === EditionStatus.AlphaRevisions
		)
	);
	let finalEditions = $derived(
		editions.filter(
			(e) => e.status === EditionStatus.FinalReview || e.status === EditionStatus.FinalRevisions
		)
	);
	let publishEditions = $derived(
		editions.filter(
			(e) => e.status === EditionStatus.AlphaAccepted || e.status === EditionStatus.Published
		)
	);
	let allNonDraft = $derived(editions.filter((e) => e.status !== EditionStatus.Draft));

	// Tab counts
	let tabCounts = $derived({
		submissions: submissions.length,
		editorial: editorialEditions.length,
		alpha: alphaEditions.length,
		final: finalEditions.length,
		publish: publishEditions.length,
		all: allNonDraft.length
	});

	function editionAssignments(editionId: string, stage?: number): ReviewAssignment[] {
		return allAssignments.filter(
			(a) => a.editionId === editionId && (stage === undefined || a.reviewStage === stage)
		);
	}

	function editionReviews(editionId: string, stage?: number): EditionReview[] {
		return allReviews.filter(
			(r) => r.editionId === editionId && (stage === undefined || r.reviewStage === stage)
		);
	}

	onMount(loadData);

	async function loadData() {
		isLoading = true;
		try {
			const [edResult, assignResult, reviewResult, userResult] = await Promise.all([
				pb.collection('editions').getList(1, 500, { expand: 'collection' }),
				pb.collection('reviewAssignments').getList(1, 1000, {
					expand: 'reviewerId,assignedBy'
				}),
				pb.collection('editionReviews').getList(1, 1000, { expand: 'reviewerId' }),
				pb.collection('userProfiles').getList(1, 500)
			]);

			editions = edResult.items.map((r) => ({
				id: r.id,
				title: r.dcTitle || r.title,
				status: (r.status as EditionStatus) || EditionStatus.Draft,
				collectionTitle: r.expand?.collection?.title || '',
				created: r.created,
				peerReviewRequested: r.peerReviewRequested || false,
				peerReviewStamp: r.peerReviewStamp || false,
				publishedAt: r.publishedAt || null
			}));

			allAssignments = assignResult.items.map((r) => ({
				id: r.id,
				editionId: r.editionId,
				reviewerId: r.reviewerId,
				reviewStage: r.reviewStage,
				assignedBy: r.assignedBy,
				status: r.status,
				created: r.created,
				updated: r.updated
			}));

			allReviews = reviewResult.items.map((r) => ({
				id: r.id,
				editionId: r.editionId,
				reviewerId: r.reviewerId,
				reviewStage: r.reviewStage,
				decision: r.decision as ReviewDecision,
				comment: r.comment || null,
				created: r.created,
				updated: r.updated
			}));

			allUsers = userResult.items.map((r) => ({
				id: r.id,
				nickname: r.nickname || '',
				email: r.email || ''
			}));
		} catch (error) {
			console.error('Error loading workflow data:', error);
			toast.error('Failed to load workflow data');
		} finally {
			isLoading = false;
		}
	}

	function toggleExpand(editionId: string) {
		expandedId = expandedId === editionId ? null : editionId;
		assignUserId = '';
	}

	// --- Submissions tab: assign board member and start editorial review ---
	async function assignAndStartReview(edition: WfEdition) {
		if (!assignUserId) {
			toast.error('Select a reviewer first');
			return;
		}
		actionLoading = true;
		try {
			await assignReviewer(
				edition.id,
				assignUserId,
				ReviewStage.Concept,
				authStore.appUserId || ''
			);

			await updateEditionStatus(edition.id, EditionStatus.EditorialReview);

			await logAudit('reviewer_assigned', 'edition', edition.id, authStore.user?.email || '', {
				reviewerId: assignUserId,
				stage: ReviewStage.Concept,
				statusChange: `${edition.status} -> ${EditionStatus.EditorialReview}`
			});

			// Notify the assigned reviewer
			await notify(
				assignUserId,
				NotificationType.ReviewerAssigned,
				'You have been assigned as a reviewer',
				`Please review the concept for "${edition.title}".`,
				edition.id,
				`${base}/editions/${edition.id}/workflow`
			);

			edition.status = EditionStatus.EditorialReview;
			editions = [...editions];
			allAssignments = [
				...allAssignments,
				{
					id: 'temp-' + Date.now(),
					editionId: edition.id,
					reviewerId: assignUserId,
					reviewStage: ReviewStage.Concept,
					assignedBy: authStore.appUserId || '',
					status: 'pending' as any,
					created: new Date().toISOString(),
					updated: new Date().toISOString()
				}
			];
			assignUserId = '';
			toast.success('Reviewer assigned, editorial review started');
		} catch (error) {
			console.error('Error starting review:', error);
			toast.error('Failed to start review');
		} finally {
			actionLoading = false;
		}
	}

	// --- Apply verdict for any review stage ---
	async function applyVerdict(edition: WfEdition, stage: ReviewStage) {
		const reviews = editionReviews(edition.id, stage);
		const assignments = editionAssignments(edition.id, stage);
		const verdict = aggregateVerdicts(reviews, assignments.length);

		if (verdict === 'pending') {
			toast.error('Not all reviews have been submitted yet');
			return;
		}

		const targetStatus = getTargetStatusFromVerdict(verdict, stage);
		if (!targetStatus) {
			toast.error('Could not determine target status');
			return;
		}

		actionLoading = true;
		try {
			await updateEditionStatus(edition.id, targetStatus, authStore.appUserId || '');

			await logAudit('status_transition', 'edition', edition.id, authStore.user?.email || '', {
				from: edition.status,
				to: targetStatus,
				verdict,
				stage
			});

			// Notify the author(s) about the verdict
			const editionUsers = await pb.collection('editionUsers').getList(1, 50, {
				filter: `editionId = "${edition.id}" && role = "author"`
			});
			const authorIds = editionUsers.items.map((r) => r.userId);

			const notifType = getNotificationType(targetStatus);
			if (notifType && authorIds.length > 0) {
				await notifyMany(
					authorIds,
					notifType,
					`Edition status: ${STATUS_LABELS[targetStatus]}`,
					`Your edition "${edition.title}" has been moved to ${STATUS_LABELS[targetStatus]}.`,
					edition.id,
					`${base}/editions/${edition.id}/workflow`
				);
			}

			edition.status = targetStatus;
			editions = [...editions];
			toast.success(`Status changed to ${STATUS_LABELS[targetStatus]}`);
		} catch (error) {
			console.error('Error applying verdict:', error);
			toast.error('Failed to apply verdict');
		} finally {
			actionLoading = false;
		}
	}

	function getNotificationType(status: EditionStatus): NotificationType | null {
		const map: Partial<Record<EditionStatus, NotificationType>> = {
			[EditionStatus.ConceptAccepted]: NotificationType.ConceptAccepted,
			[EditionStatus.ConceptRejected]: NotificationType.ConceptRejected,
			[EditionStatus.AlphaAccepted]: NotificationType.AlphaAccepted,
			[EditionStatus.AlphaRejected]: NotificationType.AlphaRejected,
			[EditionStatus.AlphaRevisions]: NotificationType.AlphaRevisionsRequested,
			[EditionStatus.FinalRevisions]: NotificationType.FinalRevisionsRequested,
			[EditionStatus.Published]: NotificationType.Published
		};
		return map[status] ?? null;
	}

	// --- Assign reviewer for alpha/final stages ---
	async function assignStageReviewer(edition: WfEdition, stage: ReviewStage) {
		if (!assignUserId) {
			toast.error('Select a reviewer first');
			return;
		}
		actionLoading = true;
		try {
			await assignReviewer(edition.id, assignUserId, stage, authStore.appUserId || '');

			await logAudit('reviewer_assigned', 'edition', edition.id, authStore.user?.email || '', {
				reviewerId: assignUserId,
				stage
			});

			await notify(
				assignUserId,
				NotificationType.ReviewerAssigned,
				'You have been assigned as a reviewer',
				`Please review "${edition.title}" (stage ${stage}).`,
				edition.id,
				`${base}/editions/${edition.id}/workflow`
			);

			allAssignments = [
				...allAssignments,
				{
					id: 'temp-' + Date.now(),
					editionId: edition.id,
					reviewerId: assignUserId,
					reviewStage: stage,
					assignedBy: authStore.appUserId || '',
					status: 'pending' as any,
					created: new Date().toISOString(),
					updated: new Date().toISOString()
				}
			];
			assignUserId = '';
			toast.success('Reviewer assigned');
		} catch (error) {
			console.error('Error assigning reviewer:', error);
			toast.error('Failed to assign reviewer');
		} finally {
			actionLoading = false;
		}
	}

	// --- Publish / unpublish ---
	async function publishEdition(edition: WfEdition) {
		actionLoading = true;
		try {
			const updateData: Record<string, unknown> = {
				status: EditionStatus.Published,
				isPublished: true,
				publishedAt: new Date().toISOString(),
				publishedBy: authStore.appUserId
			};

			if (edition.peerReviewRequested) {
				// Compile peer review content from all reviews
				const reviews = allReviews.filter((r) => r.editionId === edition.id);
				const peerReviewContent = reviews
					.map(
						(r) =>
							`Stage ${r.reviewStage} - ${userLookup.get(r.reviewerId) || 'Reviewer'}: ${r.decision}${r.comment ? '\n' + r.comment : ''}`
					)
					.join('\n\n');

				updateData.peerReviewStamp = true;
				updateData.peerReviewContent = peerReviewContent;
				updateData.peerReviewKind = 'Peer reviewed';
			}

			await pb.collection('editions').update(edition.id, updateData);

			await logAudit('status_transition', 'edition', edition.id, authStore.user?.email || '', {
				from: edition.status,
				to: EditionStatus.Published,
				peerReviewStamp: !!edition.peerReviewRequested
			});

			// Notify authors
			const editionUsers = await pb.collection('editionUsers').getList(1, 50, {
				filter: `editionId = "${edition.id}" && role = "author"`
			});
			const authorIds = editionUsers.items.map((r) => r.userId);
			if (authorIds.length > 0) {
				await notifyMany(
					authorIds,
					NotificationType.Published,
					'Edition published',
					`"${edition.title}" has been published.`,
					edition.id
				);
			}

			edition.status = EditionStatus.Published;
			edition.peerReviewStamp = !!edition.peerReviewRequested;
			edition.publishedAt = new Date().toISOString();
			editions = [...editions];
			publishModalEdition = null;
			toast.success('Edition published');
		} catch (error) {
			console.error('Error publishing:', error);
			toast.error('Failed to publish edition');
		} finally {
			actionLoading = false;
		}
	}

	async function unpublishEdition(edition: WfEdition) {
		actionLoading = true;
		try {
			await pb.collection('editions').update(edition.id, {
				status: EditionStatus.Draft,
				isPublished: false
			});

			await logAudit('status_transition', 'edition', edition.id, authStore.user?.email || '', {
				from: EditionStatus.Published,
				to: EditionStatus.Draft
			});

			edition.status = EditionStatus.Draft;
			editions = [...editions];
			toast.success('Edition unpublished');
		} catch (error) {
			console.error('Error unpublishing:', error);
			toast.error('Failed to unpublish');
		} finally {
			actionLoading = false;
		}
	}

	// --- Move editions forward manually (e.g. ConceptAccepted -> AlphaReview) ---
	async function advanceStatus(edition: WfEdition, targetStatus: EditionStatus) {
		actionLoading = true;
		try {
			await updateEditionStatus(edition.id, targetStatus, authStore.appUserId || '');

			await logAudit('status_transition', 'edition', edition.id, authStore.user?.email || '', {
				from: edition.status,
				to: targetStatus
			});

			edition.status = targetStatus;
			editions = [...editions];
			toast.success(`Status changed to ${STATUS_LABELS[targetStatus]}`);
		} catch (error) {
			console.error('Error advancing status:', error);
			toast.error('Failed to advance status');
		} finally {
			actionLoading = false;
		}
	}

	function getVerdictLabel(verdict: string): string {
		const labels: Record<string, string> = {
			accept: 'Accept',
			reject: 'Reject',
			revisions: 'Revisions Needed',
			pending: 'Pending'
		};
		return labels[verdict] || verdict;
	}

	function getVerdictBadge(verdict: string): string {
		const badges: Record<string, string> = {
			accept: 'badge-success',
			reject: 'badge-error',
			revisions: 'badge-warning',
			pending: 'badge-ghost'
		};
		return badges[verdict] || 'badge-ghost';
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div id="admin-workflow-page" class="mx-auto max-w-6xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Workflow Pipeline</h1>
		<p class="mt-2 text-base-content/60">
			Manage the review pipeline: assign reviewers, apply verdicts, and publish editions.
		</p>
	</div>

	<!-- Tabs -->
	<div class="tabs-bordered mb-6 tabs">
		<button
			class="tab"
			class:tab-active={activeTab === 'submissions'}
			onclick={() => (activeTab = 'submissions')}
		>
			Submissions
			{#if tabCounts.submissions > 0}
				<span class="ml-1 badge badge-sm">{tabCounts.submissions}</span>
			{/if}
		</button>
		<button
			class="tab"
			class:tab-active={activeTab === 'editorial'}
			onclick={() => (activeTab = 'editorial')}
		>
			Editorial
			{#if tabCounts.editorial > 0}
				<span class="ml-1 badge badge-sm">{tabCounts.editorial}</span>
			{/if}
		</button>
		<button
			class="tab"
			class:tab-active={activeTab === 'alpha'}
			onclick={() => (activeTab = 'alpha')}
		>
			Alpha
			{#if tabCounts.alpha > 0}
				<span class="ml-1 badge badge-sm">{tabCounts.alpha}</span>
			{/if}
		</button>
		<button
			class="tab"
			class:tab-active={activeTab === 'final'}
			onclick={() => (activeTab = 'final')}
		>
			Final
			{#if tabCounts.final > 0}
				<span class="ml-1 badge badge-sm">{tabCounts.final}</span>
			{/if}
		</button>
		<button
			class="tab"
			class:tab-active={activeTab === 'publish'}
			onclick={() => (activeTab = 'publish')}
		>
			Publish
			{#if tabCounts.publish > 0}
				<span class="ml-1 badge badge-sm">{tabCounts.publish}</span>
			{/if}
		</button>
		<button class="tab" class:tab-active={activeTab === 'all'} onclick={() => (activeTab = 'all')}>
			All
			{#if tabCounts.all > 0}
				<span class="ml-1 badge badge-sm">{tabCounts.all}</span>
			{/if}
		</button>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else}
		<!-- Submissions Tab -->
		{#if activeTab === 'submissions'}
			{#if submissions.length === 0}
				<p class="py-8 text-center text-base-content/60">No pending submissions.</p>
			{:else}
				<div class="space-y-2">
					{#each submissions as edition (edition.id)}
						{@render editionCard(edition, ReviewStage.Concept, true)}
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Editorial Review Tab -->
		{#if activeTab === 'editorial'}
			{#if editorialEditions.length === 0}
				<p class="py-8 text-center text-base-content/60">No editions in editorial review.</p>
			{:else}
				<div class="space-y-2">
					{#each editorialEditions as edition (edition.id)}
						{@render editionCard(edition, ReviewStage.Concept, false)}
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Alpha Review Tab -->
		{#if activeTab === 'alpha'}
			{#if alphaEditions.length === 0}
				<p class="py-8 text-center text-base-content/60">No editions in alpha review.</p>
			{:else}
				<div class="space-y-2">
					{#each alphaEditions as edition (edition.id)}
						{@render editionCard(edition, ReviewStage.Alpha, false)}
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Final Review Tab -->
		{#if activeTab === 'final'}
			{#if finalEditions.length === 0}
				<p class="py-8 text-center text-base-content/60">No editions in final review.</p>
			{:else}
				<div class="space-y-2">
					{#each finalEditions as edition (edition.id)}
						{@render editionCard(edition, ReviewStage.Final, false)}
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Publish Tab -->
		{#if activeTab === 'publish'}
			{#if publishEditions.length === 0}
				<p class="py-8 text-center text-base-content/60">No editions ready to publish.</p>
			{:else}
				<div class="space-y-2">
					{#each publishEditions as edition (edition.id)}
						<div class="rounded-box border border-base-300 bg-base-100 p-4">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="flex flex-wrap items-center gap-3">
									<span class="font-medium">{edition.title}</span>
									<StatusBadge status={edition.status} />
									{#if edition.collectionTitle}
										<span class="text-sm text-base-content/50">
											in {edition.collectionTitle}
										</span>
									{/if}
								</div>
								<div class="flex gap-2">
									{#if edition.status === EditionStatus.Published}
										<button
											class="btn btn-outline btn-sm btn-error"
											onclick={() => unpublishEdition(edition)}
											disabled={actionLoading}
										>
											Unpublish
										</button>
									{:else}
										<button
											class="btn btn-sm btn-primary"
											onclick={() => (publishModalEdition = edition)}
											disabled={actionLoading}
										>
											Publish
										</button>
									{/if}
								</div>
							</div>
							{#if edition.status === EditionStatus.Published && edition.publishedAt}
								<div class="mt-2 text-sm text-base-content/60">
									Published on {formatDate(edition.publishedAt)}
									{#if edition.peerReviewStamp}
										<span class="ml-2 badge badge-xs badge-success">Peer Reviewed</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- All Tab -->
		{#if activeTab === 'all'}
			{#if allNonDraft.length === 0}
				<p class="py-8 text-center text-base-content/60">No non-draft editions.</p>
			{:else}
				<div class="space-y-2">
					{#each allNonDraft as edition (edition.id)}
						<div class="rounded-box border border-base-300 bg-base-100 p-4">
							<div class="flex flex-wrap items-center gap-3">
								<span class="font-medium">{edition.title}</span>
								<StatusBadge status={edition.status} />
								{#if edition.collectionTitle}
									<span class="text-sm text-base-content/50">
										in {edition.collectionTitle}
									</span>
								{/if}
								<span class="text-sm text-base-content/40">
									{formatDate(edition.created)}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>

<!-- Publish Modal -->
{#if publishModalEdition}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Publish Edition</h3>
			<p class="mt-2">
				Publish <strong>{publishModalEdition.title}</strong>?
			</p>

			{#if publishModalEdition.peerReviewRequested}
				<div class="mt-4 alert alert-info">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="size-6 shrink-0 stroke-current"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
						/>
					</svg>
					<div>
						<p class="font-semibold">Peer review stamp will be applied</p>
						<p class="text-sm">
							All review comments will be compiled into the peer review content and the edition will
							be marked as peer reviewed.
						</p>
					</div>
				</div>
			{:else}
				<div class="mt-4 alert">
					<p>This edition will be published without a peer review stamp.</p>
				</div>
			{/if}

			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => (publishModalEdition = null)}
					disabled={actionLoading}
				>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					onclick={() => publishModalEdition && publishEdition(publishModalEdition)}
					disabled={actionLoading}
				>
					{#if actionLoading}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Confirm Publish
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (publishModalEdition = null)}></div>
	</div>
{/if}

<!-- Reusable edition card snippet -->
{#snippet editionCard(edition: WfEdition, stage: ReviewStage, isSubmission: boolean)}
	<div class="rounded-box border border-base-300 bg-base-100">
		<button
			class="flex w-full cursor-pointer items-center justify-between p-4 font-medium"
			onclick={() => toggleExpand(edition.id)}
		>
			<div class="flex flex-wrap items-center gap-3">
				<span>{edition.title}</span>
				<StatusBadge status={edition.status} />
				{#if edition.collectionTitle}
					<span class="text-sm text-base-content/50">in {edition.collectionTitle}</span>
				{/if}
				<span class="text-sm text-base-content/40">{formatDate(edition.created)}</span>
			</div>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="size-4 shrink-0 transition-transform duration-200"
				class:rotate-180={expandedId === edition.id}
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
			</svg>
		</button>

		{#if expandedId === edition.id}
			{@const assignments = editionAssignments(edition.id, stage)}
			{@const reviews = editionReviews(edition.id, stage)}
			{@const verdict = aggregateVerdicts(reviews, assignments.length)}
			{@const displayReviews = anonymizeReviews(reviews, assignments, stage, userLookup, true)}
			<div class="space-y-4 border-t border-base-300 px-4 pt-3 pb-4">
				<!-- Timeline -->
				<WorkflowTimeline currentStatus={edition.status} />

				<!-- Reviewer assignments -->
				<div>
					<h4 class="mb-2 text-sm font-semibold text-base-content/60 uppercase">
						Assigned Reviewers
					</h4>
					{#if assignments.length > 0}
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>Reviewer</th>
										<th>Status</th>
										<th>Assigned</th>
									</tr>
								</thead>
								<tbody>
									{#each assignments as a (a.id)}
										{@const hasReview = reviews.some((r) => r.reviewerId === a.reviewerId)}
										<tr>
											<td>{userLookup.get(a.reviewerId) || 'Unknown'}</td>
											<td>
												{#if hasReview}
													<span class="badge badge-sm badge-success">Reviewed</span>
												{:else}
													<span class="badge badge-ghost badge-sm">Pending</span>
												{/if}
											</td>
											<td class="text-base-content/60">{formatDate(a.created)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="text-sm text-base-content/60">No reviewers assigned yet.</p>
					{/if}
				</div>

				<!-- Reviews submitted -->
				{#if displayReviews.length > 0}
					<div>
						<h4 class="mb-2 text-sm font-semibold text-base-content/60 uppercase">Reviews</h4>
						<div class="space-y-2">
							{#each displayReviews as review (review.created)}
								<div class="rounded-lg border border-base-300 p-3">
									<div class="flex items-center justify-between">
										<span class="font-medium">{review.displayName}</span>
										<span
											class="badge badge-sm {review.decision === 'approve'
												? 'badge-success'
												: review.decision === 'reject'
													? 'badge-error'
													: 'badge-warning'}"
										>
											{review.decision === 'approve'
												? 'Approve'
												: review.decision === 'reject'
													? 'Reject'
													: 'Revisions'}
										</span>
									</div>
									{#if review.comment}
										<p class="mt-2 text-sm text-base-content/70">{review.comment}</p>
									{/if}
									<p class="mt-1 text-xs text-base-content/40">{formatDate(review.created)}</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Verdict aggregate -->
				{#if assignments.length > 0}
					<div class="flex items-center gap-3">
						<span class="text-sm font-semibold">Aggregate Verdict:</span>
						<span class="badge {getVerdictBadge(verdict)}">{getVerdictLabel(verdict)}</span>
						{#if verdict !== 'pending'}
							<button
								class="btn btn-sm btn-primary"
								onclick={() => applyVerdict(edition, stage)}
								disabled={actionLoading}
							>
								{#if actionLoading}
									<span class="loading loading-xs loading-spinner"></span>
								{/if}
								Apply Verdict
							</button>
						{/if}
					</div>
				{/if}

				<!-- Assign reviewer form -->
				{#if isSubmission || edition.status === EditionStatus.AlphaReview || edition.status === EditionStatus.FinalReview}
					<div class="border-t border-base-300 pt-3">
						<h4 class="mb-2 text-sm font-semibold text-base-content/60 uppercase">
							{isSubmission ? 'Assign Board Member & Start Review' : 'Assign Reviewer'}
						</h4>
						<div class="flex flex-wrap items-end gap-2">
							<div class="form-control">
								<UserSearchSelect
									users={allUsers.filter((u) => !assignments.some((a) => a.reviewerId === u.id))}
									bind:value={assignUserId}
									placeholder="Search user..."
								/>
							</div>
							<button
								class="btn btn-sm btn-primary"
								onclick={() =>
									isSubmission
										? assignAndStartReview(edition)
										: assignStageReviewer(edition, stage)}
								disabled={!assignUserId || actionLoading}
							>
								{#if actionLoading}
									<span class="loading loading-xs loading-spinner"></span>
								{/if}
								{isSubmission ? 'Assign & Start Review' : 'Assign'}
							</button>
						</div>
					</div>
				{/if}

				<!-- Advance status buttons for accepted states -->
				{#if edition.status === EditionStatus.ConceptAccepted}
					<div class="border-t border-base-300 pt-3">
						<button
							class="btn btn-outline btn-sm"
							onclick={() => advanceStatus(edition, EditionStatus.AlphaReview)}
							disabled={actionLoading}
						>
							Start Alpha Review
						</button>
					</div>
				{/if}
				{#if edition.status === EditionStatus.AlphaAccepted}
					<div class="border-t border-base-300 pt-3">
						<button
							class="btn btn-outline btn-sm"
							onclick={() => advanceStatus(edition, EditionStatus.FinalReview)}
							disabled={actionLoading}
						>
							Start Final Review
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}
