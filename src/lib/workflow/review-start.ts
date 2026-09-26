import { readCredits, validateCredits } from '$lib/utils/credits';

export function conceptReviewCreditIssue(editionCredits: unknown, collectionCredits?: unknown) {
	const editionIssue = validateCredits(readCredits(editionCredits), true);
	if (editionIssue) return editionIssue;
	return collectionCredits === undefined
		? null
		: validateCredits(readCredits(collectionCredits), true);
}

export function needsConceptReviewerAssignment(
	assignments: { reviewStage: number; status: string }[]
) {
	return !assignments.some(
		(assignment) => assignment.reviewStage === 1 && assignment.status !== 'declined'
	);
}
