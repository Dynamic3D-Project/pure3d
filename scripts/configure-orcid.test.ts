import { expect, test } from 'bun:test';
import PocketBase from 'pocketbase';
import { applyOrcidConfiguration, preflightPrivilegedAccounts } from './configure-orcid';

const orcid = 'https://orcid.org/0000-0002-1825-0097';
const candidate = 'https://orcid.org/0000-0002-1694-233X';

function fixture() {
	const records: Record<string, Record<string, unknown>[]> = {
		users: [
			{ id: 'admin', role: 'admin', pendingOrcid: orcid },
			{ id: 'member', role: 'user', orcid: candidate }
		],
		_externalAuths: [],
		collections: [{ id: 'collection' }],
		editions: [{ id: 'edition' }],
		collectionUsers: [],
		editionUsers: [{ id: 'membership', userId: 'member', editionId: 'edition', role: 'author' }],
		reviewAssignments: []
	};
	const pb = new PocketBase('http://127.0.0.1');
	pb.send = async () => ({ backend: 'pure3d-orcid-v1', issuer: 'https://orcid.org' }) as never;
	pb.collections.getOne = async () =>
		({
			id: 'users',
			fields: [{ name: 'pendingOrcid', hidden: true }, { name: 'orcidVerifiedAt' }]
		}) as never;
	for (const name of Object.keys(records))
		pb.collection(name).getFullList = async () => records[name] as never;
	return { pb, records };
}

test('strict missing mapping fails; explicit deferral reports intent, never verification', async () => {
	const { pb, records } = fixture();
	const before = structuredClone(records);
	await expect(preflightPrivilegedAccounts(pb, 'https://orcid.org')).rejects.toThrow(
		'privileged account'
	);
	expect(await preflightPrivilegedAccounts(pb, 'https://orcid.org', true)).toEqual([
		{
			id: 'member',
			requestedRole: 'user',
			memberships: [{ ...records.editionUsers[0], source: 'editionUsers' }],
			orcidCandidates: [{ orcid: candidate, source: 'users.orcid', status: 'unapproved' }],
			status: 'require_identity_linking'
		}
	]);
	expect(records).toEqual(before);
});

test('explicit mode requires a genuine global admin mapping and both report options', async () => {
	const { pb, records } = fixture();
	for (const options of [{ deferUnmapped: true }, { onboardingReport: '/unused' }])
		await expect(
			applyOrcidConfiguration(pb, 'test', 'test', 'production', options)
		).rejects.toThrow('--onboarding-report');
	delete records.users[0].pendingOrcid;
	await expect(preflightPrivilegedAccounts(pb, 'https://orcid.org', true)).rejects.toThrow(
		'global admin'
	);
	records.users[0].role = 'editorial_board';
	records.users[0].pendingOrcid = orcid;
	await expect(preflightPrivilegedAccounts(pb, 'https://orcid.org', true)).rejects.toThrow(
		'global admin'
	);
});

test('deferral never bypasses corrupt identities or dangling references', async () => {
	const corruptions: ((records: ReturnType<typeof fixture>['records']) => void)[] = [
		(r) => {
			r.users[1].orcidVerifiedAt = '2026-01-01';
		},
		(r) => {
			r.users[1].pendingOrcid = 'invalid';
		},
		(r) => {
			r.users[1].orcid = orcid;
		},
		(r) => {
			r.users[0].orcidVerifiedAt = '2026-01-01';
		},
		(r) => {
			r._externalAuths.push({ recordRef: 'member', provider: 'github', providerId: 'someone' });
		},
		(r) => {
			r._externalAuths.push({
				recordRef: 'missing',
				provider: 'oidc',
				providerId: candidate.slice(18)
			});
		},
		(r) => {
			r._externalAuths.push({ recordRef: 'member', provider: 'oidc', providerId: orcid.slice(18) });
		},
		(r) => {
			r._externalAuths.push(
				...[1, 2].map(() => ({
					recordRef: 'member',
					provider: 'oidc',
					providerId: candidate.slice(18)
				}))
			);
		},
		(r) => {
			r.editionUsers[0].userId = 'missing';
		},
		(r) => {
			r.editionUsers[0].editionId = 'missing';
		},
		(r) => {
			r.collectionUsers.push({ userId: 'member', collection: 'missing', role: 'owner' });
		},
		(r) => {
			r.reviewAssignments.push({ reviewerId: 'missing', editionId: 'edition', status: 'declined' });
		},
		(r) => {
			r.reviewAssignments.push({ reviewerId: 'member', editionId: 'missing', status: 'pending' });
		}
	];
	for (const corrupt of corruptions) {
		const { pb, records } = fixture();
		corrupt(records);
		await expect(preflightPrivilegedAccounts(pb, 'https://orcid.org', true)).rejects.toThrow();
	}
});
