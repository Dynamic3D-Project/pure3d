import { describe, expect, test } from 'bun:test';
import type { Credit } from '../types/credits';
import { creditHref, creatorNames, normalizeOrcid, readCredits, validateCredits } from './credits';

describe('credits', () => {
	const person: Credit = {
		type: 'person',
		name: 'Doe, Jane <researcher>',
		orcid: null,
		role: 'creator',
		provenance: 'manual'
	};
	test('canonicalizes ORCID and checks checksum, including X', () => {
		expect(normalizeOrcid(' 0000-0002-1825-0097 ')).toBe('https://orcid.org/0000-0002-1825-0097');
		expect(normalizeOrcid('http://orcid.org/0000-0002-1694-233x')).toBe(
			'https://orcid.org/0000-0002-1694-233X'
		);
		for (const value of ['0000-0002-1825-0098', 'https://evil.test/0000-0002-1825-0097', '', null])
			expect(normalizeOrcid(value)).toBeNull();
	});
	test('requires ORCID for every person creator only at submission/publication', () => {
		expect(validateCredits([person])).toBeNull();
		expect(validateCredits([person], true)).toContain('ORCID');
		expect(validateCredits([{ ...person, type: 'org' }], true)).toBeNull();
		expect(
			validateCredits(
				[
					{ ...person, type: 'org' },
					{ ...person, role: 'contributor' }
				],
				true
			)
		).toBeNull();
		expect(validateCredits([{ ...person, orcid: '0000-0002-1825-0097' }, person], true)).toContain(
			'ORCID'
		);
		expect(validateCredits([], true)).toContain('creator');
		expect(validateCredits([{ ...person, orcid: 'invalid' }])).toContain('checksum');
		expect(validateCredits([{ ...person, name: ' ' }])).toContain('name');
	});
	test('preserves order, complete names, explicit identity and provenance', () => {
		const credits = [
			person,
			{ ...person, name: 'Museum', type: 'org' as const },
			{ ...person, name: 'Helper', role: 'contributor' as const }
		];
		expect(readCredits(credits)).toEqual(credits);
		expect(creatorNames(credits)).toBe('Doe, Jane <researcher>, Museum');
		expect(readCredits([null, {}, 'name'])).toEqual([]);
		expect(creditHref(person)).toBeNull();
		expect(creditHref({ ...person, orcid: '0000-0002-1825-0097' })).toBe(
			'https://orcid.org/0000-0002-1825-0097'
		);
		expect(creditHref({ ...person, userId: 'explicit-user' }, '/app')).toBe(
			'/app/profile/explicit-user'
		);
	});
});
