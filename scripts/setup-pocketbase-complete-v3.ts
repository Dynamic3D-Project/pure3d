#!/usr/bin/env bun
/**
 * Complete PocketBase setup - imports ALL data from MongoDB export
 * This script creates all collections with complete schemas and imports all data
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const PB_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@admin.local';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || '1234567890';
const JSON_DIR = 'data/json-output';

let authToken = '';

// ID mapping for relationships
const idMaps = {
	site: new Map<string, string>(),
	users: new Map<string, string>(),
	keywords: new Map<string, string>(),
	collections: new Map<string, string>(), // projects -> collections
	editions: new Map<string, string>()
};

async function authenticate() {
	const response = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD })
	});

	if (!response.ok) throw new Error(`Auth failed: ${await response.text()}`);

	const data = await response.json();
	authToken = data.token;
	console.log('✅ Authenticated\n');
}

async function deleteCollection(name: string) {
	const checkResponse = await fetch(`${PB_URL}/api/collections/${name}`, {
		headers: { Authorization: authToken }
	});

	if (checkResponse.ok) {
		const existing = await checkResponse.json();
		const deleteResponse = await fetch(`${PB_URL}/api/collections/${existing.id}`, {
			method: 'DELETE',
			headers: { Authorization: authToken }
		});
		if (deleteResponse.ok) {
			console.log(`   🗑️  Deleted ${name}`);
		} else {
			console.log(`   ⚠️  Could not delete ${name}: ${await deleteResponse.text()}`);
		}
		// Wait longer for the deletion to propagate
		await new Promise((r) => setTimeout(r, 500));
	}
}

async function createCollection(name: string, fields: any[]) {
	const createResponse = await fetch(`${PB_URL}/api/collections`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: authToken
		},
		body: JSON.stringify({
			name,
			type: 'base',
			fields,
			listRule: '', // Public read
			viewRule: '' // Public read
		})
	});

	if (!createResponse.ok) {
		throw new Error(`Failed to create ${name}: ${await createResponse.text()}`);
	}

	const result = await createResponse.json();
	console.log(`   ✅ ${name} created (ID: ${result.id})`);
	return result.id;
}

async function insertRecord(collection: string, data: any) {
	const response = await fetch(`${PB_URL}/api/collections/${collection}/records`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: authToken
		},
		body: JSON.stringify(data)
	});

	if (!response.ok) {
		const error = await response.text();
		console.error(`Failed to insert into ${collection}:`, error);
		return null;
	}

	return await response.json();
}

async function main() {
	console.log('🚀 PocketBase Complete Setup v3 - Full MongoDB Import\n');
	console.log('='.repeat(60));

	// Wait for PocketBase
	console.log('⏳ Waiting for PocketBase...');
	for (let i = 0; i < 60; i++) {
		try {
			const res = await fetch(`${PB_URL}/api/health`);
			if (res.ok) {
				await new Promise((r) => setTimeout(r, 2000));
				break;
			}
		} catch (e) {}
		await new Promise((r) => setTimeout(r, 2000));
	}

	await authenticate();

	// ============================================================
	// PHASE 1: Delete existing collections (in reverse dependency order)
	// ============================================================
	console.log('🗑️  Cleaning up existing collections...\n');

	// Delete in correct dependency order (children first)
	await deleteCollection('editionUsers');
	await deleteCollection('collectionUsers'); // Old name
	await deleteCollection('projectUsers');
	await deleteCollection('editions');
	await deleteCollection('collections');
	await deleteCollection('keywords');
	await deleteCollection('users');
	await deleteCollection('site');

	// Wait for deletions to fully propagate
	console.log('\n   ⏳ Waiting for deletions to complete...');
	await new Promise((r) => setTimeout(r, 2000));

	// ============================================================
	// PHASE 2: Create all collections with complete schemas
	// ============================================================
	console.log('\n📦 Creating collections with complete schemas...\n');

	// 1. Site collection
	const siteId = await createCollection('site', [
		{ name: 'name', type: 'text', required: true },
		{ name: 'blog', type: 'url' },
		{ name: 'publishedProjectCount', type: 'number' },
		{ name: 'lastPublished', type: 'date' },
		{ name: 'processing', type: 'bool' },
		{ name: 'featured', type: 'json' }, // Array of pubNums
		{ name: 'sweeperStartTm', type: 'date' },
		{ name: 'dcDateCreated', type: 'date' },
		{ name: 'dcDateModified', type: 'date' }
	]);

	// 2. Users collection
	const usersId = await createCollection('users', [
		{ name: 'mongoId', type: 'text' }, // Original MongoDB _id
		{ name: 'userHash', type: 'text' }, // Original user hash
		{ name: 'email', type: 'email' },
		{ name: 'nickname', type: 'text' },
		{ name: 'role', type: 'text' } // root, user, etc.
	]);

	// 3. Keywords collection (taxonomy)
	const keywordsId = await createCollection('keywords', [
		{ name: 'category', type: 'text', required: true }, // country, period, subject, etc.
		{ name: 'value', type: 'text', required: true }
	]);

	// 4. Collections (projects in MongoDB)
	const collectionsId = await createCollection('collections', [
		{ name: 'mongoId', type: 'text' },
		{ name: 'title', type: 'text', required: true },
		{ name: 'site', type: 'relation', collectionId: siteId, maxSelect: 1 },
		{ name: 'isVisible', type: 'bool' },
		{ name: 'lastPublished', type: 'text' },
		{ name: 'pubNum', type: 'number' },
		{ name: 'publishedEditionCount', type: 'number' },
		// Dublin Core metadata
		{ name: 'dcTitle', type: 'text' },
		{ name: 'dcSubtitle', type: 'text' },
		{ name: 'dcAbstract', type: 'editor' },
		{ name: 'dcDescription', type: 'editor' },
		{ name: 'dcCreator', type: 'json' }, // Array
		{ name: 'dcContributor', type: 'json' }, // Array
		{ name: 'dcInstitution', type: 'json' }, // Array
		{ name: 'dcSubject', type: 'json' }, // Array
		{ name: 'dcLanguage', type: 'json' }, // Array
		{ name: 'dcCoveragePeriod', type: 'text' },
		{ name: 'dcCoveragePlace', type: 'text' },
		{ name: 'dcDateCreated', type: 'date' },
		{ name: 'dcDateModified', type: 'date' }
	]);

	// 5. Editions collection - COMPLETE schema
	const editionsId = await createCollection('editions', [
		{ name: 'mongoId', type: 'text' },
		{ name: 'title', type: 'text', required: true },
		{ name: 'collection', type: 'relation', collectionId: collectionsId, maxSelect: 1, cascadeDelete: true },
		{ name: 'isPublished', type: 'bool' },
		{ name: 'pubNum', type: 'number' },
		// Dublin Core - Basic
		{ name: 'dcTitle', type: 'text' },
		{ name: 'dcSubtitle', type: 'text' },
		{ name: 'dcAbstract', type: 'editor' },
		{ name: 'dcDescription', type: 'editor' },
		// Dublin Core - People/Orgs
		{ name: 'dcCreator', type: 'json' },
		{ name: 'dcContributor', type: 'json' },
		{ name: 'dcInstitution', type: 'json' },
		{ name: 'dcContact', type: 'text' },
		// Dublin Core - Classification
		{ name: 'dcSubject', type: 'json' },
		{ name: 'dcKeyword', type: 'json' },
		{ name: 'dcAudience', type: 'json' },
		{ name: 'dcLanguage', type: 'json' },
		{ name: 'dcSource', type: 'json' },
		// Dublin Core - Coverage (geography/time)
		{ name: 'dcCoveragePeriod', type: 'json' }, // Array
		{ name: 'dcCoveragePlace', type: 'text' },
		{ name: 'dcCoverageCountry', type: 'json' }, // Array
		{ name: 'dcCoverageTemporal', type: 'text' },
		{ name: 'dcCoverageGeo', type: 'text' },
		// Dublin Core - Rights
		{ name: 'dcRightsHolder', type: 'text' },
		{ name: 'dcRightsLicense', type: 'text' },
		// Dublin Core - Dates
		{ name: 'dcDatePublished', type: 'date' },
		{ name: 'dcDateUnPublished', type: 'date' },
		{ name: 'dcDateCreated', type: 'date' },
		{ name: 'dcDateModified', type: 'date' },
		// Dublin Core - Other
		{ name: 'dcFunder', type: 'json' },
		{ name: 'dcProvenance', type: 'editor' },
		{ name: 'dcDoi', type: 'json' },
		{ name: 'dcInstructionalMethod', type: 'text' },
		// Peer Review
		{ name: 'peerReviewKind', type: 'text' },
		{ name: 'peerReviewContent', type: 'editor' },
		// Settings
		{ name: 'settingsAuthorToolName', type: 'text' },
		{ name: 'settingsAuthorToolVersion', type: 'text' },
		{ name: 'settingsSceneFile', type: 'text' }
	]);

	// 6. ProjectUsers (collection-user relationships)
	const projectUsersId = await createCollection('projectUsers', [
		{ name: 'mongoId', type: 'text' },
		{ name: 'collection', type: 'relation', collectionId: collectionsId, maxSelect: 1, cascadeDelete: true },
		{ name: 'user', type: 'relation', collectionId: usersId, maxSelect: 1 },
		{ name: 'userHash', type: 'text' }, // Fallback if user not found
		{ name: 'role', type: 'text' }
	]);

	// 7. EditionUsers (edition-user relationships)
	const editionUsersId = await createCollection('editionUsers', [
		{ name: 'mongoId', type: 'text' },
		{ name: 'edition', type: 'relation', collectionId: editionsId, maxSelect: 1, cascadeDelete: true },
		{ name: 'user', type: 'relation', collectionId: usersId, maxSelect: 1 },
		{ name: 'userHash', type: 'text' }, // Fallback if user not found
		{ name: 'role', type: 'text' }
	]);

	// ============================================================
	// PHASE 3: Import all data
	// ============================================================
	console.log('\n📥 Importing data...\n');

	// Import Site
	console.log('📦 Importing site...');
	const siteData = JSON.parse(readFileSync(join(JSON_DIR, 'site.json'), 'utf-8'));
	for (const doc of siteData) {
		const result = await insertRecord('site', {
			name: doc.name,
			blog: doc.blog || null,
			publishedProjectCount: doc.publishedProjectCount || 0,
			lastPublished: doc.lastPublished || null,
			processing: doc.processing || false,
			featured: doc.featured || [],
			sweeperStartTm: doc.sweeperStartTm || null,
			dcDateCreated: doc.dc?.dateCreated || null,
			dcDateModified: doc.dc?.dateModified || null
		});
		if (result) {
			idMaps.site.set(doc._id, result.id);
		}
	}
	console.log(`   ✅ Imported ${idMaps.site.size} site record(s)\n`);

	// Import Users
	console.log('📦 Importing users...');
	const usersData = JSON.parse(readFileSync(join(JSON_DIR, 'user.json'), 'utf-8'));
	let userCount = 0;
	for (const doc of usersData) {
		const result = await insertRecord('users', {
			mongoId: doc._id,
			userHash: doc.user,
			email: doc.email || null,
			nickname: doc.nickname || null,
			role: doc.role || 'user'
		});
		if (result) {
			idMaps.users.set(doc.user, result.id); // Map by userHash for lookups
			userCount++;
		}
	}
	console.log(`   ✅ Imported ${userCount} users\n`);

	// Import Keywords
	console.log('📦 Importing keywords...');
	const keywordsData = JSON.parse(readFileSync(join(JSON_DIR, 'keyword.json'), 'utf-8'));
	let keywordCount = 0;
	for (const doc of keywordsData) {
		const result = await insertRecord('keywords', {
			category: doc.name,
			value: doc.value
		});
		if (result) {
			idMaps.keywords.set(doc._id, result.id);
			keywordCount++;
		}
	}
	console.log(`   ✅ Imported ${keywordCount} keywords\n`);

	// Import Collections (projects)
	console.log('📦 Importing collections (projects)...');
	const projectsData = JSON.parse(readFileSync(join(JSON_DIR, 'project.json'), 'utf-8'));
	let collectionCount = 0;

	// Get site PB ID
	const pbSiteId = idMaps.site.values().next().value;

	for (const doc of projectsData) {
		const result = await insertRecord('collections', {
			mongoId: doc._id,
			title: doc.title,
			site: pbSiteId,
			isVisible: doc.isVisible !== false,
			lastPublished: doc.lastPublished || null,
			pubNum: doc.pubNum || 0,
			publishedEditionCount: doc.publishedEditionCount || 0,
			dcTitle: doc.dc?.title || null,
			dcSubtitle: doc.dc?.subtitle || null,
			dcAbstract: doc.dc?.abstract || null,
			dcDescription: doc.dc?.description || null,
			dcCreator: doc.dc?.creator || [],
			dcContributor: doc.dc?.contributor || [],
			dcInstitution: doc.dc?.institution || [],
			dcSubject: doc.dc?.subject || [],
			dcLanguage: doc.dc?.language || [],
			dcCoveragePeriod: doc.dc?.coverage?.period || null,
			dcCoveragePlace: doc.dc?.coverage?.place || null,
			dcDateCreated: doc.dc?.dateCreated || null,
			dcDateModified: doc.dc?.dateModified || null
		});
		if (result) {
			idMaps.collections.set(doc._id, result.id);
			collectionCount++;
			process.stdout.write(`\r   Progress: ${collectionCount}/${projectsData.length}`);
		}
	}
	console.log(`\n   ✅ Imported ${collectionCount} collections\n`);

	// Import Editions
	console.log('📦 Importing editions...');
	const editionsData = JSON.parse(readFileSync(join(JSON_DIR, 'edition.json'), 'utf-8'));
	let editionCount = 0;

	for (const doc of editionsData) {
		const pbCollectionId = idMaps.collections.get(doc.projectId);
		if (!pbCollectionId) {
			console.warn(`   ⚠️  Skipping edition "${doc.title}" - collection not found`);
			continue;
		}

		const result = await insertRecord('editions', {
			mongoId: doc._id,
			title: doc.title,
			collection: pbCollectionId,
			isPublished: doc.isPublished === true,
			pubNum: doc.pubNum || 1,
			// Dublin Core - Basic
			dcTitle: doc.dc?.title || null,
			dcSubtitle: doc.dc?.subtitle || null,
			dcAbstract: doc.dc?.abstract || null,
			dcDescription: doc.dc?.description || null,
			// Dublin Core - People/Orgs
			dcCreator: doc.dc?.creator || [],
			dcContributor: doc.dc?.contributor || [],
			dcInstitution: doc.dc?.institution || [],
			dcContact: doc.dc?.contact || null,
			// Dublin Core - Classification
			dcSubject: doc.dc?.subject || [],
			dcKeyword: doc.dc?.keyword || [],
			dcAudience: doc.dc?.audience || [],
			dcLanguage: doc.dc?.language || [],
			dcSource: doc.dc?.source || [],
			// Dublin Core - Coverage
			dcCoveragePeriod: doc.dc?.coverage?.period || [],
			dcCoveragePlace: doc.dc?.coverage?.place || null,
			dcCoverageCountry: doc.dc?.coverage?.country || [],
			dcCoverageTemporal: doc.dc?.coverage?.temporal || null,
			dcCoverageGeo: doc.dc?.coverage?.geo || null,
			// Dublin Core - Rights
			dcRightsHolder: doc.dc?.rights?.holder || null,
			dcRightsLicense: doc.dc?.rights?.license || null,
			// Dublin Core - Dates
			dcDatePublished: doc.dc?.datePublished || null,
			dcDateUnPublished: doc.dc?.dateUnPublished || null,
			dcDateCreated: doc.dc?.dateCreated || null,
			dcDateModified: doc.dc?.dateModified || null,
			// Dublin Core - Other
			dcFunder: doc.dc?.funder || [],
			dcProvenance: doc.dc?.provenance || null,
			dcDoi: doc.dc?.doi || [],
			dcInstructionalMethod: doc.dc?.instructionalMethod || null,
			// Peer Review (in pure3d object, not dc)
			peerReviewKind: doc.pure3d?.peerReviewKind || null,
			peerReviewContent: doc.pure3d?.peerReviewContent || null,
			// Settings
			settingsAuthorToolName: doc.settings?.authorTool?.name || null,
			settingsAuthorToolVersion: doc.settings?.authorTool?.version || null,
			settingsSceneFile: doc.settings?.authorTool?.sceneFile || null
		});

		if (result) {
			idMaps.editions.set(doc._id, result.id);
			editionCount++;
			process.stdout.write(`\r   Progress: ${editionCount}/${editionsData.length}`);
		}
	}
	console.log(`\n   ✅ Imported ${editionCount} editions\n`);

	// Import ProjectUsers
	console.log('📦 Importing project-user relationships...');
	const projectUsersData = JSON.parse(readFileSync(join(JSON_DIR, 'projectUser.json'), 'utf-8'));
	let projectUserCount = 0;

	for (const doc of projectUsersData) {
		const pbCollectionId = idMaps.collections.get(doc.projectId);
		const pbUserId = idMaps.users.get(doc.user);

		if (!pbCollectionId) continue;

		const result = await insertRecord('projectUsers', {
			mongoId: doc._id,
			collection: pbCollectionId,
			user: pbUserId || null,
			userHash: doc.user, // Store hash as fallback
			role: doc.role
		});

		if (result) {
			projectUserCount++;
		}
	}
	console.log(`   ✅ Imported ${projectUserCount} project-user relationships\n`);

	// Import EditionUsers
	console.log('📦 Importing edition-user relationships...');
	const editionUsersData = JSON.parse(readFileSync(join(JSON_DIR, 'editionUser.json'), 'utf-8'));
	let editionUserCount = 0;

	for (const doc of editionUsersData) {
		const pbEditionId = idMaps.editions.get(doc.editionId);
		const pbUserId = idMaps.users.get(doc.user);

		if (!pbEditionId) continue;

		const result = await insertRecord('editionUsers', {
			mongoId: doc._id,
			edition: pbEditionId,
			user: pbUserId || null,
			userHash: doc.user,
			role: doc.role
		});

		if (result) {
			editionUserCount++;
		}
	}
	console.log(`   ✅ Imported ${editionUserCount} edition-user relationships\n`);

	// ============================================================
	// Summary
	// ============================================================
	console.log('='.repeat(60));
	console.log('✅ IMPORT COMPLETE!');
	console.log('='.repeat(60));
	console.log(`
Summary:
  - Site:              ${idMaps.site.size} record(s)
  - Users:             ${userCount}
  - Keywords:          ${keywordCount}
  - Collections:       ${collectionCount}
  - Editions:          ${editionCount}
  - Project-Users:     ${projectUserCount}
  - Edition-Users:     ${editionUserCount}
`);
}

main().catch((error) => {
	console.error('\n❌ Setup failed:', error);
	process.exit(1);
});
