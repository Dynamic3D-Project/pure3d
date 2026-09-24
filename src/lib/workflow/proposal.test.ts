import { expect, test } from 'bun:test';
import { PROPOSAL_AUDIENCES, proposalErrors, proposalIsDirty } from './proposal';

const validProposal = {
	proposalType: 'research',
	title: 'A 3D research proposal',
	credits: [{ role: 'creator' }],
	purpose: 'To make a research model.',
	argument: 'The model is central to the research argument.',
	threeDRationale: 'Spatial evidence needs a three-dimensional representation.',
	audiences: ['academics'],
	contextualMaterial: 'Archive records and a short interpretive essay.',
	hasExistingModel: true,
	modelSources: ['photogrammetry'],
	copyrightOwnership: 'We own the model and have permission for all source material.',
	digitisationSituation: '',
	hasModelFile: true
};

test('proposal validation requires complete model proposal details before submission', () => {
	expect(proposalErrors({ ...validProposal, modelSources: [] })).toEqual([
		'Select at least one model source.'
	]);
	expect(proposalErrors({ ...validProposal, hasModelFile: false })).toEqual([
		'Upload an existing 3D model before submitting.'
	]);
});

test('proposal validation requires digitisation context when no model exists', () => {
	expect(
		proposalErrors({
			...validProposal,
			hasExistingModel: false,
			modelSources: [],
			copyrightOwnership: '',
			digitisationSituation: ''
		})
	).toEqual(['Describe the digitisation situation.']);
});

test('proposal validation rejects written answers over 150 words', () => {
	expect(proposalErrors({ ...validProposal, purpose: Array(151).fill('word').join(' ') })).toEqual([
		'Purpose must be 150 words or fewer.'
	]);
});

test('proposal autosave snapshots ignore unchanged data', () => {
	expect(proposalIsDirty('{"title":"Draft"}', '{"title":"Draft"}')).toBe(false);
	expect(proposalIsDirty('{"title":"Draft"}', '{"title":"Updated"}')).toBe(true);
});

test('proposal audiences keep the three student groups distinct', () => {
	expect(PROPOSAL_AUDIENCES.map(([value]) => value)).toEqual([
		'general-public',
		'academics',
		'specialists',
		'primary-students',
		'secondary-students',
		'university-students'
	]);
});
