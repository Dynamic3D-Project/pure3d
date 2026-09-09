import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	fingerprint,
	inventory,
	legacyCredits,
	lookupOrcids,
	reconcileAuthorProfiles,
	sourceCredits,
	targetOrigin
} from './reconcile-author-profiles';
import type PocketBase from 'pocketbase';
import { reviewedCredits } from './migrate-orcid-credits';

describe('read-only author inventory', () => {
	test('shows all colliding profile-name candidates with original evidence and no approval or identity assignment', () => {
		const source = {
			id: 'r',
			dcCreator: [' Doe, Jane ', ' Doe, Jane '],
			dcContributor: ['Jane Doe']
		};
		const report = reconcileAuthorProfiles(
			'https://example.org',
			[source],
			[],
			[
				{
					id: 'user-a',
					nickname: 'Jane Doe',
					orcid: 'https://orcid.org/0000-0002-1825-0097',
					orcidVerifiedAt: '2026-09-08 12:00:00Z',
					email: 'PRIVATE_EMAIL'
				},
				{ id: 'user-b', name: 'Doe, Jane', orcid: null },
				{ id: 'email-only', email: 'Jane Doe' }
			]
		);
		for (const credit of report.records[0].credits) {
			expect(credit.profileCandidates?.map((candidate) => candidate.userId)).toEqual([
				'user-a',
				'user-b'
			]);
			expect(credit.profileCandidates?.[0]).toMatchObject({
				orcid: 'https://orcid.org/0000-0002-1825-0097',
				verifiedAt: '2026-09-08 12:00:00Z',
				status: 'unapproved',
				evidence: [{ source: 'users.nickname', match: 'normalized-name', value: 'Jane Doe' }]
			});
			expect(credit.profileCandidates?.[1]).toMatchObject({
				verifiedAt: null,
				status: 'unapproved'
			});
			expect(credit).toMatchObject({ status: 'pending', orcid: null, evidence: '' });
			expect(credit.userId).toBeUndefined();
		}
		expect(report.records[0].credits[0].name).toBe(' Doe, Jane ');
		expect(JSON.stringify(report)).not.toContain('PRIVATE_EMAIL');
		for (const credit of report.records[0].credits) {
			credit.status = 'unresolved';
			credit.evidence = 'Preserved for review';
		}
		expect(
			reviewedCredits(report.records[0]).every((credit) => credit.orcid === null && !credit.userId)
		).toBe(true);
	});
	test('existing user IDs and ORCIDs seed candidates even when names differ, without concealing conflicting accounts', () => {
		const credit = {
			type: 'person',
			name: 'Published Name',
			orcid: 'https://orcid.org/0000-0002-1825-0097',
			role: 'creator',
			provenance: 'manual',
			userId: 'user-a'
		};
		const report = reconcileAuthorProfiles(
			'https://example.org',
			[],
			[{ id: 'r', credits: [credit] }],
			[
				{ id: 'user-a', nickname: 'Changed Name', orcid: 'https://orcid.org/0000-0002-1694-233X' },
				{ id: 'user-b', nickname: 'Other Name', orcid: credit.orcid }
			]
		);
		expect(
			report.records[0].credits[0].profileCandidates?.map(
				(candidate) => candidate.evidence[0].match
			)
		).toEqual(['exact-user-id', 'canonical-orcid']);
		expect(report.records[0].snapshot.credits).toEqual([credit]);
		expect(report.records[0].credits[0].status).toBe('pending');
	});
	test('inventory reads only the needed user profile fields and makes no account writes', async () => {
		const reads: string[] = [];
		const pb = {
			collection: (name: string) => ({
				getFullList: async (options: { fields?: string }) => {
					reads.push(name);
					if (name === 'users') {
						expect(options.fields).toBe('id,name,nickname,username,orcid,orcidVerifiedAt');
						return [{ id: 'user-a', nickname: 'Jane Doe', orcid: null }];
					}
					return [{ id: name, dcCreator: ['Jane Doe'] }];
				}
			})
		} as unknown as PocketBase;
		const report = await inventory(pb, 'https://example.org');
		expect(reads).toEqual(['collections', 'editions', 'users']);
		expect(
			report.records.every((item) => item.credits[0].profileCandidates?.[0].status === 'unapproved')
		).toBe(true);
	});
	test('preserves exact names, commas, duplicates and creator/contributor ordering in both collections', () => {
		const record = {
			id: 'record1',
			dcCreator: [' Doe, Jane ', ' Doe, Jane '],
			dcContributor: ['Lab, Team']
		};
		const report = reconcileAuthorProfiles('https://example.org', [record], [record]);
		expect(report.records.map((item) => item.collection)).toEqual(['collections', 'editions']);
		for (const item of report.records) {
			expect(item.credits.map(({ index, name, role }) => [index, name, role])).toEqual([
				[0, ' Doe, Jane ', 'creator'],
				[1, ' Doe, Jane ', 'creator'],
				[2, 'Lab, Team', 'contributor']
			]);
			expect(
				item.credits.every(
					(credit) => credit.status === 'pending' && credit.orcid === null && !credit.userId
				)
			).toBe(true);
			expect(item.fingerprint).toBe(fingerprint(record));
		}
	});
	test('never splits a scalar name or silently discards malformed attribution', () => {
		expect(legacyCredits('Doe, Jane', null)[0].name).toBe('Doe, Jane');
		for (const value of [42, {}, ['ok', null], ['']])
			expect(() => legacyCredits(value, [])).toThrow();
		expect(() => sourceCredits({ id: 'r', credits: [{ name: 'bad' }] })).toThrow();
	});
	test('fingerprints are key-order independent but preserve attribution order', () => {
		expect(fingerprint({ id: 'r', x: 1, updated: 'a' })).toBe(
			fingerprint({ x: 1, id: 'r', updated: 'b' })
		);
		expect(fingerprint({ id: 'r', dcCreator: ['a', 'b'] })).not.toBe(
			fingerprint({ id: 'r', dcCreator: ['b', 'a'] })
		);
	});
	test('requires a credential-free explicit origin and secure remote transport', () => {
		for (const value of [
			'http://example.org',
			'https://user:secret@example.org',
			'https://example.org/?token=secret',
			'https://example.org/path',
			'https://example.org/#secret'
		])
			expect(() => targetOrigin(value)).toThrow();
		expect(targetOrigin('http://localhost:60021/')).toBe('http://localhost:60021');
	});
});

