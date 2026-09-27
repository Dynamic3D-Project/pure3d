import { describe, expect, test } from 'bun:test';
import service from './storage-dashboard-service.cjs';

const objects = [
	{ key: 'z.glb', size: 3, modified: '2026-09-03T00:00:00Z' },
	{ key: 'a.glb', size: 1, modified: '2026-09-01T00:00:00Z' },
	{ key: 'm.glb', size: 2, modified: '2026-09-02T00:00:00Z' }
];

describe('storage inventory pages', () => {
	test('returns stable key-ordered cursor pages', () => {
		const first = service.pageObjects(objects, '', 2);
		expect(first.objects.map((item: { key: string }) => item.key)).toEqual(['a.glb', 'm.glb']);
		expect(first.nextCursor).toBe('m.glb');
		expect(first.hasMore).toBe(true);

		const second = service.pageObjects(objects, first.nextCursor, 2);
		expect(second.objects.map((item: { key: string }) => item.key)).toEqual(['z.glb']);
		expect(second.nextCursor).toBe('');
		expect(second.hasMore).toBe(false);
	});

	test('bounds page size and validates prefixes', () => {
		expect(service.pageSize('999')).toBe(100);
		expect(service.pageSize('nope')).toBe(25);
		expect(service.validPrefix('project/1/')).toBe(true);
		expect(service.validPrefix('../private')).toBe(false);
		expect(service.validPrefix('/absolute')).toBe(false);
	});

	test('uses the same bytewise key order for sorting and cursors', () => {
		const first = service.pageObjects(
			[
				{ key: 'a', size: 1, modified: '' },
				{ key: 'Z', size: 1, modified: '' }
			],
			'',
			1
		);
		const second = service.pageObjects(
			[
				{ key: 'a', size: 1, modified: '' },
				{ key: 'Z', size: 1, modified: '' }
			],
			first.nextCursor,
			1
		);
		expect([...first.objects, ...second.objects].map((item) => item.key)).toEqual(['Z', 'a']);
	});
});
