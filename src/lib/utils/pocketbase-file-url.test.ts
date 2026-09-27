import { describe, expect, test } from 'bun:test';
import { getPocketBaseFileUrl } from './pocketbase-file-url';

describe('getPocketBaseFileUrl', () => {
	test('uses the projected collection namespace for collection covers', () => {
		let received: unknown;
		const url = getPocketBaseFileUrl(
			{ id: 'record', collectionId: 'pbc_collections', collectionName: 'collections' },
			'cover.avif',
			(record, filename) => {
				received = record;
				return `/api/files/${record.collectionId}/${record.id}/${filename}`;
			}
		);

		expect(url).toBe('/api/files/pbc_collections/record/cover.avif');
		expect(received).toEqual({
			id: 'record',
			collectionId: 'pbc_collections',
			collectionName: 'collections'
		});
	});

	test('does not confuse an edition parent relationship with its file namespace', () => {
		const url = getPocketBaseFileUrl(
			{
				id: 'edition',
				collectionId: 'parent-collection',
				fileCollectionId: 'pbc_editions',
				fileCollectionName: 'editions'
			},
			'cover.avif',
			(record, filename) => `/api/files/${record.collectionId}/${record.id}/${filename}`
		);

		expect(url).toBe('/api/files/pbc_editions/edition/cover.avif');
	});
});
