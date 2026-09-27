import { describe, expect, test } from 'bun:test';
import {
	COLLECTION_CARD_FIELDS,
	EDITION_CARD_FIELDS,
	HOME_COLLECTION_FIELDS,
	HOME_EDITION_FIELDS,
	countEditionsByCollection,
	selectDailyItems
} from './catalogue-performance';

describe('catalogue field projections', () => {
	test('retain PocketBase file namespaces and uploaded covers', () => {
		for (const fields of [COLLECTION_CARD_FIELDS, HOME_COLLECTION_FIELDS]) {
			expect(fields.split(',')).toEqual(expect.arrayContaining(['collectionId', 'collectionName']));
		}
		for (const fields of [EDITION_CARD_FIELDS, HOME_EDITION_FIELDS]) {
			expect(fields.split(',')).toEqual(
				expect.arrayContaining(['collectionId', 'collectionName', 'coverImage'])
			);
		}
	});
});

describe('countEditionsByCollection', () => {
	test('counts only records with a collection', () => {
		expect(
			countEditionsByCollection([
				{ collection: 'one' },
				{ collection: 'two' },
				{ collection: 'one' },
				{ collection: '' }
			])
		).toEqual({ one: 2, two: 1 });
	});
});

describe('selectDailyItems', () => {
	test('returns the same wrapped selection throughout a UTC day', () => {
		const items = ['a', 'b', 'c', 'd', 'e', 'f'];
		const morning = selectDailyItems(items, 3, new Date('2026-09-26T01:00:00Z'));
		const evening = selectDailyItems(items, 3, new Date('2026-09-26T23:59:59Z'));

		expect(morning).toEqual(evening);
		expect(morning).toHaveLength(3);
	});

	test('returns all items when the requested selection is larger', () => {
		expect(selectDailyItems(['a', 'b'], 5, new Date('2026-09-26T12:00:00Z'))).toEqual(['a', 'b']);
	});
});
