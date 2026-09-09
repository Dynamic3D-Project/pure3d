#!/usr/bin/env bun
/**
 * Imports JSON data into PocketBase.
 * Safe to re-run: existing records are detected and skipped.
 */
import PocketBase from 'pocketbase';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'node:util';
import { fingerprint, legacyCredits } from './reconcile-author-profiles';
import { publicationBlocked } from './migrate-orcid-credits';

const PB_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@admin.local';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || '1234567890';
const JSON_DIR = 'data/json-output';

const pb = new PocketBase(PB_URL);

function requireLocalTarget(target: string) {
	if (
		!['http://pocketbase:8090', 'http://localhost:60021', 'http://127.0.0.1:60021'].includes(target)
	)
		throw new Error(
			'Legacy bootstrap import is local-only; use reviewed migrations for existing data'
		);
}

function mapGlobalRole(role?: string) {
	switch (role) {
		case 'root':
		case 'admin':
			return 'admin';
		case 'editorial_board':
			return 'editorial_board';
		case 'user':
		case 'viewer':
		default:
			return 'user';
	}
}

function mapCollectionRole(role?: string) {
	switch (role) {
		case 'organiser':
			return 'owner';
		case 'editor':
			return 'editor';
		case 'viewer':
			return 'viewer';
		case 'owner':
		default:
			return role || 'viewer';
	}
}

function mapEditionRole(role?: string) {
	switch (role) {
		case 'editor':
			return 'author';
		case 'reader':
			return 'collaborator';
		case 'reviewer':
			return 'reviewer';
		case 'author':
		case 'collaborator':
		default:
			return role || 'collaborator';
	}
}

export type LegacyEditionMembership = Record<string, unknown> & {
	_id?: string;
	editionId: string;
	user: string | null;
	role?: string;
};

export async function importEditionMemberships(
	client: PocketBase,
	source: LegacyEditionMembership[],
	editionIds: Map<string, string>,
	userIds: Map<string, string>,
	onboardingDirectory: string
) {
	requireLocalTarget(client.baseURL);
	const existing = await client.collection('editionUsers').getFullList();
	const keys = new Set(
		existing.map((row) => `${row.editionId || row.edition}|${row.userId || row.user}|${row.role}`)
	);
	const pending = [];
	const ready = [];
	let skipped = 0;
	for (const [index, doc] of source.entries()) {
		if (
			!doc ||
			typeof doc.editionId !== 'string' ||
			!doc.editionId ||
			(doc.user !== null && (typeof doc.user !== 'string' || !doc.user)) ||
			(doc.role !== undefined && typeof doc.role !== 'string')
		)
			throw new Error('Invalid legacy edition membership source');
		const editionId = editionIds.get(doc.editionId);
		const userId = doc.user === null ? undefined : userIds.get(doc.user);
		const role = mapEditionRole(doc.role);
		const key = `${editionId}|${userId}|${role}`;
		if (editionId && userId && keys.has(key)) {
			skipped++;
			continue;
		}
		if (role === 'author' || !editionId || !userId) {
			// Author intent is not OAuth proof. Keep every source row for explicit onboarding review.
			pending.push({
				sourceIndex: index,
				source: doc,
				sourceFingerprint: fingerprint({ id: String(index), source: doc }),
				legacyEditionId: doc.editionId,
				legacyUserHash: doc.user,
				editionId: editionId || null,
				userId: userId || null,
				requestedRole: role,
				status: 'pending',
				evidence: '',
				reason: !editionId || !userId ? 'missing-target' : 'author-onboarding-required'
			});
			continue;
		}
		ready.push({
			mongoId: doc._id,
			edition: editionId,
			editionId,
			user: userId,
			userId,
			userHash: doc.user,
			role
		});
		keys.add(key);
	}
	let reportPath: string | null = null;
	if (pending.length) {
		mkdirSync(onboardingDirectory, { recursive: true, mode: 0o700 });
		const directory = lstatSync(onboardingDirectory);
		if (!directory.isDirectory() || (directory.mode & 0o077) !== 0)
			throw new Error('Onboarding report directory must be private (0700), not a symlink');
		reportPath = join(onboardingDirectory, `edition-author-onboarding-${crypto.randomUUID()}.json`);
		writeFileSync(
			reportPath,
			JSON.stringify(
				{
					version: 1,
					target: client.baseURL,
					createdAt: new Date().toISOString(),
					sourceFile: 'editionUser.json',
					pendingAssignments: pending
				},
				null,
				2
			) + '\n',
			{ flag: 'wx', mode: 0o600, flush: true }
		);
	}
	const pendingAuthors = pending.filter((item) => item.requestedRole === 'author').length;
	console.log(
		`   Pending author assignments: ${pendingAuthors}; other missing-target assignments: ${pending.length - pendingAuthors}. No author roles granted or downgraded.`
	);
	if (reportPath)
		console.log(
			`   Private onboarding report: ${reportPath}. Review exact source targets, approve pending ORCID mappings, obtain verified sign-in, then grant the requested role explicitly.`
		);
	// Persist unresolved intent before any membership writes, including a possible later failure.
	for (const membership of ready) await client.collection('editionUsers').create(membership);
	return { imported: ready.length, skipped, pendingAuthors, pending: pending.length, reportPath };
}

