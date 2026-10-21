import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lookupOrcids, reconcileAuthorProfiles } from './reconcile-author-profiles';

describe('optional read-only ORCID lookup', () => {
	const orcid = 'https://orcid.org/0000-0002-1825-0097';
	const reportFor = (names: string[]) =>
		reconcileAuthorProfiles('https://example.org', [{ id: 'r', dcCreator: names }], []);

	test('escapes query syntax and URL parameters, bounds candidates, and keeps evidence separate from approvals', async () => {
		const name = '" OR *:* (x) \\ + ?&rows=500';
		const report = reportFor([name, name]);
		const before = structuredClone(report);
		const suggestions = await lookupOrcids(report, 'production', async (url, options) => {
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
