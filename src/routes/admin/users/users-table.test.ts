import { describe, expect, test } from 'bun:test';
import { sortUsers } from './users-table';

const users = [
	{ id: '2', nickname: 'Beta 10', orcid: '', role: 'user' },
	{ id: '1', nickname: 'alpha', orcid: '0000-0000-0000-0001', role: 'admin' },
	{ id: '3', nickname: 'Beta 2', orcid: '0000-0000-0000-0002', role: 'user' }
];

describe('admin users table', () => {
	test('sorts rows in both directions', () => {
		expect(sortUsers(users, 'name', 'ascending').map((user) => user.id)).toEqual(['1', '3', '2']);
		expect(sortUsers(users, 'role', 'descending').map((user) => user.id)).toEqual(['2', '3', '1']);
	});
});
