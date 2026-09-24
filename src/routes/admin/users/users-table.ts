import { GLOBAL_ROLE_LABELS, type GlobalRole } from '$lib/types/roles';

export type UserSortField = 'name' | 'orcid' | 'ownership' | 'role';
export type SortDirection = 'ascending' | 'descending';

type UserRow = {
	id: string;
	nickname?: unknown;
	orcid?: unknown;
	orcidVerifiedAt?: unknown;
	role?: unknown;
};

function sortValue(user: UserRow, field: UserSortField): string {
	if (field === 'name') return String(user.nickname || 'Unnamed user');
	if (field === 'orcid') return String(user.orcid || 'Not linked');
	if (field === 'ownership')
		return user.orcid && user.orcidVerifiedAt ? 'ORCID verified' : 'Not verified through ORCID';
	return GLOBAL_ROLE_LABELS[user.role as GlobalRole] || String(user.role || '');
}

export function sortUsers<T extends UserRow>(
	users: T[],
	field: UserSortField,
	direction: SortDirection
): T[] {
	const multiplier = direction === 'ascending' ? 1 : -1;
	return users.toSorted((a, b) => {
		const comparison = sortValue(a, field).localeCompare(sortValue(b, field), undefined, {
			sensitivity: 'base',
			numeric: true
		});
		return multiplier * comparison || a.id.localeCompare(b.id);
	});
}
