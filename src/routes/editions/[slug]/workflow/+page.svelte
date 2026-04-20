<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import {
		CollectionRole,
		EditionStatus,
		GlobalRole,
		ReviewStage,
		STATUS_LABELS,
		EDITION_STATUS_TRANSITIONS,
		type UserRoleContext
	} from '$lib/types/roles';
	import { canDeleteEdition } from '$lib/utils/permissions';
	import { ReviewDecision } from '$lib/types/reviews';
	import type { EditionReview, ReviewAssignment } from '$lib/types/reviews';
	import { updateEditionStatus } from '$lib/database/edition-helpers';
	import { logAudit } from '$lib/utils/audit';
	import { notifyMany } from '$lib/utils/notifications';
	import { NotificationType } from '$lib/types/notifications';
	import { anonymizeReviews, getAdminUserIds } from '$lib/utils/review-helpers';
	import type { ReviewFeedback } from '$lib/types/reviews';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import WorkflowTimeline from '$lib/components/workflow/WorkflowTimeline.svelte';
	import ReviewForm from '$lib/components/workflow/ReviewForm.svelte';
	import CollaboratorManager from '$lib/components/workflow/CollaboratorManager.svelte';
	import ReviewFeedbackForm from '$lib/components/workflow/ReviewFeedbackForm.svelte';
	import ReviewFeedbackList from '$lib/components/workflow/ReviewFeedbackList.svelte';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import EditionAssetsPanel from '$lib/components/uploads/EditionAssetsPanel.svelte';
	import { DEFAULT_VOYAGER_VERSION } from '$lib/utils/asset-urls';
	import toast from 'svelte-french-toast';
	import type { RecordModel } from 'pocketbase';

	interface Edition {
		id: string;
		title: string;
		description: string;
		status: EditionStatus;
		collectionId: string;
		collectionTitle: string;
		peerReviewRequested: boolean;
		created: string;
	}

	let edition = $state<Edition | null>(null);
	let editionRecord = $state<RecordModel | null>(null);
	let isLoading = $state(true);
	let assignments = $state<ReviewAssignment[]>([]);
	let reviews = $state<EditionReview[]>([]);
	let userLookup = $state(new Map<string, string>());
	let isAuthor = $state(false);
	let isReviewer = $state(false);
	let myAssignment = $state<ReviewAssignment | null>(null);
	let myExistingReview = $state<EditionReview | null>(null);
	let isAdmin = $derived(
		authStore.globalRole === GlobalRole.Admin
	);
	let collectionRole = $state<CollectionRole | undefined>(undefined);
	let roleContext = $derived<UserRoleContext>({
		globalRole: authStore.globalRole,
		collectionRole
	});
	let canDelete = $derived(!!edition && canDeleteEdition(roleContext));
	let showDeleteModal = $state(false);
	let isDeleting = $state(false);

	// Concept form state
	let conceptTitle = $state('');
	let conceptDescription = $state('');
	let conceptPeerReview = $state(false);
	let conceptDcSubtitle = $state('');
	let conceptDcCreator = $state('');
	let conceptDcContributor = $state('');
	let conceptDcInstitution = $state('');
	let conceptDcSubject = $state('');
	let conceptDcKeyword = $state('');
	let conceptDcCoveragePlace = $state('');
	let conceptDcLanguage = $state('');
	let conceptDcRightsHolder = $state('');
	let conceptDcRightsLicense = $state('');
	let isSaving = $state(false);
	let isSubmitting = $state(false);

	// Viewer-mirror layout state
	let activeFormTab = $state<'description' | 'metadata' | 'peer-review' | 'team'>('description');
	let isSidebarCollapsed = $state(false);

	// Scene/viewer state
	let editionPubNum = $state(0);
	let collectionPubNum = $state(0);
	let sceneFile = $state('');
	let voyagerVersion = $state(DEFAULT_VOYAGER_VERSION);

	function jsonArrayToString(val: unknown): string {
		if (Array.isArray(val)) return val.join(', ');
		return '';
	}

	function stringToJsonArray(val: string): string[] {
		return val.split(',').map((s) => s.trim()).filter(Boolean);
	}

	// Collections for concept form
	let collections = $state<{ id: string; title: string }[]>([]);

	// Determine the current review stage based on edition status
	let currentStage = $derived.by<number | null>(() => {
		if (!edition) return null;
		switch (edition.status) {
			case EditionStatus.ConceptSubmitted:
			case EditionStatus.EditorialReview:
				return ReviewStage.Concept;
			case EditionStatus.AlphaReview:
			case EditionStatus.AlphaRevisions:
				return ReviewStage.Alpha;
			case EditionStatus.FinalReview:
			case EditionStatus.FinalRevisions:
				return ReviewStage.Final;
			default:
				return null;
		}
	});

	// Which view to show
	let viewMode = $derived.by<'concept-form' | 'review-form' | 'status-view'>(() => {
		if (!edition) return 'status-view';

		// Authors see concept form for draft/rejected editions
		if (
			isAuthor &&
			(edition.status === EditionStatus.Draft || edition.status === EditionStatus.ConceptRejected)
		) {
			return 'concept-form';
		}

		// Reviewers see review form if assigned and haven't submitted yet
		if (isReviewer && myAssignment && !myExistingReview && currentStage !== null) {
			return 'review-form';
		}

		return 'status-view';
	});

	// Anonymized reviews for display
	let displayReviews = $derived.by(() => {
		if (!edition) return [];
		const stage = currentStage ?? ReviewStage.Concept;
		return anonymizeReviews(reviews, assignments, stage, userLookup, isAdmin);
	});

	// Can the author resubmit?
	let canResubmit = $derived(
		isAuthor &&
			edition !== null &&
			(edition.status === EditionStatus.AlphaRevisions ||
				edition.status === EditionStatus.FinalRevisions)
	);

	// Can the author manage collaborators?
	let canManageCollaborators = $derived(
		isAuthor &&
			edition !== null &&
			[
				EditionStatus.Draft,
				EditionStatus.ConceptRejected,
				EditionStatus.AlphaRevisions,
				EditionStatus.FinalRevisions
			].includes(edition.status)
	);

	// Can the author resolve feedback items?
	let canResolveFeedback = $derived(
		isAuthor &&
			edition !== null &&
			[EditionStatus.AlphaRevisions, EditionStatus.FinalRevisions].includes(edition.status)
	);

	// Reference to feedback list for reloading
	let feedbackListRef: ReviewFeedbackList | undefined = $state();

	// Previous rejection/revision feedback for display
	let previousFeedback = $derived.by(() => {
		if (!edition) return [];
		return reviews
			.filter(
				(r) =>
					r.decision === ReviewDecision.Reject || r.decision === ReviewDecision.RequestRevisions
			)
			.map((r) => ({
				comment: r.comment,
				decision: r.decision,
				created: r.created
			}));
	});

	onMount(async () => {
		if (!authStore.isAuthenticated) {
			goto(`${base}/`);
			return;
		}
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		const slug = $page.params.slug || '';

		try {
			// Load edition
			const edRecord = await pb.collection('editions').getOne(slug, {
				expand: 'collection'
			});
			editionRecord = edRecord;
			edition = {
				id: edRecord.id,
				title: edRecord.dcTitle || edRecord.title || '',
				description: edRecord.dcAbstract || edRecord.dcDescription || '',
				status: (edRecord.status as EditionStatus) || EditionStatus.Draft,
				collectionId: edRecord.collection || '',
				collectionTitle: edRecord.expand?.collection?.title || '',
				peerReviewRequested: edRecord.peerReviewRequested || false,
				created: edRecord.created
			};

			// Initialize concept form
			conceptTitle = edition.title;
			conceptDescription = edition.description;
			conceptPeerReview = edition.peerReviewRequested;
			conceptDcSubtitle = edRecord.dcSubtitle || '';
			conceptDcCreator = jsonArrayToString(edRecord.dcCreator);
			conceptDcContributor = jsonArrayToString(edRecord.dcContributor);
			conceptDcInstitution = jsonArrayToString(edRecord.dcInstitution);
			conceptDcSubject = jsonArrayToString(edRecord.dcSubject);
			conceptDcKeyword = jsonArrayToString(edRecord.dcKeyword);
			conceptDcCoveragePlace = edRecord.dcCoveragePlace || '';
			conceptDcLanguage = jsonArrayToString(edRecord.dcLanguage);
			conceptDcRightsHolder = edRecord.dcRightsHolder || '';
			conceptDcRightsLicense = edRecord.dcRightsLicense || '';

			// Initialize viewer/scene data
			editionPubNum = edRecord.pubNum || 0;
			collectionPubNum = edRecord.expand?.collection?.pubNum || 0;
			sceneFile = edRecord.settingsSceneFile || edRecord.sceneFile || '';
			voyagerVersion = edRecord.settingsAuthorToolVersion || DEFAULT_VOYAGER_VERSION;

			// Load user's relationship to this edition
			if (authStore.appUserId) {
				const edUsers = await pb.collection('editionUsers').getList(1, 10, {
					filter: `editionId = "${edition.id}" && userId = "${authStore.appUserId}"`
				});
				isAuthor = edUsers.items.some((r) => r.role === 'author');
				isReviewer = edUsers.items.some((r) => r.role === 'reviewer');

				if (edition.collectionId) {
					const collRoles = await pb.collection('collectionUsers').getList(1, 1, {
						filter: `collection = "${edition.collectionId}" && userId = "${authStore.appUserId}"`
					});
					collectionRole = (collRoles.items[0]?.role as CollectionRole) || undefined;
				}
			}

			// Load assignments and reviews
			const [assignResult, reviewResult] = await Promise.all([
				pb.collection('reviewAssignments').getList(1, 50, {
					filter: `editionId = "${edition.id}"`,
					sort: 'created'
				}),
				pb.collection('editionReviews').getList(1, 50, {
					filter: `editionId = "${edition.id}"`,
					sort: '-created'
				})
			]);

			assignments = assignResult.items.map((r) => ({
				id: r.id,
				editionId: r.editionId,
				reviewerId: r.reviewerId,
				reviewStage: r.reviewStage,
				assignedBy: r.assignedBy,
				status: r.status,
				created: r.created,
				updated: r.updated
			}));

			reviews = reviewResult.items.map((r) => ({
				id: r.id,
				editionId: r.editionId,
				reviewerId: r.reviewerId,
				reviewStage: r.reviewStage,
				decision: r.decision as ReviewDecision,
				comment: r.comment || null,
				created: r.created,
				updated: r.updated
			}));

			// Find current user's assignment and existing review
			if (authStore.appUserId) {
				myAssignment = assignments.find((a) => a.reviewerId === authStore.appUserId) || null;
				myExistingReview = reviews.find((r) => r.reviewerId === authStore.appUserId) || null;
			}

			// Build user lookup for display names
			const reviewerIds = [
				...new Set([...assignments.map((a) => a.reviewerId), ...reviews.map((r) => r.reviewerId)])
			];
			if (reviewerIds.length > 0) {
				const userResult = await pb.collection('userProfiles').getList(1, 100, {
					filter: reviewerIds.map((id) => `id = "${id}"`).join(' || ')
				});
				userLookup = new Map(
					userResult.items.map((u) => [u.id, u.nickname || u.email || 'Unknown'])
				);
			}

			// Auth guard: redirect if user has no relation and isn't admin
			if (!isAuthor && !isReviewer && !isAdmin) {
				toast.error('You do not have access to this workflow');
				goto(`${base}/editions/${slug}`);
				return;
			}

			// Load collections for concept form
			const colResult = await pb.collection('collections').getList(1, 500);
			collections = colResult.items.map((r) => ({ id: r.id, title: r.title }));
		} catch (error) {
			console.error('Error loading workflow data:', error);
			toast.error('Failed to load workflow data');
			goto(`${base}/editions/${slug}`);
		} finally {
			isLoading = false;
		}
	}

	// --- Concept Form Actions ---
	function buildEditionData() {
		return {
			title: conceptTitle.trim(),
			dcTitle: conceptTitle.trim(),
			dcSubtitle: conceptDcSubtitle.trim(),
			dcAbstract: conceptDescription,
			dcDescription: conceptDescription,
			dcCreator: stringToJsonArray(conceptDcCreator),
			dcContributor: stringToJsonArray(conceptDcContributor),
			dcInstitution: stringToJsonArray(conceptDcInstitution),
			dcSubject: stringToJsonArray(conceptDcSubject),
			dcKeyword: stringToJsonArray(conceptDcKeyword),
			dcCoveragePlace: conceptDcCoveragePlace.trim(),
			dcLanguage: stringToJsonArray(conceptDcLanguage),
			dcRightsHolder: conceptDcRightsHolder.trim(),
			dcRightsLicense: conceptDcRightsLicense.trim(),
			peerReviewRequested: conceptPeerReview
		};
	}

	async function saveDraft() {
		if (!edition) return;
		isSaving = true;
		try {
			await pb.collection('editions').update(edition.id, buildEditionData());
			edition.title = conceptTitle;
			edition.description = conceptDescription;
			edition.peerReviewRequested = conceptPeerReview;
			toast.success('Draft saved');
		} catch (error) {
			console.error('Error saving draft:', error);
			toast.error('Failed to save draft');
		} finally {
			isSaving = false;
		}
	}

	async function deleteEdition() {
		if (!edition || isDeleting) return;
		isDeleting = true;
		try {
			const deletedId = edition.id;
			const deletedTitle = edition.title;
			const deletedStatus = edition.status;
			await pb.collection('editions').delete(deletedId);
			await logAudit('edition_deleted', 'edition', deletedId, authStore.user?.email || '', {
				title: deletedTitle,
				status: deletedStatus
			});
			toast.success('Edition deleted');
			showDeleteModal = false;
			goto(`${base}/editions`);
		} catch (error) {
			console.error('Error deleting edition:', error);
			toast.error('Failed to delete edition');
			isDeleting = false;
		}
	}

	async function submitConcept() {
		if (!edition) return;
		if (!conceptTitle.trim()) {
			toast.error('Title is required');
			return;
		}
		isSubmitting = true;
		try {
			await pb.collection('editions').update(edition.id, buildEditionData());

			await updateEditionStatus(edition.id, EditionStatus.ConceptSubmitted);

			await logAudit('status_transition', 'edition', edition.id, authStore.user?.email || '', {
				from: edition.status,
				to: EditionStatus.ConceptSubmitted,
				title: conceptTitle
			});

			// Notify admins
			const adminIds = await getAdminUserIds();
			await notifyMany(
				adminIds,
				NotificationType.ConceptSubmitted,
				'New concept submitted',
				`"${conceptTitle}" has been submitted for review.`,
				edition.id,
				`${base}/admin/workflow`
			);

			edition.status = EditionStatus.ConceptSubmitted;
			edition.title = conceptTitle;
			edition.description = conceptDescription;
			toast.success('Concept submitted for review');
		} catch (error) {
			console.error('Error submitting concept:', error);
			toast.error('Failed to submit concept');
		} finally {
			isSubmitting = false;
		}
	}

	// --- Resubmit after revisions ---
	async function resubmit() {
		if (!edition) return;
		isSubmitting = true;
		try {
			const targetStatus =
				edition.status === EditionStatus.AlphaRevisions
					? EditionStatus.AlphaReview
					: EditionStatus.FinalReview;

			await updateEditionStatus(edition.id, targetStatus);

			await logAudit('status_transition', 'edition', edition.id, authStore.user?.email || '', {
				from: edition.status,
				to: targetStatus
			});

			const adminIds = await getAdminUserIds();
			await notifyMany(
				adminIds,
				NotificationType.StatusChanged,
				'Edition resubmitted',
				`"${edition.title}" has been resubmitted after revisions.`,
				edition.id,
				`${base}/admin/workflow`
			);

			edition.status = targetStatus;
			toast.success('Resubmitted for review');
		} catch (error) {
			console.error('Error resubmitting:', error);
			toast.error('Failed to resubmit');
		} finally {
			isSubmitting = false;
		}
	}

	function handleReviewSubmitted() {
		loadData();
	}

	function handleFeedbackSubmitted() {
		feedbackListRef?.loadFeedback();
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
</script>

<div id="edition-workflow-page" class="mx-auto p-4 lg:p-8" class:max-w-7xl={edition && viewMode === 'concept-form'} class:max-w-4xl={!edition || viewMode !== 'concept-form'}>
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if edition}
		<!-- Header -->
		{#if viewMode !== 'concept-form'}
			<div class="mb-6">
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="text-2xl font-bold">{edition.title || 'Untitled Edition'}</h1>
					<StatusBadge status={edition.status} />
					{#if canDelete}
						<button
							type="button"
							class="btn btn-sm btn-error btn-outline ms-auto"
							onclick={() => (showDeleteModal = true)}
						>
							Delete Edition
						</button>
					{/if}
				</div>
				{#if edition.collectionTitle}
					<p class="mt-1 text-base-content/60">in {edition.collectionTitle}</p>
				{/if}
				<a href="{base}/editions/{edition.id}" class="mt-2 inline-block link text-sm link-primary">
					View Edition
				</a>
			</div>
		{/if}

		<!-- Workflow Timeline (always visible) -->
		<div class="mb-6">
			<WorkflowTimeline currentStatus={edition.status} />
		</div>

		<!-- Concept Proposal Form — mirrors viewer layout -->
		{#if viewMode === 'concept-form'}
			<!-- Show rejection feedback if resubmitting -->
			{#if edition.status === EditionStatus.ConceptRejected && previousFeedback.length > 0}
				<div class="mb-4 alert alert-warning">
					<div>
						<p class="font-semibold">Previous Review Feedback</p>
						{#each previousFeedback as fb (fb.created)}
							{#if fb.comment}
								<p class="mt-1 text-sm">{fb.comment}</p>
							{/if}
						{/each}
					</div>
				</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); submitConcept(); }}>
				<!-- Header: editable title + authors (mirrors viewer header) -->
				<div class="mb-6 flex items-start gap-4">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-3">
							<input
								type="text"
								class="input input-bordered w-full text-3xl font-bold placeholder:text-base-content/30 md:text-4xl h-auto py-3"
								bind:value={conceptTitle}
								required
								placeholder="Edition title"
							/>
							<StatusBadge status={edition.status} />
						</div>
						<input
							type="text"
							class="input input-bordered mt-2 w-full text-base-content/70 placeholder:text-base-content/30"
							bind:value={conceptDcCreator}
							placeholder="Authors (comma-separated)"
						/>
						{#if edition.collectionTitle}
							<p class="mt-1 text-sm text-base-content/50">in {edition.collectionTitle}</p>
						{/if}
					</div>
					<!-- Sidebar toggle -->
					<button
						type="button"
						onclick={() => (isSidebarCollapsed = !isSidebarCollapsed)}
						class="btn hidden btn-ghost btn-sm lg:flex"
					>
						{isSidebarCollapsed ? 'Show details' : 'Hide details'}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-300" class:rotate-180={isSidebarCollapsed} fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				</div>

				<!-- Two-column layout (mirrors viewer) -->
				<div class="relative flex flex-col gap-8 transition-all duration-300 lg:flex-row lg:items-start">
					<!-- Left Column: 3D Viewer + Asset Uploads -->
					<div class="min-w-0 flex-1 space-y-4">
						{#if editionRecord}
							<EditionAssetsPanel
								bind:edition={editionRecord}
								{collectionPubNum}
								{editionPubNum}
								onupdated={(r) => (editionRecord = r)}
							/>
						{/if}
					</div>

					<!-- Right Column: Tabbed Sidebar -->
					<div
						class="shrink-0 transition-all duration-300 ease-in-out"
						class:lg:w-96={!isSidebarCollapsed}
						class:lg:w-0={isSidebarCollapsed}
					>
						<div class="lg:sticky lg:top-4">
							<div
								class="card overflow-hidden bg-base-200 shadow-xl transition-all duration-300"
								class:lg:w-0={isSidebarCollapsed}
								class:lg:opacity-0={isSidebarCollapsed}
								class:lg:invisible={isSidebarCollapsed}
							>
								<div class="w-96 max-w-full p-0">
									<!-- Tabs -->
									<div role="tablist" class="tabs-bordered tabs bg-base-300">
										<button type="button" role="tab" class="tab flex-1" class:tab-active={activeFormTab === 'description'} onclick={() => (activeFormTab = 'description')}>
											Description
										</button>
										<button type="button" role="tab" class="tab flex-1" class:tab-active={activeFormTab === 'metadata'} onclick={() => (activeFormTab = 'metadata')}>
											Metadata
										</button>
										<button type="button" role="tab" class="tab flex-1" class:tab-active={activeFormTab === 'peer-review'} onclick={() => (activeFormTab = 'peer-review')}>
											Review
										</button>
										<button type="button" role="tab" class="tab flex-1" class:tab-active={activeFormTab === 'team'} onclick={() => (activeFormTab = 'team')}>
											Team
										</button>
									</div>

									<!-- Tab Content -->
									<div class="p-5">
										{#if activeFormTab === 'description'}
											<div class="space-y-4">
												<div>
													<span class="mb-2 block text-sm font-semibold">Abstract</span>
													<RichTextEditor content={conceptDescription} onchange={(html) => (conceptDescription = html)} minHeight="150px" />
												</div>
												<div class="form-control">
													<label class="label py-0.5" for="concept-keyword">
														<span class="label-text text-sm font-semibold">Tags / Keywords</span>
														<span class="label-text-alt text-xs">comma-separated</span>
													</label>
													<input id="concept-keyword" type="text" class="input-bordered input input-sm" bind:value={conceptDcKeyword} placeholder="ceramic, sculpture, museum" />
												</div>
											</div>

										{:else if activeFormTab === 'metadata'}
											<div class="space-y-3">
												<div class="form-control">
													<label class="label py-0.5" for="concept-subtitle">
														<span class="label-text text-sm">Subtitle</span>
													</label>
													<input id="concept-subtitle" type="text" class="input-bordered input input-sm" bind:value={conceptDcSubtitle} />
												</div>
												<div class="form-control">
													<label class="label py-0.5" for="concept-contributor">
														<span class="label-text text-sm">Contributors</span>
													</label>
													<input id="concept-contributor" type="text" class="input-bordered input input-sm" bind:value={conceptDcContributor} placeholder="comma-separated" />
												</div>
												<div class="form-control">
													<label class="label py-0.5" for="concept-institution">
														<span class="label-text text-sm">Institutions</span>
													</label>
													<input id="concept-institution" type="text" class="input-bordered input input-sm" bind:value={conceptDcInstitution} placeholder="comma-separated" />
												</div>
												<div class="form-control">
													<label class="label py-0.5" for="concept-subject">
														<span class="label-text text-sm">Subjects</span>
													</label>
													<input id="concept-subject" type="text" class="input-bordered input input-sm" bind:value={conceptDcSubject} placeholder="comma-separated" />
												</div>
												<div class="grid grid-cols-2 gap-3">
													<div class="form-control">
														<label class="label py-0.5" for="concept-place">
															<span class="label-text text-sm">Place</span>
														</label>
														<input id="concept-place" type="text" class="input-bordered input input-sm" bind:value={conceptDcCoveragePlace} placeholder="Rome, Italy" />
													</div>
													<div class="form-control">
														<label class="label py-0.5" for="concept-language">
															<span class="label-text text-sm">Languages</span>
														</label>
														<input id="concept-language" type="text" class="input-bordered input input-sm" bind:value={conceptDcLanguage} placeholder="en, nl" />
													</div>
												</div>
												<div class="grid grid-cols-2 gap-3">
													<div class="form-control">
														<label class="label py-0.5" for="concept-rights-holder">
															<span class="label-text text-sm">Rights Holder</span>
														</label>
														<input id="concept-rights-holder" type="text" class="input-bordered input input-sm" bind:value={conceptDcRightsHolder} />
													</div>
													<div class="form-control">
														<label class="label py-0.5" for="concept-license">
															<span class="label-text text-sm">License</span>
														</label>
														<input id="concept-license" type="text" class="input-bordered input input-sm" bind:value={conceptDcRightsLicense} placeholder="CC BY 4.0" />
													</div>
												</div>
											</div>

										{:else if activeFormTab === 'peer-review'}
											<div class="space-y-4">
												<label class="flex cursor-pointer items-start gap-3">
													<input type="checkbox" class="checkbox checkbox-sm mt-0.5" bind:checked={conceptPeerReview} />
													<div>
														<span class="text-sm font-semibold">Request peer review</span>
														<p class="text-xs text-base-content/60">
															If enabled, the edition will go through alpha and final review stages before publication.
														</p>
													</div>
												</label>
												{#if edition.status === EditionStatus.ConceptRejected && previousFeedback.length > 0}
													<div class="mt-4">
														<h3 class="mb-2 text-sm font-semibold">Previous Feedback</h3>
														{#each previousFeedback as fb (fb.created)}
															{#if fb.comment}
																<p class="mt-1 rounded bg-base-300 p-2 text-sm">{fb.comment}</p>
															{/if}
														{/each}
													</div>
												{/if}
											</div>

										{:else if activeFormTab === 'team'}
											<CollaboratorManager editionId={edition.id} isReadOnly={!canManageCollaborators} />
										{/if}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Action bar -->
				<div class="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-base-300 pt-4">
					<a href="{base}/editions/{edition.id}" class="link text-sm link-primary mr-auto">View Edition</a>
					<button
						type="button"
						class="btn btn-primary btn-sm"
						onclick={saveDraft}
						disabled={isSaving || isSubmitting}
					>
						{#if isSaving}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Draft Proposal
					</button>
					<button type="submit" class="btn btn-outline btn-primary btn-sm" disabled={isSaving || isSubmitting}>
						{#if isSubmitting}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Submit for Review
					</button>
				</div>
			</form>
		{/if}

		<!-- Review Form (for assigned reviewers) -->
		{#if viewMode === 'review-form' && myAssignment && edition}
			<div class="space-y-6">
				<div class="rounded-box border border-base-300 bg-base-100 p-6">
					<h2 class="mb-2 text-xl font-semibold">Edition Details</h2>
					<p class="text-base-content/70">{edition.description || 'No description provided.'}</p>
					<a
						href="{base}/editions/{edition.id}"
						class="mt-2 inline-block link text-sm link-primary"
					>
						Open 3D Viewer
					</a>
				</div>

				<!-- Previous round feedback if revision resubmission -->
				{#if previousFeedback.length > 0}
					<div class="alert alert-info">
						<div>
							<p class="font-semibold">Previous Round Feedback</p>
							{#each previousFeedback as fb (fb.created)}
								{#if fb.comment}
									<p class="mt-1 text-sm">{fb.comment}</p>
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				<div class="rounded-box border border-base-300 bg-base-100 p-6">
					<h2 class="mb-4 text-xl font-semibold">Submit Your Review</h2>
					<ReviewForm
						editionId={edition.id}
						reviewStage={myAssignment.reviewStage}
						reviewerId={authStore.appUserId || ''}
						onsubmit={handleReviewSubmitted}
					/>
				</div>

				<!-- Granular feedback (reviewer) -->
				<div class="rounded-box border border-base-300 bg-base-100 p-6">
					<h2 class="mb-4 text-lg font-semibold">Granular Feedback</h2>
					<ReviewFeedbackForm
						editionId={edition.id}
						reviewStage={myAssignment.reviewStage}
						reviewerId={authStore.appUserId || ''}
						onsubmit={handleFeedbackSubmitted}
					/>
					<div class="divider"></div>
					<ReviewFeedbackList
						bind:this={feedbackListRef}
						editionId={edition.id}
						reviewStage={myAssignment.reviewStage}
						isAnonymized={myAssignment.reviewStage === 2}
						{userLookup}
					/>
				</div>
			</div>
		{/if}

		<!-- Status View (default for authors viewing progress) -->
		{#if viewMode === 'status-view'}
			<div class="space-y-6">
				<!-- Review feedback (if any) -->
				{#if displayReviews.length > 0}
					<div class="rounded-box border border-base-300 bg-base-100 p-6">
						<h2 class="mb-4 text-lg font-semibold">Review Feedback</h2>
						<div class="space-y-3">
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
									<p class="mt-1 text-xs text-base-content/40">
										{formatDate(review.created)}
									</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Reviewer: already submitted review -->
				{#if isReviewer && myExistingReview}
					<div class="alert alert-success">
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
								d="m4.5 12.75 6 6 9-13.5"
							/>
						</svg>
						<p>
							You have already submitted your review ({myExistingReview.decision === 'approve'
								? 'Approved'
								: myExistingReview.decision === 'reject'
									? 'Rejected'
									: 'Revisions Requested'}).
						</p>
					</div>
				{/if}

				<!-- Granular feedback list (author view) -->
				{#if edition && (isAuthor || isAdmin)}
					<div class="rounded-box border border-base-300 bg-base-100 p-6">
						<h2 class="mb-4 text-lg font-semibold">Detailed Feedback</h2>
						<ReviewFeedbackList
							editionId={edition.id}
							canResolve={canResolveFeedback}
							isAnonymized={currentStage === 2}
							{userLookup}
						/>
					</div>
				{/if}

				<!-- Collaborator Management (status view) -->
				{#if edition && isAuthor}
					<div class="rounded-box border border-base-300 bg-base-100 p-6">
						<h2 class="mb-4 text-lg font-semibold">Collaborators</h2>
						<CollaboratorManager editionId={edition.id} isReadOnly={!canManageCollaborators} />
					</div>
				{/if}

				<!-- Resubmit button for authors with revisions -->
				{#if canResubmit}
					<div class="rounded-box border border-base-300 bg-base-100 p-6">
						<h2 class="mb-2 text-lg font-semibold">Revisions Requested</h2>
						<p class="mb-4 text-base-content/70">
							Please make the requested changes to your edition, then resubmit for review.
						</p>
						<div class="flex gap-2">
							<a href="{base}/editions/{edition.id}" class="btn btn-ghost btn-sm"> Edit Edition </a>
							<button class="btn btn-sm btn-primary" onclick={resubmit} disabled={isSubmitting}>
								{#if isSubmitting}
									<span class="loading loading-sm loading-spinner"></span>
								{/if}
								Resubmit for Review
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

{#if showDeleteModal && edition}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete edition?</h3>
			<p class="py-4">
				This will permanently delete <strong>{edition.title || 'this edition'}</strong>. This
				action cannot be undone.
			</p>
			<div class="modal-action">
				<button
					type="button"
					class="btn"
					onclick={() => (showDeleteModal = false)}
					disabled={isDeleting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-error"
					onclick={deleteEdition}
					disabled={isDeleting}
				>
					{#if isDeleting}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Delete
				</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop"
			onclick={() => !isDeleting && (showDeleteModal = false)}
			aria-label="Close"
		></button>
	</div>
{/if}
