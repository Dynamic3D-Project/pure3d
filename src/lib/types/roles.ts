// Global roles assigned system-wide in the `users` collection
export enum GlobalRole {
	SuperAdmin = 'superadmin',
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

// Edition workflow statuses
export enum EditionStatus {
	Draft = 'draft',
	Submitted = 'submitted',
	InReview = 'in_review',
	Approved = 'approved',
	Rejected = 'rejected',
	Published = 'published'
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

	// User & platform management
	AdminViewPanel = 'admin:view_panel',
	AdminManageUsers = 'admin:manage_users',
	AdminManagePlatform = 'admin:manage_platform'
}

// Valid edition status transitions: from → allowed targets
export const EDITION_STATUS_TRANSITIONS: Record<EditionStatus, EditionStatus[]> = {
	[EditionStatus.Draft]: [EditionStatus.Submitted],
	[EditionStatus.Submitted]: [EditionStatus.InReview],
	[EditionStatus.InReview]: [EditionStatus.Approved, EditionStatus.Rejected],
	[EditionStatus.Approved]: [EditionStatus.Published],
	[EditionStatus.Rejected]: [EditionStatus.Draft],
	[EditionStatus.Published]: [EditionStatus.Draft]
};

// Global role hierarchy (higher index = more privilege)
export const GLOBAL_ROLE_HIERARCHY: GlobalRole[] = [
	GlobalRole.Viewer,
	GlobalRole.EditorialBoard,
	GlobalRole.Admin,
	GlobalRole.SuperAdmin
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
	[GlobalRole.SuperAdmin]: 'Super Admin',
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
	[EditionStatus.Submitted]: 'Submitted',
	[EditionStatus.InReview]: 'In Review',
	[EditionStatus.Approved]: 'Approved',
	[EditionStatus.Rejected]: 'Rejected',
	[EditionStatus.Published]: 'Published'
};
