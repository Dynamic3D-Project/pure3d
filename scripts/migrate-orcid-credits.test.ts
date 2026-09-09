import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type PocketBase from 'pocketbase';
import {
	migrate,
	planRecord,
	publicationBlocked,
	reviewedCredits,
	validateManifest
} from './migrate-orcid-credits';
import {
	legacyCredits,
	reconcileAuthorProfiles,
	type AttributionRecord
} from './reconcile-author-profiles';

const target = 'https://example.org';
const orcid = 'https://orcid.org/0000-0002-1825-0097';
const auditDirectories: string[] = [];
function newAudit() {
	const directory = mkdtempSync(join(tmpdir(), 'orcid-audit-'));
	auditDirectories.push(directory);
	return join(directory, 'apply.jsonl');
}
function readAudit(path: string) {
	return readFileSync(path, 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
}
afterEach(() => {
	for (const directory of auditDirectories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

function fixture(active = false) {
	const record: AttributionRecord = {
		id: 'edition00000001',
		updated: 'before',
		title: 'Untouched',
		status: active ? 'published' : 'draft',
		dcCreator: ['Doe, Jane', 'Doe, Jane'],
		dcContributor: ['Museum, Lab']
	};
	const manifest = reconcileAuthorProfiles(target, [], [record]);
	const item = manifest.records[0];
	item.status = 'approved';
	for (const credit of item.credits) {
		credit.status = 'unresolved';
		credit.evidence = 'Awaiting author confirmation';
	}
	return { record, manifest, item };
}

function fakePB(
	record: AttributionRecord,
	options: {
		backupFails?: boolean;
		conflict?: boolean;
		schemaMissing?: boolean;
		rewrite?: boolean;
		hooksInstalled?: boolean;
	} = {}
) {
	let stored = structuredClone(record);
	let reads = 0;
	let backup = '';
	const events: string[] = [];
	const definitions = ['collections', 'editions'].map((name) => ({
		id: name,
		name,
		fields: options.schemaMissing ? [] : [{ name: 'credits', type: 'json' }]
	}));
	const pb = {
		send: async () => {
			if (options.hooksInstalled) return { backend: 'pure3d-orcid-v1' };
			throw { status: 404 };
		},
		collections: {
			getOne: async (name: string) => structuredClone(definitions.find((item) => item.id === name)),
			update: async (name: string, data: { fields: { name: string; type: string }[] }) => {
				events.push('schema');
				definitions.find((item) => item.id === name)!.fields = data.fields;
				if (name === 'editions' && !Object.hasOwn(stored, 'credits')) stored.credits = null;
			}
		},
		collection: () => ({
			getOne: async () => {
				reads++;
				if (options.conflict && reads === 2) stored.title = 'Concurrent edit';
				return structuredClone(stored);
			},
			update: async (_id: string, data: object) => {
				events.push('data');
				stored = {
					...stored,
					...data,
					updated: 'after',
					...(options.rewrite ? { title: 'Unexpected hook rewrite' } : {})
				};
			}
		}),
		backups: {
			create: async (name: string) => {
				events.push('backup');
				if (options.backupFails) throw new Error('private error');
				backup = name;
			},
			getFullList: async () => [{ key: backup, size: 100 }]
		}
	} as unknown as PocketBase;
	return { pb, events, stored: () => stored };
}

describe('reviewed ORCID migration', () => {
	test('pre-hook preservation retains published legacy attribution exactly and is idempotent', async () => {
		for (const credits of [undefined, null, []]) {
			const record = {
				...fixture(true).record,
				credits,
				isPublished: true,
				isVisible: true,
				dcCreator: [' Doe, Jane ', ' Doe, Jane '],
				dcContributor: [' Museum, Lab\t']
			};
			const manifest = reconcileAuthorProfiles(target, [], [record]);
			const item = manifest.records[0];
			item.status = 'approved';
			for (const credit of item.credits) {
				credit.status = 'unresolved';
				credit.evidence = 'Exact preservation only; provisional person/org type needs review';
			}
			const fake = fakePB(record, { schemaMissing: true });
			await expect(migrate(fake.pb, manifest, target)).rejects.toThrow('Unresolved');
			expect(await migrate(fake.pb, manifest, target, false, false, undefined, true)).toMatchObject(
				{ hooksInstalled: false, changes: 1 }
			);
			expect(fake.events).toEqual([]);
			await expect(
				migrate(fake.pb, manifest, target, true, false, newAudit(), true)
			).rejects.toThrow('maintenance');
			await expect(migrate(fake.pb, manifest, target, true, true, undefined, true)).rejects.toThrow(
				'--audit'
			);
			await migrate(fake.pb, manifest, target, true, true, newAudit(), true);
			expect(fake.stored()).toEqual({
				...record,
				updated: 'after',
				credits: legacyCredits(record.dcCreator, record.dcContributor)
			});
			expect(fake.stored().credits).toEqual(
				item.credits.map(({ name, role }) => ({
					name,
					role,
					type: 'person',
					orcid: null,
					provenance: 'manual'
				}))
			);
			expect(await migrate(fake.pb, manifest, target, true, true, newAudit(), true)).toMatchObject({
				changes: 0
			});
		}
	});
	test('preservation rejects identity approval, canonical sources, evidence gaps and all source changes', () => {
		for (const mutate of [
			(item: ReturnType<typeof fixture>['item']) => {
				item.credits[2].status = 'approved';
			},
			(item: ReturnType<typeof fixture>['item']) => {
				item.credits[0].orcid = orcid;
			},
			(item: ReturnType<typeof fixture>['item']) => {
				item.credits[0].userId = 'user00000000001';
			},
			(item: ReturnType<typeof fixture>['item']) => {
				item.credits[2].type = 'org';
			},
			(item: ReturnType<typeof fixture>['item']) => {
				item.credits[0].evidence = '';
			},
			(item: ReturnType<typeof fixture>['item']) => {
				item.credits[0].index = 1;
			},
			(item: ReturnType<typeof fixture>['item']) => {
				item.status = 'pending';
			}
		]) {
			const { item, record } = fixture(true);
			mutate(item);
			expect(() => planRecord(item, record, true, false)).toThrow();
		}
		const { item, record } = fixture(true);
		expect(() => planRecord(item, record, true)).toThrow('PRE-HOOK');
		for (const change of [
			{ title: 'Edit' },
			{ status: 'draft' },
			{ isPublished: false },
			{ isVisible: true },
			{ dcCreator: ['Renamed'] },
			{ credits: [{ name: 'Canonical' }] }
		])
			expect(() => planRecord(item, { ...record, ...change }, true, false)).toThrow('changed');
		const canonical = { ...record, credits: legacyCredits(record.dcCreator, record.dcContributor) };
		const review = reconcileAuthorProfiles(target, [], [canonical]).records[0];
		review.status = 'approved';
		for (const credit of review.credits) {
			credit.status = 'unresolved';
			credit.evidence = 'Preserve';
		}
		expect(() => planRecord(review, canonical, true, false)).toThrow('exact legacy');
	});
	test('preservation requires HTTP 404 at preflight and immediately before each schema/data write', async () => {
		for (const failAt of [1, 2, 3, 4]) {
			for (const status of [200, 401, 403, 500]) {
				const { record, manifest } = fixture(true);
				const fake = fakePB(record, { schemaMissing: true });
				let probes = 0;
				fake.pb.send = (async () => {
					if (++probes === failAt) {
						if (status === 200) return { backend: 'pure3d-orcid-v1' };
						throw { status };
					}
					throw { status: 404 };
				}) as PocketBase['send'];
				await expect(
					migrate(fake.pb, manifest, target, true, true, newAudit(), true)
				).rejects.toBeDefined();
				expect(fake.events).toEqual(
					[[], ['backup'], ['backup', 'schema'], ['backup', 'schema', 'schema']][failAt - 1]
				);
				expect(fake.stored().dcCreator).toEqual(record.dcCreator);
			}
		}
	});
	test('unresolved drafts retain all attribution without identity assignment', () => {
		const { item, record } = fixture();
		const plan = planRecord(item, record);
		expect(plan.credits.map((credit) => credit.name)).toEqual([
			'Doe, Jane',
			'Doe, Jane',
			'Museum, Lab'
		]);
		expect(publicationBlocked(plan.credits)).toBe(true);
		expect(
			plan.credits.every((credit) => credit.orcid === null && credit.provenance === 'manual')
		).toBe(true);
	});
	test('requires approved checksum-valid canonical ORCID with indexed evidence, without manufacturing OAuth proof', () => {
		const { item } = fixture();
		item.credits[0] = {
			...item.credits[0],
			status: 'approved',
			orcid,
			evidence: 'Author confirmed exact identifier, ticket 70'
		};
		expect(reviewedCredits(item)[0]).toMatchObject({
			orcid,
			provenance: 'manual',
			name: 'Doe, Jane'
		});
		for (const invalid of [
			'0000-0002-1825-0097',
			'https://orcid.org/0000-0002-1825-0098',
			'invalid'
		]) {
			item.credits[0].orcid = invalid;
			expect(() => reviewedCredits(item)).toThrow();
		}
		item.credits[0].orcid = orcid;
		item.credits[0].index = 1;
		expect(() => reviewedCredits(item)).toThrow();
	});
	test('does not allow unresolved mappings, missing evidence, dropped names or unapproved organizations', () => {
		for (const mutate of [
			(item: ReturnType<typeof fixture>['item']) => {
				item.credits[0].orcid = orcid;
			},
			(item: ReturnType<typeof fixture>['item']) => {
				item.credits[0].evidence = '';
			},
			(item: ReturnType<typeof fixture>['item']) => {
				item.credits.pop();
			},
			(item: ReturnType<typeof fixture>['item']) => {
				item.credits[0].type = 'org';
			}
		]) {
			const { item } = fixture();
			mutate(item);
			expect(() => reviewedCredits(item)).toThrow();
		}
	});
	test('blocks unresolved public records and detects edits including updated timestamp', () => {
		const { item, record } = fixture(true);
		expect(() => planRecord(item, record)).toThrow('Unresolved');
		const draft = fixture();
		expect(() => planRecord(draft.item, { ...draft.record, title: 'Changed' })).toThrow('changed');
		expect(() => planRecord(draft.item, { ...draft.record, updated: 'Changed' })).toThrow(
			'changed'
		);
	});
	test('active records require ORCID for person creators, while contributor ORCIDs are optional', () => {
		const { item, record } = fixture(true);
		for (const review of item.credits.slice(0, 2)) {
			review.status = 'approved';
			review.orcid = orcid;
			review.evidence = 'Author-confirmed identifier for each indexed legacy credit';
		}
		expect(publicationBlocked(planRecord(item, record).credits)).toBe(false);
		item.credits[2].status = 'approved';
		expect(planRecord(item, record).credits[2]).toMatchObject({ type: 'person', orcid: null });
		item.credits[2].type = 'org';
		item.credits[2].evidence = 'Institution confirmed organizational authorship';
		const plan = planRecord(item, record);
		expect(plan.credits.map((credit) => credit.name)).toEqual([
			'Doe, Jane',
			'Doe, Jane',
			'Museum, Lab'
		]);
		expect(publicationBlocked(plan.credits)).toBe(false);
		expect(plan.credits[2]).toMatchObject({ type: 'org', orcid: null, provenance: 'manual' });
	});
	test('rejects different targets, duplicate records and tampered snapshots', () => {
		const { manifest } = fixture();
		expect(() => validateManifest(manifest, 'https://other.org')).toThrow();
		manifest.records.push(manifest.records[0]);
		expect(() => validateManifest(manifest, target)).toThrow();
		manifest.records.pop();
		manifest.records[0].snapshot.title = 'Changed';
		expect(() => validateManifest(manifest, target)).toThrow();
	});
	test('a person creator cannot be approved without ORCID or bypass the requirement through an optional contributor', () => {
		const { item, record } = fixture(true);
		item.credits[2].status = 'approved';
		expect(() => planRecord(item, record)).toThrow('Unresolved');
		item.credits[0].status = 'approved';
		expect(() => reviewedCredits(item)).toThrow('author without ORCID');
		item.credits[0].status = 'unresolved';
		item.credits[2].userId = 'user00000000001';
		expect(() => reviewedCredits(item)).toThrow('account link');
	});
	test('default preflight does not create backups or perform schema/data writes', async () => {
		const { record, manifest } = fixture();
		const fake = fakePB(record, { schemaMissing: true });
		expect(await migrate(fake.pb, manifest, target)).toMatchObject({
			changes: 1,
			publicationBlockers: 1
		});
		expect(fake.events).toEqual([]);
	});
	test('backs up before schema/data writes, preserves source fields and is idempotent', async () => {
		const { record, manifest } = fixture();
		const fake = fakePB(record, { schemaMissing: true });
		await migrate(fake.pb, manifest, target, true, true, newAudit());
		expect(fake.events).toEqual(['backup', 'schema', 'schema', 'data']);
		expect(fake.stored().dcCreator).toEqual(record.dcCreator);
		expect(fake.stored().dcContributor).toEqual(record.dcContributor);
		expect(await migrate(fake.pb, manifest, target, true, true, newAudit())).toMatchObject({
			changes: 0
		});
		expect(fake.events).toEqual(['backup', 'schema', 'schema', 'data']);
	});
	test('backup failure or a snapshot conflict prevents schema/data writes', async () => {
		for (const options of [{ backupFails: true }, { conflict: true }]) {
			const { record, manifest } = fixture();
			const fake = fakePB(record, { ...options, schemaMissing: true });
			await expect(migrate(fake.pb, manifest, target, true, true, newAudit())).rejects.toThrow();
			expect(fake.events).toEqual(['backup']);
		}
	});
	test('requires maintenance confirmation and detects unexpected saved results', async () => {
		const { record, manifest } = fixture();
		const fake = fakePB(record, { rewrite: true });
		await expect(migrate(fake.pb, manifest, target, true)).rejects.toThrow('maintenance');
		expect(fake.events).toEqual([]);
		await expect(migrate(fake.pb, manifest, target, true, true, newAudit())).rejects.toThrow(
			'Stored attribution'
		);
	});
	test('pending records remain in the queue and are never changed', async () => {
		const { record, manifest, item } = fixture();
		item.status = 'blocked';
		const fake = fakePB(record);
		expect(await migrate(fake.pb, manifest, target, true, true, newAudit())).toMatchObject({
			queued: 1,
			changes: 0
		});
		expect(fake.events).toEqual([]);
	});
	test('installed hooks preserve duplicate names, whitespace and creator/contributor order', async () => {
		const record: AttributionRecord = {
			id: 'edition00000001',
			status: 'draft',
			dcCreator: [' Doe, Jane ', ' Doe, Jane '],
			dcContributor: [' Lab, Team\t']
		};
		const manifest = reconcileAuthorProfiles(target, [], [record]);
		manifest.records[0].status = 'approved';
		for (const credit of manifest.records[0].credits) {
			credit.status = 'unresolved';
			credit.evidence = 'Original legacy attribution retained for review';
		}
		const fake = fakePB(record, { hooksInstalled: true });
		await migrate(fake.pb, manifest, target, true, true, newAudit());
		expect(fake.stored().credits).toEqual(reviewedCredits(manifest.records[0]));
		expect((fake.stored().credits as { name: string }[]).map((credit) => credit.name)).toEqual([
			' Doe, Jane ',
			' Doe, Jane ',
			' Lab, Team\t'
		]);
		expect(fake.events).toEqual(['backup', 'data']);
		expect(await migrate(fake.pb, manifest, target, true, true, newAudit())).toMatchObject({
			changes: 0
		});
	});
	test('can resume after schema addition without changing the reviewed snapshot', () => {
		const { item, record } = fixture();
		expect(planRecord(item, { ...record, credits: null }).changed).toBe(true);
	});
	test('checks explicit user links against verified ORCID and external auth, never names', async () => {
		const { record, manifest, item } = fixture();
		item.credits[0] = { ...item.credits[0], status: 'approved', orcid, userId: 'user00000000001' };
		const fake = fakePB(record);
		const original = fake.pb.collection.bind(fake.pb);
		fake.pb.collection = ((name: string) =>
			name === 'users'
				? {
						getOne: async () => ({
							id: 'user00000000001',
							collectionId: 'users',
							orcid,
							orcidVerifiedAt: '',
							nickname: 'Doe, Jane'
						})
					}
				: name === '_externalAuths'
					? { getFullList: async () => [] }
					: original(name)) as PocketBase['collection'];
		fake.pb.filter = () => 'safe-filter';
		await expect(migrate(fake.pb, manifest, target, true, true, newAudit())).rejects.toThrow(
			'OAuth proof'
		);
		expect(fake.events).toEqual([]);
	});
	test('importing either CLI or the local importer performs no requests', async () => {
		const result = Bun.spawnSync([
			process.execPath,
			'--no-env-file',
			'-e',
			"globalThis.fetch = () => { throw new Error('unexpected request'); }; await import('./scripts/reconcile-author-profiles.ts'); await import('./scripts/migrate-orcid-credits.ts'); await import('./scripts/import-data.ts');"
		]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toBe('');
		expect(result.stderr.toString()).toBe('');
	});
	test('apply requires a fresh private audit and never overwrites an existing file', async () => {
		const { record, manifest } = fixture();
		const fake = fakePB(record);
		await expect(migrate(fake.pb, manifest, target, true, true)).rejects.toThrow('--audit');
		const path = newAudit();
		writeFileSync(path, 'previous audit');
		await expect(migrate(fake.pb, manifest, target, true, true, path)).rejects.toThrow();
		expect(readFileSync(path, 'utf8')).toBe('previous audit');
		expect(fake.events).toEqual([]);
	});
	test('audit records confirmed backup, committed readback and idempotent skips', async () => {
		const { record, manifest } = fixture();
		const fake = fakePB(record);
		const path = newAudit();
		await migrate(fake.pb, manifest, target, true, true, path);
		const events = readAudit(path);
		expect(statSync(path).mode & 0o777).toBe(0o600);
		expect(new Set(events.map((event) => event.backupId)).size).toBe(1);
		expect(
			events.find((event) => event.event === 'backup' && event.status === 'confirmed')
		).toMatchObject({ backupConfirmed: true });
		expect(events.find((event) => event.event === 'record')).toMatchObject({
			collection: 'editions',
			id: record.id,
			status: 'applied',
			committed: true,
			writeAcknowledged: true,
			readback: fake.stored(),
			backupConfirmed: true
		});
		expect(events.at(-1).status).toBe('completed');
		const retry = newAudit();
		await migrate(fake.pb, manifest, target, true, true, retry);
		expect(readAudit(retry).find((event) => event.event === 'record')).toMatchObject({
			status: 'skipped',
			reason: 'already-applied',
			committed: true,
			writeAttempted: false,
			readback: fake.stored(),
			backupConfirmed: false
		});
		expect(fake.events).toEqual(['backup', 'data']);
	});
	test('unavailable post-write readback is audited as uncertain, never as an uncommitted write', async () => {
		const { record, manifest } = fixture();
		const fake = fakePB(record);
		let patched = false;
		fake.pb.collection = (() => ({
			getOne: async () => {
				if (patched) throw new Error('PRIVATE_READ_ERROR');
				return structuredClone(record);
			},
			update: async () => {
				patched = true;
			}
		})) as unknown as PocketBase['collection'];
		const path = newAudit();
		await expect(migrate(fake.pb, manifest, target, true, true, path)).rejects.toThrow();
		expect(readAudit(path).find((event) => event.event === 'record')).toMatchObject({
			status: 'failed',
			phase: 'record-readback',
			committed: null,
			writeAttempted: true,
			writeAcknowledged: true,
			readback: null
		});
		expect(readAudit(path).at(-1).status).toBe('failed');
		expect(readFileSync(path, 'utf8')).not.toContain('PRIVATE_READ_ERROR');
	});
	test('a failed snapshot read cannot report a different record as its readback', async () => {
		const { record } = fixture();
		const second = { ...record, id: 'edition00000002' };
		const manifest = reconcileAuthorProfiles(target, [], [record, second]);
		for (const item of manifest.records) {
			item.status = 'approved';
			for (const credit of item.credits) {
				credit.status = 'unresolved';
				credit.evidence = 'Legacy review';
			}
		}
		const fake = fakePB(record);
		let calls = 0;
		fake.pb.collection = (() => ({
			getOne: async (id: string) => {
				calls++;
				if (calls === 3) throw new Error('Snapshot unavailable');
				return structuredClone(id === record.id ? record : second);
			}
		})) as unknown as PocketBase['collection'];
		const path = newAudit();
		await expect(migrate(fake.pb, manifest, target, true, true, path)).rejects.toThrow();
		expect(
			readAudit(path).find((event) => event.event === 'record' && event.status === 'failed')
		).toMatchObject({ id: record.id, phase: 'snapshot-check', readback: null, committed: false });
	});
	test('backup and snapshot failures leave per-record results and a failed footer before rejection', async () => {
		for (const options of [{ backupFails: true }, { conflict: true }]) {
			const { record, manifest } = fixture();
			const fake = fakePB(record, options);
			const path = newAudit();
			await expect(migrate(fake.pb, manifest, target, true, true, path)).rejects.toThrow();
			const events = readAudit(path);
			expect(events.at(-1)).toMatchObject({ event: 'run', status: 'failed' });
			expect(events.find((event) => event.event === 'record')).toMatchObject({
				id: record.id,
				committed: false,
				writeAttempted: false,
				status: options.backupFails ? 'skipped' : 'failed'
			});
			expect(readFileSync(path, 'utf8')).not.toContain('private error');
			expect(fake.events).toEqual(['backup']);
		}
	});
	test('partial apply flushes each committed record before the next write and audits uncertain/late failures', async () => {
		for (const commitBeforeError of [false, true]) {
			const { record } = fixture();
			const records = [
				record,
				{ ...record, id: 'edition00000002' },
				{ ...record, id: 'edition00000003' }
			];
			const manifest = reconcileAuthorProfiles(target, [], records);
			for (const item of manifest.records) {
				item.status = 'approved';
				for (const credit of item.credits) {
					credit.status = 'unresolved';
					credit.evidence = 'Review pending author confirmation';
				}
			}
			const stored = new Map(records.map((row) => [row.id, structuredClone(row)]));
			const fake = fakePB(record);
			const path = newAudit();
			fake.pb.collection = (() => ({
				getOne: async (id: string) => structuredClone(stored.get(id)),
				update: async (id: string, data: object) => {
					if (id === records[1].id) {
						// The first result is durable while the second request is still executing, not just in finally.
						expect(
							readAudit(path).find((event) => event.event === 'record' && event.id === record.id)
						).toMatchObject({ status: 'applied', committed: true });
						if (commitBeforeError)
							stored.set(id, { ...stored.get(id)!, ...data, updated: 'after' });
						throw new Error('PRIVATE_REQUEST_TOKEN_AND_BODY');
					}
					stored.set(id, { ...stored.get(id)!, ...data, updated: 'after' });
				}
			})) as unknown as PocketBase['collection'];
			await expect(migrate(fake.pb, manifest, target, true, true, path)).rejects.toThrow();
			const results = readAudit(path).filter((event) => event.event === 'record');
			expect(results.map((row) => row.status)).toEqual(['applied', 'failed', 'skipped']);
			expect(results[1]).toMatchObject({
				committed: commitBeforeError ? true : null,
				writeAttempted: true,
				writeAcknowledged: false,
				readback: stored.get(records[1].id)
			});
			expect(results[2]).toMatchObject({ reason: 'run-aborted-before-write', committed: false });
			expect(readAudit(path).at(-1).status).toBe('failed');
			expect(readFileSync(path, 'utf8')).not.toContain('PRIVATE_REQUEST_TOKEN_AND_BODY');
		}
	});
	test('CLI argument failures do not expose credential-like input', () => {
		for (const script of ['reconcile-author-profiles', 'migrate-orcid-credits']) {
			const result = Bun.spawnSync([
				process.execPath,
				'--no-env-file',
				`scripts/${script}.ts`,
				'--SECRET_DO_NOT_LOG'
			]);
			expect(result.exitCode).toBe(1);
			expect(result.stdout.toString() + result.stderr.toString()).not.toContain(
				'SECRET_DO_NOT_LOG'
			);
		}
	});
});
