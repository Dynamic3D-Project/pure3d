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
			return (
				globalRole === GlobalRole.EditorialBoard || editionRole === EditionRole.Reviewer
			);

		case Permission.WorkflowApprove:
		case Permission.WorkflowReject:
			return (
				globalRole === GlobalRole.EditorialBoard || editionRole === EditionRole.Reviewer
			);

		case Permission.WorkflowRequestRevisions:
			return (
				globalRole === GlobalRole.EditorialBoard || editionRole === EditionRole.Reviewer
			);

		case Permission.WorkflowPublish:
		case Permission.WorkflowUnpublish:
			return collectionRole === CollectionRole.Owner;

		case Permission.ReviewerAssign:
			return false; // Only Admin (handled above)

		case Permission.ReviewerSuggest:
			return globalRole === GlobalRole.EditorialBoard;

		// --- Collection actions ---
		case Permission.CollectionCreate:
			return false; // Only Admin (handled above)

		case Permission.CollectionEdit:
			return (
				collectionRole === CollectionRole.Owner ||
				collectionRole === CollectionRole.Editor
			);

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
 * Implements stage-specific gating for the 12-status pipeline.
 */
export function canUserTransitionStatus(
	context: UserRoleContext,
	current: EditionStatus,
	target: EditionStatus
): boolean {
	if (!canTransitionStatus(current, target)) return false;

	// Admin can do all valid transitions
	if (context.globalRole === GlobalRole.Admin) return true;

	switch (target) {
		// --- Concept stage ---
		case EditionStatus.ConceptSubmitted:
			// Author or CollectionOwner submits concept
			return hasPermission(context, Permission.WorkflowSubmit);

		case EditionStatus.EditorialReview:
			// Admin/EditorialBoard moves to editorial review
			return hasPermission(context, Permission.WorkflowReview);

		case EditionStatus.ConceptAccepted:
			return hasPermission(context, Permission.WorkflowApprove);

		case EditionStatus.ConceptRejected:
			return hasPermission(context, Permission.WorkflowReject);

		// --- Alpha stage ---
		case EditionStatus.AlphaReview:
			if (current === EditionStatus.ConceptAccepted) {
				// Admin moves accepted concept to alpha review
				return hasPermission(context, Permission.WorkflowReview);
			}
			if (current === EditionStatus.AlphaRevisions) {
				// Author resubmits after revisions
				return hasPermission(context, Permission.WorkflowSubmit);
			}
			return false;

		case EditionStatus.AlphaRevisions:
			return hasPermission(context, Permission.WorkflowRequestRevisions);

		case EditionStatus.AlphaAccepted:
			return hasPermission(context, Permission.WorkflowApprove);

		case EditionStatus.AlphaRejected:
			return hasPermission(context, Permission.WorkflowReject);

		// --- Final stage ---
		case EditionStatus.FinalReview:
			if (current === EditionStatus.AlphaAccepted) {
				// Admin moves accepted alpha to final review
				return hasPermission(context, Permission.WorkflowReview);
			}
			if (current === EditionStatus.FinalRevisions) {
				// Author resubmits after revisions
				return hasPermission(context, Permission.WorkflowSubmit);
			}
			return false;

		case EditionStatus.FinalRevisions:
			return hasPermission(context, Permission.WorkflowRequestRevisions);

		// --- Publication ---
		case EditionStatus.Published:
			return hasPermission(context, Permission.WorkflowPublish);

		// --- Return to draft ---
		case EditionStatus.Draft:
			if (current === EditionStatus.ConceptRejected || current === EditionStatus.AlphaRejected) {
				// Author can revise after rejection
				return hasPermission(context, Permission.WorkflowSubmit);
			}
			if (current === EditionStatus.Published) {
				return hasPermission(context, Permission.WorkflowUnpublish);
			}
			return false;

		default:
			return false;
	}
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
