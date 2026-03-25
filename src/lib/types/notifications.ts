export enum NotificationType {
	StatusChanged = 'status_changed',
	ConceptSubmitted = 'concept_submitted',
	ConceptAccepted = 'concept_accepted',
	ConceptRejected = 'concept_rejected',
	AlphaReviewStarted = 'alpha_review_started',
	AlphaRevisionsRequested = 'alpha_revisions_requested',
	AlphaAccepted = 'alpha_accepted',
	AlphaRejected = 'alpha_rejected',
	FinalReviewStarted = 'final_review_started',
	FinalRevisionsRequested = 'final_revisions_requested',
	Published = 'published',
	ReviewerAssigned = 'reviewer_assigned',
	ReviewerRemoved = 'reviewer_removed',
	ReviewSubmitted = 'review_submitted',
	UserAddedToEdition = 'user_added_to_edition',
	CollaboratorAdded = 'collaborator_added',
	CollaboratorRemoved = 'collaborator_removed',
	FeedbackReceived = 'feedback_received'
}

export interface Notification {
	id: string;
	recipientId: string;
	type: NotificationType;
	title: string;
	message: string | null;
	editionId: string | null;
	actionUrl: string | null;
	read: boolean;
	created: string;
}
