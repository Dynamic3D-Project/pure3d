#!/usr/bin/env bun
/**
 * Imports JSON data into PocketBase.
 * Safe to re-run: existing records are detected and skipped.
 */
import PocketBase from 'pocketbase';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const PB_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@admin.local';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || '1234567890';
const JSON_DIR = 'data/json-output';
const PUBLIC_PB_URL = process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090';

const pb = new PocketBase(PB_URL);

function mapGlobalRole(role?: string) {
	switch (role) {
		case 'root':
		case 'admin':
			return 'admin';
		case 'editorial_board':
			return 'editorial_board';
		case 'viewer':
			return 'viewer';
		case 'user':
		default:
			return 'viewer';
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
		const error = await response.json();
		throw new Error(error.message || 'PocketBase authentication failed');
	}

	const authData = await response.json();
	pb.authStore.save(authData.token, authData.record);
	console.log('Authenticated successfully\n');
}

async function main() {
	console.log('Importing data into PocketBase');
	console.log(`   URL: ${PB_URL}`);
	console.log(`   Admin: ${ADMIN_EMAIL}\n`);

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

		const tempPassword = `${doc.user || 'import'}-${Math.random().toString(36).slice(2, 10)}`;
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

		const result = await pb.collection('collections').create({
			mongoId: doc._id,
			title: doc.title,
			site: siteId || null,
			siteId: siteId || null,
			isVisible: doc.isVisible !== false,
			lastPublished: doc.lastPublished || null,
			pubNum: projectPubNum,
			thumbnail: thumbnailUrl,
			dcTitle: doc.dc?.title,
			dcSubtitle: doc.dc?.subtitle,
			dcCreator: doc.dc?.creator || [],
			dcContributor: doc.dc?.contributor || [],
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

		let result;
		try {
			result = await pb.collection('editions').create({
				mongoId: doc._id,
				title: doc.title,
				collection: pbCollectionId,
				isPublished: doc.isPublished === true,
				status: normalizeStatus(doc.isPublished, doc.status || null),
				pubNum: editionPubNum,
				thumbnail: thumbnailUrl,
				dcTitle: doc.dc?.title,
				dcSubtitle: doc.dc?.subtitle,
				dcCreator: doc.dc?.creator || [],
				dcContributor: doc.dc?.contributor || [],
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
				publishedAt: doc.dc?.datePublished || null,
				authorToolName: doc.settings?.authorTool?.name,
				authorToolVersion: doc.settings?.authorTool?.version,
				sceneFile: doc.settings?.authorTool?.sceneFile,
				settingsAuthorToolName: doc.settings?.authorTool?.name,
				settingsAuthorToolVersion: doc.settings?.authorTool?.version,
				settingsSceneFile: doc.settings?.authorTool?.sceneFile
			});
		} catch (error: any) {
			console.error(`   Failed edition: ${doc.title} (${doc._id})`);
			console.error(JSON.stringify(error?.response || error, null, 2));
			throw error;
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
	const editionUsersData = readJsonArray<any>('editionUser.json');
	const existingEditionUsers = await pb.collection('editionUsers').getFullList();
	const editionUserKeys = new Set(
		existingEditionUsers.map(
			(record: any) =>
				`${record.editionId || record.edition}|${record.userId || record.user}|${record.role}`
		)
	);

	let importedEditionUsers = 0;
	let skippedEditionUsers = 0;

	for (const doc of editionUsersData) {
		const pbEditionId = editionIdMap.get(doc.editionId);
		const pbUserId = userHashToId.get(doc.user);
		if (!pbEditionId || !pbUserId) {
			continue;
		}

		const role = mapEditionRole(doc.role);
		const key = `${pbEditionId}|${pbUserId}|${role}`;
		if (editionUserKeys.has(key)) {
			skippedEditionUsers++;
			continue;
		}

		await pb.collection('editionUsers').create({
			mongoId: doc._id,
			edition: pbEditionId,
			editionId: pbEditionId,
			user: pbUserId,
			userId: pbUserId,
			userHash: doc.user,
			role
		});

		editionUserKeys.add(key);
		importedEditionUsers++;
	}

	console.log(`   Imported ${importedEditionUsers}, skipped ${skippedEditionUsers}`);

	console.log('\nData import complete.');
	console.log(`   Admin UI: ${PUBLIC_PB_URL}/_/`);
	console.log(`   API: ${PUBLIC_PB_URL}/api/\n`);
}

main().catch((error) => {
	console.error('Import failed:', error.message || error);
	process.exit(1);
});
