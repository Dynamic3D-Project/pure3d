import { expect, test } from 'bun:test';
import { mergeSchemaFields } from './schema-fields';

test('schema merge preserves field IDs, unrelated fields and relation values', () => {
	const existing = [
		{
			id: 'relation-id',
			name: 'collection',
			type: 'relation',
			collectionId: 'collections',
			required: false
		},
		{ id: 'legacy-id', name: 'legacy', type: 'text' }
	];
	const merged = mergeSchemaFields(existing, [
		{ name: 'collection', type: 'relation', collectionId: 'collections', required: true },
		{ name: 'extra', type: 'text' }
	]);
	expect(merged).toEqual([
		{ ...existing[0], required: true },
		existing[1],
		{ name: 'extra', type: 'text' }
	]);
	expect(existing[0].required).toBe(false);
});

test('relation retargeting requires an explicit data migration instead of dropping fields', () => {
	expect(() =>
		mergeSchemaFields(
			[{ id: 'relation-id', name: 'collection', type: 'relation', collectionId: 'old' }],
			[{ name: 'collection', type: 'relation', collectionId: 'new' }]
		)
	).toThrow('explicit data migration');
});

test('desired schema IDs cannot replace existing field identities', () => {
	const existing = [{ id: 'stored-id', name: 'title', type: 'text', required: false }];
	for (const id of ['exported-id', '', undefined]) {
		const desired = [{ id, name: 'title', type: 'text', required: true }];
		expect(mergeSchemaFields(existing, desired)).toEqual([{ ...existing[0], required: true }]);
		expect(desired[0].id).toBe(id);
	}
	expect(existing[0].required).toBe(false);
});

test('new fields retain their supplied IDs', () => {
	const field = { id: 'new-id', name: 'title', type: 'text' };
	expect(mergeSchemaFields([], [field])).toEqual([field]);
});

test('schema field type changes cannot silently destroy existing data', () => {
	expect(() =>
		mergeSchemaFields([{ name: 'title', type: 'text' }], [{ name: 'title', type: 'number' }])
	).toThrow('explicit data migration');
});
