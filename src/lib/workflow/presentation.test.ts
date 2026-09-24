import { expect, test } from 'bun:test';
import { EditionStatus } from '../types/roles';
import { workflowStages, workflowAnchor } from './presentation';

test('every workflow status appears in exactly one timeline stage', () => {
	const statuses = workflowStages.flatMap((stage) => stage.statuses);
	expect([...statuses].sort()).toEqual(Object.values(EditionStatus).sort());
});

test('submission and post-review links keep authors in the correct workflow section', () => {
	expect(workflowAnchor(EditionStatus.Draft)).toBe('#proposal');
	expect(workflowAnchor(EditionStatus.ConceptSubmitted)).toBe('#proposal-summary');
	expect(workflowAnchor(EditionStatus.FinalAccepted)).toBe('#final');
	expect(workflowAnchor(EditionStatus.PublicationRequested)).toBe('#final');
	expect(workflowAnchor(EditionStatus.Published)).toBe('#published');
});
