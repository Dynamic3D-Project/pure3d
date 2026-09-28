import { expect, test } from 'bun:test';
import {
	isCmsColumnCount,
	maxEditionReferences,
	maxProfileCards,
	maxProfileLinks,
	normaliseLogoItems,
	normaliseProfileCards,
	normaliseProjectFacts,
	parseEditionIds,
	safeContentImageUrl,
	safeContentUrl,
	serialiseEditionIds
} from './content-components';

test('edition component references round-trip in order and reject malformed IDs', () => {
	const ids = parseEditionIds('edition-a, edition-b, edition-a, <script>');
	expect(ids).toEqual(['edition-a', 'edition-b']);
	expect(parseEditionIds(serialiseEditionIds(ids))).toEqual(ids);
});

test('edition selection refuses more than 24 references instead of silently dropping them', () => {
	expect(() =>
		serialiseEditionIds(
			Array.from({ length: maxEditionReferences + 1 }, (_, index) => `edition-${index}`)
		)
	).toThrow(`Select at most ${maxEditionReferences} editions.`);
});

test('component links only accept safe external, mail and local destinations', () => {
	expect(safeContentUrl('/resources/example')).toBe('/resources/example');
	expect(safeContentUrl('https://example.org/path')).toBe('https://example.org/path');
	expect(safeContentUrl('mailto:editor@example.org')).toBe('mailto:editor@example.org');
	expect(safeContentUrl('javascript:alert(1)')).toBeNull();
	expect(safeContentUrl('//example.org')).toBeNull();
	expect(safeContentUrl('https://user:pass@example.org')).toBeNull();
	expect(safeContentUrl('https://example.org/\npath')).toBeNull();
	expect(safeContentImageUrl('https://example.org/logo.svg')).toBe('https://example.org/logo.svg');
	expect(safeContentImageUrl('mailto:editor@example.org')).toBeNull();
});

test('columns only support two to four columns', () => {
	expect(isCmsColumnCount(2)).toBe(true);
	expect(isCmsColumnCount(3)).toBe(true);
	expect(isCmsColumnCount(4)).toBe(true);
	expect(isCmsColumnCount(1)).toBe(false);
	expect(isCmsColumnCount('2')).toBe(false);
});

test('card, logo and fact component data is bounded and rejects unsafe URLs', () => {
	expect(
		normaliseProfileCards([
			{
				name: 'Ada Lovelace',
				role: 'Researcher',
				bio: 'Computational methods',
				image: '/api/files/people/ada.jpg',
				alt: 'Ada Lovelace',
				links: [
					{ label: 'Institution', href: 'https://example.org/ada' },
					{ label: 'ORCID', href: 'https://orcid.org/0000-0000-0000-0000' }
				]
			}
		])
	).toEqual([
		{
			name: 'Ada Lovelace',
			role: 'Researcher',
			bio: 'Computational methods',
			image: '/api/files/people/ada.jpg',
			alt: 'Ada Lovelace',
			links: [
				{ label: 'Institution', href: 'https://example.org/ada' },
				{ label: 'ORCID', href: 'https://orcid.org/0000-0000-0000-0000' }
			]
		}
	]);
	expect(
		normaliseProfileCards([{ name: 'Legacy', href: 'https://example.org', linkLabel: 'Profile' }])
	).toMatchObject([{ name: 'Legacy', links: [{ label: 'Profile', href: 'https://example.org' }] }]);
	expect(
		normaliseProfileCards([
			{ name: 'Unsafe', links: [{ label: 'Unsafe', href: 'javascript:alert(1)' }] }
		])
	).toEqual([]);
	expect(
		normaliseProfileCards([
			{
				name: 'Too many',
				links: Array.from({ length: maxProfileLinks + 1 }, () => ({
					label: 'Link',
					href: 'https://example.org'
				}))
			}
		])
	).toEqual([]);
	expect(
		normaliseLogoItems([{ name: 'Museum', image: '/logos/museum.svg', alt: 'Museum logo' }])
	).toEqual([{ name: 'Museum', image: '/logos/museum.svg', alt: 'Museum logo', href: '' }]);
	expect(normaliseLogoItems([{ name: 'Museum', image: 'javascript:alert(1)' }])).toEqual([]);
	expect(normaliseProjectFacts([{ label: 'Date', value: '2026' }])).toEqual([
		{ label: 'Date', value: '2026' }
	]);
	expect(
		normaliseProfileCards(Array.from({ length: maxProfileCards + 1 }, () => ({ name: 'Profile' })))
	).toEqual([]);
	expect(
		normaliseLogoItems([{ name: 'Museum', image: '/logo.svg', alt: 'x'.repeat(241) }])
	).toEqual([]);
	expect(
		normaliseProjectFacts([
			{ label: 'Valid', value: 'Value' },
			{ label: '', value: 'Dropped' }
		])
	).toEqual([]);
});