function normalizeEmail(email?: string | null) {
	return (email || '').trim().toLowerCase();
}

function normalizeStatus(isPublished?: boolean, explicitStatus?: string | null) {
	if (explicitStatus) {
		return explicitStatus;
	}

	return isPublished ? 'published' : 'draft';
}

function normalizeNumber(value: unknown, fallback = 0) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	if (value && typeof value === 'object') {
		for (const key of ['$numberInt', '$numberLong', '$numberDouble']) {
			const wrapped = (value as Record<string, unknown>)[key];
			if (typeof wrapped === 'string' && wrapped.trim()) {
				const parsed = Number(wrapped);
				if (Number.isFinite(parsed)) {
					return parsed;
				}
			}
		}
	}

	return fallback;
}

function readJsonArray<T>(filename: string): T[] {
	const filepath = join(JSON_DIR, filename);
	if (!existsSync(filepath)) {
		console.log(`   Skipped ${filename}, file not found`);
		return [];
	}

	return JSON.parse(readFileSync(filepath, 'utf-8')) as T[];
}

async function waitForPocketBase() {
	console.log('Waiting for PocketBase...');

	for (let attempt = 0; attempt < 30; attempt++) {
		try {
			await pb.health.check();
			console.log('PocketBase is ready\n');
			return;
		} catch {}

		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	throw new Error('PocketBase did not become ready in time');
}

async function authenticate() {
	console.log('Authenticating...');

	const response = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			identity: ADMIN_EMAIL,
			password: ADMIN_PASSWORD
		})
	});

	if (!response.ok) {
		throw new Error('PocketBase authentication failed');
	}

	const authData = await response.json();
	pb.authStore.save(authData.token, authData.record);
	console.log('Authenticated successfully\n');
}

