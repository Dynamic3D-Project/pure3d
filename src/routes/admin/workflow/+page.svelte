<script lang="ts">
	import { workflowAnchor } from '$lib/workflow/presentation';
	import { onMount } from 'svelte';
	import { base, resolve } from '$app/paths';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { EditionStatus, ReviewStage, STATUS_LABELS } from '$lib/types/roles';
	import { ReviewDecision, ReviewAssignmentStatus } from '$lib/types/reviews';
	import type { EditionReview, ReviewAssignment } from '$lib/types/reviews';
	import {
		updateEditionStatus,
		assignReviewer,
		removeReviewAssignment
	} from '$lib/database/edition-helpers';
	import {
		anonymizeReviews,
		isCurrentReviewRound,
		aggregateVerdicts,
		getTargetStatusFromVerdict
	} from '$lib/utils/review-helpers';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import AlphaEditorialPanel from '$lib/components/workflow/AlphaEditorialPanel.svelte';
	import FinalEditorialPanel from '$lib/components/workflow/FinalEditorialPanel.svelte';
	import WorkflowTimeline from '$lib/components/workflow/WorkflowTimeline.svelte';
	import FloatingSelect from '$lib/components/ui/FloatingSelect.svelte';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';
	import toast from 'svelte-french-toast';
	import { readCredits, validateCredits } from '$lib/utils/credits';
	import { canTransitionStatus } from '$lib/utils/permissions';
	import {
		conceptReviewCreditIssue,
		needsConceptReviewerAssignment
	} from '$lib/workflow/review-start';

	interface WfEdition {
		id: string;
		title: string;
		status: EditionStatus;
		collectionId: string;
		collectionTitle: string;
		created: string;
		peerReviewRequested: boolean;
		peerReviewStamp: boolean;
		publishedAt: string | null;
		alphaReviewRound: number;
		finalReviewRound: number;
	}

	interface AppUser {
		id: string;
		nickname: string;
		orcid: string;
	}

	let editions = $state<WfEdition[]>([]);
	let allAssignments = $state<ReviewAssignment[]>([]);
	let allReviews = $state<EditionReview[]>([]);
	let allUsers = $state<AppUser[]>([]);
	let userLookup = $derived(
		new Map(allUsers.map((u) => [u.id, u.nickname || u.orcid || 'Unnamed user']))
	);

	let isLoading = $state(true);
	let activeTab = $state<'submissions' | 'editorial' | 'alpha' | 'final' | 'publish' | 'all'>(
		'submissions'
	);
	let searchQuery = $state('');
	let collectionFilter = $state('');
	let expandedId = $state<string | null>(null);
	let actionLoading = $state(false);
	let filteredBaseEditions = $derived(
		editions.filter((e) => {
			const query = searchQuery.toLowerCase();
			const matchesSearch =
				!query ||
				e.title.toLowerCase().includes(query) ||
				e.collectionTitle.toLowerCase().includes(query);
			const matchesCollection = !collectionFilter || e.collectionId === collectionFilter;

			return matchesSearch && matchesCollection;
		})
	);
	let hasActiveFilters = $derived(Boolean(searchQuery || collectionFilter));
	let collectionFilterOptions = $derived([
		{ value: '', label: 'All collections' },
		...Array.from(
			new Map(
				editions
					.filter((edition) => edition.collectionId && edition.collectionTitle)
					.map((edition) => [edition.collectionId, edition.collectionTitle])
			).entries()
		)
			.sort(([, a], [, b]) => a.localeCompare(b))
			.map(([value, label]) => ({ value, label }))
	]);

	// Reviewer assignment form state
	let assignUserId = $state('');
	let assignDueAt = $state('');
	let replacementReason = $state('');
	let overrideEdition = $state<WfEdition | null>(null);
	let overrideStatus = $state<EditionStatus | ''>('');
	let overrideReason = $state('');

	// Publish modal state
	let publishModalEdition = $state<WfEdition | null>(null);

	// Filtered editions per tab
	let submissions = $derived(
		filteredBaseEditions.filter((e) => e.status === EditionStatus.ConceptSubmitted)
	);
	let editorialEditions = $derived(
		filteredBaseEditions.filter((e) => e.status === EditionStatus.EditorialReview)
	);
	let alphaEditions = $derived(
		filteredBaseEditions.filter(
			(e) =>
				e.status === EditionStatus.ConceptAccepted ||
				e.status === EditionStatus.AlphaReview ||
				e.status === EditionStatus.AlphaRevisions
		)
	);
	let finalEditions = $derived(
		filteredBaseEditions.filter(
			(e) =>
				e.status === EditionStatus.AlphaAccepted ||
				e.status === EditionStatus.FinalReview ||
				e.status === EditionStatus.FinalRevisions ||
				e.status === EditionStatus.FinalAccepted
		)
	);
	let publishEditions = $derived(
		filteredBaseEditions.filter(
			(e) => e.status === EditionStatus.Published || e.status === EditionStatus.PublicationRequested
		)
	);
	let allEditions = $derived(filteredBaseEditions);

	// Tab counts
	let tabCounts = $derived({
		submissions: submissions.length,
		editorial: editorialEditions.length,
		alpha: alphaEditions.length,
		final: finalEditions.length,
		publish: publishEditions.length,
		all: allEditions.length
	});

	const overrideTargets: Partial<Record<EditionStatus, EditionStatus[]>> = {
		[EditionStatus.Draft]: [EditionStatus.ConceptSubmitted],
		[EditionStatus.ConceptSubmitted]: [EditionStatus.EditorialReview],
		[EditionStatus.EditorialReview]: [EditionStatus.ConceptAccepted, EditionStatus.ConceptRejected],
		[EditionStatus.ConceptAccepted]: [EditionStatus.AlphaReview],
		[EditionStatus.ConceptRejected]: [EditionStatus.Draft],
		[EditionStatus.AlphaReview]: [
			EditionStatus.AlphaAccepted,
			EditionStatus.AlphaRejected,
			EditionStatus.AlphaRevisions
		],
		[EditionStatus.AlphaRevisions]: [EditionStatus.AlphaReview],
		[EditionStatus.AlphaAccepted]: [EditionStatus.FinalReview, EditionStatus.AlphaReview],
		[EditionStatus.AlphaRejected]: [EditionStatus.Draft, EditionStatus.AlphaReview],
		[EditionStatus.FinalReview]: [EditionStatus.FinalAccepted, EditionStatus.FinalRevisions],
		[EditionStatus.FinalRevisions]: [EditionStatus.FinalReview],
		[EditionStatus.FinalAccepted]: [EditionStatus.PublicationRequested, EditionStatus.FinalReview],
		[EditionStatus.PublicationRequested]: [EditionStatus.FinalAccepted, EditionStatus.FinalReview]
	};

	function editionAssignments(editionId: string, stage?: number): ReviewAssignment[] {
		const edition = editions.find((edition) => edition.id === editionId);
		return allAssignments.filter(
			(a) =>
				a.editionId === editionId &&
				(stage === undefined || a.reviewStage === stage) &&
				isCurrentReviewRound(a, edition || {})
		);
	}

	function editionReviews(editionId: string, stage?: number): EditionReview[] {
		const edition = editions.find((edition) => edition.id === editionId);
		return allReviews.filter(
			(r) =>
				r.editionId === editionId &&
				r.reviewStatus !== 'draft' &&
				(stage === undefined || r.reviewStage === stage) &&
				isCurrentReviewRound(r, edition || {})
		);
	}

	onMount(loadData);

	async function loadData() {
		isLoading = true;
		try {
			const [editionRecords, assignmentRecords, reviewRecords, userResult] = await Promise.all([
				pb.collection('editions').getFullList({ expand: 'collection' }),
				pb.collection('reviewAssignments').getFullList({
					expand: 'reviewerId,assignedBy'
				}),
				pb.collection('editionReviews').getFullList({ expand: 'reviewerId' }),
				pb.collection('users').getFullList()
			]);

			editions = editionRecords.map((r) => ({
				alphaReviewRound: r.alphaReviewRound || 0,
				finalReviewRound: r.finalReviewRound || 0,
				id: r.id,
				title: r.dcTitle || r.title,
				status: (r.status as EditionStatus) || EditionStatus.Draft,
				collectionId: r.collection || '',
				collectionTitle: r.expand?.collection?.title || '',
				created: r.created,
				peerReviewRequested: r.peerReviewRequested || false,
				peerReviewStamp: r.peerReviewStamp || false,
				publishedAt: r.publishedAt || null
			}));

			allAssignments = assignmentRecords.map((r) => ({
				reviewRound: r.reviewRound || 0,
				editionTitle: r.editionTitle || '',
				id: r.id,
				editionId: r.editionId,
				reviewerId: r.reviewerId,
				reviewStage: r.reviewStage,
				assignedBy: r.assignedBy,
				status: r.status,
				created: r.created,
				updated: r.updated
			}));

			allReviews = reviewRecords.map((r) => ({
				reviewStatus: r.reviewStatus,
				reviewRound: r.reviewRound || 0,
				id: r.id,
				editionId: r.editionId,
				reviewerId: r.reviewerId,
				reviewStage: r.reviewStage,
				decision: r.decision as ReviewDecision,
				comment: r.comment || null,
				created: r.created,
				updated: r.updated
			}));

			allUsers = userResult.map((r) => ({
				id: r.id,
				nickname: r.nickname || '',
				orcid: r.orcid || ''
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
		actionLoading = true;
		try {
			const current = await pb.collection('editions').getOne(edition.id, {
				fields: 'id,status,credits,collection'
			});
			if (current.status !== EditionStatus.ConceptSubmitted)
				throw new Error('This proposal has changed. Refresh the workflow before starting review.');
			const parentCredits = current.collection
				? (await pb.collection('collections').getOne(current.collection, { fields: 'id,credits' }))
						.credits
				: undefined;
			const creditIssue = conceptReviewCreditIssue(current.credits, parentCredits);
			if (creditIssue) throw new Error(creditIssue);

			const existing = await pb.collection('reviewAssignments').getFullList({
				filter: pb.filter('editionId = {:id} && reviewStage = 1', { id: edition.id }),
				fields: 'id,reviewerId,reviewStage,status,assignedBy,reviewRound,created,updated'
			});
			let assignment;
			if (
				needsConceptReviewerAssignment(
					existing.map((row) => ({ reviewStage: row.reviewStage, status: row.status }))
				)
			) {
				if (!assignUserId) throw new Error('Select a reviewer first.');
				assignment = await assignReviewer(
					edition.id,
					assignUserId,
					ReviewStage.Concept,
					authStore.appUserId || ''
				);
			}

			await updateEditionStatus(edition.id, EditionStatus.EditorialReview);

			edition.status = EditionStatus.EditorialReview;
			editions = [...editions];
			if (assignment)
				allAssignments = [
					...allAssignments,
					{
						id: assignment.id,
						editionId: edition.id,
						reviewerId: assignment.reviewerId,
						reviewStage: ReviewStage.Concept,
						assignedBy: assignment.assignedBy,
						status: ReviewAssignmentStatus.Pending,
						reviewRound: 0,
						created: assignment.created,
						updated: assignment.updated
					}
				];
			assignUserId = '';
			toast.success('Editorial review started');
		} catch (error) {
			console.error('Error starting review:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to start review');
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
		if (!canTransitionStatus(edition.status, targetStatus)) {
			toast.error('This verdict is not a valid transition from the current stage');
			return;
		}
		if (targetStatus === EditionStatus.Published) {
			await publishEdition(edition);
			return;
		}

		actionLoading = true;
		try {
			await updateEditionStatus(edition.id, targetStatus, authStore.appUserId || '');

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

	// --- Assign reviewer for alpha/final stages ---
	async function assignStageReviewer(edition: WfEdition, stage: ReviewStage) {
		if (!assignUserId) {
			toast.error('Select a reviewer first');
			return;
		}
		actionLoading = true;
		try {
			if (stage >= 2 && !assignDueAt) throw new Error('Choose a review deadline.');
			if (stage === 3 && !replacementReason.trim())
				throw new Error(
					'Explain why a new reviewer is being invited instead of reusing the Alpha reviewers.'
				);
			const assignment = await assignReviewer(
				edition.id,
				assignUserId,
				stage,
				authStore.appUserId || '',
				assignDueAt ? new Date(assignDueAt + 'T23:59:59').toISOString() : '',
				replacementReason
			);

			allAssignments = [
				...allAssignments,
				{
					id: assignment.id,
					editionId: edition.id,
					reviewerId: assignment.reviewerId,
					reviewStage: stage,
					assignedBy: assignment.assignedBy,
					status: assignment.status,
					reviewRound: assignment.reviewRound,
					created: assignment.created,
					updated: assignment.updated
				}
			];
			assignUserId = '';
			assignDueAt = '';
			replacementReason = '';
			toast.success('Reviewer assigned');
		} catch (error) {
			console.error('Error assigning reviewer:', error);
			toast.error('Failed to assign reviewer');
		} finally {
			actionLoading = false;
		}
	}

	function openOverride(edition: WfEdition) {
		overrideEdition = edition;
		overrideStatus = overrideTargets[edition.status]?.[0] || '';
		overrideReason = '';
	}

	async function applyOverride() {
		if (!overrideEdition || !overrideStatus || !overrideReason.trim()) return;
		actionLoading = true;
		try {
			const result = await pb.send<{
				status: EditionStatus;
				alphaReviewRound: number;
				finalReviewRound: number;
			}>(`/api/pure3d/editions/${overrideEdition.id}/admin-workflow-override`, {
				method: 'POST',
				body: {
					status: overrideStatus,
					expectedStatus: overrideEdition.status,
					reason: overrideReason
				}
			});
			overrideEdition.status = result.status;
			overrideEdition.alphaReviewRound = result.alphaReviewRound;
			overrideEdition.finalReviewRound = result.finalReviewRound;
			editions = [...editions];
			overrideEdition = null;
			toast.success('Administrative workflow intervention recorded');
		} catch (error) {
			console.error('Error applying workflow override:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to apply workflow override');
		} finally {
			actionLoading = false;
		}
	}

	async function removePendingAssignment(assignment: ReviewAssignment) {
		if (!confirm('Remove this unsubmitted reviewer invitation?')) return;
		actionLoading = true;
		try {
			await removeReviewAssignment(assignment.id);
			allAssignments = allAssignments.filter((item) => item.id !== assignment.id);
			toast.success('Reviewer invitation removed');
		} catch (error) {
			console.error('Error removing reviewer invitation:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to remove reviewer invitation');
		} finally {
			actionLoading = false;
		}
	}

	// --- Publish / unpublish ---
	async function publishEdition(edition: WfEdition) {
		actionLoading = true;
		try {
			const current = await pb.collection('editions').getOne(edition.id);
			if (!canTransitionStatus(current.status as EditionStatus, EditionStatus.Published)) {
				toast.error('Complete the final review stage before publishing');
				return;
			}
			const issue = validateCredits(readCredits(current.credits), true);
			if (issue) {
				toast.error(issue);
				return;
			}
			const comment = prompt('Editorial publication explanation (maximum 500 words):');
			if (!comment?.trim()) return;
			await pb.send(`/api/pure3d/editions/${edition.id}/final-decision`, {
				method: 'POST',
				body: { decision: 'publish', comment }
			});
			const saved = await pb.collection('editions').getOne(edition.id);

			edition.status = EditionStatus.Published;
			edition.peerReviewRequested = saved.peerReviewRequested;
			edition.peerReviewStamp = saved.peerReviewStamp;
			edition.publishedAt = saved.publishedAt || null;
			editions = [...editions];
			publishModalEdition = null;
			toast.success('Edition published');
		} catch (error) {
			console.error('Error publishing:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to publish edition');
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
		if (!dateStr) return '';
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function workflowStepHref(editionId: string, status: EditionStatus): string {
		const workflowPath = `${base}/editions/${editionId}/workflow`;
		return workflowPath + workflowAnchor(status);
	}
</script>

<div id="admin-workflow-page" class="mx-auto max-w-6xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Workflow Pipeline</h1>
		<p class="mt-2 text-base-content/60">
			Manage all editions, review rounds, editorial decisions, and publication confirmation.
		</p>
	</div>

	<!-- Stats summary bar -->
	{#if !isLoading}
		<div id="workflow-stats" class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
			<div class="rounded-box border border-base-300 bg-base-100 p-3 text-center">
				<div class="text-2xl font-bold">{tabCounts.submissions}</div>
				<div class="text-xs text-base-content/60">Submissions</div>
			</div>
			<div class="rounded-box border border-base-300 bg-base-100 p-3 text-center">
				<div class="text-2xl font-bold">{tabCounts.editorial}</div>
				<div class="text-xs text-base-content/60">Editorial</div>
			</div>
			<div class="rounded-box border border-base-300 bg-base-100 p-3 text-center">
				<div class="text-2xl font-bold">{tabCounts.alpha}</div>
				<div class="text-xs text-base-content/60">Alpha</div>
			</div>
			<div class="rounded-box border border-base-300 bg-base-100 p-3 text-center">
				<div class="text-2xl font-bold">{tabCounts.final}</div>
				<div class="text-xs text-base-content/60">Final</div>
			</div>
			<div class="rounded-box border border-base-300 bg-base-100 p-3 text-center">
				<div class="text-2xl font-bold">{tabCounts.publish}</div>
				<div class="text-xs text-base-content/60">Publish</div>
			</div>
			<div class="rounded-box border border-base-300 bg-base-100 p-3 text-center">
				<div class="text-2xl font-bold">{tabCounts.all}</div>
				<div class="text-xs text-base-content/60">All Editions</div>
			</div>
		</div>
	{/if}

	<div class="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div>
				<h2 class="text-sm font-semibold tracking-wide text-base-content/70 uppercase">Filters</h2>
				<p class="text-xs text-base-content/50">
					Filter pipeline tabs by edition title or collection.
				</p>
			</div>
			{#if hasActiveFilters}
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					onclick={() => {
						searchQuery = '';
						collectionFilter = '';
					}}
				>
					Clear
				</button>
			{/if}
		</div>
		<div class="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_16rem]">
			<label class="form-control">
				<span class="label pt-0 pb-1"><span class="label-text text-xs">Search</span></span>
				<input
					type="text"
					placeholder="Edition or collection..."
					class="input-bordered input w-full bg-base-200/40"
					bind:value={searchQuery}
				/>
			</label>
			<label class="form-control">
				<span class="label pt-0 pb-1"><span class="label-text text-xs">Collection</span></span>
				<FloatingSelect
					id="workflow-collection-filter"
					bind:value={collectionFilter}
					options={collectionFilterOptions}
					class="w-full bg-base-200/40"
				/>
			</label>
		</div>
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
										<a
											class="btn btn-outline btn-sm"
											href={resolve('/editions/[slug]', { slug: edition.id })}
											>View published edition</a
										>
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
			{#if allEditions.length === 0}
				<p class="py-8 text-center text-base-content/60">No editions match the selected filters.</p>
			{:else}
				<div class="space-y-2">
					{#each allEditions as edition (edition.id)}
						{@render editionCard(
							edition,
							edition.status.startsWith('final') ||
								edition.status === EditionStatus.PublicationRequested
								? ReviewStage.Final
								: edition.status.startsWith('alpha')
									? ReviewStage.Alpha
									: ReviewStage.Concept,
							false
						)}
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>

{#if overrideEdition}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Administrative workflow intervention</h3>
			<p class="mt-2 text-sm text-base-content/70">
				Move <strong>{overrideEdition.title}</strong> from
				{STATUS_LABELS[overrideEdition.status]} with an audited reason.
			</p>
			<div class="mt-4 alert text-sm alert-warning">
				This bypasses transition prerequisites only. It does not create or release reviews, apply a
				peer-review stamp, confirm publication rights, or publish the edition.
			</div>
			<label class="form-control mt-4">
				<span class="label"><span class="label-text">Target workflow stage</span></span>
				<select class="select-bordered select" bind:value={overrideStatus}>
					{#each overrideTargets[overrideEdition.status] || [] as status (status)}
						<option value={status}>{STATUS_LABELS[status]}</option>
					{/each}
				</select>
			</label>
			<label class="form-control mt-4">
				<span class="label"><span class="label-text">Override reason (audited)</span></span>
				<textarea
					class="textarea-bordered textarea"
					rows="4"
					maxlength="5000"
					bind:value={overrideReason}
					placeholder="Explain the prerequisite exception or why this review round is reopening."
				></textarea>
			</label>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					disabled={actionLoading}
					onclick={() => (overrideEdition = null)}>Cancel</button
				>
				<button
					class="btn btn-primary"
					disabled={actionLoading || !overrideStatus || !overrideReason.trim()}
					onclick={applyOverride}
				>
					{#if actionLoading}<span class="loading loading-sm loading-spinner"></span>{/if}
					Record intervention
				</button>
			</div>
		</div>
		<button
			class="modal-backdrop"
			disabled={actionLoading}
			onclick={() => (overrideEdition = null)}
			aria-label="Close administrative workflow intervention"
		></button>
	</div>
{/if}

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
							Released Final Reviews will become public using each reviewer's chosen attribution.
							Alpha feedback stays private.
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
					disabled={actionLoading ||
						!canTransitionStatus(publishModalEdition.status, EditionStatus.Published)}
				>
					{#if actionLoading}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Confirm Publish
				</button>
			</div>
		</div>
		<button
			class="modal-backdrop"
			onclick={() => (publishModalEdition = null)}
			aria-label="Close publish modal"
		></button>
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
			{@const verdictTarget =
				verdict === 'pending' ? null : getTargetStatusFromVerdict(verdict, stage)}
			{@const displayReviews = anonymizeReviews(reviews, assignments, userLookup, true)}
			<div class="space-y-4 border-t border-base-300 px-4 pt-3 pb-4">
				<!-- Timeline -->
				<WorkflowTimeline
					currentStatus={edition.status}
					hrefForStatus={(status) => workflowStepHref(edition.id, status)}
				/>
				<a
					class="btn btn-outline btn-sm"
					href={resolve('/editions/[slug]/workflow', { slug: edition.id })}
				>
					Open edition workspace
				</a>

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
										<th><span class="sr-only">Actions</span></th>
									</tr>
								</thead>
								<tbody>
									{#each assignments as a (a.id)}
										{@const hasReview = reviews.some((r) => r.reviewerId === a.reviewerId)}
										<tr>
											<td>{userLookup.get(a.reviewerId) || 'Unknown'}</td>
											<td>
												{#if a.status === ReviewAssignmentStatus.Declined}<span
														class="badge badge-ghost badge-sm">Declined</span
													>{:else if hasReview}
													<span class="badge badge-sm badge-success">Reviewed</span>
												{:else}
													<span class="badge badge-ghost badge-sm">Pending</span>
												{/if}
											</td>
											<td class="text-base-content/60">{formatDate(a.created)}</td>
											<td>
												{#if !hasReview && [ReviewAssignmentStatus.Pending, ReviewAssignmentStatus.Accepted].includes(a.status)}
													<button
														class="btn btn-ghost btn-xs"
														disabled={actionLoading}
														onclick={() => removePendingAssignment(a)}
													>
														Remove
													</button>
												{/if}
											</td>
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
				{#if displayReviews.length > 0 && stage === ReviewStage.Concept}
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
				{#if assignments.length > 0 && stage === ReviewStage.Concept}
					<div class="flex items-center gap-3">
						<span class="text-sm font-semibold">Aggregate Verdict:</span>
						<span class="badge {getVerdictBadge(verdict)}">{getVerdictLabel(verdict)}</span>
						{#if verdictTarget && canTransitionStatus(edition.status, verdictTarget)}
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
				{#if edition.status === EditionStatus.FinalReview}<FinalEditorialPanel
						editionId={edition.id}
						status={edition.status}
						round={edition.finalReviewRound}
						onchanged={() => void loadData()}
					/>{/if}
				{#if stage === ReviewStage.Alpha && edition.status === EditionStatus.AlphaReview}{#key assignments.length}<AlphaEditorialPanel
							editionId={edition.id}
							round={edition.alphaReviewRound}
							onchanged={() => void loadData()}
						/>{/key}{/if}
				{#if isSubmission || edition.status === EditionStatus.AlphaReview || edition.status === EditionStatus.FinalReview}
					<div class="border-t border-base-300 pt-3">
						<h4 class="mb-2 text-sm font-semibold text-base-content/60 uppercase">
							{isSubmission ? 'Assign Board Member & Start Review' : 'Assign Reviewer'}
						</h4>
						<div class="flex flex-wrap items-end gap-2">
							{#if !isSubmission || needsConceptReviewerAssignment(assignments)}<div
									class="form-control"
								>
									<UserSearchSelect
										users={allUsers.filter((u) => !assignments.some((a) => a.reviewerId === u.id))}
										bind:value={assignUserId}
										placeholder="Search user..."
									/>
								</div>{/if}
							{#if !isSubmission}<label class="text-sm" for="assignment-deadline"
									>Deadline<input
										id="assignment-deadline"
										class="input-bordered input input-sm block"
										type="date"
										bind:value={assignDueAt}
									/></label
								>{/if}
							{#if stage === ReviewStage.Final}<label class="text-sm" for="replacement-reason"
									>Reason for reviewer replacement<input
										id="replacement-reason"
										class="input-bordered input input-sm block"
										bind:value={replacementReason}
									/></label
								>{/if}
							<button
								class="btn btn-sm btn-primary"
								onclick={() =>
									isSubmission
										? assignAndStartReview(edition)
										: assignStageReviewer(edition, stage)}
								disabled={(!assignUserId &&
									(!isSubmission || needsConceptReviewerAssignment(assignments))) ||
									actionLoading}
							>
								{#if actionLoading}
									<span class="loading loading-xs loading-spinner"></span>
								{/if}
								{isSubmission
									? needsConceptReviewerAssignment(assignments)
										? 'Assign & Start Review'
										: 'Start Review'
									: 'Assign'}
							</button>
						</div>
					</div>
				{/if}

				{#if overrideTargets[edition.status]?.length}
					<div class="border-t border-base-300 pt-3">
						<h4 class="text-sm font-semibold text-base-content/60 uppercase">
							Administrative intervention
						</h4>
						<p class="mt-1 text-sm text-base-content/60">
							Advance or reopen this workflow when documented prerequisites require an exception.
						</p>
						<button class="btn mt-2 btn-outline btn-sm" onclick={() => openOverride(edition)}>
							Override workflow
						</button>
					</div>
				{/if}

				<!-- Advance status buttons for accepted states -->
				{#if edition.status === EditionStatus.ConceptAccepted}
					<div class="border-t border-base-300 pt-3">
						<p class="mb-2 text-sm">
							The author prepares the edition and requests Alpha Review from the Review tab.
						</p>
						<a
							class="btn btn-outline btn-sm"
							href={resolve('/editions/[slug]/workflow', { slug: edition.id })}
							>Open edition workspace</a
						>
					</div>
				{/if}
				{#if [EditionStatus.AlphaAccepted, EditionStatus.FinalRevisions, EditionStatus.FinalAccepted].includes(edition.status)}
					<div class="border-t border-base-300 pt-3">
						<a
							class="btn btn-outline btn-sm"
							href={resolve('/editions/[slug]/workflow', { slug: edition.id })}
							>Open author submission workspace</a
						>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}
