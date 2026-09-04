import { describe, expect, test } from 'bun:test';
import { filterStorageObjects, getStorageSummary, type StorageObject } from './storage-dashboard';

const objects: StorageObject[] = [
	{ key: 'project/1/model.glb', size: 8_000_000, modified: '2026-09-01T10:00:00Z' },
	{ key: 'project/1/icon.png', size: 250_000, modified: '2026-09-03T10:00:00Z' },
	{ key: 'pbc_123/record/article.pdf', size: 2_000_000, modified: '2026-09-02T10:00:00Z' }
];

describe('storage dashboard', () => {
	test('filters by key and size range', () => {
		expect(
			filterStorageObjects(objects, {
				query: 'PROJECT/1',
				minSize: 1_000_000,
				maxSize: 10_000_000,
				sort: 'size-desc'
			})
		).toEqual([objects[0]]);
	});

	test('sorts by newest modification time', () => {
		expect(
			filterStorageObjects(objects, {
				query: '',
				minSize: 0,
				maxSize: Infinity,
				sort: 'modified-desc'
			}).map((object) => object.key)
		).toEqual(['project/1/icon.png', 'pbc_123/record/article.pdf', 'project/1/model.glb']);
	});

	test('summarizes all objects without filtering', () => {
		expect(getStorageSummary(objects)).toEqual({ count: 3, size: 10_250_000 });
	});
});
