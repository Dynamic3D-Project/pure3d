import { EditionStatus, ReviewStage, GlobalRole } from '$lib/types/roles';
import { ReviewDecision } from '$lib/types/reviews';
import type { EditionReview, ReviewAssignment } from '$lib/types/reviews';
import { pb } from '$lib/database/client';

export interface DisplayReview {
	displayName: string;
	decision: ReviewDecision;
	comment: string | null;
	created: string;
}

/**
 * Map reviews to display-friendly format with single-blind anonymization.
 * Alpha stage (stage=2): authors see "Reviewer 1", "Reviewer 2" etc.
 * Final stage (stage=3) or admin view: real names shown.
 */
export function anonymizeReviews(
	reviews: EditionReview[],
	assignments: ReviewAssignment[],
	stage: number,
	userLookup: Map<string, string>,
	isAdmin: boolean
): DisplayReview[] {
	const showRealNames = isAdmin || stage === ReviewStage.Final;

	// Stable numbering: sort assignments by created date for consistent "Reviewer N"
	const sortedAssignments = [...assignments].sort(
		(a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
	);
	const reviewerIndex = new Map<string, number>();
	sortedAssignments.forEach((a, i) => {
		reviewerIndex.set(a.reviewerId, i + 1);
	});

	return reviews.map((review) => {
		let displayName: string;
		if (showRealNames) {
			displayName = userLookup.get(review.reviewerId) || 'Unknown Reviewer';
		} else {
			const idx = reviewerIndex.get(review.reviewerId) || 0;
			displayName = idx > 0 ? `Reviewer ${idx}` : 'Reviewer';
		}

		return {
			displayName,
			decision: review.decision,
			comment: review.comment,
			created: review.created
		};
	});
}

/**
 * Aggregate review verdicts into a single outcome.
 * - pending: not all reviews submitted yet
 * - reject: any reviewer rejected
 * - revisions: any reviewer requested revisions (no rejections)
 * - accept: all reviewers approved
 */
export function aggregateVerdicts(
	reviews: EditionReview[],
	expectedCount: number
): 'accept' | 'reject' | 'revisions' | 'pending' {
	if (reviews.length < expectedCount) return 'pending';

	const hasReject = reviews.some((r) => r.decision === ReviewDecision.Reject);
	if (hasReject) return 'reject';

	const hasRevisions = reviews.some((r) => r.decision === ReviewDecision.RequestRevisions);
	if (hasRevisions) return 'revisions';

	return 'accept';
}

/**
 * Map an aggregate verdict + review stage to the target EditionStatus.
 * Returns null if the mapping is not applicable.
 */
export function getTargetStatusFromVerdict(
	verdict: 'accept' | 'reject' | 'revisions',
	stage: ReviewStage
): EditionStatus | null {
	switch (stage) {
		case ReviewStage.Concept:
			if (verdict === 'accept') return EditionStatus.ConceptAccepted;
			if (verdict === 'reject') return EditionStatus.ConceptRejected;
			return null;
		case ReviewStage.Alpha:
			if (verdict === 'accept') return EditionStatus.AlphaAccepted;
			if (verdict === 'reject') return EditionStatus.AlphaRejected;
			if (verdict === 'revisions') return EditionStatus.AlphaRevisions;
			return null;
		case ReviewStage.Final:
			if (verdict === 'accept') return EditionStatus.Published;
			if (verdict === 'revisions') return EditionStatus.FinalRevisions;
			return null;
		default:
			return null;
	}
}

/**
 * Get userProfile IDs of all admin users.
 */
export async function getAdminUserIds(): Promise<string[]> {
	try {
		const result = await pb.collection('userProfiles').getList(1, 500, {
			filter: `role = "${GlobalRole.Admin}"`
		});
		return result.items.map((r) => r.id);
	} catch {
		return [];
	}
}
