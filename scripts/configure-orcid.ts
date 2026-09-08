#!/usr/bin/env bun
/**
 * Dry-run (offline, no credentials read): bun --no-env-file scripts/configure-orcid.ts
 * Prepare fields first: bun scripts/configure-orcid.ts --prepare
 * Approve pending mappings, then cut over: bun scripts/configure-orcid.ts --apply
 * Requires POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD,
 * ORCID_CLIENT_ID and ORCID_CLIENT_SECRET. Never invokes the bootstrap/import scripts.
 * Deploy pb_hooks first. Existing admins can approve mappings through the private endpoint.
 * ORCID_ENVIRONMENT=production (default) or sandbox. For sandbox, start PB with
 * ORCID_ISSUER=https://sandbox.orcid.org and use a separate database and ORCID client.
 * Run --apply in a maintenance window; REST schema changes are not transactional.
 */
import PocketBase from 'pocketbase';
import { randomBytes } from 'node:crypto';
import schema from '../pocketbase/pb_schema/collections.json';
import { canonicalOrcid, orcidEndpoints } from '../pocketbase/pb_hooks/orcid-validation.cjs';

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

async function confirmedBackup(pb: PocketBase) {
	const backup = 'orcid-config-' + crypto.randomUUID() + '.zip';
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
	environment = 'production'
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
					extra: { issuers: [issuer], jwksURL: issuer + '/oauth/jwks' }
				}
			]
		}
	};
}

export async function preflightPrivilegedAccounts(pb: PocketBase, issuer: string) {
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
		.getFullList({ fields: 'id,role,orcid,orcidVerifiedAt,pendingOrcid' });
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
	for (const name of ['collectionUsers', 'editionUsers']) {
		const memberships = await pb.collection(name).getFullList({ fields: 'userId,role' });
		for (const member of memberships) {
			if (
				(name === 'collectionUsers' && ['owner', 'editor'].includes(member.role)) ||
				name === 'editionUsers'
			)
				privileged.add(member.userId);
		}
	}
	for (const assignment of await pb
		.collection('reviewAssignments')
		.getFullList({ fields: 'reviewerId,status' })) {
		if (assignment.status !== 'declined') privileged.add(assignment.reviewerId);
	}
	for (const id of privileged) {
		const user = users.find((user) => user.id === id);
		if (!user) throw new Error('Privileged membership has no target account');
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
		if (!verified && !approved)
			throw new Error(
				'Every privileged account needs a verified ORCID link or an administrator-approved pending mapping before disabling login'
			);
	}
}

export async function applyOrcidConfiguration(
	pb: PocketBase,
	clientId: string,
	clientSecret: string,
	environment = 'production'
) {
	const config = orcidAuthConfig(clientId, clientSecret, environment);
	const issuer = config.oauth2.providers[0].extra.issuers[0];
	let backup = '';
	await alignOrcidSchema(pb, async () => {
		await preflightPrivilegedAccounts(pb, issuer);
		backup = await confirmedBackup(pb);
	});
	// Recheck after the schema phase so a newly privileged/unapproved account cannot be silently locked out.
	await preflightPrivilegedAccounts(pb, issuer);
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
		JSON.stringify(provider.extra) !== JSON.stringify(expected.extra) ||
		Object.values(saved.oauth2.mappedFields).some(Boolean)
	)
		throw new Error('ORCID authentication configuration readback failed');
	return { backup, issuer };
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length > 1 || args.some((arg) => !['--prepare', '--apply'].includes(arg)))
		throw new Error('Usage: configure-orcid.ts [--prepare | --apply]');
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
		process.env.ORCID_ENVIRONMENT || 'production'
	);
	console.log(
		'ORCID schema/rules applied; users are OAuth-only and previous users sessions are invalidated. Superuser sessions are unchanged. No user identities or attribution records were rewritten.'
	);
}

if (import.meta.main)
	main().catch(() => {
		// SDK errors can contain submitted credentials and full collection settings.
		console.error(
			'ORCID configuration failed. No credentials or server response logged. Check issuer/environment agreement, privileged-account mappings, backup readback, schema compatibility and required environment variables. A partial schema update may need rerunning; retain the backup and use a maintenance window.'
		);
		process.exitCode = 1;
	});
