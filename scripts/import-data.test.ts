import { describe, expect, test } from 'bun:test';
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type PocketBase from 'pocketbase';
import { importEditionMemberships, type LegacyEditionMembership } from './import-data';

const editionIds = new Map([['legacy-edition', 'edition00000001']]);
const userIds = new Map([['legacy-user', 'user00000000001']]);
const author: LegacyEditionMembership = {
	_id: 'legacy-membership',
	editionId: 'legacy-edition',
	user: 'legacy-user',
	role: 'editor'
};

function fixture(existing: Record<string, unknown>[] = []) {
	const directory = mkdtempSync(join(tmpdir(), 'pure3d-onboarding-'));
	const writes: Record<string, unknown>[] = [];
	const pb = {
		baseURL: 'http://localhost:60021',
		collection: (name: string) => {
			expect(name).toBe('editionUsers');
			return {
				getFullList: async () => existing,
				create: async (data: Record<string, unknown>) => {
					if (data.role === 'author') throw new Error('ORCID author gate must not be bypassed');
					writes.push(data);
				}
			};
		}
	} as unknown as PocketBase;
	return {
		directory,
		writes,
		pb,
		close: () => rmSync(directory, { recursive: true, force: true })
	};
}

describe('local legacy membership onboarding', () => {
	test('the full import finishes with unverified users and a durable author onboarding report', () => {
		const fake = fixture();
		try {
			const sourceDirectory = join(fake.directory, 'data/json-output');
			mkdirSync(sourceDirectory, { recursive: true });
			for (const [name, rows] of Object.entries({
				user: [{ user: 'legacy-user', email: 'test@example.org', nickname: 'Original Name' }],
				project: [
					{ _id: 'legacy-collection', title: 'Collection', dc: { creator: ['Original Name'] } }
				],
				edition: [
					{
						_id: 'legacy-edition',
						projectId: 'legacy-collection',
						title: 'Edition',
						dc: { creator: ['Original Name'] }
					}
				],
				editionUser: [author]
			}))
				writeFileSync(join(sourceDirectory, `${name}.json`), JSON.stringify(rows));
			const result = Bun.spawnSync(
				[
					process.execPath,
					'--no-env-file',
					'-e',
					`
				const records = new Map();
				globalThis.fetch = async (input, options = {}) => {
					const url = new URL(String(input));
					if (url.origin !== 'http://localhost:60021') throw new Error('No real network allowed');
					if (url.pathname === '/api/health') return Response.json({ code: 200 });
					if (url.pathname.endsWith('/auth-with-password')) return Response.json({ token: 'PRIVATE_TOKEN', record: { id: 'admin', collectionName: '_superusers' } });
					const match = url.pathname.match(/^\\/api\\/collections\\/([^/]+)\\/records(?:\\/([^/]+))?$/);
					if (!match) throw new Error('Unexpected endpoint');
					const [, name, id] = match;
					if (options.method !== 'POST') return Response.json(id ? records.get(name).find(row => row.id === id) : { items: records.get(name) || [], totalPages: 1 });
					const data = JSON.parse(options.body);
					if (name === 'editionUsers' && data.role === 'author') throw new Error('Unverified authors are forbidden');
					if (name === 'users' && (data.orcid || data.orcidVerifiedAt || data.pendingOrcid)) throw new Error('Must not fabricate identity proof');
					const record = { ...data, id: name + '00000001', collectionName: name };
					records.set(name, [...(records.get(name) || []), record]);
					return Response.json(record);
				};
				const { main } = await import(${JSON.stringify(new URL('./import-data.ts', import.meta.url).href)});
				await main([]);
			`
				],
				{
					cwd: fake.directory,
					env: {
						...process.env,
						POCKETBASE_URL: 'http://localhost:60021',
						POCKETBASE_ADMIN_EMAIL: 'admin@example.org',
						POCKETBASE_ADMIN_PASSWORD: 'PRIVATE_PASSWORD'
					}
				}
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr.toString()).toBe('');
			expect(result.stdout.toString()).toContain('Pending author assignments: 1');
			expect(result.stdout.toString()).toContain('Data import complete.');
			expect(result.stdout.toString()).not.toContain('Original Name');
			expect(result.stdout.toString()).not.toContain('PRIVATE_');
			const reportDirectory = join(fake.directory, 'data/import-onboarding');
			expect(statSync(reportDirectory).mode & 0o777).toBe(0o700);
			const report = JSON.parse(
				readFileSync(join(reportDirectory, readdirSync(reportDirectory)[0]), 'utf8')
			);
			expect(report.pendingAssignments[0]).toMatchObject({
				source: author,
				requestedRole: 'author',
				userId: 'users00000001',
				editionId: 'editions00000001'
			});
		} finally {
			fake.close();
		}
	});
	test('preserves author intent in a private report while importing non-author memberships', async () => {
		const fake = fixture();
		try {
			const result = await importEditionMemberships(
				fake.pb,
				[author, { ...author, _id: 'reader-row', role: 'reader' }],
				editionIds,
				userIds,
				fake.directory
			);
			expect(result).toMatchObject({ imported: 1, skipped: 0, pendingAuthors: 1, pending: 1 });
			expect(fake.writes).toHaveLength(1);
			expect(fake.writes[0].role).toBe('collaborator');
			const report = JSON.parse(readFileSync(result.reportPath!, 'utf8'));
			expect(report).toMatchObject({
				version: 1,
				target: 'http://localhost:60021',
				sourceFile: 'editionUser.json'
			});
			expect(report.pendingAssignments[0]).toMatchObject({
				sourceIndex: 0,
				source: author,
				legacyEditionId: author.editionId,
				legacyUserHash: author.user,
				editionId: 'edition00000001',
				userId: 'user00000000001',
				requestedRole: 'author',
				status: 'pending',
				evidence: '',
				reason: 'author-onboarding-required'
			});
			expect(report.pendingAssignments[0].sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
			expect(JSON.stringify(report)).not.toContain('orcidVerifiedAt');
			expect(statSync(result.reportPath!).mode & 0o777).toBe(0o600);
		} finally {
			fake.close();
		}
	});
	test('keeps duplicate source author rows and creates new reports without overwriting previous review', async () => {
		const fake = fixture();
		try {
			const first = await importEditionMemberships(
				fake.pb,
				[author, author],
				editionIds,
				userIds,
				fake.directory
			);
			const original = readFileSync(first.reportPath!, 'utf8');
			const second = await importEditionMemberships(
				fake.pb,
				[author],
				editionIds,
				userIds,
				fake.directory
			);
			expect(first.pendingAuthors).toBe(2);
			expect(
				JSON.parse(original).pendingAssignments.map(
					(row: { sourceIndex: number }) => row.sourceIndex
				)
			).toEqual([0, 1]);
			expect(second.reportPath).not.toBe(first.reportPath);
			expect(readFileSync(first.reportPath!, 'utf8')).toBe(original);
			expect(fake.writes).toEqual([]);
		} finally {
			fake.close();
		}
	});
	test('preserves unresolved target identifiers rather than dropping or name-linking memberships', async () => {
		const fake = fixture();
		try {
			const result = await importEditionMemberships(
				fake.pb,
				[author, { ...author, role: 'reviewer' }],
				new Map(),
				new Map(),
				fake.directory
			);
			const report = JSON.parse(readFileSync(result.reportPath!, 'utf8'));
			expect(result).toMatchObject({ imported: 0, pending: 2, pendingAuthors: 1 });
			expect(report.pendingAssignments[0]).toMatchObject({
				source: author,
				editionId: null,
				userId: null,
				reason: 'missing-target'
			});
			expect(report.pendingAssignments[1].requestedRole).toBe('reviewer');
			expect(fake.writes).toEqual([]);
		} finally {
			fake.close();
		}
	});
	test('preserves null-user legacy rows for review without blocking valid memberships', async () => {
		const fake = fixture();
		try {
			const missingAuthor = {
				...author,
				user: null,
				dateDeleted: '2020-01-01'
			};
			const missingCollaborator = { ...author, user: null, role: 'reader' };
			const result = await importEditionMemberships(
				fake.pb,
				[missingAuthor, missingCollaborator, { ...author, role: 'reviewer' }],
				editionIds,
				userIds,
				fake.directory
			);
			expect(result).toMatchObject({ imported: 1, pending: 2, pendingAuthors: 1 });
			const report = JSON.parse(readFileSync(result.reportPath!, 'utf8'));
			expect(report.pendingAssignments.map((item: { source: unknown }) => item.source)).toEqual([
				missingAuthor,
				missingCollaborator
			]);
			for (const item of report.pendingAssignments) {
				expect(item).toMatchObject({
					legacyUserHash: null,
					userId: null,
					editionId: 'edition00000001',
					status: 'pending',
					reason: 'missing-target'
				});
			}
			expect(fake.writes).toHaveLength(1);
			expect(fake.writes[0]).toMatchObject({ userId: 'user00000000001', role: 'reviewer' });
			expect(statSync(result.reportPath!).mode & 0o777).toBe(0o600);
		} finally {
			fake.close();
		}
	});
	test('does not change existing authors or duplicate existing non-author memberships', async () => {
		const fake = fixture([
			{ editionId: 'edition00000001', userId: 'user00000000001', role: 'author' }
		]);
		try {
			const result = await importEditionMemberships(
				fake.pb,
				[author, { ...author, role: 'reviewer' }, { ...author, role: 'reviewer' }],
				editionIds,
				userIds,
				fake.directory
			);
			expect(result).toMatchObject({ imported: 1, skipped: 2, pending: 0, reportPath: null });
			expect(fake.writes[0].role).toBe('reviewer');
		} finally {
			fake.close();
		}
	});
	test('report failure prevents membership writes', async () => {
		const fake = fixture();
		try {
			chmodSync(fake.directory, 0o755);
			await expect(
				importEditionMemberships(
					fake.pb,
					[author, { ...author, role: 'reader' }],
					editionIds,
					userIds,
					fake.directory
				)
			).rejects.toThrow('private');
			expect(fake.writes).toEqual([]);
			expect(readdirSync(fake.directory)).toEqual([]);
		} finally {
			fake.close();
		}
	});
	test('retains the report if a subsequent non-author membership write fails', async () => {
		const fake = fixture();
		try {
			fake.pb.collection = (() => ({
				getFullList: async () => [],
				create: async () => {
					expect(readdirSync(fake.directory)).toHaveLength(1);
					throw new Error('Simulated non-author write failure');
				}
			})) as unknown as PocketBase['collection'];
			await expect(
				importEditionMemberships(
					fake.pb,
					[author, { ...author, role: 'reader' }],
					editionIds,
					userIds,
					fake.directory
				)
			).rejects.toThrow('Simulated');
			const report = JSON.parse(
				readFileSync(join(fake.directory, readdirSync(fake.directory)[0]), 'utf8')
			);
			expect(report.pendingAssignments[0].source).toEqual(author);
		} finally {
			fake.close();
		}
	});
	test('refuses non-local targets before making a request', async () => {
		const fake = fixture();
		try {
			const remote = {
				baseURL: 'https://example.org',
				collection: () => {
					throw new Error('Must not request');
				}
			} as unknown as PocketBase;
			await expect(
				importEditionMemberships(remote, [author], editionIds, userIds, fake.directory)
			).rejects.toThrow('local-only');
			expect(readdirSync(fake.directory)).toEqual([]);
		} finally {
			fake.close();
		}
	});
});
