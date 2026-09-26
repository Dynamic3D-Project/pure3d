import { expect, test } from 'bun:test';
import { conceptReviewCreditIssue, needsConceptReviewerAssignment } from './review-start';

test('blocks a review transition when a creator is missing an ORCID', () => {
	const issue = conceptReviewCreditIssue([
		{ type: 'person', name: 'Creator', role: 'creator', provenance: 'manual', orcid: null }
	]);
	expect(issue).toContain('ORCID');
});

test('does not create another assignment when a pending concept reviewer already exists', () => {
	expect(needsConceptReviewerAssignment([{ reviewStage: 1, status: 'pending' }])).toBe(false);
	expect(needsConceptReviewerAssignment([{ reviewStage: 1, status: 'declined' }])).toBe(true);
});
