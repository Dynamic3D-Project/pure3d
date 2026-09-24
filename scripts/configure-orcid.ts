#!/usr/bin/env bun
/**
 * Dry-run (offline, no credentials read): bun --no-env-file scripts/configure-orcid.ts
 * Prepare fields first: bun scripts/configure-orcid.ts --prepare
 * Approve pending mappings, then cut over: bun scripts/configure-orcid.ts --apply
 * Explicit deferral: --apply --defer-unmapped --onboarding-report NEW_PRIVATE_FILE
 * Existing provider repair: --update-jwks (confirmed backup; no session rotation or client secret required).
 * Requires POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD,
 * ORCID_CLIENT_ID and ORCID_CLIENT_SECRET. Never invokes the bootstrap/import scripts.
 * Deploy pb_hooks first. Existing admins can approve mappings through the private endpoint.
 * ORCID_ENVIRONMENT=production (default) or sandbox. For sandbox, start PB with
 * ORCID_ISSUER=https://sandbox.orcid.org and use a separate database and ORCID client.
 * Run --apply in a maintenance window; REST schema changes are not transactional.
 */
import PocketBase from 'pocketbase';
import { randomBytes } from 'node:crypto';
import { open } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import schema from '../pocketbase/pb_schema/collections.json';
import {
	canonicalOrcid,
	orcidEndpoints,
	orcidJwksURL
} from '../pocketbase/pb_hooks/orcid-validation.cjs';

const names = ['users', 'collections', 'editions', 'collectionUsers', 'editionUsers'];
const workflowNames = [
	'auditLog',
	'editionReviews',
	'reviewAssignments',
	'notifications',
	'reviewFeedback'
];
const ruleKeys = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule', 'manageRule'];
type Field = Record<string, unknown> & { name: string };

export async function alignOrcidSchema(
	pb: PocketBase,
	beforeApply?: () => Promise<void>,
	schemaOnly = false
) {
	// Never open the authenticated write rules unless their enforcing hooks are deployed.
	const status = await pb.send('/api/pure3d/orcid/config', { method: 'GET' });
	if (
		status.backend !== 'pure3d-orcid-v1' ||
		status.reviewAccess !== 'assignment-scoped-v1' ||
		status.activity !== 'trusted-events-v1'
	)
		throw new Error('Deploy the current ORCID and review backend hooks first');
	// Read all definitions before making any changes; no collection deletions or data rewrites.
	const active = await Promise.all(
		[...names, ...workflowNames].map((name) => pb.collections.getOne(name))
	);
	const identities = await pb
		.collection('users')
		.getFullList({ fields: 'id,orcid,orcidVerifiedAt,pendingOrcid' });
	const assigned = new Map<string, string>();
	for (const user of identities) {
		if (user.orcidVerifiedAt && !user.orcid) throw new Error('Verified account missing its ORCID');
		for (const value of [user.orcid, user.pendingOrcid].filter(Boolean)) {
			if (canonicalOrcid(value) !== value)
				throw new Error('Existing ORCID must be canonical before configuration');
			if (assigned.has(value) && assigned.get(value) !== user.id)
				throw new Error('Conflicting duplicate ORCID identity');
			assigned.set(value, user.id);
		}
	}
	const ids = Object.fromEntries(active.map((collection) => [collection.name, collection.id]));
	const updates = active.map((collection) => {
		const desired = schema.find((item) => item.name === collection.name)!;
		const fields = [...collection.fields] as Field[];
		const desiredFields = desired.fields.filter(
			(field) =>
				collection.name === 'users' ||
				collection.name.endsWith('Users') ||
				field.name === 'credits' ||
				(collection.name === 'editions' && field.name.startsWith('alpha')) ||
				(collection.name === 'editionReviews' &&
					!['editionId', 'reviewerId', 'comment'].includes(field.name)) ||
				(collection.name === 'reviewAssignments' &&
					['reviewRound', 'editionTitle'].includes(field.name)) ||
				(workflowNames.includes(collection.name) && ['created', 'updated'].includes(field.name)) ||
				(collection.name === 'auditLog' && field.name === 'targetType') ||
				(collection.name === 'notifications' && field.name === 'type')
		);
		for (const definition of desiredFields) {
			const field = { ...definition } as Field;
			if (field.type === 'relation') field.collectionId = ids[field.collectionId as string];
			const index = fields.findIndex((existing) => existing.name === field.name);
			if (index < 0) fields.push(field);
			else {
				if (
					fields[index].type !== field.type ||
					(field.type === 'relation' && fields[index].collectionId !== field.collectionId)
				) {
					throw new Error(
						'Schema field type/target mismatch; resolve explicitly before configuring ORCID'
					);
				}
				fields[index] = { ...fields[index], ...field };
			}
		}
		const rules = Object.fromEntries(
			ruleKeys
				.filter((key) => key in desired)
				.map((key) => [key, (desired as Record<string, unknown>)[key]])
		);
		const desiredIndexes = (desired.indexes || []).filter(
			(index) => names.includes(collection.name) || /CREATE UNIQUE INDEX/i.test(index)
		);
		const indexes = [
			...collection.indexes.filter(
				(index: string) =>
					!desiredIndexes.some(
						(wanted) =>
							index.match(/INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)/i)?.[1] ===
							wanted.match(/INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)/i)?.[1]
					)
			),
			...desiredIndexes
		];
		return { id: collection.id, fields, indexes, rules };
	});
	if (beforeApply) await beforeApply();
	// Install relation fields before rules referencing their back-relations.
	for (const update of updates)
		await pb.collections.update(update.id, { fields: update.fields, indexes: update.indexes });
	if (!schemaOnly) for (const { id, rules } of updates) await pb.collections.update(id, rules);
}

