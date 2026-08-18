import { describe, expect, test } from 'bun:test';
import { editionMatchesQuery } from './edition-search';

describe('editionMatchesQuery', () => {
	const edition = {
		title: 'The Battle at 25 Northumberland Road',
		dcAbstract: 'The Sherwood Foresters during the Easter Rising.',
		dcCreator: ['Susan Schreibman'],
		dcKeyword: ['British History', 'Irish History'],
		dcSubject: ['History', 'War and conflict'],
		dcCoverageCountry: ['Ireland (IE)'],
		dcFunder: ['Andrew W. Mellon Foundation'],
		dcDescription: null
	};

	test('matches titles and Dublin Core metadata', () => {
		for (const query of [
			'battle',
			'Sherwood Foresters',
			'Susan Schreibman',
			'British History',
			'War and conflict',
			'Ireland (IE)',
			'Andrew W. Mellon Foundation'
		]) {
			expect(editionMatchesQuery(edition, `  ${query.toUpperCase()}  `)).toBe(true);
		}
		expect(editionMatchesQuery(edition, 'unrelated')).toBe(false);
	});
});
