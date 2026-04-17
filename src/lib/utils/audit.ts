import { pb } from '$lib/database/client';

export type AuditAction =
	| 'role_change'
	| 'status_transition'
	| 'user_assigned'
	| 'user_removed'
	| 'user_created'
	| 'user_updated'
	| 'user_deleted'
	| 'review_submitted'
	| 'reviewer_assigned'
	| 'reviewer_removed'
	| 'feedback_created'
	| 'feedback_resolved'
	| 'collaborator_added'
	| 'collaborator_removed'
	| 'doc_created'
	| 'doc_updated'
	| 'doc_deleted'
	| 'edition_deleted';

export type AuditTargetType = 'user' | 'collection' | 'edition' | 'documentation';

export async function logAudit(
	action: AuditAction,
	targetType: AuditTargetType,
	targetId: string,
	performedBy: string,
	details?: Record<string, unknown>
): Promise<void> {
	try {
		await pb.collection('auditLog').create({
			action,
			targetType,
			targetId,
			performedBy,
			details: details ?? {}
		});
	} catch (error) {
		console.error('Failed to write audit log:', error);
	}
}
