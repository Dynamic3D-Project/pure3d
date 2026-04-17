// Global roles assigned system-wide in the `users` collection
export enum GlobalRole {
	Admin = 'admin',
	EditorialBoard = 'editorial_board',
	Viewer = 'viewer'
}

// Collection-level roles assigned per-collection in `collectionUsers`
export enum CollectionRole {
	Owner = 'owner',
	Editor = 'editor',
	Viewer = 'viewer'
}

// Edition-level roles assigned per-edition in `editionUsers`
export enum EditionRole {
	Author = 'author',
	Collaborator = 'collaborator',
	Reviewer = 'reviewer'
}

// Edition workflow statuses (multi-stage review pipeline)
export enum EditionStatus {
	Draft = 'draft',
	ConceptSubmitted = 'concept_submitted',
	EditorialReview = 'editorial_review',
	ConceptAccepted = 'concept_accepted',
	ConceptRejected = 'concept_rejected',
	AlphaReview = 'alpha_review',
	AlphaRevisions = 'alpha_revisions',
	AlphaAccepted = 'alpha_accepted',
	AlphaRejected = 'alpha_rejected',
	FinalReview = 'final_review',
	FinalRevisions = 'final_revisions',
	Published = 'published'
}

// Review pipeline stages
export enum ReviewStage {
	Concept = 1,
	Alpha = 2,
	Final = 3
}

// Map an EditionStatus to its ReviewStage (null if not in a review stage)
export function getReviewStage(status: EditionStatus): ReviewStage | null {
	switch (status) {
		case EditionStatus.ConceptSubmitted:
		case EditionStatus.EditorialReview:
		case EditionStatus.ConceptAccepted:
		case EditionStatus.ConceptRejected:
			return ReviewStage.Concept;
		case EditionStatus.AlphaReview:
		case EditionStatus.AlphaRevisions:
		case EditionStatus.AlphaAccepted:
		case EditionStatus.AlphaRejected:
			return ReviewStage.Alpha;
		case EditionStatus.FinalReview:
		case EditionStatus.FinalRevisions:
			return ReviewStage.Final;
		default:
			return null;
	}
}

// Granular permissions for permission checking
export enum Permission {
	// Edition actions
	EditionCreate = 'edition:create',
	EditionEdit = 'edition:edit',
	EditionDelete = 'edition:delete',
	EditionViewDraft = 'edition:view_draft',

	// Workflow actions
	WorkflowSubmit = 'workflow:submit',
	WorkflowReview = 'workflow:review',
	WorkflowApprove = 'workflow:approve',
	WorkflowReject = 'workflow:reject',
	WorkflowPublish = 'workflow:publish',
	WorkflowUnpublish = 'workflow:unpublish',

	// Collection actions
	CollectionCreate = 'collection:create',
	CollectionEdit = 'collection:edit',
	CollectionDelete = 'collection:delete',
	CollectionManageUsers = 'collection:manage_users',

	// Annotation & review actions
	EditionAnnotate = 'edition:annotate',
	ReviewerAssign = 'reviewer:assign',
	ReviewerSuggest = 'reviewer:suggest',
	WorkflowRequestRevisions = 'workflow:request_revisions',
	EditionAssignToCollection = 'edition:assign_to_collection',

	// User & platform management
	AdminViewPanel = 'admin:view_panel',
	AdminManageUsers = 'admin:manage_users',
	AdminManagePlatform = 'admin:manage_platform'
}

// Valid edition status transitions: from → allowed targets
export const EDITION_STATUS_TRANSITIONS: Record<EditionStatus, EditionStatus[]> = {
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
	[EditionStatus.AlphaAccepted]: [EditionStatus.FinalReview],
	[EditionStatus.AlphaRejected]: [EditionStatus.Draft],
	[EditionStatus.FinalReview]: [EditionStatus.Published, EditionStatus.FinalRevisions],
	[EditionStatus.FinalRevisions]: [EditionStatus.FinalReview],
	[EditionStatus.Published]: [EditionStatus.Draft]
};

// Global role hierarchy (higher index = more privilege)
export const GLOBAL_ROLE_HIERARCHY: GlobalRole[] = [
	GlobalRole.Viewer,
	GlobalRole.EditorialBoard,
	GlobalRole.Admin
];

// Context object for permission checks
export interface UserRoleContext {
	globalRole: GlobalRole;
	collectionRole?: CollectionRole;
	editionRole?: EditionRole;
}

// Display-friendly labels for all roles
// Display-friendly labels for global roles
export const GLOBAL_ROLE_LABELS: Record<GlobalRole, string> = {
	[GlobalRole.Admin]: 'Admin',
	[GlobalRole.EditorialBoard]: 'Editorial Board',
	[GlobalRole.Viewer]: 'Viewer'
};

// Display-friendly labels for collection roles
export const COLLECTION_ROLE_LABELS: Record<CollectionRole, string> = {
	[CollectionRole.Owner]: 'Collection Owner',
	[CollectionRole.Editor]: 'Editor',
	[CollectionRole.Viewer]: 'Viewer'
};

// Display-friendly labels for edition roles
export const EDITION_ROLE_LABELS: Record<EditionRole, string> = {
	[EditionRole.Author]: 'Author',
	[EditionRole.Collaborator]: 'Collaborator',
	[EditionRole.Reviewer]: 'Reviewer'
};

// Combined labels lookup (collection-level "viewer" and "editor" overlap with global,
// so this map resolves to the most common label for each string value)
export const ROLE_LABELS: Record<string, string> = {
	...EDITION_ROLE_LABELS,
	...COLLECTION_ROLE_LABELS,
	...GLOBAL_ROLE_LABELS
};

// Edition status display labels
export const STATUS_LABELS: Record<EditionStatus, string> = {
	[EditionStatus.Draft]: 'Draft',
	[EditionStatus.ConceptSubmitted]: 'Concept Submitted',
	[EditionStatus.EditorialReview]: 'Editorial Review',
	[EditionStatus.ConceptAccepted]: 'Concept Accepted',
	[EditionStatus.ConceptRejected]: 'Concept Rejected',
	[EditionStatus.AlphaReview]: 'Alpha Review',
	[EditionStatus.AlphaRevisions]: 'Alpha Revisions',
	[EditionStatus.AlphaAccepted]: 'Alpha Accepted',
	[EditionStatus.AlphaRejected]: 'Alpha Rejected',
	[EditionStatus.FinalReview]: 'Final Review',
	[EditionStatus.FinalRevisions]: 'Final Revisions',
	[EditionStatus.Published]: 'Published'
};
