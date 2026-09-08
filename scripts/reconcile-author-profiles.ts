#!/usr/bin/env bun
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import PocketBase from 'pocketbase';
import type { Credit } from '../src/lib/types/credits';
import { normalizeOrcid, readCredits } from '../src/lib/utils/credits';
import { orcidEndpoints } from '../pocketbase/pb_hooks/orcid-validation.cjs';
import { profileNameKey, profileNames } from './author-profile-candidates';

export type AttributionRecord = Record<string, unknown> & { id: string };
export type CreditReview = {
	index: number;
	name: string;
	role: Credit['role'];
	status: 'pending' | 'unresolved' | 'approved';
	evidence: string;
	type: Credit['type'];
	orcid: string | null;
	userId?: string;
	profileCandidates?: {
		userId: string;
		orcid: string | null;
		verifiedAt: string | null;
		status: 'unapproved';
		evidence: { source: string; match: string; value: string }[];
	}[];
};
export type RecordReview = {
	collection: 'collections' | 'editions';
	id: string;
	fingerprint: string;
	snapshot: AttributionRecord;
	status: 'pending' | 'blocked' | 'approved';
	credits: CreditReview[];
};
export type AuthorReconciliation = {
	version: 1;
	target: string;
	records: RecordReview[];
};

function stable(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stable);
	if (value && typeof value === 'object')
		return Object.fromEntries(
			Object.entries(value)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, item]) => [key, stable(item)])
		);
	return value;
}

export function fingerprint(record: AttributionRecord): string {
	// PocketBase updates this timestamp on our own write; all other fields remain conflict-sensitive.
	const content = { ...record };
	delete content.updated;
	return createHash('sha256')
		.update(JSON.stringify(stable(content)))
		.digest('hex');
}

export function legacyCredits(creators: unknown, contributors: unknown): Credit[] {
	return (
		[
			['creator', creators],
			['contributor', contributors]
		] as const
	).flatMap(([role, value]) => {
		if (value === undefined || value === null) return [];
		const names = typeof value === 'string' ? [value] : value;
		if (!Array.isArray(names) || names.some((name) => typeof name !== 'string' || !name.trim()))
			throw new Error('Malformed legacy attribution; resolve the source explicitly');
		return names.map(
			(name): Credit => ({ type: 'person', name, orcid: null, role, provenance: 'manual' })
		);
	});
}

export function sourceCredits(record: AttributionRecord): Credit[] {
	if (
		record.credits === undefined ||
		record.credits === null ||
		(Array.isArray(record.credits) && !record.credits.length)
	)
		return legacyCredits(record.dcCreator, record.dcContributor);
	const credits = readCredits(record.credits);
	if (
		JSON.stringify(stable(credits)) !== JSON.stringify(stable(record.credits)) ||
		credits.some(
			(credit) =>
				!credit.name.trim() ||
				Object.keys(credit).some(
					(key) =>
						!['type', 'name', 'orcid', 'role', 'provenance', 'userId', 'contributionRole'].includes(
							key
						)
				) ||
				(credit.type === 'org' &&
					(credit.orcid !== null || credit.userId !== undefined || credit.provenance !== 'manual'))
		)
	)
		throw new Error('Existing credits are malformed or noncanonical; review separately');
	return credits;
}

