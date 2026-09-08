import { describe, expect, test } from 'bun:test';
import { editionMatchesQuery } from './edition-search';

describe('editionMatchesQuery', () => {
	const edition = {
		title: 'The Battle at 25 Northumberland Road',
		dcAbstract: 'The Sherwood Foresters during the Easter Rising.',
		credits: [
			{
				type: 'person',
				name: 'Susan Schreibman',
				orcid: 'https://orcid.org/0000-0002-1825-0097',
				role: 'creator',
				provenance: 'manual'
			},
			{
				type: 'org',
				name: 'Example Museum',
				orcid: null,
				role: 'contributor',
				provenance: 'manual',
				contributionRole: 'Digitization'
			}
		],
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
			'0000-0002-1825-0097',
			'Example Museum',
			'Digitization',
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