async function confirmedBackup(
	pb: PocketBase,
	backup = 'orcid-config-' + crypto.randomUUID() + '.zip'
) {
	await pb.backups.create(backup);
	const backups = await pb.backups.getFullList();
	if (!backups.some((entry) => entry.key === backup && entry.size > 0))
		throw new Error('PocketBase backup readback was not confirmed; no schema/auth changes applied');
	return backup;
}

export async function prepareOrcidSchema(pb: PocketBase) {
	let backup = '';
	await alignOrcidSchema(
		pb,
		async () => {
			backup = await confirmedBackup(pb);
		},
		true
	);
	const users = await pb.collections.getOne('users');
	if (
		!users.fields.some((field) => field.name === 'pendingOrcid' && field.hidden) ||
		!users.fields.some((field) => field.name === 'orcidVerifiedAt')
	)
		throw new Error('Prepared identity schema readback failed');
	return { backup };
}

export function orcidAuthConfig(
	clientId: string,
	clientSecret: string,
	environment = 'production',
	jwksURL = orcidJwksURL()
) {
	if (!['production', 'sandbox'].includes(environment))
		throw new Error('ORCID_ENVIRONMENT must be production or sandbox');
	const { issuer } = orcidEndpoints(
		environment === 'sandbox' ? 'https://sandbox.orcid.org' : 'https://orcid.org'
	);
	return {
		passwordAuth: { enabled: false },
		otp: { enabled: false },
		mfa: { enabled: false },
		authAlert: { enabled: false },
		manageRule: null,
		authRule: '',
		oauth2: {
			enabled: true,
			mappedFields: { id: '', name: '', username: '', avatarURL: '' },
			providers: [
				{
					name: 'oidc',
					displayName: 'ORCID',
					clientId,
					clientSecret,
					// v0.35 has no persisted scopes setting; clients must pass scopes: ['openid'].
					authURL: issuer + '/oauth/authorize',
					tokenURL: issuer + '/oauth/token',
					userInfoURL: '',
					pkce: true,
					extra: { issuers: [issuer], jwksURL }
				}
			]
		}
	};
}