export function targetOrigin(target: string): string {
	const url = new URL(target);
	if (
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		url.pathname !== '/' ||
		(url.protocol !== 'https:' &&
			!(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
	)
		throw new Error('An explicit HTTPS origin is required; HTTP is allowed only on loopback');
	return url.origin;
}

export async function connect(target: string): Promise<PocketBase> {
	const email = process.env.POCKETBASE_ADMIN_EMAIL;
	const password = process.env.POCKETBASE_ADMIN_PASSWORD;
	if (!email || !password) throw new Error('PocketBase admin credentials are required');
	const pb = new PocketBase(targetOrigin(target));
	pb.autoCancellation(false);
	pb.beforeSend = (url, options) => ({ url, options: { ...options, redirect: 'error' } });
	await pb.collection('_superusers').authWithPassword(email, password);
	return pb;
}

export function reconcileAuthorProfiles(
	target: string,
	collections: AttributionRecord[],
	editions: AttributionRecord[],
	profiles: AttributionRecord[] = []
): AuthorReconciliation {
	return {
		version: 1,
		target: targetOrigin(target),
		records: (
			[
				['collections', collections],
				['editions', editions]
			] as const
		).flatMap(([collection, records]) =>
			records.map((snapshot) => ({
				collection,
				id: snapshot.id,
				snapshot,
				fingerprint: fingerprint(snapshot),
				status: 'pending',
				credits: sourceCredits(snapshot).map((credit, index) => ({
					index,
					name: credit.name,
					role: credit.role,
					type: credit.type,
					orcid: credit.orcid,
					...(credit.userId ? { userId: credit.userId } : {}),
					status: 'pending',
					evidence: '',
					profileCandidates:
						credit.type === 'org'
							? []
							: profiles.flatMap((profile) => {
									const evidence = [];
									if (credit.userId === profile.id)
										evidence.push({
											source: 'users.id',
											match: 'exact-user-id',
											value: profile.id
										});
									if (
										credit.orcid &&
										normalizeOrcid(credit.orcid) === normalizeOrcid(profile.orcid)
									)
										evidence.push({
											source: 'users.orcid',
											match: 'canonical-orcid',
											value: profile.orcid as string
										});
									const names = profileNames({ name: credit.name })
										.map(profileNameKey)
										.filter(Boolean);
									for (const field of ['name', 'nickname', 'username']) {
										const value = profile[field];
										if (
											typeof value === 'string' &&
											profileNames({ name: value }).some((name) =>
												names.includes(profileNameKey(name))
											)
										)
											evidence.push({ source: `users.${field}`, match: 'normalized-name', value });
									}
									return evidence.length
										? [
												{
													userId: profile.id,
													orcid: typeof profile.orcid === 'string' ? profile.orcid : null,
													verifiedAt:
														typeof profile.orcidVerifiedAt === 'string' && profile.orcidVerifiedAt
															? profile.orcidVerifiedAt
															: null,
													status: 'unapproved' as const,
													evidence
												}
											]
										: [];
								})
				}))
			}))
		)
	};
}

export async function inventory(pb: PocketBase, target: string): Promise<AuthorReconciliation> {
	const [collections, editions, profiles] = await Promise.all([
		pb.collection('collections').getFullList({ sort: 'id' }),
		pb.collection('editions').getFullList({ sort: 'id' }),
		pb
			.collection('users')
			.getFullList({ sort: 'id', fields: 'id,name,nickname,username,orcid,orcidVerifiedAt' })
	]);
	return reconcileAuthorProfiles(target, collections, editions, profiles);
}

type LookupResult = {
	status: 'candidates' | 'no-results' | 'denied' | 'rate-limited' | 'unavailable' | 'skipped';
	candidates: string[];
	evidence: {
		source: string;
		query: string;
		checkedAt: string | null;
		httpStatus?: number;
		reason?: string;
	};
};

// Search evidence is never identity approval. Cache requests, not indexed legacy attribution.
export async function lookupOrcids(
	report: AuthorReconciliation,
	environment = 'production',
	request: (url: URL, options: RequestInit) => Promise<Response> = fetch,
	pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
) {
	if (!['production', 'sandbox'].includes(environment))
		throw new Error('Invalid ORCID environment');
	const { publicApi } = orcidEndpoints(
		environment === 'sandbox' ? 'https://sandbox.orcid.org' : 'https://orcid.org'
	);
	const cache = new Map<string, LookupResult>();
	const suggestions = [];
	let requests = 0;
	let stopped = false;
	for (const record of report.records)
		for (const credit of record.credits) {
			if (credit.type !== 'person' || credit.orcid) continue;
			let result = cache.get(credit.name);
			if (!result) {
				const url = new URL(`${publicApi}/v3.0/search/`);
				const query = `text:"${credit.name.replace(/[\r\n\t]/g, ' ').replace(/[+\-!(){}[\]^"~*?:\\/|&]/g, '\\$&')}"`;
				url.searchParams.set('q', query);
				url.searchParams.set('rows', '5');
				result = {
					status: 'skipped',
					candidates: [],
					evidence: { source: `${publicApi}/v3.0/search/`, query, checkedAt: null }
				};
				if (stopped || requests >= 100 || credit.name.length > 500) {
					result.evidence.reason = stopped
						? 'Lookup halted after API failure'
						: requests >= 100
							? '100-request limit reached'
							: 'Name exceeds 500-character lookup limit';
				} else {
					if (requests) await pause(1000);
					requests++;
					result.evidence.checkedAt = new Date().toISOString();
					try {
						const response = await request(url, {
							headers: { Accept: 'application/json' },
							signal: AbortSignal.timeout(10000),
							redirect: 'error'
						});
						result.evidence.httpStatus = response.status;
						if (!response.ok) {
							result.status = [401, 403].includes(response.status)
								? 'denied'
								: response.status === 429
									? 'rate-limited'
									: 'unavailable';
							stopped = true;
						} else {
							const data = await response.json();
							if (!data || !(Array.isArray(data.result) || data.result === null))
								throw new Error('Invalid search response');
							result.candidates = (data.result || [])
								.slice(0, 5)
								.flatMap(
									(item: { 'orcid-identifier'?: { path?: string; uri?: string } } | null) => {
										const identifier = item?.['orcid-identifier'];
										const orcid = normalizeOrcid(identifier?.path ?? identifier?.uri);
										return orcid ? [orcid] : [];
									}
								);
							result.status = result.candidates.length ? 'candidates' : 'no-results';
						}
					} catch {
						result.status = 'unavailable';
						stopped = true;
					}
				}
				cache.set(credit.name, result);
			}
			suggestions.push({
				collection: record.collection,
				id: record.id,
				fingerprint: record.fingerprint,
				index: credit.index,
				...result
			});
		}
	return suggestions;
}

export async function main(args = process.argv.slice(2)) {
	const { values } = parseArgs({
		args,
		options: {
			target: { type: 'string' },
			output: { type: 'string' },
			'lookup-orcid': { type: 'boolean' }
		}
	});
	if (!values.target || !values.output)
		throw new Error('Use --target ORIGIN --output NEW_PRIVATE_FILE');
	const target = targetOrigin(values.target);
	const report = await inventory(await connect(target), target);
	const suggestions = values['lookup-orcid']
		? await lookupOrcids(report, process.env.ORCID_ENVIRONMENT || 'production')
		: [];
	writeFileSync(values.output, JSON.stringify({ ...report, suggestions }, null, 2) + '\n', {
		flag: 'wx',
		mode: 0o600
	});
	console.log(
		`Read-only inventory saved: ${report.records.length} records. No identities assigned; all credits require review.`
	);
}

if (import.meta.main)
	main().catch(() => {
		console.error(
			'Author inventory failed. Check arguments, credentials, source attribution and output permissions. No server response or personal data logged.'
		);
		process.exitCode = 1;
	});
