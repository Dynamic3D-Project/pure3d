/**
 * Client-safe edition helper functions.
 * These use the client-side PocketBase instance and can be imported from browser code.
 */
import { pb } from '$lib/database/client';
import { EditionRole, EditionStatus, getReviewStage } from '$lib/types/roles';
import type { ReviewAssignmentStatus } from '$lib/types/reviews';

export async function updateEditionStatus(
	editionId: string,
	newStatus: EditionStatus,
	performedByUserId?: string
) {
	const isPublished = newStatus === EditionStatus.Published;
	const reviewStage = getReviewStage(newStatus);

	const updateData: Record<string, unknown> = {
		status: newStatus,
		isPublished,
		reviewStage: reviewStage ?? null
	};

	if (isPublished && performedByUserId) {
		updateData.publishedAt = new Date().toISOString();
		updateData.publishedBy = performedByUserId;
	}

	return pb.collection('editions').update(editionId, updateData);
}

export async function assignReviewer(
	editionId: string,
	reviewerId: string,
	reviewStage: number,
	assignedBy: string
) {
	const assignment = await pb.collection('reviewAssignments').create({
		editionId,
		reviewerId,
		reviewStage,
		assignedBy,
		status: 'pending'
	});

	// Ensure the reviewer has an editionUsers record with Reviewer role
	try {
		const existing = await pb.collection('editionUsers').getList(1, 1, {
			filter: `editionId = "${editionId}" && userId = "${reviewerId}"`
		});
		if (existing.items.length === 0) {
			await pb.collection('editionUsers').create({
				editionId,
				userId: reviewerId,
				user: reviewerId,
				role: EditionRole.Reviewer
			});
		}
	} catch {
		// If editionUsers creation fails, the assignment still exists
	}

	return assignment;
}

export async function updateReviewAssignmentStatus(id: string, status: ReviewAssignmentStatus) {
	return pb.collection('reviewAssignments').update(id, { status });
}

export async function removeReviewAssignment(id: string) {
	return pb.collection('reviewAssignments').delete(id);
}