export async function preflightPrivilegedAccounts(
	pb: PocketBase,
	issuer: string,
	deferUnmapped = false
) {
	const status = await pb.send('/api/pure3d/orcid/config', { method: 'GET' });
	if (status.backend !== 'pure3d-orcid-v1' || status.issuer !== issuer)
		throw new Error('PocketBase ORCID_ISSUER must match ORCID_ENVIRONMENT');
	const collection = await pb.collections.getOne('users');
	if (
		!collection.fields.some((field) => field.name === 'pendingOrcid' && field.hidden) ||
		!collection.fields.some((field) => field.name === 'orcidVerifiedAt')
	)
		throw new Error('Run --prepare and approve privileged account mappings before --apply');
	const users = await pb
		.collection('users')
		.getFullList({ fields: 'id,role,orcid,orcidVerifiedAt,pendingOrcid', sort: 'id' });
	const links = await pb.collection('_externalAuths').getFullList({
		filter: pb.filter('collectionRef = {:id}', { id: collection.id }),
		fields: 'recordRef,provider,providerId'
	});
	const existingProvider = collection.oauth2?.providers?.find(
		(provider: { name: string }) => provider.name === 'oidc'
	);
	const identitiesExist =
		users.some((user) => user.orcidVerifiedAt || user.pendingOrcid) || links.length > 0;
	if (
		identitiesExist &&
		existingProvider &&
		JSON.stringify(existingProvider.extra?.issuers) !== JSON.stringify([issuer])
	)
		throw new Error('Do not switch ORCID environments on an identity-bearing database');
	if (
		(users.some((user) => user.orcidVerifiedAt) || links.length > 0) &&
		!existingProvider &&
		issuer !== 'https://orcid.org'
	)
		throw new Error(
			'Sandbox cutover requires an isolated database without existing identity mappings'
		);
	const privileged = new Set(
		users.filter((user) => ['admin', 'editorial_board'].includes(user.role)).map((user) => user.id)
	);
	const membershipsByUser = new Map<string, Record<string, unknown>[]>();
	const targets = new Map<string, Set<string>>();
	for (const name of ['collections', 'editions'])
		targets.set(
			name,
			new Set((await pb.collection(name).getFullList({ fields: 'id' })).map((record) => record.id))
		);
	for (const name of ['collectionUsers', 'editionUsers']) {
		const memberships = await pb
			.collection(name)
			.getFullList({ fields: 'id,userId,role,collection,editionId', sort: 'id' });
		for (const member of memberships) {
			if (
				!targets
					.get(name === 'collectionUsers' ? 'collections' : 'editions')!
					.has(name === 'collectionUsers' ? member.collection : member.editionId)
			)
				throw new Error('Membership has no target collection/edition');
			if (!users.some((user) => user.id === member.userId))
				throw new Error('Privileged membership has no target account');
			membershipsByUser.set(member.userId, [
				...(membershipsByUser.get(member.userId) || []),
				{
					id: member.id,
					userId: member.userId,
					role: member.role,
					collection: member.collection,
					editionId: member.editionId,
					source: name
				}
			]);
			if (
				(name === 'collectionUsers' && ['owner', 'editor'].includes(member.role)) ||
				name === 'editionUsers'
			)
				privileged.add(member.userId);
		}
	}
	for (const assignment of await pb
		.collection('reviewAssignments')
		.getFullList({ fields: 'id,reviewerId,status,editionId,reviewStage', sort: 'id' })) {
		if (!targets.get('editions')!.has(assignment.editionId))
			throw new Error('Review assignment has no target edition');
		if (!users.some((user) => user.id === assignment.reviewerId))
			throw new Error('Review assignment has no target account');
		membershipsByUser.set(assignment.reviewerId, [
			...(membershipsByUser.get(assignment.reviewerId) || []),
			{
				id: assignment.id,
				reviewerId: assignment.reviewerId,
				status: assignment.status,
				editionId: assignment.editionId,
				reviewStage: assignment.reviewStage,
				source: 'reviewAssignments'
			}
		]);
		if (assignment.status !== 'declined') privileged.add(assignment.reviewerId);
	}
	const assigned = new Map<string, string>();
	for (const user of users) {
		for (const value of [user.orcid, user.pendingOrcid].filter(Boolean)) {
			if (canonicalOrcid(value) !== value) throw new Error('Existing ORCID must be canonical');
			if (assigned.has(value) && assigned.get(value) !== user.id)
				throw new Error('Conflicting duplicate ORCID identity');
			assigned.set(value, user.id);
		}
	}
	const linked = new Set<string>();
	for (const link of links) {
		if (!users.some((user) => user.id === link.recordRef))
			throw new Error('External identity has no target account');
		if (link.provider !== 'oidc') throw new Error('Unrelated external identity provider');
		const value = 'https://orcid.org/' + link.providerId;
		if (linked.has(value)) throw new Error('Duplicate external ORCID identity');
		linked.add(value);
		if (
			canonicalOrcid(value) !== value ||
			(assigned.has(value) && assigned.get(value) !== link.recordRef)
		)
			throw new Error('Conflicting external ORCID identity');
		assigned.set(value, link.recordRef);
	}
	const deferred = [];
	let readyAdmin = false;
	for (const user of users) {
		const id = user.id;
		const ownLinks = links.filter((link) => link.recordRef === id);
		const verified =
			user.orcidVerifiedAt &&
			user.orcid &&
			canonicalOrcid(user.orcid) === user.orcid &&
			ownLinks.length === 1 &&
			ownLinks[0].provider === 'oidc' &&
			ownLinks[0].providerId === user.orcid.slice(18);
		const approved =
			!user.orcidVerifiedAt &&
			user.pendingOrcid &&
			canonicalOrcid(user.pendingOrcid) === user.pendingOrcid &&
			ownLinks.length === 0 &&
			!links.some(
				(link) => link.provider === 'oidc' && link.providerId === user.pendingOrcid.slice(18)
			);
		if (
			((user.orcidVerifiedAt || ownLinks.length) && !verified) ||
			(user.pendingOrcid && !approved)
		)
			throw new Error('Invalid verified or approved ORCID identity');
		if (user.role === 'admin' && (verified || approved)) readyAdmin = true;
		if (!privileged.has(id) || verified || approved) continue;
		if (!deferUnmapped)
			throw new Error(
				'Every privileged account needs a verified ORCID link or an administrator-approved pending mapping before disabling login'
			);
		deferred.push({
			id,
			requestedRole: user.role,
			memberships: membershipsByUser.get(id) || [],
			orcidCandidates: user.orcid
				? [{ orcid: user.orcid, source: 'users.orcid', status: 'unapproved' }]
				: [],
			status: 'require_identity_linking'
		});
	}
	if (!readyAdmin)
		throw new Error('At least one verified or approved pending global admin is required');
	return deferred;
}

