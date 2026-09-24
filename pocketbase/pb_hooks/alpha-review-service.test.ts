import { expect, test } from 'bun:test';
import alpha from './alpha-review-service.cjs';

test('Alpha draft answers allow incomplete work, submission requires the confirmed criteria', () => {
	expect(alpha.reviewErrors({}, false)).toEqual([]);
	expect(alpha.reviewErrors({}, true).length).toBeGreaterThan(0);
	const valid = {
		technicalComments: 'Loads correctly.',
		valueRating: 4,
		valueExplanation: 'Sources and methods are clear.',
		experienceComments: 'Easy to navigate.',
		generalComments: 'Ready for refinement.',
		decision: 'approve',
		recommendationExplanation: 'The edition can proceed.',
		collaborationInterest: 'no'
	};
	expect(alpha.reviewErrors(valid, true)).toEqual([]);
	expect(
		alpha.reviewErrors({ ...valid, valueExplanation: Array(151).fill('word').join(' ') }, true)
			.length
	).toBeGreaterThan(0);
	expect(alpha.reviewErrors({ ...valid, decision: 'reject' }, true).length).toBeGreaterThan(0);
});

test('author request is guided and limited to 500 words in total', () => {
	expect(
		alpha.requestErrors({
			ready: 'Scene and narrative',
			focus: 'Interpretation',
			workInProgress: 'Audio'
		})
	).toEqual([]);
	expect(
		alpha.requestErrors({ ready: 'Ready', focus: '', workInProgress: '' }).length
	).toBeGreaterThan(0);
	expect(
		alpha.requestErrors({ ready: Array(501).fill('word').join(' '), focus: 'Focus' }).length
	).toBeGreaterThan(0);
});

test('author feedback never contains reviewer identity or confidential recommendation', () => {
	const review = {
		technicalComments: 'Technical',
		valueRating: 4,
		valueExplanation: 'Value',
		experienceComments: 'Experience',
		generalComments: 'General',
		reviewerId: 'secret',
		decision: 'approve',
		recommendationExplanation: 'Confidential',
		collaborationInterest: 'yes'
	};
	const publicFeedback = alpha.publicFeedback(review, 0);
	expect(publicFeedback).toEqual({
		reviewer: 'Reviewer A',
		technicalComments: 'Technical',
		valueRating: 4,
		valueExplanation: 'Value',
		experienceComments: 'Experience',
		generalComments: 'General'
	});
});
