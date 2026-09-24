import {
	GlobalRole,
	CollectionRole,
	EditionRole,
	EditionStatus,
	Permission,
	EDITION_STATUS_TRANSITIONS,
	GLOBAL_ROLE_HIERARCHY,
	type UserRoleContext
} from '$lib/types/roles';

/**
 * Check if a global role meets a minimum privilege level.
 */
export function hasMinGlobalRole(context: UserRoleContext, minRole: GlobalRole): boolean {
	const userIndex = GLOBAL_ROLE_HIERARCHY.indexOf(context.globalRole);
	const minIndex = GLOBAL_ROLE_HIERARCHY.indexOf(minRole);
	return userIndex >= minIndex;
}

/**
 * Check if a status transition is structurally valid (ignoring permissions).
 */
export function canTransitionStatus(current: EditionStatus, target: EditionStatus): boolean {
	const allowed = EDITION_STATUS_TRANSITIONS[current];
	return allowed?.includes(target) ?? false;
}

/**
 * Check if a user has a specific permission given their role context.
 */
export function hasPermission(context: UserRoleContext, permission: Permission): boolean {
	const { globalRole, collectionRole, editionRole } = context;
	// Published records have no ordinary unpublish transition, including for admins.
	if (permission === Permission.WorkflowUnpublish) return false;

	// Admin has all permissions
	if (globalRole === GlobalRole.Admin) return true;

	switch (permission) {
		// --- Edition actions ---
		case Permission.EditionCreate:
			return collectionRole === CollectionRole.Owner;

		case Permission.EditionEdit:
			return (
				collectionRole === CollectionRole.Owner ||
				collectionRole === CollectionRole.Editor ||
				editionRole === EditionRole.Author ||
				editionRole === EditionRole.Collaborator
			);

		case Permission.EditionDelete:
			return collectionRole === CollectionRole.Owner;

		case Permission.EditionViewDraft:
			return (
				collectionRole === CollectionRole.Owner ||
				collectionRole === CollectionRole.Editor ||
				collectionRole === CollectionRole.Viewer ||
				editionRole === EditionRole.Author ||
				editionRole === EditionRole.Collaborator ||
				editionRole === EditionRole.Reviewer
			);

		case Permission.EditionAnnotate:
			return editionRole === EditionRole.Reviewer;

		case Permission.EditionAssignToCollection:
			return collectionRole === CollectionRole.Owner || editionRole === EditionRole.Author;

		// --- Workflow actions ---
		case Permission.WorkflowSubmit:
			return collectionRole === CollectionRole.Owner || editionRole === EditionRole.Author;

		case Permission.WorkflowReview:
			return globalRole === GlobalRole.EditorialBoard || editionRole === EditionRole.Reviewer;

		case Permission.WorkflowApprove:
		case Permission.WorkflowReject:
			return globalRole === GlobalRole.EditorialBoard || editionRole === EditionRole.Reviewer;

		case Permission.WorkflowRequestRevisions:
			return globalRole === GlobalRole.EditorialBoard || editionRole === EditionRole.Reviewer;

		case Permission.WorkflowPublish:
		case Permission.ReviewerAssign:
			return globalRole === GlobalRole.EditorialBoard;

		case Permission.ReviewerSuggest:
			return globalRole === GlobalRole.EditorialBoard;

		// --- Collection actions ---
		case Permission.CollectionCreate:
			return false; // Only Admin (handled above)

		case Permission.CollectionEdit:
			return collectionRole === CollectionRole.Owner || collectionRole === CollectionRole.Editor;

		case Permission.CollectionDelete:
			return collectionRole === CollectionRole.Owner;

		case Permission.CollectionManageUsers:
			return collectionRole === CollectionRole.Owner;

		// --- Admin actions ---
		case Permission.AdminViewPanel:
		case Permission.AdminManageUsers:
			return false; // Only Admin (handled above)

		default:
			return false;
	}
}

/**
 * Check if a user can trigger a specific status transition.
 * Mirrors the backend transition role checks. Submission validation and editorial
 * decisions still run on the backend; this only controls available UI actions.
 */
export function canUserTransitionStatus(
	context: UserRoleContext,
	current: EditionStatus,
	target: EditionStatus
): boolean {
	if (!canTransitionStatus(current, target)) return false;

	if (context.globalRole === GlobalRole.Admin) return true;
	const editorial = context.globalRole === GlobalRole.EditorialBoard;
	const author = hasPermission(context, Permission.WorkflowSubmit);
	if (
		[
			EditionStatus.AlphaReview,
			EditionStatus.FinalReview,
			EditionStatus.PublicationRequested
		].includes(target)
	)
		return author || editorial;
	if (
		[
			EditionStatus.AlphaReview,
			EditionStatus.FinalReview,
			EditionStatus.PublicationRequested
		].includes(current)
	)
		return editorial;
	if ([EditionStatus.ConceptSubmitted, EditionStatus.Draft].includes(target)) return author;
	return editorial || context.editionRole === EditionRole.Reviewer;
}

/**
 * Determine where a submission should be routed based on whether
 * the edition belongs to a collection.
 */
export function getSubmitTarget(hasCollection: boolean): 'collection_owner' | 'admin' {
	return hasCollection ? 'collection_owner' : 'admin';
}

// --- Convenience wrappers ---

export function canEditEdition(context: UserRoleContext): boolean {
	return hasPermission(context, Permission.EditionEdit);
}

export function canDeleteEdition(context: UserRoleContext): boolean {
	return hasPermission(context, Permission.EditionDelete);
}

export function canSubmitForReview(context: UserRoleContext): boolean {
	return hasPermission(context, Permission.WorkflowSubmit);
}

export function canManageUsers(context: UserRoleContext): boolean {
	return hasPermission(context, Permission.AdminManageUsers);
}

export function canViewAdminPanel(context: UserRoleContext): boolean {
	return hasPermission(context, Permission.AdminViewPanel);
}