describe('optional read-only ORCID lookup', () => {
	const orcid = 'https://orcid.org/0000-0002-1825-0097';
	const reportFor = (names: string[]) =>
		reconcileAuthorProfiles('https://example.org', [{ id: 'r', dcCreator: names }], []);

	test('escapes query syntax and URL parameters, bounds candidates, and keeps evidence separate from approvals', async () => {
		const name = '" OR *:* (x) \\ + ?&rows=500';
		const report = reportFor([name, name]);
		const before = structuredClone(report);
		let calls = 0;
		const suggestions = await lookupOrcids(report, 'production', async (url, options) => {
			calls++;
			expect(url.origin).toBe('https://pub.orcid.org');
			expect(url.searchParams.get('q')).toBe(
				'text:"\\" OR \\*\\:\\* \\(x\\) \\\\ \\+ \\?\\&rows=500"'
			);
			expect(url.searchParams.getAll('rows')).toEqual(['5']);
			expect(options.headers).toEqual({ Accept: 'application/json' });
			expect(options.redirect).toBe('error');
			expect(options.signal).toBeInstanceOf(AbortSignal);
			return Response.json({
				result: Array.from({ length: 6 }, () => ({ 'orcid-identifier': { uri: orcid } }))
			});
		});
		expect(calls).toBe(1);
		expect(suggestions.map((item) => item.index)).toEqual([0, 1]);
		expect(suggestions[0]).toMatchObject({
			fingerprint: report.records[0].fingerprint,
			status: 'candidates',
			evidence: { httpStatus: 200, source: 'https://pub.orcid.org/v3.0/search/' }
		});
		expect(suggestions[0].evidence.checkedAt).not.toBeNull();
		expect(suggestions[0].candidates).toHaveLength(5);
		expect(report).toEqual(before);
	});
	test('paces calls and stops at 100 requests without dropping indexed review entries', async () => {
		let calls = 0;
		const waits: number[] = [];
		const suggestions = await lookupOrcids(
			reportFor(Array.from({ length: 105 }, (_, i) => `Person ${i}`)),
			'production',
			async () => {
				calls++;
				return Response.json({ result: null });
			},
			async (ms) => {
				waits.push(ms);
			}
		);
		expect(calls).toBe(100);
		expect(waits).toEqual(Array(99).fill(1000));
		expect(suggestions).toHaveLength(105);
		expect(suggestions[99].status).toBe('no-results');
		expect(suggestions[100]).toMatchObject({
			status: 'skipped',
			evidence: { checkedAt: null, reason: '100-request limit reached' }
		});
	});
	test('CLI lookup is opt-in and still saves a private inventory when the public API denies access', () => {
		const directory = mkdtempSync(join(tmpdir(), 'pure3d-orcid-lookup-'));
		try {
			for (const lookup of [false, true]) {
				const output = join(directory, `${lookup}.json`);
				const args = [
					'--target',
					'https://example.org',
					'--output',
					output,
					...(lookup ? ['--lookup-orcid'] : [])
				];
				const result = Bun.spawnSync(
					[
						process.execPath,
						'--no-env-file',
						'-e',
						`
					let calls = 0;
					globalThis.fetch = async (input, options) => {
						const url = new URL(String(input));
						if (url.origin === 'https://example.org' && url.pathname.endsWith('/auth-with-password'))
							return Response.json({ token: 'PRIVATE_TOKEN', record: { id: 'admin', collectionName: '_superusers' } });
						if (url.origin === 'https://example.org' && url.pathname.endsWith('/records') && options.method === 'GET')
							return Response.json({ items: [{ id: 'r', dcCreator: ['PRIVATE_AUTHOR'] }], totalPages: 1 });
						if (url.origin === 'https://pub.sandbox.orcid.org') {
							calls++;
							if (new Headers(options.headers).has('Authorization')) throw new Error('Credential leak');
							return new Response('PRIVATE_PROVIDER_ERROR', { status: 403 });
						}
						throw new Error('Unexpected request; real network is forbidden');
					};
					const { main } = await import('./scripts/reconcile-author-profiles.ts');
					await main(${JSON.stringify(args)});
					if (calls !== ${lookup ? 1 : 0}) throw new Error('Wrong lookup count');
				`
					],
					{
						env: {
							...process.env,
							POCKETBASE_ADMIN_EMAIL: 'private@example.org',
							POCKETBASE_ADMIN_PASSWORD: 'PRIVATE_PASSWORD',
							ORCID_ENVIRONMENT: 'sandbox'
						}
					}
				);
				expect(result.exitCode).toBe(0);
				expect(result.stderr.toString()).toBe('');
				expect(result.stdout.toString()).not.toContain('PRIVATE_');
				const report = JSON.parse(readFileSync(output, 'utf8'));
				expect(report.records).toHaveLength(2);
				expect(report.records[0].credits[0]).toMatchObject({
					status: 'pending',
					orcid: null,
					evidence: ''
				});
				expect(report.suggestions).toHaveLength(lookup ? 2 : 0);
				if (lookup) expect(report.suggestions[0].status).toBe('denied');
			}
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
	test('denied, rate-limited and failed APIs retain inventory and halt further requests without response leakage', async () => {
		for (const [httpStatus, status] of [
			[401, 'denied'],
			[403, 'denied'],
			[429, 'rate-limited'],
			[500, 'unavailable']
		] as const) {
			const report = reportFor(['Person A', 'Person B']);
			const before = structuredClone(report);
			let calls = 0;
			const suggestions = await lookupOrcids(report, 'production', async () => {
				calls++;
				return new Response('SECRET_DO_NOT_LOG', { status: httpStatus });
			});
			expect(calls).toBe(1);
			expect(suggestions[0]).toMatchObject({ status, candidates: [], evidence: { httpStatus } });
			expect(suggestions[1].status).toBe('skipped');
			expect(JSON.stringify(suggestions)).not.toContain('SECRET_DO_NOT_LOG');
			expect(report).toEqual(before);
		}
	});
	test('handles network and malformed-response failures without losing the report', async () => {
		for (const request of [
			async () => {
				throw new Error('SECRET_DO_NOT_LOG');
			},
			async () => new Response('invalid JSON'),
			async () => Response.json({ error: 'SECRET_DO_NOT_LOG' })
		]) {
			const suggestions = await lookupOrcids(
				reportFor(['Person A', 'Person B']),
				'production',
				request
			);
			expect(suggestions.map((item) => item.status)).toEqual(['unavailable', 'skipped']);
			expect(JSON.stringify(suggestions)).not.toContain('SECRET_DO_NOT_LOG');
		}
	});
	test('uses sandbox only when selected and accepts only checksum-valid candidate identifiers', async () => {
		const suggestions = await lookupOrcids(reportFor(['Person A']), 'sandbox', async (url) => {
			expect(url.origin).toBe('https://pub.sandbox.orcid.org');
			return Response.json({
				result: [
					null,
					{ 'orcid-identifier': { path: '0000-0002-1825-0098' } },
					{ 'orcid-identifier': { path: '0000-0002-1825-0097' } }
				]
			});
		});
		expect(suggestions[0].candidates).toEqual([orcid]);
		await expect(
			lookupOrcids(reportFor([]), 'invalid', async () => {
				throw new Error('Must not request');
			})
		).rejects.toThrow('environment');
	});
});
