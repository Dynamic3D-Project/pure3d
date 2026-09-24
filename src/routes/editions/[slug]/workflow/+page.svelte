<script lang="ts">
	import CreditsEditor from '$lib/components/ui/CreditsEditor.svelte';
	import type { Credit } from '$lib/types/credits';
	import { readCredits, validateCredits } from '$lib/utils/credits';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import {
		CollectionRole,
		EditionStatus,
		GlobalRole,
		ReviewStage,
		type UserRoleContext
	} from '$lib/types/roles';
	import { canDeleteEdition } from '$lib/utils/permissions';
	import { ReviewDecision } from '$lib/types/reviews';
	import type { EditionReview, ReviewAssignment } from '$lib/types/reviews';
	import { updateEditionStatus } from '$lib/database/edition-helpers';
	import { anonymizeReviews } from '$lib/utils/review-helpers';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import ReviewForm from '$lib/components/workflow/ReviewForm.svelte';
	import CollaboratorManager from '$lib/components/workflow/CollaboratorManager.svelte';
	import ReviewFeedbackForm from '$lib/components/workflow/ReviewFeedbackForm.svelte';
	import ReviewFeedbackList from '$lib/components/workflow/ReviewFeedbackList.svelte';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import EditionAssetsPanel from '$lib/components/uploads/EditionAssetsPanel.svelte';
	import ProposalModelUploads from '$lib/components/uploads/ProposalModelUploads.svelte';
	import ProposalSummary from '$lib/components/workflow/ProposalSummary.svelte';
	import AlphaRequestForm from '$lib/components/workflow/AlphaRequestForm.svelte';
	import AlphaReviewForm from '$lib/components/workflow/AlphaReviewForm.svelte';
	import AlphaReviewProgress from '$lib/components/workflow/AlphaReviewProgress.svelte';
	import AlphaEditorialPanel from '$lib/components/workflow/AlphaEditorialPanel.svelte';
	import type { SaveState } from '$lib/workflow/autosave';
	import VoyagerPreview from '$lib/components/uploads/VoyagerPreview.svelte';
	import CoverImageUpload from '$lib/components/uploads/CoverImageUpload.svelte';
	import {
		MODEL_SOURCES,
		PROPOSAL_AUDIENCES,
		PROPOSAL_TYPES,
		proposalErrors,
		proposalIsDirty,
		wordCount
	} from '$lib/workflow/proposal';
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
		proposalSubmittedAt: string;
	}

	let edition = $state<Edition | null>(null);
	let editionRecord = $state<RecordModel | null>(null);
	let isLoading = $state(true);
	let assignments = $state<ReviewAssignment[]>([]);
	let reviews = $state<EditionReview[]>([]);
	let userLookup = $state(new Map<string, string>());
	let isAuthor = $state(false);
	let isCollaborator = $state(false);
	let editionAssetsBusy = $state(false);
	let coverBusy = $state(false);
	let expandedReview = $state(false);
	let isReviewer = $state(false);
	let myAssignment = $state<ReviewAssignment | null>(null);
	let myExistingReview = $state<EditionReview | null>(null);
	let isAdmin = $derived(authStore.globalRole === GlobalRole.Admin);
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
	let credits = $state<Credit[]>([]);
	let conceptDcInstitution = $state('');
	let conceptDcSubject = $state('');
	let conceptDcKeyword = $state('');
	let conceptDcCoveragePlace = $state('');
	let conceptDcLanguage = $state('');
	let conceptDcRightsHolder = $state('');
	let conceptDcRightsLicense = $state('');
	let proposalType = $state('');
	let proposalPurpose = $state('');
	let proposalArgument = $state('');
	let proposalThreeDRationale = $state('');
	let proposalAudience = $state<string[]>([]);
	let proposalContextualMaterial = $state('');
	let proposalHasExistingModel = $state(false);
	let proposalModelSources = $state<string[]>([]);
	let proposalCopyrightOwnership = $state('');
	let proposalDigitisationSituation = $state('');
	let proposalSupportingLinks = $state('');
	let isUploadingSupporting = $state(false);
	let isUploadingModel = $state(false);
	let authorAffiliations = $state<Record<string, string>>({});
	let proposalQuestions = $derived([
		{
			id: 'proposal-purpose',
			label: 'For what purpose was the model created?',
			hint: 'Please provide links to existing websites, research publications, videos, or graphics.',
			value: proposalPurpose
		},
		{
			id: 'proposal-argument',
			label:
				'What research argument or narrative would you like to develop, and how will the 3D model be its central component?',
			hint: '',
			value: proposalArgument
		},
		{
			id: 'proposal-3d-rationale',
			label:
				'Why is 3D visualisation an appropriate means of presenting your argument or narrative?',
			hint: '',
			value: proposalThreeDRationale
		},
		{
			id: 'proposal-context',
			label: 'What material do you have available to contextualise your 3D models?',
			hint: 'Indicate formats and quantities, including archival material, images, videos, or audio recordings.',
			value: proposalContextualMaterial
		}
	]);
	let isSaving = $state(false);
	let isSubmitting = $state(false);
	let submitDialog: HTMLDialogElement;
	let saveInFlight: Promise<boolean> | null = null;
	let formReady = $state(false);
	let lastSavedSnapshot = $state('');
	let saveStatus = $state<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
	let alphaContextSaveStatus = $state<SaveState>('saved');
	const effectiveSaveStatus = $derived(
		saveStatus === 'error' || alphaContextSaveStatus === 'error'
			? 'error'
			: saveStatus === 'saving' || alphaContextSaveStatus === 'saving'
				? 'saving'
				: saveStatus === 'unsaved' || alphaContextSaveStatus === 'unsaved'
					? 'unsaved'
					: 'saved'
	);
	let saveError = $state('');
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingSaveAfterCurrent = false;

	// Viewer-mirror layout state
	let activeFormTab = $state<'description' | 'metadata' | 'peer-review' | 'team'>('description');

	// Scene/viewer state
	let editionPubNum = $state(0);
	let collectionPubNum = $state(0);

	function jsonArrayToString(val: unknown): string {
		if (Array.isArray(val)) return val.join(', ');
		return '';
	}

	function stringToJsonArray(val: string): string[] {
		return val
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	function toggleSelection(values: string[], value: string, checked: boolean): string[] {
		return checked ? [...new Set([...values, value])] : values.filter((item) => item !== value);
	}

	function formSnapshot(): string {
		return JSON.stringify(activeFormData());
	}

	let saveStatusText = $derived.by(() => {
		if (effectiveSaveStatus === 'error') return "Couldn't save";
		if (editionAssetsBusy || coverBusy) return 'Asset work in progress';
		if (effectiveSaveStatus === 'saving') return 'Saving...';
		if (effectiveSaveStatus === 'unsaved') return 'Unsaved changes';
		return 'All changes saved';
	});
	let saveStatusClass = $derived.by(() => {
		if (effectiveSaveStatus === 'error') return 'text-error';
		if (effectiveSaveStatus === 'unsaved') return 'text-warning';
		if (effectiveSaveStatus === 'saving' || editionAssetsBusy || coverBusy)
			return 'text-base-content/60';
		return 'text-success';
	});
	let saveStatusBadgeClass = $derived.by(() => {
		if (effectiveSaveStatus === 'error') return 'border-error/30 bg-error/10 text-error';
		if (effectiveSaveStatus === 'unsaved') return 'border-warning/30 bg-warning/10 text-warning';
		if (effectiveSaveStatus === 'saving' || editionAssetsBusy || coverBusy)
			return 'border-base-300 bg-base-200 text-base-content/70';
		return 'border-success/30 bg-success/10 text-success';
	});

	$effect(() => {
		if (!formReady || !edition || viewMode !== 'concept-form') return;
		const snapshot = formSnapshot();
		if (snapshot === lastSavedSnapshot) return;
		scheduleAutosave();
	});

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
		if (
			(isAuthor ||
				isCollaborator ||
				isAdmin ||
				collectionRole === CollectionRole.Owner ||
				collectionRole === CollectionRole.Editor) &&
			![
				EditionStatus.ConceptSubmitted,
				EditionStatus.EditorialReview,
				EditionStatus.ConceptRejected,
				EditionStatus.AlphaReview
			].includes(edition.status)
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
		return anonymizeReviews(
			reviews.filter((review) => review.reviewStage !== ReviewStage.Alpha),
			assignments,
			stage,
			userLookup,
			isAdmin
		);
	});

	// Can the author resubmit?
	let canResubmit = $derived(
		isAuthor && edition !== null && edition.status === EditionStatus.FinalRevisions
	);

	// Can the author manage collaborators?
	let canManageCollaborators = $derived(
		isAuthor &&
			edition !== null &&
			[
				EditionStatus.Draft,
				EditionStatus.ConceptRejected,
				EditionStatus.ConceptAccepted,
				EditionStatus.AlphaAccepted,
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
	let canSubmitConcept = $derived(edition?.status === EditionStatus.Draft);

	const workflowStages: Array<{ label: string; statuses: EditionStatus[] }> = [
		{ label: 'Proposal', statuses: [EditionStatus.Draft] },
		{
			label: 'Proposal review',
			statuses: [
				EditionStatus.ConceptSubmitted,
				EditionStatus.EditorialReview,
				EditionStatus.ConceptAccepted,
				EditionStatus.ConceptRejected
			]
		},
		{
			label: 'Alpha Review',
			statuses: [
				EditionStatus.AlphaReview,
				EditionStatus.AlphaAccepted,
				EditionStatus.AlphaRevisions,
				EditionStatus.AlphaRejected
			]
		},
		{
			label: 'Final Review',
			statuses: [EditionStatus.FinalReview, EditionStatus.FinalRevisions]
		},
		{ label: 'Published', statuses: [EditionStatus.Published] }
	];

	const currentWorkflowStageIndex = $derived.by(() => {
		const currentEdition = edition;
		if (!currentEdition) return 0;
		const index = workflowStages.findIndex((stage) =>
			stage.statuses.includes(currentEdition.status)
		);
		return index === -1 ? 0 : index;
	});

	function workflowStageState(index: number): 'complete' | 'current' | 'future' {
		if (index < currentWorkflowStageIndex) return 'complete';
		if (index === currentWorkflowStageIndex) return 'current';
		return 'future';
	}

	const nextWorkflowAction = $derived.by(() => {
		if (!edition) return '';
		if (canSubmitConcept) return 'Submit proposal for review when it is ready.';
		if (edition.status === EditionStatus.ConceptAccepted)
			return 'Prepare the edition, then request Alpha Review from the Review tab.';
		if (edition.status === EditionStatus.AlphaRevisions)
			return 'Read the released feedback, revise the edition, then request another Alpha round from the Review tab.';
		if (edition.status === EditionStatus.AlphaReview)
			return 'Alpha Review is in progress. Editing is locked until the editorial decision.';
		if (canResubmit) return 'Address feedback, then resubmit the edition for review.';
		if (edition.status === EditionStatus.Published)
			return 'This edition is published and visible publicly.';
		return 'Your proposal is submitted. You can view it while the editorial team reviews it.';
	});

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

	function hasUnsavedChanges() {
		return (
			formReady &&
			!!edition &&
			viewMode === 'concept-form' &&
			(proposalIsDirty(lastSavedSnapshot, formSnapshot()) ||
				isUploadingSupporting ||
				isUploadingModel ||
				editionAssetsBusy ||
				coverBusy)
		);
	}

	// SvelteKit requires this during component initialization, not from onMount.
	beforeNavigate((navigation) => {
		if (hasUnsavedChanges() && !confirm('Leave with unsaved proposal changes?'))
			navigation.cancel();
	});

	onMount(() => {
		if (!authStore.isAuthenticated) {
			goto(resolve('/'));
			return;
		}
		const beforeUnload = (event: BeforeUnloadEvent) => {
			if (!hasUnsavedChanges()) return;
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', beforeUnload);
		void loadData();
		return () => {
			clearAutosaveTimer();
			window.removeEventListener('beforeunload', beforeUnload);
		};
	});

	async function loadData() {
		isLoading = true;
		alphaContextSaveStatus = 'saved';
		formReady = false;
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
				created: edRecord.created,
				proposalSubmittedAt: edRecord.proposalSubmittedAt || ''
			};

			// Initialize concept form
			if ($page.url.hash === '#edition-review-tab') activeFormTab = 'peer-review';
			conceptTitle = edition.title;
			conceptDescription = edition.description;
			conceptPeerReview = edition.peerReviewRequested;
			conceptDcSubtitle = edRecord.dcSubtitle || '';
			credits = readCredits(edRecord.credits);
			conceptDcInstitution = jsonArrayToString(edRecord.dcInstitution);
			conceptDcSubject = jsonArrayToString(edRecord.dcSubject);
			conceptDcKeyword = jsonArrayToString(edRecord.dcKeyword);
			conceptDcCoveragePlace = edRecord.dcCoveragePlace || '';
			conceptDcLanguage = jsonArrayToString(edRecord.dcLanguage);
			conceptDcRightsHolder = edRecord.dcRightsHolder || '';
			conceptDcRightsLicense = edRecord.dcRightsLicense || '';
			proposalType = edRecord.proposalType || '';
			proposalPurpose = edRecord.proposalPurpose || '';
			proposalArgument = edRecord.proposalArgument || '';
			proposalThreeDRationale = edRecord.proposalThreeDRationale || '';
			proposalAudience = Array.isArray(edRecord.proposalAudience) ? edRecord.proposalAudience : [];
			proposalContextualMaterial = edRecord.proposalContextualMaterial || '';
			proposalHasExistingModel = !!edRecord.proposalHasExistingModel;
			proposalModelSources = Array.isArray(edRecord.proposalModelSources)
				? edRecord.proposalModelSources
				: [];
			proposalCopyrightOwnership = edRecord.proposalCopyrightOwnership || '';
			proposalDigitisationSituation = edRecord.proposalDigitisationSituation || '';
			proposalSupportingLinks = Array.isArray(edRecord.proposalSupportingLinks)
				? edRecord.proposalSupportingLinks.join('\n')
				: '';
			authorAffiliations = {};
			if (credits.length === 0 && authStore.appUserId && edition.status === EditionStatus.Draft) {
				const profile = await pb.collection('users').getOne(authStore.appUserId);
				if (profile.affiliation) authorAffiliations = { [profile.id]: profile.affiliation };
				credits = [
					{
						type: 'person',
						name: profile.nickname || profile.email || 'Unnamed author',
						orcid: profile.orcid || null,
						role: 'creator',
						provenance: profile.orcidVerifiedAt ? 'oauth' : 'manual',
						userId: profile.id
					}
				];
			}
			const creditedUserIds = credits.map((credit) => credit.userId).filter(Boolean) as string[];
			if (creditedUserIds.length) {
				const users = await pb.collection('users').getList(1, creditedUserIds.length, {
					filter: creditedUserIds.map((id) => pb.filter('id = {:id}', { id })).join(' || ')
				});
				authorAffiliations = {
					...authorAffiliations,
					...Object.fromEntries(users.items.map((user) => [user.id, user.affiliation || '']))
				};
			}

			// Initialize viewer/scene data
			editionPubNum = edRecord.pubNum || 0;
			collectionPubNum = edRecord.expand?.collection?.pubNum || 0;

			// Load user's relationship to this edition
			if (authStore.appUserId) {
				const edUsers = await pb.collection('editionUsers').getList(1, 10, {
					filter: `editionId = "${edition.id}" && userId = "${authStore.appUserId}"`
				});
				isAuthor = edUsers.items.some((r) => r.role === 'author');
				isCollaborator = edUsers.items.some((r) => r.role === 'collaborator');
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

			reviews = reviewResult.items.map((r) => ({
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

			// Find current user's assignment and existing review
			if (authStore.appUserId) {
				myAssignment =
					assignments.find(
						(a) =>
							a.reviewerId === authStore.appUserId &&
							a.reviewStage === currentStage &&
							!['declined', 'completed'].includes(a.status) &&
							(a.reviewStage !== ReviewStage.Alpha ||
								a.reviewRound === (edRecord.alphaReviewRound || 0))
					) || null;
				isReviewer = !!myAssignment;
				myExistingReview =
					reviews.find(
						(r) =>
							r.reviewerId === authStore.appUserId &&
							r.reviewStage === currentStage &&
							(r.reviewStage !== ReviewStage.Alpha ||
								(r.reviewRound === (edRecord.alphaReviewRound || 0) &&
									r.reviewStatus === 'submitted'))
					) || null;
			}

			// Build user lookup for display names
			const reviewerIds = [
				...new Set([...assignments.map((a) => a.reviewerId), ...reviews.map((r) => r.reviewerId)])
			];
			if (reviewerIds.length > 0) {
				const userResult = await pb.collection('users').getList(1, 100, {
					filter: reviewerIds.map((id) => `id = "${id}"`).join(' || ')
				});
				userLookup = new Map(
					userResult.items.map((u) => [u.id, u.nickname || u.email || 'Unknown'])
				);
			}

			// Auth guard: redirect if user has no relation and isn't admin
			if (
				!isAuthor &&
				!isCollaborator &&
				!isReviewer &&
				!isAdmin &&
				!collectionRole &&
				authStore.globalRole !== GlobalRole.EditorialBoard
			) {
				toast.error('You do not have access to this workflow');
				goto(resolve('/editions/[slug]', { slug }));
				return;
			}
		} catch (error) {
			console.error('Error loading workflow data:', error);
			toast.error('Failed to load workflow data');
			goto(resolve('/editions/[slug]', { slug }));
		} finally {
			if (edition) {
				lastSavedSnapshot = formSnapshot();
				saveStatus = 'saved';
				saveError = '';
				formReady = true;
			}
			isLoading = false;
		}
	}

	// --- Concept Form Actions ---
	function buildProposalData() {
		return {
			title: conceptTitle.trim(),
			dcTitle: conceptTitle.trim(),
			credits: readCredits(credits),
			proposalType,
			proposalPurpose: proposalPurpose.trim(),
			proposalArgument: proposalArgument.trim(),
			proposalThreeDRationale: proposalThreeDRationale.trim(),
			proposalAudience,
			proposalContextualMaterial: proposalContextualMaterial.trim(),
			proposalHasExistingModel,
			proposalModelSources,
			proposalCopyrightOwnership: proposalCopyrightOwnership.trim(),
			proposalDigitisationSituation: proposalDigitisationSituation.trim(),
			proposalSupportingLinks: proposalSupportingLinks
				.split(/\r?\n/)
				.map((link) => link.trim())
				.filter(Boolean)
		};
	}

	function buildEditionData() {
		return {
			title: conceptTitle.trim(),
			dcTitle: conceptTitle.trim(),
			dcSubtitle: conceptDcSubtitle.trim(),
			dcAbstract: conceptDescription,
			dcDescription: conceptDescription,
			credits: readCredits(credits),
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

	function activeFormData() {
		return canSubmitConcept ? buildProposalData() : buildEditionData();
	}

	function clearAutosaveTimer() {
		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
			autosaveTimer = null;
		}
	}

	function scheduleAutosave() {
		if (!edition || isSubmitting) return;
		clearAutosaveTimer();
		saveStatus = 'unsaved';
		saveError = '';
		autosaveTimer = setTimeout(() => {
			autosaveTimer = null;
			void persistDraft({ showToast: false });
		}, 1200);
	}

	async function persistDraft({ showToast }: { showToast: boolean }) {
		if (saveInFlight) return saveInFlight;
		saveInFlight = performSave(showToast);
		try {
			return await saveInFlight;
		} finally {
			saveInFlight = null;
		}
	}

	async function performSave(showToast: boolean) {
		if (!edition || isSubmitting) return false;
		if (isUploadingModel || isUploadingSupporting) {
			pendingSaveAfterCurrent = true;
			return false;
		}
		const creditError = validateCredits(credits, false);
		if (creditError) {
			saveStatus = 'error';
			saveError = creditError;
			if (showToast) toast.error(creditError);
			return false;
		}
		if (isSaving) {
			pendingSaveAfterCurrent = true;
			return false;
		}

		clearAutosaveTimer();
		isSaving = true;
		saveStatus = 'saving';
		saveError = '';
		const data = activeFormData();
		const savedSnapshot = JSON.stringify(data);

		try {
			const updated = await pb
				.collection('editions')
				.update(edition.id, data, { requestKey: null });
			if (canSubmitConcept && !('proposalType' in updated))
				throw new Error('The proposal database migration must be installed before saving.');
			editionRecord = updated;
			edition.title = data.title;
			lastSavedSnapshot = savedSnapshot;

			if (formSnapshot() === savedSnapshot) {
				clearAutosaveTimer();
				saveStatus = 'saved';
			} else {
				scheduleAutosave();
			}

			if (showToast) toast.success('Draft saved');
			return true;
		} catch (error) {
			console.error('Error saving draft:', error);
			saveStatus = 'error';
			saveError = error instanceof Error ? error.message : 'Save failed';
			if (showToast) toast.error('Failed to save draft');
			return false;
		} finally {
			isSaving = false;
			if (pendingSaveAfterCurrent) {
				pendingSaveAfterCurrent = false;
				scheduleAutosave();
			}
		}
	}

	async function saveDraft() {
		await persistDraft({ showToast: true });
	}

	async function flushEditionForAlpha() {
		if (!edition || editionAssetsBusy || coverBusy)
			throw new Error('Finish uploads and close the scene editor before requesting review.');
		clearAutosaveTimer();
		if (saveInFlight) await saveInFlight;
		const creditError = validateCredits(credits, true);
		if (creditError) throw new Error(creditError);
		const data = buildEditionData();
		editionRecord = await pb.collection('editions').update(edition.id, data);
		lastSavedSnapshot = JSON.stringify(data);
		saveStatus = 'saved';
	}

	async function uploadSupportingFiles(event: Event) {
		if (!edition || !editionRecord || isSubmitting || isUploadingSupporting || isSaving) return;
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (files.length === 0) return;
		if (files.some((file) => file.size > 200 * 1024 * 1024)) {
			toast.error('Each file must be 200 MB or smaller.');
			return;
		}
		isUploadingSupporting = true;
		try {
			const form = new FormData();
			for (const file of files) form.append('proposalSupportingFiles+', file);
			editionRecord = await pb
				.collection('editions')
				.update(edition.id, form, { requestKey: null });
			toast.success('Supporting files uploaded');
		} catch (error) {
			console.error('Error uploading supporting files:', error);
			toast.error('Failed to upload supporting files');
		} finally {
			isUploadingSupporting = false;
			resumeAutosave();
		}
	}

	async function removeSupportingFile(filename: string) {
		if (!edition || !editionRecord || isUploadingSupporting || isSaving || isSubmitting) return;
		isUploadingSupporting = true;
		try {
			editionRecord = await pb.collection('editions').update(
				edition.id,
				{
					'proposalSupportingFiles-': [filename]
				},
				{ requestKey: null }
			);
		} catch (error) {
			console.error('Error removing supporting file:', error);
			toast.error('Failed to remove supporting file');
		} finally {
			isUploadingSupporting = false;
			resumeAutosave();
		}
	}

	function resumeAutosave() {
		pendingSaveAfterCurrent = false;
		if (hasUnsavedChanges()) scheduleAutosave();
	}

	async function saveCollaboratorCredits(nextCredits: Credit[]) {
		if (isSaving || isSubmitting) throw new Error('Wait for the current save to finish.');
		credits = readCredits(nextCredits);
		if (!(await persistDraft({ showToast: false }))) {
			throw new Error(saveError || 'Credits are unsaved. Check the form and save again.');
		}
	}

	async function deleteEdition() {
		if (!edition || isDeleting) return;
		isDeleting = true;
		try {
			const deletedId = edition.id;
			await pb.collection('editions').delete(deletedId);
			toast.success('Edition deleted');
			showDeleteModal = false;
			goto(resolve('/editions'));
		} catch (error) {
			console.error('Error deleting edition:', error);
			toast.error('Failed to delete edition');
			isDeleting = false;
		}
	}

	async function submitConcept() {
		if (!edition || isSubmitting || isUploadingSupporting || isUploadingModel) return;
		const creditError = validateCredits(credits, true);
		if (creditError) {
			toast.error(creditError);
			return;
		}
		const errors = proposalErrors({
			proposalType,
			title: conceptTitle,
			credits,
			purpose: proposalPurpose,
			argument: proposalArgument,
			threeDRationale: proposalThreeDRationale,
			audiences: proposalAudience,
			contextualMaterial: proposalContextualMaterial,
			hasExistingModel: proposalHasExistingModel,
			modelSources: proposalModelSources,
			copyrightOwnership: proposalCopyrightOwnership,
			digitisationSituation: proposalDigitisationSituation,
			hasModelFile:
				Array.isArray(editionRecord?.proposalModelFiles) &&
				editionRecord.proposalModelFiles.length > 0,
			supportingLinks: proposalSupportingLinks
				.split(/\r?\n/)
				.map((link) => link.trim())
				.filter(Boolean)
		});
		if (errors.length) {
			toast.error(errors[0]);
			return;
		}
		clearAutosaveTimer();
		isSubmitting = true;
		try {
			if (saveInFlight) await saveInFlight;
			const data = buildProposalData();
			const submittedSnapshot = JSON.stringify(data);
			const updated = await pb.collection('editions').update(
				edition.id,
				{
					...data,
					status: EditionStatus.ConceptSubmitted
				},
				{ requestKey: null }
			);
			editionRecord = updated;
			lastSavedSnapshot = submittedSnapshot;
			saveStatus = 'saved';
			edition.status = EditionStatus.ConceptSubmitted;
			edition.proposalSubmittedAt = updated.proposalSubmittedAt || '';
			edition.title = conceptTitle;
			toast.success('Proposal submitted for review');
		} catch (error) {
			console.error('Error submitting concept:', error);
			toast.error('Failed to submit proposal');
			saveStatus = 'error';
			saveError = 'Submission failed. Your proposal is still a draft.';
		} finally {
			isSubmitting = false;
		}
	}

	function requestSubmit() {
		if (!isUploadingSupporting && !isUploadingModel) submitDialog.showModal();
		else toast.error('Wait for uploads and changes to finish saving, then submit again.');
	}

	async function reopenProposal() {
		if (!edition || isSubmitting) return;
		isSubmitting = true;
		try {
			await updateEditionStatus(edition.id, EditionStatus.Draft);
			await loadData();
		} catch {
			toast.error('Could not reopen the proposal. Please try again.');
		} finally {
			isSubmitting = false;
		}
	}

	// --- Resubmit after revisions ---
	async function resubmit() {
		if (!edition) return;
		const creditError = validateCredits(credits, true);
		if (creditError) {
			toast.error(creditError);
			return;
		}
		if (isSaving) {
			toast.error('Wait for the current save to finish, then submit again.');
			return;
		}
		clearAutosaveTimer();
		isSubmitting = true;
		try {
			await pb.collection('editions').update(edition.id, buildEditionData());
			lastSavedSnapshot = formSnapshot();
			saveStatus = 'saved';
			const targetStatus =
				edition.status === EditionStatus.AlphaRevisions
					? EditionStatus.AlphaReview
					: EditionStatus.FinalReview;

			await updateEditionStatus(edition.id, targetStatus);

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

<div
	id="edition-workflow-page"
	class="mx-auto p-4 lg:p-8"
	class:max-w-7xl={edition &&
		((viewMode === 'concept-form' && !canSubmitConcept) || viewMode === 'review-form')}
	class:max-w-4xl={!edition || viewMode === 'status-view' || canSubmitConcept}
>
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if edition}
		<!-- Breadcrumbs -->
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<nav class="breadcrumbs text-sm">
				<ul>
					<li><a href={resolve('/')} class="link link-hover">Home</a></li>
					<li><a href={resolve('/editions')} class="link link-hover">Editions</a></li>
					<li class="text-base-content/70">{edition.title || 'Untitled Edition'}</li>
				</ul>
			</nav>
			{#if viewMode === 'concept-form'}
				<div
					class="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium {saveStatusBadgeClass}"
					aria-live="polite"
				>
					{#if saveStatus === 'saving'}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						<span class="size-2 rounded-full bg-current"></span>
					{/if}
					<span>{saveStatusText}</span>
				</div>
			{/if}
		</div>

		<!-- Header -->
		<div class="mb-6 flex flex-wrap items-start gap-4">
			{#if viewMode !== 'concept-form'}
				<div class="min-w-64">
					<div class="flex flex-wrap items-center gap-3">
						<h1 class="text-2xl font-bold">
							{viewMode === 'review-form' ? 'Review Edition' : 'Edition Workflow'}
						</h1>
						<StatusBadge status={edition.status} />
					</div>
					<p class="mt-1 text-base-content/70">{edition.title || 'Untitled Edition'}</p>
					{#if edition.collectionTitle}
						<p class="text-sm text-base-content/50">in {edition.collectionTitle}</p>
					{/if}
				</div>
			{/if}

			{#if viewMode === 'concept-form'}
				<div class="min-w-72 flex-1 rounded-box border border-base-300 bg-base-100 px-4 py-3">
					<div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
						<div>
							<span class="font-semibold">Workflow</span>
							<span class="ml-2 text-base-content/60">{nextWorkflowAction}</span>
						</div>
						<StatusBadge status={edition.status} />
					</div>
					<ol class="flex items-center gap-2 overflow-x-auto pb-1">
						{#each workflowStages as stage, index (stage.label)}
							{@const state = workflowStageState(index)}
							<li class="flex shrink-0 items-center gap-2">
								<div
									class="flex size-5 items-center justify-center rounded-full text-[10px] font-semibold"
									class:bg-success={state === 'complete'}
									class:text-success-content={state === 'complete'}
									class:bg-primary={state === 'current'}
									class:text-primary-content={state === 'current'}
									class:bg-base-300={state === 'future'}
									class:text-base-content={state === 'future'}
									class:opacity-50={state === 'future'}
								>
									{#if state === 'complete'}✓{:else}{index + 1}{/if}
								</div>
								<span class="text-xs whitespace-nowrap" class:opacity-50={state === 'future'}>
									{stage.label}
								</span>
								{#if index < workflowStages.length - 1}
									<span class="h-px w-6 bg-base-300"></span>
								{/if}
							</li>
						{/each}
					</ol>
				</div>
			{/if}

			<div class="ml-auto flex flex-col items-end gap-2">
				<div class="flex flex-wrap items-center justify-end gap-2">
					<a href={resolve('/editions/[slug]', { slug: edition.id })} class="btn btn-ghost btn-sm"
						>View Edition</a
					>
					{#if canDelete}
						<button
							type="button"
							class="btn btn-outline btn-sm btn-error"
							onclick={() => (showDeleteModal = true)}
						>
							Delete
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Proposal Form — mirrors viewer layout -->
		{#if viewMode === 'concept-form'}
			{#if canSubmitConcept}
				<form
					id="proposal"
					class="space-y-8"
					onsubmit={(event) => {
						event.preventDefault();
						requestSubmit();
					}}
				>
					<fieldset
						disabled={isSubmitting || isUploadingSupporting || isUploadingModel}
						class="space-y-8"
					>
						<section class="space-y-4 rounded-box border border-base-300 bg-base-100 p-5">
							<div>
								<h1 class="text-2xl font-bold">Publish with us</h1>
								<p class="mt-1 text-sm text-base-content/65">
									Your proposal stays private and editable until you submit it for editorial review.
								</p>
							</div>
							<div class="space-y-4">
								<label class="form-control">
									<span class="label-text mb-1 font-semibold">Proposal type</span>
									<select
										class="select-bordered select w-full max-w-xs"
										bind:value={proposalType}
										required
									>
										<option value="" disabled>Select a type</option>
										{#each PROPOSAL_TYPES as [value, label] (value)}
											<option {value}>{label}</option>
										{/each}
									</select>
								</label>
								<label class="form-control">
									<span class="label-text mb-1 font-semibold">Title</span>
									<input class="input-bordered input w-full" bind:value={conceptTitle} required />
								</label>
							</div>
							<div>
								<h2 class="font-semibold">Authors</h2>
								<div class="mt-3">
									<CreditsEditor
										bind:credits
										disabled={isSubmitting}
										authorsOnly
										affiliations={authorAffiliations}
									/>
								</div>
							</div>
						</section>

						<section class="space-y-5 rounded-box border border-base-300 bg-base-100 p-5">
							<div>
								<h2 class="text-lg font-semibold">Submission questionnaire</h2>
								<p class="text-sm text-base-content/65">
									Each written answer is limited to 150 words.
								</p>
							</div>
							{#each proposalQuestions as field (field.id)}
								{@const id = field.id}
								<label class="form-control" for={id}>
									<span class="label-text font-semibold">{field.label}</span>
									{#if field.hint}<span class="label-text-alt">{field.hint}</span>{/if}
									<textarea
										{id}
										class="textarea-bordered textarea mt-1 min-h-28 w-full"
										value={field.value}
										aria-invalid={wordCount(field.value) > 150}
										oninput={(event) => {
											const value = event.currentTarget.value;
											if (id === 'proposal-purpose') proposalPurpose = value;
											else if (id === 'proposal-argument') proposalArgument = value;
											else if (id === 'proposal-3d-rationale') proposalThreeDRationale = value;
											else proposalContextualMaterial = value;
										}}
										required
									></textarea>
									<span class="mt-1 text-right text-xs text-base-content/50"
										>{wordCount(field.value)}/150 words</span
									>
								</label>
							{/each}
							<fieldset class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								<legend class="font-semibold">Intended audience</legend>
								{#each PROPOSAL_AUDIENCES as [value, label] (value)}
									<label class="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											checked={proposalAudience.includes(value)}
											onchange={(event) =>
												(proposalAudience = toggleSelection(
													proposalAudience,
													value,
													event.currentTarget.checked
												))}
										/>
										{label}
									</label>
								{/each}
							</fieldset>
						</section>

						<section class="space-y-5 rounded-box border border-base-300 bg-base-100 p-5">
							<h2 class="text-lg font-semibold">3D model</h2>
							<fieldset class="space-y-2">
								<legend class="font-semibold">Do you already have a digital 3D model?</legend>
								<label class="mr-5 inline-flex items-center gap-2"
									><input type="radio" value={true} bind:group={proposalHasExistingModel} /> Yes</label
								>
								<label class="inline-flex items-center gap-2"
									><input type="radio" value={false} bind:group={proposalHasExistingModel} /> No</label
								>
							</fieldset>
							{#if proposalHasExistingModel}
								<div class="space-y-4">
									<p class="text-sm text-base-content/65">
										Add each GLB, GLTF, OBJ, or PLY model with its companions separately; each file
										may be up to 200 MB. Every retained model has its own preview.
									</p>
									{#if editionRecord}
										<ProposalModelUploads
											bind:edition={editionRecord}
											disabled={isSubmitting || isUploadingSupporting || isSaving}
											onupdated={(record) => (editionRecord = record)}
											onuploadstatechange={(uploading) => {
												isUploadingModel = uploading;
												if (!uploading) resumeAutosave();
											}}
										/>
									{/if}
									<fieldset class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
										<legend class="font-semibold">How was the model created?</legend>
										{#each MODEL_SOURCES as [value, label] (value)}
											<label class="mr-4 inline-flex items-center gap-2 text-sm">
												<input
													type="checkbox"
													class="checkbox checkbox-sm"
													checked={proposalModelSources.includes(value)}
													onchange={(event) =>
														(proposalModelSources = toggleSelection(
															proposalModelSources,
															value,
															event.currentTarget.checked
														))}
												/>
												{label}
											</label>
										{/each}
									</fieldset>
									<label class="form-control">
										<span class="label-text font-semibold">Copyright ownership and permissions</span
										>
										<span class="label-text-alt"
											>Confirm you own the model or have permission to use it.</span
										>
										<textarea
											class="textarea-bordered textarea mt-1 min-h-28 w-full"
											bind:value={proposalCopyrightOwnership}
											required
										></textarea>
										<span class="mt-1 text-right text-xs text-base-content/50"
											>{wordCount(proposalCopyrightOwnership)}/150 words</span
										>
									</label>
								</div>
							{:else}
								<label class="form-control">
									<span class="label-text font-semibold">Describe the digitisation situation</span>
									<textarea
										class="textarea-bordered textarea mt-1 min-h-28 w-full"
										bind:value={proposalDigitisationSituation}
										required
									></textarea>
									<span class="mt-1 text-right text-xs text-base-content/50"
										>{wordCount(proposalDigitisationSituation)}/150 words</span
									>
								</label>
								<label class="form-control">
									<span class="label-text font-semibold">Supporting links</span>
									<textarea
										class="textarea-bordered textarea mt-1 min-h-20 w-full"
										bind:value={proposalSupportingLinks}
										placeholder="One link per line"
									></textarea>
								</label>
								{#if editionRecord}
									<div>
										<button
											type="button"
											class="btn btn-outline btn-sm"
											onclick={() => document.getElementById('proposal-supporting-files')?.click()}
											disabled={isUploadingSupporting || isSubmitting || isSaving}
											>Add supporting files</button
										>
										<input
											id="proposal-supporting-files"
											class="hidden"
											type="file"
											multiple
											onchange={uploadSupportingFiles}
											disabled={isUploadingSupporting || isSubmitting}
										/>
										{#if isUploadingSupporting}<span class="ml-2 text-sm">Uploading…</span>{/if}
										{#if Array.isArray(editionRecord.proposalSupportingFiles) && editionRecord.proposalSupportingFiles.length > 0}
											<ul class="mt-2 space-y-1 text-sm">
												{#each editionRecord.proposalSupportingFiles as filename (filename)}
													<li class="flex items-center gap-2">
														<span class="break-all">{filename}</span><button
															type="button"
															class="btn btn-ghost btn-xs"
															onclick={() => removeSupportingFile(filename)}
															disabled={isUploadingSupporting || isSubmitting || isSaving}
															>Remove</button
														>
													</li>
												{/each}
											</ul>
										{/if}
									</div>
								{/if}
							{/if}
						</section>
					</fieldset>

					<div class="flex items-center justify-end gap-3 border-t border-base-300 pt-4">
						<div
							class="mr-auto flex items-center gap-2 text-xs {saveStatusClass}"
							aria-live="polite"
						>
							<span>{saveStatusText}</span>
							{#if saveStatus === 'error'}<span>{saveError}</span><button
									type="button"
									class="link"
									onclick={() => persistDraft({ showToast: false })}>Retry</button
								>{/if}
						</div>
						<button
							type="submit"
							class="btn btn-primary"
							disabled={isSubmitting || isUploadingSupporting || isUploadingModel}
						>
							{#if isSubmitting}<span class="loading loading-xs loading-spinner"></span>{/if}
							Submit for Review
						</button>
					</div>
				</form>
			{:else}
				<div id="draft" class="scroll-mt-24">
					{#if editionRecord?.alphaReviewRound}<div class="mb-6">
							<AlphaReviewProgress
								editionId={edition.id}
								open={edition.status === EditionStatus.AlphaRevisions}
							/>
						</div>{/if}
					{#if editionRecord?.proposalSubmittedAt}
						<details class="mb-6">
							<summary class="cursor-pointer py-3 font-semibold">View submitted proposal</summary
							><ProposalSummary record={editionRecord} />
						</details>
					{/if}
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
						id="concept"
						class="scroll-mt-24"
						onsubmit={(e) => {
							e.preventDefault();
							void saveDraft();
						}}
					>
						<fieldset disabled={isSubmitting}>
							<!-- Header: cover image + editable title + authors -->
							<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-stretch">
								{#if editionRecord}
									<div class="w-full flex-none sm:w-36">
										<CoverImageUpload
											bind:record={editionRecord}
											disabled={isSubmitting || editionAssetsBusy}
											onbusychange={(busy) => (coverBusy = busy)}
											onuploaded={(r) => (editionRecord = r)}
											onremoved={(r) => (editionRecord = r)}
										/>
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<label for="concept-title" class="mb-1 block text-sm font-semibold">Title</label>
									<input
										id="concept-title"
										type="text"
										class="input-bordered input w-full text-2xl font-semibold placeholder:text-base-content/30"
										bind:value={conceptTitle}
										required
										placeholder="Edition title"
									/>
									<CreditsEditor bind:credits disabled={isSubmitting} />
									{#if edition.collectionTitle}
										<p class="mt-1 text-sm text-base-content/50">in {edition.collectionTitle}</p>
									{/if}
								</div>
							</div>

							<!-- Two-column layout (mirrors viewer) -->
							<div class="relative flex flex-col gap-8 lg:flex-row lg:items-start">
								<!-- Left Column: 3D Viewer + Asset Uploads -->
								<div class="min-w-0 flex-1 space-y-4">
									{#if editionRecord}
										<EditionAssetsPanel
											bind:edition={editionRecord}
											disabled={isSubmitting || coverBusy}
											onbusychange={(busy) => (editionAssetsBusy = busy)}
											{collectionPubNum}
											{editionPubNum}
											onupdated={(r) => (editionRecord = r)}
										/>
									{/if}
								</div>

								<!-- Right Column: Tabbed Sidebar -->
								<div class="shrink-0 lg:w-96">
									<div class="lg:sticky lg:top-4">
										<div class="overflow-hidden rounded-xl border border-base-300 bg-base-200">
											<div class="w-96 max-w-full p-0">
												<!-- Tabs -->
												<div role="tablist" class="tabs-bordered tabs bg-base-300">
													<button
														type="button"
														role="tab"
														class="tab flex-1"
														class:tab-active={activeFormTab === 'description'}
														onclick={() => (activeFormTab = 'description')}
													>
														Description
													</button>
													<button
														type="button"
														role="tab"
														class="tab flex-1"
														class:tab-active={activeFormTab === 'metadata'}
														onclick={() => (activeFormTab = 'metadata')}
													>
														Metadata
													</button>
													<button
														type="button"
														role="tab"
														class="tab flex-1"
														class:tab-active={activeFormTab === 'peer-review'}
														id="edition-review-tab"
														onclick={() => (activeFormTab = 'peer-review')}
													>
														Review
													</button>
													<button
														type="button"
														role="tab"
														class="tab flex-1"
														class:tab-active={activeFormTab === 'team'}
														onclick={() => (activeFormTab = 'team')}
													>
														Team
													</button>
												</div>

												<!-- Tab Content -->
												<div class="p-5">
													{#if activeFormTab === 'description'}
														<div class="space-y-4">
															<div>
																<span class="mb-2 block text-sm font-semibold">Abstract</span>
																<RichTextEditor
																	content={conceptDescription}
																	onchange={(html) => (conceptDescription = html)}
																	minHeight="200px"
																/>
															</div>
															<div class="form-control">
																<label class="label py-0.5" for="concept-keyword">
																	<span class="label-text text-sm font-semibold"
																		>Tags / Keywords</span
																	>
																	<span class="label-text-alt text-xs">comma-separated</span>
																</label>
																<input
																	id="concept-keyword"
																	type="text"
																	class="input-bordered input input-sm"
																	bind:value={conceptDcKeyword}
																	placeholder="ceramic, sculpture, museum"
																/>
															</div>
														</div>
													{:else if activeFormTab === 'metadata'}
														<div class="space-y-3">
															<div class="form-control">
																<label class="label py-0.5" for="concept-subtitle">
																	<span class="label-text text-sm">Subtitle</span>
																</label>
																<input
																	id="concept-subtitle"
																	type="text"
																	class="input-bordered input input-sm"
																	bind:value={conceptDcSubtitle}
																/>
															</div>
															<div class="form-control">
																<label class="label py-0.5" for="concept-institution">
																	<span class="label-text text-sm">Institutions</span>
																</label>
																<input
																	id="concept-institution"
																	type="text"
																	class="input-bordered input input-sm"
																	bind:value={conceptDcInstitution}
																	placeholder="comma-separated"
																/>
															</div>
															<div class="form-control">
																<label class="label py-0.5" for="concept-subject">
																	<span class="label-text text-sm">Subjects</span>
																</label>
																<input
																	id="concept-subject"
																	type="text"
																	class="input-bordered input input-sm"
																	bind:value={conceptDcSubject}
																	placeholder="comma-separated"
																/>
															</div>
															<div class="grid grid-cols-2 gap-3">
																<div class="form-control">
																	<label class="label py-0.5" for="concept-place">
																		<span class="label-text text-sm">Place</span>
																	</label>
																	<input
																		id="concept-place"
																		type="text"
																		class="input-bordered input input-sm"
																		bind:value={conceptDcCoveragePlace}
																		placeholder="Rome, Italy"
																	/>
																</div>
																<div class="form-control">
																	<label class="label py-0.5" for="concept-language">
																		<span class="label-text text-sm">Languages</span>
																	</label>
																	<input
																		id="concept-language"
																		type="text"
																		class="input-bordered input input-sm"
																		bind:value={conceptDcLanguage}
																		placeholder="en, nl"
																	/>
																</div>
															</div>
															<div class="grid grid-cols-2 gap-3">
																<div class="form-control">
																	<label class="label py-0.5" for="concept-rights-holder">
																		<span class="label-text text-sm">Rights Holder</span>
																	</label>
																	<input
																		id="concept-rights-holder"
																		type="text"
																		class="input-bordered input input-sm"
																		bind:value={conceptDcRightsHolder}
																	/>
																</div>
																<div class="form-control">
																	<label class="label py-0.5" for="concept-license">
																		<span class="label-text text-sm">License</span>
																	</label>
																	<input
																		id="concept-license"
																		type="text"
																		class="input-bordered input input-sm"
																		bind:value={conceptDcRightsLicense}
																		placeholder="CC BY 4.0"
																	/>
																</div>
															</div>
														</div>
													{:else if activeFormTab === 'peer-review' && ![EditionStatus.ConceptAccepted, EditionStatus.AlphaRevisions].includes(edition.status)}
														<div class="space-y-4">
															<label class="flex cursor-pointer items-start gap-3">
																<input
																	type="checkbox"
																	class="checkbox mt-0.5 checkbox-sm"
																	bind:checked={conceptPeerReview}
																/>
																<div>
																	<span class="text-sm font-semibold">Request peer review</span>
																	<p class="text-xs text-base-content/60">
																		If enabled, the edition will go through alpha and final review
																		stages before publication.
																	</p>
																</div>
															</label>
															{#if edition.status === EditionStatus.ConceptRejected && previousFeedback.length > 0}
																<div class="mt-4">
																	<h3 class="mb-2 text-sm font-semibold">Previous Feedback</h3>
																	{#each previousFeedback as fb (fb.created)}
																		{#if fb.comment}
																			<p class="mt-1 rounded bg-base-300 p-2 text-sm">
																				{fb.comment}
																			</p>
																		{/if}
																	{/each}
																</div>
															{/if}
														</div>
													{:else if activeFormTab === 'team'}
														<CollaboratorManager
															editionId={edition.id}
															{credits}
															oncreditssaved={saveCollaboratorCredits}
															isReadOnly={(!isAdmin && !canManageCollaborators) ||
																isSaving ||
																isSubmitting}
														/>
													{/if}
													{#if editionRecord && [EditionStatus.ConceptAccepted, EditionStatus.AlphaRevisions].includes(edition.status)}
														<div hidden={activeFormTab !== 'peer-review'}>
															<AlphaRequestForm
																edition={editionRecord}
																disabled={editionAssetsBusy || coverBusy}
																canRequest={isAuthor ||
																	isAdmin ||
																	collectionRole === CollectionRole.Owner}
																beforeSubmit={flushEditionForAlpha}
																onstatuschange={(state) => (alphaContextSaveStatus = state)}
																onbusychange={(busy) => (isSubmitting = busy)}
																onsubmitted={() => {
																	toast.success('Edition submitted for Alpha Review');
																	void loadData();
																}}
															/>
														</div>
													{/if}
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>

							<!-- Action bar -->
							<div
								class="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-base-300 pt-4"
							>
								<a
									href={resolve('/editions/[slug]', { slug: edition.id })}
									class="mr-auto link text-sm link-primary">View Edition</a
								>
								<div class="flex items-center gap-2 text-xs {saveStatusClass}" aria-live="polite">
									{#if saveStatus === 'saving'}
										<span class="loading loading-xs loading-spinner"></span>
									{:else}
										<span class="size-2 rounded-full bg-current"></span>
									{/if}
									<span>{saveStatusText}</span>
								</div>
								<button
									type="button"
									class="btn btn-sm btn-primary"
									onclick={saveDraft}
									disabled={isSaving || isSubmitting}
								>
									{#if isSaving}
										<span class="loading loading-xs loading-spinner"></span>
									{/if}
									Save Changes
								</button>
								{#if canResubmit}
									<button
										type="button"
										class="btn btn-outline btn-sm btn-primary"
										onclick={resubmit}
										disabled={isSaving || isSubmitting}
									>
										{#if isSubmitting}
											<span class="loading loading-xs loading-spinner"></span>
										{/if}
										Resubmit for Review
									</button>
								{/if}
							</div>
						</fieldset>
					</form>
				</div>
			{/if}
		{/if}

		<!-- Review Form (for assigned reviewers) -->
		{#if viewMode === 'review-form' && myAssignment && edition}
			{#if currentStage === ReviewStage.Alpha && editionRecord}
				<div
					class={expandedReview
						? 'mx-auto max-w-4xl'
						: 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]'}
				>
					<div class:hidden={expandedReview} class="space-y-4 lg:sticky lg:top-24">
						<VoyagerPreview
							edition={editionRecord}
							{collectionPubNum}
							{editionPubNum}
							title={edition.title}
						/>
						<div class="rounded-box border border-base-300 p-4">
							<h2 class="font-semibold">{edition.title}</h2>
							<p class="mt-2 text-sm text-base-content/70">
								This edition is read-only during Alpha Review. Use the review form to record your
								feedback.
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
								aria-expanded={expandedReview}
								onclick={() => (expandedReview = !expandedReview)}
								>{expandedReview ? 'Show edition alongside' : 'Expand review form'}</button
							>
						</div>
						<div class={expandedReview ? '' : 'lg:max-h-[75dvh] lg:overflow-y-auto lg:pr-2'}>
							<AlphaReviewForm
								editionId={edition.id}
								reviewerId={authStore.appUserId || ''}
								round={editionRecord.alphaReviewRound || 0}
								context={editionRecord.alphaRequest}
								onsubmitted={() => {
									toast.success('Alpha Review submitted');
									void goto(resolve('/reviews'));
								}}
							/>
						</div>
					</section>
				</div>
			{:else}
				<div class="space-y-6">
					{#if editionRecord}<ProposalSummary record={editionRecord} />{/if}
					<div id="concept" class="scroll-mt-24 rounded-box border border-base-300 bg-base-100 p-6">
						<h2 class="mb-2 text-xl font-semibold">Edition Details</h2>
						<p class="text-base-content/70">{edition.description || 'No description provided.'}</p>
						<a
							href={resolve('/editions/[slug]', { slug: edition.id })}
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

					<div id="review" class="scroll-mt-24 rounded-box border border-base-300 bg-base-100 p-6">
						<h2 class="mb-4 text-xl font-semibold">Submit Your Review</h2>
						<ReviewForm
							editionId={edition.id}
							reviewStage={myAssignment.reviewStage}
							reviewerId={authStore.appUserId || ''}
							onsubmit={handleReviewSubmitted}
						/>
					</div>

					<!-- Granular feedback (reviewer) -->
					<div
						id="feedback"
						class="scroll-mt-24 rounded-box border border-base-300 bg-base-100 p-6"
					>
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
		{/if}

		<!-- Status View (default for authors viewing progress) -->
		{#if viewMode === 'status-view'}
			<div class="space-y-6">
				{#if edition.status === EditionStatus.ConceptRejected && (isAuthor || isAdmin)}
					<div class="alert">
						<span
							>The editorial team returned this proposal. Review the feedback below before revising.</span
						><button class="btn btn-primary" disabled={isSubmitting} onclick={reopenProposal}
							>Revise proposal</button
						>
					</div>
				{/if}
				{#if edition.status === EditionStatus.ConceptSubmitted || edition.status === EditionStatus.EditorialReview}
					<div class="rounded-box border border-info/30 bg-info/10 p-4 text-base-content">
						<span>
							Proposal submitted{edition.proposalSubmittedAt
								? ` ${formatDate(edition.proposalSubmittedAt)}`
								: ''}. It remains private and viewable, but cannot be edited while under editorial
							review.
						</span>
					</div>
				{/if}
				{#if edition.status === EditionStatus.AlphaReview && editionRecord}
					<div class="rounded-box border border-info/30 bg-info/10 p-4 text-base-content">
						Submitted for Alpha Review. You can view the edition, but editing is locked until the
						editors release their decision.
					</div>
					<div id="alpha">
						<VoyagerPreview
							edition={editionRecord}
							{collectionPubNum}
							{editionPubNum}
							title={edition.title}
						/>
					</div>
					<AlphaReviewProgress editionId={edition.id} open />
					{#if isAdmin || authStore.globalRole === GlobalRole.EditorialBoard}<AlphaEditorialPanel
							editionId={edition.id}
							round={editionRecord.alphaReviewRound || 0}
							onchanged={() => void loadData()}
						/>{/if}
					<details>
						<summary class="cursor-pointer py-3 font-semibold">View submitted proposal</summary
						><ProposalSummary record={editionRecord} />
					</details>
				{:else if editionRecord}<ProposalSummary record={editionRecord} />{/if}

				{#if ![EditionStatus.ConceptSubmitted, EditionStatus.EditorialReview, EditionStatus.AlphaReview].includes(edition.status)}
					<div id="alpha" class="scroll-mt-24 rounded-box border border-base-300 bg-base-100 p-6">
						<h2 class="mb-2 text-lg font-semibold">Alpha</h2>
						<p class="text-base-content/70">Review and revise the edition before final review.</p>
						<a
							href={resolve('/editions/[slug]', { slug: edition.id })}
							class="mt-2 inline-block link text-sm link-primary"
						>
							Edit Edition
						</a>
					</div>

					<div id="final" class="scroll-mt-24 rounded-box border border-base-300 bg-base-100 p-6">
						<h2 class="mb-2 text-lg font-semibold">Final</h2>
						<p class="text-base-content/70">Resolve final review feedback before publication.</p>
						<a
							href={resolve('/editions/[slug]', { slug: edition.id })}
							class="mt-2 inline-block link text-sm link-primary"
						>
							Edit Edition
						</a>
					</div>

					<div
						id="published"
						class="scroll-mt-24 rounded-box border border-base-300 bg-base-100 p-6"
					>
						<h2 class="mb-2 text-lg font-semibold">Published</h2>
						<p class="text-base-content/70">Published editions are visible to public visitors.</p>
						<a
							href={resolve('/editions/[slug]', { slug: edition.id })}
							class="mt-2 inline-block link text-sm link-primary"
						>
							View Edition
						</a>
					</div>

					<!-- Review feedback (if any) -->
				{/if}
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
					<div
						id="feedback"
						class="scroll-mt-24 rounded-box border border-base-300 bg-base-100 p-6"
					>
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
					<div
						id="collaborators"
						class="scroll-mt-24 rounded-box border border-base-300 bg-base-100 p-6"
					>
						<h2 class="mb-4 text-lg font-semibold">Collaborators</h2>
						<CollaboratorManager
							editionId={edition.id}
							{credits}
							oncreditssaved={saveCollaboratorCredits}
							isReadOnly={edition.status === EditionStatus.AlphaReview ||
								(!isAdmin && !canManageCollaborators) ||
								isSaving ||
								isSubmitting}
						/>
					</div>
				{/if}

				<!-- Resubmit button for authors with revisions -->
				{#if canResubmit}
					<div
						id="revisions"
						class="scroll-mt-24 rounded-box border border-base-300 bg-base-100 p-6"
					>
						<h2 class="mb-2 text-lg font-semibold">Revisions Requested</h2>
						<p class="mb-4 text-base-content/70">
							Please make the requested changes to your edition, then resubmit for review.
						</p>
						<div class="flex gap-2">
							<a
								href={resolve('/editions/[slug]', { slug: edition.id })}
								class="btn btn-ghost btn-sm"
							>
								Edit Edition
							</a>
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

	<dialog bind:this={submitDialog} class="modal" aria-labelledby="submit-proposal-title">
		<div class="modal-box">
			<h2 id="submit-proposal-title" class="text-lg font-bold">Submit proposal for review?</h2>
			<p class="py-4">
				Your proposal will remain private and viewable, but you and collaborators will no longer be
				able to edit proposal answers or proposal files while it is under editorial review.
			</p>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => submitDialog.close()}>Keep editing</button
				><button
					type="button"
					class="btn btn-primary"
					onclick={() => {
						submitDialog.close();
						void submitConcept();
					}}>Submit for Review</button
				>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop"><button aria-label="Close">Close</button></form>
	</dialog>

	{#if showDeleteModal && edition}
		<div class="modal-open modal">
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
					<button type="button" class="btn btn-error" onclick={deleteEdition} disabled={isDeleting}>
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
</div>

<style>
	#proposal :global(.form-control) {
		display: flex;
		flex-direction: column;
	}
</style>
