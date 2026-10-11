import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { metadataOptions, metadataValues, vocabularyValues } from './metadata';

test('metadata fields retain imported scalar and unknown controlled values', () => {
	expect(metadataValues('Contemporary')).toEqual(['Contemporary']);
	expect(metadataValues(['Ancient', '', 'Modern'])).toEqual(['Ancient', 'Modern']);
	expect(metadataOptions(['Legacy period'], ['Ancient', 'Modern'])).toEqual([
		'Ancient',
		'Legacy period',
		'Modern'
	]);
	expect(metadataOptions(['', ' '], ['CC BY', 'CC BY'])).toEqual(['CC BY']);
});

test('uses the imported keyword category vocabulary without inventing values', () => {
	expect(
		vocabularyValues(
			[
				{ category: 'language', value: 'English (eng)' },
				{ name: 'language', value: 'Dutch (nld)' },
				{ category: 'subject', value: 'History' }
			],
			'language'
		)
	).toEqual(['English (eng)', 'Dutch (nld)']);
});

test('uses the imported source and license categories, with text fallback when a category is absent', () => {
	const keywords = JSON.parse(
		readFileSync(new URL('../../../../data/json-output/keyword.json', import.meta.url), 'utf8')
	);
	expect(vocabularyValues(keywords, 'source')).toContain('Photogrammetry');
	expect(vocabularyValues(keywords, 'license')).toContain('CC BY: Attribution required.');
	expect(vocabularyValues(keywords, 'audience')).toEqual([]);
});

test('metadata values survive a save and reopen round trip', () => {
	const saved = JSON.parse(
		JSON.stringify({
			dcAudience: ['general public', 'students (secondary)'],
			dcCoverageCountry: ['United States of America (US)'],
			dcSource: ['Photogrammetry']
		})
	);
	expect(metadataValues(saved.dcAudience)).toEqual(['general public', 'students (secondary)']);
	expect(metadataValues(saved.dcCoverageCountry)).toEqual(['United States of America (US)']);
	expect(metadataValues(saved.dcSource)).toEqual(['Photogrammetry']);
});
