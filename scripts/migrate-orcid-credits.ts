#!/usr/bin/env bun
import { closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type PocketBase from 'pocketbase';
import type { Credit } from '../src/lib/types/credits';
import { normalizeOrcid } from '../src/lib/utils/credits';
import { credits as validateBackendCredits } from '../pocketbase/pb_hooks/orcid-validation.cjs';
import {
	connect,
	fingerprint,
	legacyCredits,
	sourceCredits,
	targetOrigin,
	type AttributionRecord,
	type AuthorReconciliation,
	type RecordReview
} from './reconcile-author-profiles';

export function reviewedCredits(item: RecordReview): Credit[] {
	const source = sourceCredits(item.snapshot);
	if (!Array.isArray(item.credits) || item.credits.length !== source.length)
		throw new Error('Review must preserve every credit');
	return source.map((credit, index) => {
		const review = item.credits[index];
		if (
			review.index !== index ||
			review.name !== credit.name ||
			review.role !== credit.role ||
			!['approved', 'unresolved'].includes(review.status) ||
			typeof review.evidence !== 'string' ||
			!review.evidence.trim()
		)
			throw new Error('Each credit needs indexed review and evidence');
		if (review.status === 'unresolved') {
			if (
				review.type !== credit.type ||
				review.orcid !== credit.orcid ||
				review.userId !== credit.userId
			)
				throw new Error('Unresolved credits cannot assign identities');
			return credit;
		}
		if (
			!['person', 'org'].includes(review.type) ||
			(review.orcid !== null &&
				(!normalizeOrcid(review.orcid) || normalizeOrcid(review.orcid) !== review.orcid)) ||
			(review.userId !== undefined &&
				(typeof review.userId !== 'string' || !/^[a-z0-9]{15}$/.test(review.userId)))
		)
			throw new Error('Invalid approved identity');
		if (review.type === 'org' && (review.orcid !== null || review.userId !== undefined))
			throw new Error('Organizations cannot have ORCID identities');
		if (review.type === 'person' && credit.role === 'creator' && !review.orcid)
			throw new Error('An individual author without ORCID must remain unresolved');
		if (review.userId && !review.orcid)
			throw new Error('An account link requires a matching ORCID');
		if (
			(credit.orcid && credit.orcid !== review.orcid) ||
			(credit.userId && credit.userId !== review.userId) ||
			(credit.provenance === 'oauth' && credit.type !== review.type)
		)
			throw new Error('Migration cannot replace existing identity proof');
		return {
			...credit,
			type: review.type,
			orcid: review.orcid,
			...(review.userId ? { userId: review.userId } : {})
		};
	});
}

export function publicationBlocked(credits: Credit[]): boolean {
	return (
		!credits.some((credit) => credit.role === 'creator') ||
		credits.some(
			(credit) =>
				credit.type === 'person' && credit.role === 'creator' && !normalizeOrcid(credit.orcid)
		)
	);
}

export function planRecord(
	item: RecordReview,
	current: AttributionRecord,
	preserveUnresolved = false,
	hooksInstalled = true
) {
	if (
		item.snapshot.id !== item.id ||
		current.id !== item.id ||
		fingerprint(item.snapshot) !== item.fingerprint
	)
		throw new Error('Invalid record snapshot');
	const credits = reviewedCredits(item);
	if (preserveUnresolved) {
		if (hooksInstalled) throw new Error('Preservation requires PRE-HOOK deployment (HTTP 404)');
		if (
			item.status !== 'approved' ||
			(item.snapshot.credits != null &&
				!(Array.isArray(item.snapshot.credits) && item.snapshot.credits.length === 0)) ||
			item.credits.some((credit) => credit.status !== 'unresolved') ||
			JSON.stringify(credits) !==
				JSON.stringify(legacyCredits(item.snapshot.dcCreator, item.snapshot.dcContributor))
		)
			throw new Error(
				'Preservation requires approved exact legacy attribution, all credits unresolved'
			);
		// The converter's person default is provisional; person/org classification still needs review.
	}
	const expected = fingerprint({ ...item.snapshot, credits });
	if (fingerprint(current) === expected) return { credits, changed: false, expected };
	const comparable = { ...current };
	if (!Object.hasOwn(item.snapshot, 'credits') && current.credits === null)
		delete comparable.credits;
	if (fingerprint(comparable) !== item.fingerprint || current.updated !== item.snapshot.updated)
		throw new Error('Record changed since inventory');
	const active =
		item.collection === 'collections'
			? current.isVisible === true
			: current.isPublished === true ||
				(typeof current.status === 'string' && !['', 'draft'].includes(current.status));
	if (active && publicationBlocked(credits) && !preserveUnresolved)
		throw new Error('Unresolved public attribution blocks migration of this record');
	return { credits, changed: true, expected };
}

export function validateManifest(manifest: AuthorReconciliation, target: string) {
	if (
		manifest.version !== 1 ||
		manifest.target !== targetOrigin(target) ||
		!Array.isArray(manifest.records)
	)
		throw new Error('Manifest version or target mismatch');
	const seen = new Set<string>();
	for (const item of manifest.records) {
		const key = `${item.collection}/${item.id}`;
		if (
			!['collections', 'editions'].includes(item.collection) ||
			typeof item.id !== 'string' ||
			!['pending', 'blocked', 'approved'].includes(item.status) ||
			seen.has(key)
		)
			throw new Error('Invalid or duplicate manifest record');
		seen.add(key);
		if (
			!item.snapshot ||
			item.snapshot.id !== item.id ||
			fingerprint(item.snapshot) !== item.fingerprint
		)
			throw new Error('Invalid manifest fingerprint');
	}
}

async function verifyLinks(pb: PocketBase, credits: Credit[]) {
	for (const credit of credits) {
		if (!credit.userId) continue;
		const user = await pb.collection('users').getOne(credit.userId);
		const links = await pb.collection('_externalAuths').getFullList({
			filter: pb.filter('recordRef = {:id} && collectionRef = {:collection}', {
				id: user.id,
				collection: user.collectionId
			})
		});
		if (
			!user.orcidVerifiedAt ||
			user.orcid !== credit.orcid ||
			links.length !== 1 ||
			links[0].provider !== 'oidc' ||
			links[0].providerId !== credit.orcid?.slice(18)
		)
			throw new Error('Approved account link lacks matching OAuth proof');
	}
}

async function inspectHooks(pb: PocketBase, preserveUnresolved: boolean): Promise<boolean> {
	try {
		const status = await pb.send('/api/pure3d/orcid/config', { method: 'GET' });
		if (preserveUnresolved)
			throw new Error('Preservation is PRE-HOOK deployment only; endpoint must return HTTP 404');
		if (status.backend !== 'pure3d-orcid-v1') throw new Error('Unknown ORCID backend');
		return true;
	} catch (error) {
		if ((error as { status?: number }).status !== 404) throw error;
		return false;
	}
}

export async function migrate(
	pb: PocketBase,
	manifest: AuthorReconciliation,
	target: string,
	apply = false,
	maintenanceConfirmed = false,
	auditPath?: string,
	preserveUnresolved = false
) {
	validateManifest(manifest, target);
	if (apply && !maintenanceConfirmed)
		throw new Error('Apply requires a confirmed maintenance window');
	if (apply && !auditPath) throw new Error('Apply requires a new private --audit output');
	if (!apply && auditPath) throw new Error('--audit is only used with --apply');
	const runId = crypto.randomUUID();
	const backup = `orcid-credits-${runId}.zip`;
	const fd = apply ? openSync(auditPath!, 'wx', 0o600) : undefined;
	let backupConfirmed = false;
	let phase = 'preflight';
	let active: RecordReview | undefined;
	let expected: string | undefined;
	let readback: AttributionRecord | null = null;
	let writeAttempted = false;
	let writeAcknowledged = false;
	const settled = new Set<string>();
	const audit = (entry: Record<string, unknown>) => {
		if (fd === undefined) return;
		const bytes = Buffer.from(
			JSON.stringify({
				runId,
				backupId: backup,
				backupConfirmed,
				phase,
				at: new Date().toISOString(),
				...entry
			}) + '\n'
		);
		let offset = 0;
		while (offset < bytes.length) {
			const written = writeSync(fd, bytes, offset, bytes.length - offset);
			if (!written) throw new Error('Audit write failed');
			offset += written;
		}
		fsyncSync(fd);
	};
	const result = (item: RecordReview, details: Record<string, unknown>) => {
		audit({
			event: 'record',
			collection: item.collection,
			id: item.id,
			sourceFingerprint: item.fingerprint,
			...details
		});
		settled.add(`${item.collection}/${item.id}`);
	};
	try {
		audit({
			event: 'run',
			status: 'started',
			preserveUnresolved,
			target: targetOrigin(target),
			records: manifest.records.map((item) => ({
				collection: item.collection,
				id: item.id,
				fingerprint: item.fingerprint,
				reviewStatus: item.status
			}))
		});
		const hooksInstalled = await inspectHooks(pb, preserveUnresolved);
		const definitions = await Promise.all(
			['collections', 'editions'].map((name) => pb.collections.getOne(name))
		);
		for (const definition of definitions) {
			const field = definition.fields.find((field: { name: string }) => field.name === 'credits');
			if (field && field.type !== 'json') throw new Error('Existing credits field is not JSON');
		}
		const plans = [];
		for (const item of manifest.records) {
			active = item;
			readback = null;
			expected = undefined;
			if (item.status !== 'approved') {
				result(item, {
					status: 'skipped',
					reason: 'not-approved',
					writeAttempted: false,
					committed: false,
					readback: null
				});
				continue;
			}
			const current = await pb.collection(item.collection).getOne(item.id);
			readback = current;
			const plan = planRecord(item, current, preserveUnresolved, hooksInstalled);
			expected = plan.expected;
			await verifyLinks(pb, plan.credits);
			if (hooksInstalled && plan.changed) {
				const checked = validateBackendCredits(
					plan.credits,
					item.snapshot.credits || [],
					false,
					(id: string) => {
						const credit = plan.credits.find((credit) => credit.userId === id);
						return { orcid: credit?.orcid, orcidVerifiedAt: 'verified by preflight' };
					}
				);
				if (
					fingerprint({ id: item.id, credits: checked }) !==
					fingerprint({ id: item.id, credits: plan.credits })
				)
					throw new Error('Backend would normalize reviewed attribution; resolve before applying');
			}
			plans.push({ item, current, ...plan });
			if (!plan.changed)
				result(item, {
					status: 'skipped',
					reason: 'already-applied',
					writeAttempted: false,
					committed: true,
					expectedFingerprint: expected,
					readbackFingerprint: fingerprint(current),
					readback: current
				});
		}
		active = undefined;
		const changes = plans.filter((plan) => plan.changed);
		const summary = {
			hooksInstalled,
			preserveUnresolved,
			approved: plans.length,
			changes: changes.length,
			queued: manifest.records.length - plans.length,
			publicationBlockers: plans.filter((plan) => publicationBlocked(plan.credits)).length
		};
		if (apply && changes.length) {
			phase = 'backup';
			audit({ event: 'backup', status: 'requested' });
			await pb.backups.create(backup);
			const backups = await pb.backups.getFullList();
			if (!backups.some((entry) => entry.key === backup && entry.size > 0))
				throw new Error('Backup was not confirmed');
			backupConfirmed = true;
			audit({ event: 'backup', status: 'confirmed' });
			// REST has no conditional PATCH: maintenance isolation closes the read/write race.
			phase = 'snapshot-check';
			for (const plan of changes) {
				active = plan.item;
				expected = plan.expected;
				readback = null;
				readback = await pb.collection(plan.item.collection).getOne<AttributionRecord>(plan.item.id);
				if (
					fingerprint(readback) !== fingerprint(plan.current) ||
					readback.updated !== plan.current.updated
				)
					throw new Error('Record changed during preflight');
			}
			active = undefined;
			phase = 'schema';
			for (const definition of definitions) {
				const current = await pb.collections.getOne(definition.id);
				if (JSON.stringify(current) !== JSON.stringify(definition))
					throw new Error('Schema changed during preflight');
				if (!definition.fields.some((field: { name: string }) => field.name === 'credits')) {
					audit({ event: 'schema', collection: definition.name, status: 'write-started' });
					if (preserveUnresolved) await inspectHooks(pb, true);
					await pb.collections.update(definition.id, {
						fields: [...definition.fields, { name: 'credits', type: 'json', maxSize: 2000000 }]
					});
					audit({ event: 'schema', collection: definition.name, status: 'write-acknowledged' });
				}
			}
			for (const plan of changes) {
				active = plan.item;
				expected = plan.expected;
				writeAttempted = false;
				writeAcknowledged = false;
				readback = null;
				phase = 'record-check';
				const current = await pb.collection(plan.item.collection).getOne(plan.item.id);
				readback = current;
				const comparable = { ...current };
				if (!Object.hasOwn(plan.current, 'credits') && current.credits === null)
					delete comparable.credits;
				if (
					fingerprint(comparable) !== fingerprint(plan.current) ||
					current.updated !== plan.current.updated
				)
					throw new Error('Record changed before write');
				await verifyLinks(pb, plan.credits);
				phase = 'record-write';
				audit({
					event: 'record-write-intent',
					collection: active.collection,
					id: active.id,
					expectedFingerprint: expected
				});
				if (preserveUnresolved) await inspectHooks(pb, true);
				writeAttempted = true;
				await pb.collection(active.collection).update(active.id, { credits: plan.credits });
				writeAcknowledged = true;
				phase = 'record-readback';
				readback = await pb.collection(active.collection).getOne<AttributionRecord>(active.id);
				if (fingerprint(readback) !== expected)
					throw new Error('Stored attribution differs from reviewed data; stop and investigate');
				result(active, {
					status: 'applied',
					committed: true,
					writeAttempted,
					writeAcknowledged,
					expectedFingerprint: expected,
					readbackFingerprint: fingerprint(readback),
					readback
				});
				active = undefined;
			}
		}
		phase = 'complete';
		audit({ event: 'run', status: 'completed', summary });
		return summary;
	} catch (error) {
		if (active) {
			if (writeAttempted) {
				// A failed response does not prove a failed commit; inspect current state without retrying PATCH.
				try {
					readback = await pb.collection(active.collection).getOne(active.id);
				} catch {
					readback = null;
				}
			}
			result(active, {
				status: 'failed',
				writeAttempted,
				writeAcknowledged,
				committed: !writeAttempted
					? false
					: readback && fingerprint(readback) === expected
						? true
						: null,
				expectedFingerprint: expected,
				readbackFingerprint: readback ? fingerprint(readback) : null,
				readback
			});
		}
		for (const item of manifest.records)
			if (!settled.has(`${item.collection}/${item.id}`))
				result(item, {
					status: 'skipped',
					reason: 'run-aborted-before-write',
					writeAttempted: false,
					committed: false,
					readback: null
				});
		audit({
			event: 'run',
			status: 'failed',
			httpStatus:
				typeof (error as { status?: unknown })?.status === 'number'
					? (error as { status: number }).status
					: null
		});
		throw error;
	} finally {
		if (fd !== undefined) closeSync(fd);
	}
}

export async function main(args = process.argv.slice(2)) {
	const { values } = parseArgs({
		args,
		options: {
			target: { type: 'string' },
			manifest: { type: 'string' },
			apply: { type: 'boolean' },
			'preserve-unresolved': { type: 'boolean' },
			audit: { type: 'string' },
			'maintenance-confirmed': { type: 'boolean' }
		}
	});
	if (!values.target || !values.manifest)
		throw new Error(
			'Use --target ORIGIN --manifest FILE [--preserve-unresolved (PRE-HOOK deployment only)] [--apply --maintenance-confirmed --audit NEW_PRIVATE_FILE]'
		);
	if (values.apply && !values.audit) throw new Error('--apply requires --audit NEW_PRIVATE_FILE');
	if (values.audit && !values.apply) throw new Error('--audit requires --apply');
	const target = targetOrigin(values.target);
	const manifest = JSON.parse(readFileSync(values.manifest, 'utf8')) as AuthorReconciliation;
	validateManifest(manifest, target);
	const summary = await migrate(
		await connect(target),
		manifest,
		target,
		values.apply,
		values['maintenance-confirmed'],
		values.audit,
		values['preserve-unresolved']
	);
	console.log(
		`${values.apply ? 'Apply' : 'Read-only preflight'}: ${JSON.stringify(summary)}. Source fields retained. Review queued records; unresolved individual authors block submission/publication. Contributor ORCIDs are optional.`
	);
	if (values['preserve-unresolved'])
		console.log(
			'PRE-HOOK deployment maintenance only: exact legacy attribution preserved, not identity-approved. Default person types are provisional and need person/org review. Existing publication state is retained; normal application validation is unchanged.'
		);
}

if (import.meta.main)
	main().catch(() => {
		console.error(
			'ORCID migration failed. No credentials, names or server response logged. Inspect the private --audit JSONL output if created; partial or uncertain commits are possible. Retain the backup and manifest, check approval/conflicts/permissions, and rerun read-only before retrying. Audit storage failures or interruption can leave the last write unconfirmed.'
		);
		process.exitCode = 1;
	});
