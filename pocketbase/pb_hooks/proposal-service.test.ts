import { expect, test } from 'bun:test';
import proposal from './proposal-service.cjs';

test('submitted proposals reject author changes to proposal fields and files', () => {
	expect(proposal.canAuthorEditProposal('concept_submitted', ['proposalPurpose'])).toBe(false);
	expect(proposal.canAuthorEditProposal('concept_submitted', ['proposalModelFiles'])).toBe(false);
	expect(proposal.canAuthorEditProposal('concept_submitted', ['title'])).toBe(false);
	expect(proposal.canAuthorEditProposal('concept_submitted', ['modelFile'])).toBe(false);
	expect(
		proposal.canAuthorEditProposal('concept_accepted', ['modelFile', 'title', 'credits'])
	).toBe(true);
	expect(proposal.canAuthorEditProposal('concept_accepted', ['proposalPurpose'])).toBe(false);
	expect(proposal.canAuthorEditProposal('concept_rejected', ['proposalPurpose'])).toBe(true);
	expect(proposal.canAuthorEditProposal('concept_submitted', ['dcKeyword'])).toBe(true);
});

test('a submitted proposal requires its draft questionnaire and model evidence', () => {
	expect(
		proposal.submissionErrors({
			title: 'Draft',
			credits: [{ role: 'creator' }],
			proposalType: 'research',
			proposalPurpose: 'Purpose',
			proposalArgument: 'Argument',
			proposalThreeDRationale: 'Rationale',
			proposalAudience: ['academics'],
			proposalContextualMaterial: 'Context',
			proposalHasExistingModel: true,
			modelFile: '',
			proposalModelSources: ['photogrammetry'],
			proposalCopyrightOwnership: 'Permission',
			proposalDigitisationSituation: ''
		})
	).toEqual(['Upload an existing 3D model before submitting.']);
});
