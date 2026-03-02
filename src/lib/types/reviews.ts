export enum ReviewDecision {
	Approve = 'approve',
	Reject = 'reject',
	RequestRevisions = 'request_revisions'
}

export enum ReviewAssignmentStatus {
	Pending = 'pending',
	Accepted = 'accepted',
	Declined = 'declined',
	Completed = 'completed'
}

export interface EditionReview {
	id: string;
	editionId: string;
	reviewerId: string;
	reviewStage: number;
	decision: ReviewDecision;
	comment: string | null;
	created: string;
	updated: string;
}

export interface ReviewAssignment {
	id: string;
	editionId: string;
	reviewerId: string;
	reviewStage: number;
	assignedBy: string;
	status: ReviewAssignmentStatus;
	created: string;
	updated: string;
}

export enum FeedbackCategory {
	General = 'general',
	Annotation = 'annotation',
	Article = 'article'
}

export interface ReviewFeedback {
	id: string;
	editionId: string;
	reviewerId: string;
	reviewStage: number;
	category: FeedbackCategory;
	targetLabel: string | null;
	comment: string;
	resolved: boolean;
	created: string;
	updated: string;
}