export async function applyOrcidConfiguration(
	pb: PocketBase,
	clientId: string,
	clientSecret: string,
	environment = 'production',
	options: { deferUnmapped?: boolean; onboardingReport?: string } = {}
) {
	if (!!options.deferUnmapped !== !!options.onboardingReport)
		throw new Error(
			'--defer-unmapped requires --onboarding-report NEW_PRIVATE_FILE and vice versa'
		);
	const status = await pb.send('/api/pure3d/orcid/config', { method: 'GET' });
	if (
		!status.jwksURL ||
		orcidJwksURL(status.jwksURL.replace(/\/api\/pure3d\/orcid\/jwks$/, '')) !== status.jwksURL
	)
		throw new Error('Deploy the ORCID JWKS bridge hooks first');
	const config = orcidAuthConfig(clientId, clientSecret, environment, status.jwksURL);
	const issuer = config.oauth2.providers[0].extra.issuers[0];
	let backup = '';
	let guard = '';
	await alignOrcidSchema(pb, async () => {
		const deferred = await preflightPrivilegedAccounts(pb, issuer, options.deferUnmapped);
		guard = JSON.stringify(deferred);
		const report = options.onboardingReport
			? await open(options.onboardingReport, 'wx', 0o600)
			: null;
		try {
			backup = 'orcid-config-' + crypto.randomUUID() + '.zip';
			if (report) {
				await report.chmod(0o600);
				await report.writeFile(
					JSON.stringify(
						{
							version: 1,
							target: pb.baseURL,
							issuer,
							backupId: backup,
							backupStatus: 'confirmation_required',
							createdAt: new Date().toISOString(),
							operatorId: pb.authStore.record?.id,
							operatorChoice: 'defer-unmapped-preserve-roles-disable-login',
							status: 'preflight_confirmed',
							accounts: deferred
						},
						null,
						2
					) + '\n'
				);
				await report.sync();
			}
		} finally {
			await report?.close();
		}
		await confirmedBackup(pb, backup);
	});
	// Recheck after the schema phase so a newly privileged/unapproved account cannot be silently locked out.
	if (
		JSON.stringify(await preflightPrivilegedAccounts(pb, issuer, options.deferUnmapped)) !== guard
	)
		throw new Error(
			'Onboarding preflight changed; retain report and backup and retry in isolation'
		);
	// PB v0.35 accepts a new signing secret; blank is not a request to generate one.
	// Rotate in the same update that disables legacy login, invalidating all existing users JWTs.
	await pb.collections.update('users', {
		...config,
		authToken: { secret: randomBytes(32).toString('hex') }
	});
	const saved = await pb.collections.getOne('users');
	const provider = saved.oauth2.providers[0];
	const expected = config.oauth2.providers[0];
	if (
		saved.passwordAuth.enabled ||
		saved.otp.enabled ||
		saved.mfa.enabled ||
		!saved.oauth2.enabled ||
		saved.oauth2.providers.length !== 1 ||
		!provider ||
		['name', 'clientId', 'authURL', 'tokenURL', 'userInfoURL', 'pkce'].some(
			(key) => provider[key] !== expected[key as keyof typeof expected]
		) ||
		!isDeepStrictEqual(provider.extra, expected.extra) ||
		Object.values(saved.oauth2.mappedFields).some(Boolean)
	)
		throw new Error('ORCID authentication configuration readback failed');
	return { backup, issuer };
}

