import { expect, test } from 'bun:test';
import {
	maxEditionReferences,
	parseEditionIds,
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
});
