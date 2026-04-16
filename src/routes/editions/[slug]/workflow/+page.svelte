<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import {
		EditionStatus,
		GlobalRole,
		ReviewStage,
		STATUS_LABELS,
		EDITION_STATUS_TRANSITIONS
	} from '$lib/types/roles';
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
	import toast from 'svelte-french-toast';

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
	let isLoading = $state(true);
	let assignments = $state<ReviewAssignment[]>([]);
	let reviews = $state<EditionReview[]>([]);
	let userLookup = $state(new Map<string, string>());
	let isAuthor = $state(false);
	let isReviewer = $state(false);
	let myAssignment = $state<ReviewAssignment | null>(null);
	let myExistingReview = $state<EditionReview | null>(null);
	let isAdmin = $derived(
		authStore.globalRole === GlobalRole.SuperAdmin || authStore.globalRole === GlobalRole.Admin
	);

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

			// Load user's relationship to this edition
			if (authStore.appUserId) {
				const edUsers = await pb.collection('editionUsers').getList(1, 10, {
					filter: `editionId = "${edition.id}" && userId = "${authStore.appUserId}"`
				});
				isAuthor = edUsers.items.some((r) => r.role === 'author');
				isReviewer = edUsers.items.some((r) => r.role === 'reviewer');
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

<div id="edition-workflow-page" class="mx-auto max-w-4xl p-4 lg:p-8">
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if edition}
		<!-- Header -->
		<div class="mb-6">
			<div class="flex flex-wrap items-center gap-3">
				<h1 class="text-2xl font-bold">{edition.title || 'Untitled Edition'}</h1>
				<StatusBadge status={edition.status} />
			</div>
			{#if edition.collectionTitle}
				<p class="mt-1 text-base-content/60">in {edition.collectionTitle}</p>
			{/if}
			<a href="{base}/editions/{edition.id}" class="mt-2 inline-block link text-sm link-primary">
				View Edition
			</a>
		</div>

		<!-- Workflow Timeline (always visible) -->
		<div class="mb-6">
			<WorkflowTimeline currentStatus={edition.status} />
		</div>

		<!-- Concept Proposal Form -->
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

			<form
				onsubmit={(e) => {
					e.preventDefault();
					submitConcept();
				}}
			>
				<!-- Basic Information -->
				<section class="mb-6">
					<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">Basic Information</h2>
					<div class="grid gap-5 md:grid-cols-2">
						<div class="opacity-50">
							<div class="flex aspect-[4/3] items-center justify-center rounded-lg border-2 border-dashed border-base-300 bg-base-200">
								<div class="text-center text-base-content/40">
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="mx-auto mb-1 size-8">
										<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
									</svg>
									<p class="text-xs">Cover Image</p>
								</div>
							</div>
							<button type="button" class="btn btn-outline btn-xs mt-2 w-full" disabled>Upload Image</button>
							<p class="mt-1 text-center text-xs text-base-content/40">JPG, PNG, WebP</p>
						</div>
						<div class="space-y-3">
							<div class="form-control">
								<label class="label py-0.5" for="concept-title">
									<span class="label-text text-sm font-medium">Title *</span>
								</label>
								<input id="concept-title" type="text" class="input-bordered input input-sm" bind:value={conceptTitle} required placeholder="Edition title" />
							</div>
							<div class="form-control">
								<label class="label py-0.5" for="concept-subtitle">
									<span class="label-text text-sm">Subtitle</span>
								</label>
								<input id="concept-subtitle" type="text" class="input-bordered input input-sm" bind:value={conceptDcSubtitle} />
							</div>
						</div>
					</div>
				</section>

				<div class="divider my-2"></div>

				<!-- People -->
				<section class="mb-6">
					<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">People</h2>
					<div class="grid gap-x-4 gap-y-3 md:grid-cols-2">
						<div class="form-control">
							<label class="label py-0.5" for="concept-creator">
								<span class="label-text text-sm">Creators</span>
								<span class="label-text-alt text-xs">comma-separated</span>
							</label>
							<input id="concept-creator" type="text" class="input-bordered input input-sm" bind:value={conceptDcCreator} placeholder="Author A, Author B" />
						</div>
						<div class="form-control">
							<label class="label py-0.5" for="concept-contributor">
								<span class="label-text text-sm">Contributors</span>
								<span class="label-text-alt text-xs">comma-separated</span>
							</label>
							<input id="concept-contributor" type="text" class="input-bordered input input-sm" bind:value={conceptDcContributor} />
						</div>
						<div class="form-control">
							<label class="label py-0.5" for="concept-institution">
								<span class="label-text text-sm">Institutions</span>
								<span class="label-text-alt text-xs">comma-separated</span>
							</label>
							<input id="concept-institution" type="text" class="input-bordered input input-sm" bind:value={conceptDcInstitution} />
						</div>
					</div>
				</section>

				<div class="divider my-2"></div>

				<!-- Classification -->
				<section class="mb-6">
					<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">Classification</h2>
					<div class="grid gap-x-4 gap-y-3 md:grid-cols-2">
						<div class="form-control">
							<label class="label py-0.5" for="concept-subject">
								<span class="label-text text-sm">Subjects</span>
								<span class="label-text-alt text-xs">comma-separated</span>
							</label>
							<input id="concept-subject" type="text" class="input-bordered input input-sm" bind:value={conceptDcSubject} placeholder="archaeology, 3D modeling" />
						</div>
						<div class="form-control">
							<label class="label py-0.5" for="concept-keyword">
								<span class="label-text text-sm">Keywords</span>
								<span class="label-text-alt text-xs">comma-separated</span>
							</label>
							<input id="concept-keyword" type="text" class="input-bordered input input-sm" bind:value={conceptDcKeyword} />
						</div>
						<div class="form-control">
							<label class="label py-0.5" for="concept-place">
								<span class="label-text text-sm">Coverage Place</span>
							</label>
							<input id="concept-place" type="text" class="input-bordered input input-sm" bind:value={conceptDcCoveragePlace} placeholder="Rome, Italy" />
						</div>
						<div class="form-control">
							<label class="label py-0.5" for="concept-language">
								<span class="label-text text-sm">Languages</span>
								<span class="label-text-alt text-xs">comma-separated</span>
							</label>
							<input id="concept-language" type="text" class="input-bordered input input-sm" bind:value={conceptDcLanguage} placeholder="en, nl" />
						</div>
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
				</section>

				<div class="divider my-2"></div>

				<!-- 3D Model Files -->
				<section class="mb-6">
					<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">3D Model Files</h2>
					<div class="rounded-xl border border-base-300 bg-base-100 p-5 opacity-50">
						<div class="mb-3 space-y-2">
							<div class="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 px-3 py-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4 shrink-0 text-base-content/40">
									<path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
								</svg>
								<span class="truncate text-xs text-base-content/40">No model file selected</span>
							</div>
							<div class="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 px-3 py-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4 shrink-0 text-base-content/40">
									<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
								</svg>
								<span class="truncate text-xs text-base-content/40">No scene file selected</span>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<button type="button" class="btn btn-outline btn-sm" disabled>Upload Model</button>
							<button type="button" class="btn btn-outline btn-sm" disabled>Upload Scene</button>
						</div>
						<p class="mt-2 text-center text-xs text-base-content/40">GLB, GLTF, OBJ, PLY + SVX scene file</p>
					</div>
				</section>

				<div class="divider my-2"></div>

				<!-- Abstract -->
				<section class="mb-6">
					<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">Abstract</h2>
					<RichTextEditor content={conceptDescription} onchange={(html) => (conceptDescription = html)} minHeight="120px" />
				</section>

				<!-- Peer Review -->
				<section class="mb-6">
					<label class="flex cursor-pointer items-start gap-3">
						<input type="checkbox" class="checkbox checkbox-sm mt-0.5" bind:checked={conceptPeerReview} />
						<div>
							<span class="text-sm font-semibold">Request peer review</span>
							<p class="text-xs text-base-content/60">
								If enabled, the edition will go through alpha and final review stages before publication.
							</p>
						</div>
					</label>
				</section>

				<!-- Actions -->
				<div class="flex items-center gap-3 border-t border-base-300 pt-4">
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={saveDraft}
						disabled={isSaving || isSubmitting}
					>
						{#if isSaving}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Save Draft
					</button>
					<button type="submit" class="btn btn-primary btn-sm" disabled={isSaving || isSubmitting}>
						{#if isSubmitting}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Submit for Review
					</button>
				</div>
			</form>

			<!-- Collaborator Management -->
			{#if edition}
				<div class="mt-6 rounded-box border border-base-300 bg-base-100 p-6">
					<h2 class="mb-4 text-lg font-semibold">Collaborators</h2>
					<CollaboratorManager editionId={edition.id} isReadOnly={!canManageCollaborators} />
				</div>
			{/if}
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
				<!-- Timeline -->
				<div class="rounded-box border border-base-300 bg-base-100 p-6">
					<h2 class="mb-4 text-lg font-semibold">Progress</h2>
					<WorkflowTimeline currentStatus={edition.status} />
				</div>

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