export async function updateOrcidJwks(pb: PocketBase) {
	const status = await pb.send('/api/pure3d/orcid/config', { method: 'GET' });
	const saved = await pb.collections.getOne('users');
	const provider = saved.oauth2?.providers?.[0];
	if (
		status.backend !== 'pure3d-orcid-v1' ||
		!status.jwksURL ||
		orcidJwksURL(status.jwksURL.replace(/\/api\/pure3d\/orcid\/jwks$/, '')) !== status.jwksURL ||
		!saved.oauth2.enabled ||
		saved.oauth2.providers.length !== 1 ||
		provider.name !== 'oidc' ||
		provider.userInfoURL ||
		provider.tokenURL !== orcidEndpoints(status.issuer).issuer + '/oauth/token' ||
		!isDeepStrictEqual(provider.extra?.issuers, [status.issuer])
	)
		throw new Error('Expected an already configured ORCID provider and current bridge hooks');
	const backup = await confirmedBackup(pb);
	provider.extra.jwksURL = status.jwksURL;
	// Only provider metadata: no schema, token secret, identity or onboarding changes.
	await pb.collections.update(saved.id, { oauth2: saved.oauth2 });
	const updated = await pb.collections.getOne(saved.id);
	if (!isDeepStrictEqual(updated.oauth2, saved.oauth2))
		throw new Error('ORCID JWKS configuration readback failed');
	return { backup, jwksURL: status.jwksURL };
}

