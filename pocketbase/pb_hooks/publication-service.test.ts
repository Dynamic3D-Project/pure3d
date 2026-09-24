import { expect, test } from 'bun:test';
import service from './publication-service.cjs';
const answers = {
	valueRating: 4,
	valueExplanation: 'Evidence is clear.',
	experienceComments: 'Usable.',
	changesRating: 5,
	changesExplanation: 'All changes addressed.',
	recommendation: 'minor_changes',
	comments: '',
	attribution: 'anonymous'
};
test('Final Review validates all recommendations, attribution, limits and draft answers', () => {
	expect(service.answersError({}, false)).toBe('');
	expect(service.answersError({}, true)).not.toBe('');
	for (const recommendation of [
		'without_changes',
		'minor_changes',
		'major_changes',
		'do_not_recommend'
	])
		expect(service.answersError({ ...answers, recommendation }, true)).toBe('');
	expect(service.answersError({ ...answers, attribution: '' }, true)).not.toBe('');
	expect(service.answersError({ ...answers, valueRating: 1.5 }, true)).not.toBe('');
	expect(
		service.answersError({ ...answers, comments: Array(151).fill('word').join(' ') }, true)
	).not.toBe('');
	expect(service.answersError({ ...answers, secret: 'unsupported' }, false)).not.toBe('');
});
test('author response and publication rights are required and bounded', () => {
	expect(
		service.requestError(
			{
				changes: 'Updated sources.',
				notImplemented: 'Kept original colour for accuracy.',
				comment: ''
			},
			false
		)
	).toBe('');
	expect(service.requestError({ changes: '', notImplemented: '', comment: '' }, false)).not.toBe(
		''
	);
	expect(service.requestError({ rightsConfirmed: false, comment: '' }, true)).not.toBe('');
	expect(service.requestError({ rightsConfirmed: true, comment: '' }, true)).toBe('');
	expect(
		service.requestError(
			{ rightsConfirmed: true, comment: Array(501).fill('word').join(' ') },
			true
		)
	).not.toBe('');
});
