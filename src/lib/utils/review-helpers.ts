import { EditionStatus, ReviewStage } from '$lib/types/roles';
import { ReviewDecision } from '$lib/types/reviews';
import type { EditionReview, ReviewAssignment } from '$lib/types/reviews';

export interface DisplayReview {
	displayName: string;
	decision: ReviewDecision;
	comment: string | null;
	created: string;
}

export function isCurrentReviewRound(
	review: { reviewStage: number; reviewRound?: number },
	edition: { alphaReviewRound?: number; finalReviewRound?: number }
): boolean {
	if (review.reviewStage === ReviewStage.Concept) return true;
	const round =
		review.reviewStage === ReviewStage.Final ? edition.finalReviewRound : edition.alphaReviewRound;
	return (review.reviewRound || 0) === (round || 0);
}

/**
 * Generic internal review summaries. Only editors see identities here.
 * Public Final Review attribution is selected by the backend public-reviews endpoint.
 */
export function anonymizeReviews(
	reviews: EditionReview[],
	assignments: ReviewAssignment[],
	userLookup: Map<string, string>,
	isAdmin: boolean
): DisplayReview[] {
	const showRealNames = isAdmin;

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
	if (expectedCount <= 0 || reviews.length < expectedCount) return 'pending';

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
		// Later rounds require an explicit editorial decision and feedback release.
		default:
			return null;
	}
}