async function main() {
	const args = process.argv.slice(2);
	const deferredMode =
		args.length === 4 &&
		args[0] === '--apply' &&
		args[1] === '--defer-unmapped' &&
		args[2] === '--onboarding-report' &&
		!!args[3] &&
		!args[3].startsWith('--');
	if (
		!deferredMode &&
		(args.length > 1 ||
			args.some((arg) => !['--prepare', '--apply', '--update-jwks'].includes(arg)))
	)
		throw new Error(
			'Usage: configure-orcid.ts [--update-jwks | --prepare | --apply [--defer-unmapped --onboarding-report NEW_PRIVATE_FILE]]'
		);
	if (!args.length) {
		console.log(
			'DRY RUN (offline): align users profiles/private pendingOrcid, credits, membership indexes and API rules.'
		);
		console.log(
			'With --apply: enable ORCID-only oidc, require issuer/JWKS ID-token verification, disable users password/OTP/MFA and automatic profile mapping.'
		);
		console.log(
			'Apply first requires approved/verified privileged accounts and a newly created, readback-confirmed PocketBase backup. ORCID_ENVIRONMENT selects production (default) or sandbox; hooks ORCID_ISSUER must agree.'
		);
		console.log(
			'No credentials read, network requests or writes. Deploy the ORCID hooks before applying; _superusers authentication is unchanged.'
		);
		console.log(
			'--prepare creates a confirmed backup and adds schema only, preserving legacy login/rules/tokens. Approve and read back pending mappings before --apply; cutover invalidates all existing users sessions.'
		);
		console.log(
			'Explicit --apply --defer-unmapped --onboarding-report NEW_PRIVATE_FILE preserves unmapped roles with login disabled. A verified/approved pending global admin is always required; the private report is flushed before backup/schema/auth operations.'
		);
		return;
	}
	const required = [
		'POCKETBASE_URL',
		'POCKETBASE_ADMIN_EMAIL',
		'POCKETBASE_ADMIN_PASSWORD',
		...(args[0] === '--apply' ? ['ORCID_CLIENT_ID', 'ORCID_CLIENT_SECRET'] : [])
	];
	if (required.some((key) => !process.env[key]))
		throw new Error('Missing required configuration environment variables');
	const url = new URL(process.env.POCKETBASE_URL!);
	if (
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		url.pathname !== '/' ||
		(url.protocol !== 'https:' &&
			!(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
	)
		throw new Error('Use an HTTPS PocketBase origin (HTTP allowed only on loopback)');
	const pb = new PocketBase(url.origin);
	await pb
		.collection('_superusers')
		.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL!, process.env.POCKETBASE_ADMIN_PASSWORD!);
	if (args[0] === '--update-jwks') {
		const result = await updateOrcidJwks(pb);
		console.log(
			'ORCID JWKS URL updated after confirmed backup: ' +
				result.backup +
				'. Sessions and identities unchanged.'
		);
		return;
	}
	if (args[0] === '--prepare') {
		await prepareOrcidSchema(pb);
		console.log(
			'ORCID schema prepared after confirmed backup. Legacy login, tokens and API rules are unchanged. Approve and read back privileged pending mappings, then run --apply.'
		);
		return;
	}
	await applyOrcidConfiguration(
		pb,
		process.env.ORCID_CLIENT_ID!,
		process.env.ORCID_CLIENT_SECRET!,
		process.env.ORCID_ENVIRONMENT || 'production',
		deferredMode ? { deferUnmapped: true, onboardingReport: args[3] } : {}
	);
	console.log(
		'ORCID schema/rules applied; users are OAuth-only and previous users sessions are invalidated. Superuser sessions are unchanged. No user identities or attribution records were rewritten.'
	);
}

if (import.meta.main)
	main().catch(() => {
		// SDK errors can contain submitted credentials and full collection settings.
		console.error(
			'ORCID configuration failed. No credentials or server response logged. Check flags, new private report path, verified/approved global admin, issuer/environment agreement, privileged-account mappings, backup readback, schema compatibility and required environment variables. A partial schema update may need rerunning; retain the report and backup and use a maintenance window.'
		);
		process.exitCode = 1;
	});
