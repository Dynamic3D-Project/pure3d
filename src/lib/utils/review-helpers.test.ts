import { expect, test } from 'bun:test';
import {
	aggregateVerdicts,
	anonymizeReviews,
	getTargetStatusFromVerdict,
	isCurrentReviewRound
} from './review-helpers';
import { EditionStatus, ReviewStage } from '../types/roles';
import { ReviewDecision, type EditionReview } from '../types/reviews';

test('no assigned reviews cannot produce an approval', () => {
	expect(aggregateVerdicts([], 0)).toBe('pending');
});

test('only proposal votes use the automatic verdict mapping', () => {
	expect(getTargetStatusFromVerdict('accept', ReviewStage.Concept)).toBe(
		EditionStatus.ConceptAccepted
	);
	for (const stage of [ReviewStage.Alpha, ReviewStage.Final])
		for (const verdict of ['accept', 'reject', 'revisions'] as const)
			expect(getTargetStatusFromVerdict(verdict, stage)).toBeNull();
});

test('generic review rendering does not infer attribution consent from Final stage', () => {
	const review = {
		reviewerId: 'reviewer',
		decision: ReviewDecision.Approve,
		comment: '',
		created: ''
	} as EditionReview;
	expect(
		anonymizeReviews([review], [], new Map([['reviewer', 'Private name']]), false)[0].displayName
	).toBe('Reviewer');
});

test('current round filtering handles Final as well as Alpha records', () => {
	const edition = { alphaReviewRound: 2, finalReviewRound: 3 };
	expect(isCurrentReviewRound({ reviewStage: 1, reviewRound: 0 }, edition)).toBe(true);
	expect(isCurrentReviewRound({ reviewStage: 2, reviewRound: 1 }, edition)).toBe(false);
	expect(isCurrentReviewRound({ reviewStage: 3, reviewRound: 2 }, edition)).toBe(false);
	expect(isCurrentReviewRound({ reviewStage: 3, reviewRound: 3 }, edition)).toBe(true);
});
