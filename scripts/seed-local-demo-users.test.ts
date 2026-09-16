import { expect, test } from 'bun:test';
import { demoUsers, seedLocalDemoUsers } from './seed-local-demo-users';

test('seeds only admin and user accounts and enables local password login', async () => {
	const updates: Array<[string, Record<string, unknown>]> = [];
	const creates: Record<string, unknown>[] = [];
	const users = {
		getFullList: async () => [{ id: 'existing-admin', email: 'admin@pure3d.eu' }],
		update: async (id: string, data: Record<string, unknown>) => updates.push([id, data]),
		create: async (data: Record<string, unknown>) => creates.push(data)
	};
	const pb = {
		collections: {
			getOne: async () => ({
				id: 'users',
				passwordAuth: { enabled: false, identityFields: ['email'] }
			}),
			update: async (id: string, data: Record<string, unknown>) => updates.push([id, data])
		},
		collection: () => users
	};

	await seedLocalDemoUsers(pb as never);

	expect(demoUsers.map(({ role }) => role)).toEqual(['admin', 'user']);
	expect(updates[0]).toEqual([
		'users',
		{ passwordAuth: { enabled: true, identityFields: ['email'] } }
	]);
	expect(updates[1]?.[0]).toBe('existing-admin');
	expect(creates[0]?.email).toBe('user@pure3d.eu');
});