export async function main(args = process.argv.slice(2)) {
	// This bootstrap importer is not a production migration or an identity-proof mechanism.
	requireLocalTarget(PB_URL);
	const { values } = parseArgs({
		args,
		options: {
			'onboarding-dir': { type: 'string', default: 'data/import-onboarding' }
		}
	});
	console.log('Importing data into PocketBase');

	await waitForPocketBase();
	await authenticate();

	const collectionIdMap = new Map<string, string>();
	const editionIdMap = new Map<string, string>();
	const userHashToId = new Map<string, string>();

	console.log('Importing site...');
	const siteData = readJsonArray<any>('site.json');
	const existingSite = await pb.collection('site').getFullList();
	let siteId = existingSite[0]?.id;

	if (!siteId) {
		if (siteData.length === 0) {
			const result = await pb.collection('site').create({
				name: 'Pure3D',
				blog: null,
				lastPublished: null,
				processing: false,
				featured: [],
				publishedProjectCount: 0,
				sweeperStartTm: null,
				dcDateCreated: null,
				dcDateModified: null
			});
			siteId = result.id;
			console.log('   Created default empty site record');
		} else {
			for (const doc of siteData) {
				const result = await pb.collection('site').create({
					name: doc.name,
					blog: doc.blog || null,
					lastPublished: doc.lastPublished || null,
					processing: doc.processing || false,
					featured: doc.featured || [],
					publishedProjectCount: doc.publishedProjectCount || 0,
					sweeperStartTm: doc.sweeperStartTm || null,
					dcDateCreated: doc.dc?.dateCreated || null,
					dcDateModified: doc.dc?.dateModified || null
				});
				siteId = result.id;
			}
			console.log(`   Imported ${siteData.length} site record(s)`);
		}
	} else {
		console.log(`   Skipped, site already exists (${siteId})`);
	}

	console.log('\nImporting users...');
	const usersData = readJsonArray<any>('user.json');
	const existingUsers = await pb.collection('users').getFullList();
	const existingEmails = new Set(existingUsers.map((record: any) => normalizeEmail(record.email)));

	for (const record of existingUsers) {
		if (record.userHash) {
			userHashToId.set(record.userHash, record.id);
		}
	}

	let importedUsers = 0;
	let skippedUsers = 0;

	for (const doc of usersData) {
		const email = normalizeEmail(doc.email);
		if (email && existingEmails.has(email)) {
			skippedUsers++;
			continue;
		}

		const tempPassword = crypto.randomUUID();
		const result = await pb.collection('users').create({
			email: doc.email,
			password: tempPassword,
			passwordConfirm: tempPassword,
			userHash: doc.user,
			nickname: doc.nickname,
			role: mapGlobalRole(doc.role)
		});

		if (doc.user) {
			userHashToId.set(doc.user, result.id);
		}
		if (email) {
			existingEmails.add(email);
		}

		importedUsers++;
	}

	console.log(`   Imported ${importedUsers}, skipped ${skippedUsers}`);

	console.log('\nImporting keywords...');
	const keywordsData = readJsonArray<any>('keyword.json');
	const existingKeywords = await pb.collection('keywords').getFullList();
	const keywordKeys = new Set(
		existingKeywords.map((record: any) => `${record.category || record.name}|${record.value}`)
	);

	let importedKeywords = 0;
	let skippedKeywords = 0;

	for (const doc of keywordsData) {
		const key = `${doc.name}|${doc.value}`;
		if (keywordKeys.has(key)) {
			skippedKeywords++;
			continue;
		}

		await pb.collection('keywords').create({
			name: doc.name,
			category: doc.name,
			value: doc.value
		});
		keywordKeys.add(key);
		importedKeywords++;
	}

	console.log(`   Imported ${importedKeywords}, skipped ${skippedKeywords}`);

	console.log('\nImporting collections...');
	const projectsData = readJsonArray<any>('project.json');
	const existingCollections = await pb.collection('collections').getFullList();
	const existingCollectionsByTitle = new Map(
		existingCollections.map((record: any) => [record.title, record])
	);

	for (const doc of projectsData) {
		const existing = existingCollectionsByTitle.get(doc.title);
		if (existing) {
			collectionIdMap.set(doc._id, existing.id);
		}
	}

	let importedCollections = 0;
	let skippedCollections = 0;

	for (const doc of projectsData) {
		const existing = existingCollectionsByTitle.get(doc.title);
		if (existing) {
			collectionIdMap.set(doc._id, existing.id);
			skippedCollections++;
			continue;
		}

		const projectPubNum = normalizeNumber(doc.pubNum, 0);
		const thumbnailUrl =
			projectPubNum > 0 ? `https://editions.pure3d.eu/project/${projectPubNum}/icon.png` : '';

		const credits = legacyCredits(doc.dc?.creator, doc.dc?.contributor);
		const result = await pb.collection('collections').create({
			mongoId: doc._id,
			title: doc.title,
			site: siteId || null,
			siteId: siteId || null,
			isVisible: !publicationBlocked(credits) && doc.isVisible !== false,
			lastPublished: doc.lastPublished || null,
			pubNum: projectPubNum,
			thumbnail: thumbnailUrl,
			dcTitle: doc.dc?.title,
			dcSubtitle: doc.dc?.subtitle,
			credits,
			dcInstitution: doc.dc?.institution || [],
			dcAbstract: doc.dc?.abstract,
			dcDescription: doc.dc?.description,
			dcSubject: doc.dc?.subject || [],
			dcCoveragePeriod: doc.dc?.coverage?.period,
			dcCoveragePlace: doc.dc?.coverage?.place,
			dcLanguage: doc.dc?.language || [],
			dcDateCreated: doc.dc?.dateCreated,
			dcDateModified: doc.dc?.dateModified
		});

		existingCollectionsByTitle.set(doc.title, result);
		collectionIdMap.set(doc._id, result.id);
		importedCollections++;
	}

	console.log(`   Imported ${importedCollections}, skipped ${skippedCollections}`);

	console.log('\nImporting editions...');
	const editionsData = readJsonArray<any>('edition.json');
	const existingEditions = await pb.collection('editions').getFullList();
	const existingEditionKeys = new Map(
		existingEditions.map((record: any) => [`${record.title}|${record.collection}`, record])
	);

	for (const doc of editionsData) {
		const pbCollectionId = collectionIdMap.get(doc.projectId);
		if (!pbCollectionId) {
			continue;
		}

		const existing = existingEditionKeys.get(`${doc.title}|${pbCollectionId}`);
		if (existing) {
			editionIdMap.set(doc._id, existing.id);
		}
	}

	let importedEditions = 0;
	let skippedEditions = 0;

	for (const doc of editionsData) {
		const pbCollectionId = collectionIdMap.get(doc.projectId);
		if (!pbCollectionId) {
			continue;
		}

		const existing = existingEditionKeys.get(`${doc.title}|${pbCollectionId}`);
		if (existing) {
			editionIdMap.set(doc._id, existing.id);
			skippedEditions++;
			continue;
		}

		const collectionRecord = await pb.collection('collections').getOne(pbCollectionId);
		const collectionPubNum = collectionRecord.pubNum || 0;
		const editionPubNum = normalizeNumber(doc.pubNum, 1);
		const thumbnailUrl =
			collectionPubNum > 0
				? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/icon.png`
				: '';

		const credits = legacyCredits(doc.dc?.creator, doc.dc?.contributor);
		let result;
		try {
			result = await pb.collection('editions').create({
				mongoId: doc._id,
				title: doc.title,
				collection: pbCollectionId,
				isPublished: !publicationBlocked(credits) && doc.isPublished === true,
				status: publicationBlocked(credits)
					? 'draft'
					: normalizeStatus(doc.isPublished, doc.status || null),
				pubNum: editionPubNum,
				thumbnail: thumbnailUrl,
				dcTitle: doc.dc?.title,
				dcSubtitle: doc.dc?.subtitle,
				credits,
				dcInstitution: doc.dc?.institution || [],
				dcAbstract: doc.dc?.abstract,
				dcDescription: doc.dc?.description,
				dcContact: doc.dc?.contact || null,
				dcSubject: doc.dc?.subject || [],
				dcKeyword: doc.dc?.keyword || [],
				dcAudience: doc.dc?.audience || [],
				dcFunder: doc.dc?.funder || [],
				dcSource: doc.dc?.source || [],
				dcProvenance: doc.dc?.provenance,
				dcCoveragePeriod: doc.dc?.coverage?.period || [],
				dcCoveragePlace: doc.dc?.coverage?.place,
				dcCoverageCountry: doc.dc?.coverage?.country || [],
				dcCoverageTemporal: doc.dc?.coverage?.temporal,
				dcCoverageGeo: doc.dc?.coverage?.geo,
				dcLanguage: doc.dc?.language || [],
				dcRightsHolder: doc.dc?.rights?.holder,
				dcRightsLicense: doc.dc?.rights?.license,
				dcDatePublished: doc.dc?.datePublished,
				dcDateUnPublished: doc.dc?.dateUnPublished,
				dcDateCreated: doc.dc?.dateCreated,
				dcDateModified: doc.dc?.dateModified,
				dcDoi: doc.dc?.doi || [],
				peerReviewKind: doc.pure3d?.peerReviewKind || null,
				peerReviewContent: doc.pure3d?.peerReviewContent || null,
				peerReviewRequested: false,
				reviewStage: null,
				peerReviewStamp: false,
				publishedAt: publicationBlocked(credits) ? null : doc.dc?.datePublished || null,
				authorToolName: doc.settings?.authorTool?.name,
				authorToolVersion: doc.settings?.authorTool?.version,
				sceneFile: doc.settings?.authorTool?.sceneFile,
				settingsAuthorToolName: doc.settings?.authorTool?.name,
				settingsAuthorToolVersion: doc.settings?.authorTool?.version,
				settingsSceneFile: doc.settings?.authorTool?.sceneFile
			});
		} catch {
			throw new Error('Edition import failed; no source data or server response logged');
		}

		existingEditionKeys.set(`${doc.title}|${pbCollectionId}`, result);
		editionIdMap.set(doc._id, result.id);
		importedEditions++;
	}

	console.log(`   Imported ${importedEditions}, skipped ${skippedEditions}`);

	console.log('\nImporting collection users...');
	const projectUsersData = readJsonArray<any>('projectUser.json');
	const existingCollectionUsers = await pb.collection('collectionUsers').getFullList();
	const collectionUserKeys = new Set(
		existingCollectionUsers.map(
			(record: any) => `${record.collection}|${record.userId || record.user}|${record.role}`
		)
	);

	let importedCollectionUsers = 0;
	let skippedCollectionUsers = 0;

	for (const doc of projectUsersData) {
		const pbCollectionId = collectionIdMap.get(doc.projectId);
		const pbUserId = userHashToId.get(doc.user);
		if (!pbCollectionId || !pbUserId) {
			continue;
		}

		const role = mapCollectionRole(doc.role);
		const key = `${pbCollectionId}|${pbUserId}|${role}`;
		if (collectionUserKeys.has(key)) {
			skippedCollectionUsers++;
			continue;
		}

		await pb.collection('collectionUsers').create({
			mongoId: doc._id,
			collection: pbCollectionId,
			user: pbUserId,
			userId: pbUserId,
			userHash: doc.user,
			role
		});

		collectionUserKeys.add(key);
		importedCollectionUsers++;
	}

	console.log(`   Imported ${importedCollectionUsers}, skipped ${skippedCollectionUsers}`);

	console.log('\nImporting edition users...');
	const editionUsersData = readJsonArray<LegacyEditionMembership>('editionUser.json');
	const memberships = await importEditionMemberships(
		pb,
		editionUsersData,
		editionIdMap,
		userHashToId,
		values['onboarding-dir']
	);
	console.log(
		`   Imported ${memberships.imported}, skipped ${memberships.skipped}, deferred ${memberships.pending}`
	);

	console.log('\nData import complete.');
}

if (import.meta.main)
	main().catch(() => {
		console.error(
			'Local import failed. Check local target, source data, schema, credentials and private onboarding directory permissions. Earlier stages may have completed; retain any onboarding report. No server response logged.'
		);
		process.exitCode = 1;
	});
