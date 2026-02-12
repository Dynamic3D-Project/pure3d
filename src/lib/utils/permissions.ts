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

	// Super Admin has all permissions
	if (globalRole === GlobalRole.SuperAdmin) return true;

	switch (permission) {
		// --- Edition actions ---
		case Permission.EditionCreate:
			return globalRole === GlobalRole.Admin || collectionRole === CollectionRole.Owner;

		case Permission.EditionEdit:
			return (
				globalRole === GlobalRole.Admin ||
				collectionRole === CollectionRole.Owner ||
				collectionRole === CollectionRole.Editor ||
				editionRole === EditionRole.Author ||
				editionRole === EditionRole.Collaborator
			);

		case Permission.EditionDelete:
			return globalRole === GlobalRole.Admin || collectionRole === CollectionRole.Owner;

		case Permission.EditionViewDraft:
			return (
				globalRole === GlobalRole.Admin ||
				collectionRole === CollectionRole.Owner ||
				collectionRole === CollectionRole.Editor ||
				collectionRole === CollectionRole.Viewer ||
				editionRole === EditionRole.Author ||
				editionRole === EditionRole.Collaborator ||
				editionRole === EditionRole.Reviewer
			);

		// --- Workflow actions ---
		case Permission.WorkflowSubmit:
			return (
				globalRole === GlobalRole.Admin ||
				collectionRole === CollectionRole.Owner ||
				editionRole === EditionRole.Author
			);

		case Permission.WorkflowReview:
			return globalRole === GlobalRole.EditorialBoard || editionRole === EditionRole.Reviewer;

		case Permission.WorkflowApprove:
		case Permission.WorkflowReject:
			return globalRole === GlobalRole.EditorialBoard || editionRole === EditionRole.Reviewer;

		case Permission.WorkflowPublish:
		case Permission.WorkflowUnpublish:
			return globalRole === GlobalRole.Admin || collectionRole === CollectionRole.Owner;

		// --- Collection actions ---
		case Permission.CollectionCreate:
			return globalRole === GlobalRole.Admin;

		case Permission.CollectionEdit:
			return (
				globalRole === GlobalRole.Admin ||
				collectionRole === CollectionRole.Owner ||
				collectionRole === CollectionRole.Editor
			);

		case Permission.CollectionDelete:
			return globalRole === GlobalRole.Admin || collectionRole === CollectionRole.Owner;

		case Permission.CollectionManageUsers:
			return globalRole === GlobalRole.Admin || collectionRole === CollectionRole.Owner;

		// --- Admin actions ---
		case Permission.AdminViewPanel:
		case Permission.AdminManageUsers:
			return globalRole === GlobalRole.Admin;

		case Permission.AdminManagePlatform:
			return false; // Only SuperAdmin (handled above)

		default:
			return false;
	}
}

/**
 * Check if a user can trigger a specific status transition.
 */
export function canUserTransitionStatus(
	context: UserRoleContext,
	current: EditionStatus,
	target: EditionStatus
): boolean {
	if (!canTransitionStatus(current, target)) return false;

	// SuperAdmin can do all valid transitions
	if (context.globalRole === GlobalRole.SuperAdmin) return true;

	switch (target) {
		case EditionStatus.Submitted:
			return hasPermission(context, Permission.WorkflowSubmit);
		case EditionStatus.InReview:
			return hasPermission(context, Permission.WorkflowReview);
		case EditionStatus.Approved:
			return hasPermission(context, Permission.WorkflowApprove);
		case EditionStatus.Rejected:
			return hasPermission(context, Permission.WorkflowReject);
		case EditionStatus.Published:
			return hasPermission(context, Permission.WorkflowPublish);
		case EditionStatus.Draft:
			// Returning to draft from rejected or published
			if (current === EditionStatus.Rejected) {
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
