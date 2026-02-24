#!/usr/bin/env bun
/**
 * Creates all PocketBase collections via API.
 * Idempotent — safe to re-run on an existing database.
 *
 * Three-phase approach:
 *   1) Create base + auth collections (without relation fields)
 *   2) Add relation fields between collections
 *   3) Set open API rules (app-level RBAC handles authorization)
 *
 * Run by docker-compose pocketbase-setup service, or manually:
 *   bun scripts/create-pocketbase-collections.ts
 */
import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

const pb = new PocketBase(POCKETBASE_URL);

const openRules = {
	listRule: '',
	viewRule: '',
	createRule: '',
	updateRule: '',
	deleteRule: ''
};

async function collectionExists(name: string): Promise<string | null> {
	try {
		const coll = await pb.collections.getOne(name);
		return coll.id;
	} catch {
		return null;
	}
}

async function ensureCollection(name: string, payload: Record<string, unknown>): Promise<string> {
	const existingId = await collectionExists(name);
	if (existingId) {
		console.log(`   ${name}: already exists`);
		return existingId;
	}
	const result = await pb.collections.create(payload);
	console.log(`   ${name}: created (${result.id})`);
	return result.id;
}

async function main() {
	if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
		console.error('Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD');
		process.exit(1);
	}

	console.log('Creating PocketBase Collections');
	console.log(`   URL: ${POCKETBASE_URL}\n`);

	// Wait for PocketBase to be healthy
	console.log('Waiting for PocketBase...');
	for (let i = 0; i < 30; i++) {
		try {
			const res = await fetch(`${POCKETBASE_URL}/api/health`);
			if (res.ok) break;
		} catch {}
		await new Promise((r) => setTimeout(r, 2000));
	}

	// Authenticate as superuser
	console.log('Authenticating...');
	try {
		await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
		console.log('Authenticated successfully\n');
	} catch (error: any) {
		throw new Error(`Authentication failed. Check credentials in .env:\n${error.message}`);
	}

	const collectionIds: Record<string, string> = {};

	// ── Phase 1: Create collections ────────────────────────────────────
	console.log('Phase 1: Creating collections...\n');

	// users — PocketBase auth collection (login/register)
	collectionIds['users'] = await ensureCollection('users', {
		name: 'users',
		type: 'auth',
		fields: []
	});

	// userProfiles — app-level user data (roles, nicknames)
	collectionIds['userProfiles'] = await ensureCollection('userProfiles', {
		name: 'userProfiles',
		type: 'base',
		fields: [
			{ name: 'user', type: 'text', required: true },
			{ name: 'email', type: 'email', required: true },
			{ name: 'nickname', type: 'text', required: true },
			{
				name: 'role',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['superadmin', 'admin', 'editor', 'viewer']
			},
			{ name: 'pbAuthId', type: 'text', required: false }
		],
		indexes: [
			'CREATE UNIQUE INDEX idx_userprofiles_user ON userProfiles (user)',
			'CREATE INDEX idx_userprofiles_email ON userProfiles (email)'
		]
	});

	// site
	collectionIds['site'] = await ensureCollection('site', {
		name: 'site',
		type: 'base',
		fields: [
			{ name: 'name', type: 'text', required: true },
			{ name: 'blog', type: 'url', required: false },
			{ name: 'lastPublished', type: 'date', required: false },
			{ name: 'processing', type: 'bool', required: false },
			{ name: 'featured', type: 'json', required: false },
			{ name: 'publishedProjectCount', type: 'number', required: false },
			{ name: 'sweeperStartTm', type: 'date', required: false },
			{ name: 'dcDateCreated', type: 'date', required: false },
			{ name: 'dcDateModified', type: 'date', required: false }
		]
	});

	// keywords
	collectionIds['keywords'] = await ensureCollection('keywords', {
		name: 'keywords',
		type: 'base',
		fields: [
			{
				name: 'name',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['country', 'period', 'audience', 'subject', 'language', 'license', 'funder']
			},
			{ name: 'value', type: 'text', required: true }
		],
		indexes: [
			'CREATE UNIQUE INDEX idx_keywords_name_value ON keywords (name, value)',
			'CREATE INDEX idx_keywords_name ON keywords (name)'
		]
	});

	// collections
	collectionIds['collections'] = await ensureCollection('collections', {
		name: 'collections',
		type: 'base',
		fields: [
			{ name: 'title', type: 'text', required: true },
			{ name: 'isVisible', type: 'bool', required: false },
			{ name: 'lastPublished', type: 'date', required: false },
			{ name: 'pubNum', type: 'number', required: false },
			{ name: 'thumbnail', type: 'url', required: false },
			{ name: 'dcTitle', type: 'text', required: false },
			{ name: 'dcSubtitle', type: 'text', required: false },
			{ name: 'dcCreator', type: 'json', required: false },
			{ name: 'dcContributor', type: 'json', required: false },
			{ name: 'dcInstitution', type: 'json', required: false },
			{ name: 'dcAbstract', type: 'editor', required: false },
			{ name: 'dcDescription', type: 'editor', required: false },
			{ name: 'dcSubject', type: 'json', required: false },
			{ name: 'dcCoveragePeriod', type: 'text', required: false },
			{ name: 'dcCoveragePlace', type: 'text', required: false },
			{ name: 'dcLanguage', type: 'json', required: false },
			{ name: 'dcDateCreated', type: 'date', required: false },
			{ name: 'dcDateModified', type: 'date', required: false }
		],
		indexes: ['CREATE INDEX idx_collections_visible ON collections (isVisible)']
	});

	// editions
	collectionIds['editions'] = await ensureCollection('editions', {
		name: 'editions',
		type: 'base',
		fields: [
			{ name: 'title', type: 'text', required: true },
			{ name: 'isPublished', type: 'bool', required: false },
			{ name: 'pubNum', type: 'number', required: false },
			{ name: 'thumbnail', type: 'url', required: false },
			{
				name: 'status',
				type: 'select',
				required: false,
				maxSelect: 1,
				values: ['draft', 'in_review', 'published', 'archived']
			},
			{ name: 'dcTitle', type: 'text', required: false },
			{ name: 'dcSubtitle', type: 'text', required: false },
			{ name: 'dcCreator', type: 'json', required: false },
			{ name: 'dcContributor', type: 'json', required: false },
			{ name: 'dcInstitution', type: 'json', required: false },
			{ name: 'dcAbstract', type: 'editor', required: false },
			{ name: 'dcDescription', type: 'editor', required: false },
			{ name: 'dcContact', type: 'email', required: false },
			{ name: 'dcSubject', type: 'json', required: false },
			{ name: 'dcKeyword', type: 'json', required: false },
			{ name: 'dcAudience', type: 'json', required: false },
			{ name: 'dcFunder', type: 'json', required: false },
			{ name: 'dcSource', type: 'json', required: false },
			{ name: 'dcProvenance', type: 'editor', required: false },
			{ name: 'dcCoveragePeriod', type: 'json', required: false },
			{ name: 'dcCoveragePlace', type: 'text', required: false },
			{ name: 'dcCoverageCountry', type: 'json', required: false },
			{ name: 'dcCoverageTemporal', type: 'text', required: false },
			{ name: 'dcCoverageGeo', type: 'text', required: false },
			{ name: 'dcLanguage', type: 'json', required: false },
			{ name: 'dcRightsHolder', type: 'text', required: false },
			{ name: 'dcRightsLicense', type: 'text', required: false },
			{ name: 'dcDatePublished', type: 'date', required: false },
			{ name: 'dcDateUnPublished', type: 'date', required: false },
			{ name: 'dcDateCreated', type: 'date', required: false },
			{ name: 'dcDateModified', type: 'date', required: false },
			{ name: 'authorToolName', type: 'text', required: false },
			{ name: 'authorToolVersion', type: 'text', required: false },
			{ name: 'sceneFile', type: 'text', required: false }
		],
		indexes: ['CREATE INDEX idx_editions_published ON editions (isPublished)']
	});

	// collectionUsers — collection-level role assignments
	collectionIds['collectionUsers'] = await ensureCollection('collectionUsers', {
		name: 'collectionUsers',
		type: 'base',
		fields: [
			{ name: 'user', type: 'text', required: true },
			{
				name: 'role',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['owner', 'editor', 'viewer']
			}
		]
	});

	// editionUsers — edition-level role assignments
	collectionIds['editionUsers'] = await ensureCollection('editionUsers', {
		name: 'editionUsers',
		type: 'base',
		fields: [
			{ name: 'user', type: 'text', required: true },
			{
				name: 'role',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['author', 'collaborator', 'reviewer']
			}
		]
	});

	// auditLog — audit trail for admin actions
	collectionIds['auditLog'] = await ensureCollection('auditLog', {
		name: 'auditLog',
		type: 'base',
		fields: [
			{ name: 'action', type: 'text', required: true },
			{
				name: 'targetType',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['user', 'collection', 'edition']
			},
			{ name: 'targetId', type: 'text', required: true },
			{ name: 'performedBy', type: 'text', required: true },
			{ name: 'details', type: 'json', required: false }
		]
	});

	// ── Phase 2: Add relation fields ───────────────────────────────────
	console.log('\nPhase 2: Adding relation fields...\n');

	const relationFields = [
		{
			collection: 'collections',
			fieldName: 'siteId',
			targetCollection: 'site',
			cascadeDelete: false
		},
		{
			collection: 'editions',
			fieldName: 'collection',
			targetCollection: 'collections',
			cascadeDelete: true
		},
		{
			collection: 'collectionUsers',
			fieldName: 'collection',
			targetCollection: 'collections',
			cascadeDelete: true
		},
		{
			collection: 'collectionUsers',
			fieldName: 'userId',
			targetCollection: 'userProfiles',
			cascadeDelete: true
		},
		{
			collection: 'editionUsers',
			fieldName: 'editionId',
			targetCollection: 'editions',
			cascadeDelete: true
		},
		{
			collection: 'editionUsers',
			fieldName: 'userId',
			targetCollection: 'userProfiles',
			cascadeDelete: true
		}
	];

	for (const rel of relationFields) {
		try {
			const coll = await pb.collections.getOne(rel.collection);
			const fieldExists = coll.fields.some((f: any) => f.name === rel.fieldName);
			if (fieldExists) {
				console.log(`   ${rel.collection}.${rel.fieldName}: already exists`);
				continue;
			}

			coll.fields.push({
				name: rel.fieldName,
				type: 'relation',
				required: false,
				maxSelect: 1,
				collectionId: collectionIds[rel.targetCollection],
				cascadeDelete: rel.cascadeDelete
			});

			await pb.collections.update(coll.id, coll);
			console.log(`   ${rel.collection}.${rel.fieldName} -> ${rel.targetCollection}: added`);
		} catch (error: any) {
			console.error(`   ${rel.collection}.${rel.fieldName}: ${error.message}`);
		}
	}

	// ── Phase 3: Set open API rules ────────────────────────────────────
	console.log('\nPhase 3: Setting open API rules...\n');

	const allAppCollections = [
		'users',
		'userProfiles',
		'site',
		'keywords',
		'collections',
		'editions',
		'collectionUsers',
		'editionUsers',
		'auditLog'
	];

	for (const name of allAppCollections) {
		try {
			const coll = await pb.collections.getOne(name);
			await pb.collections.update(coll.id, openRules);
			console.log(`   ${name}: API rules set to open`);
		} catch (error: any) {
			console.error(`   ${name}: FAILED — ${error.message}`);
		}
	}

	// ── Summary ────────────────────────────────────────────────────────
	console.log('\n' + '='.repeat(60));
	console.log('All collections created successfully!');
	console.log('='.repeat(60));
	console.log('\nCollection IDs:');
	for (const [name, id] of Object.entries(collectionIds)) {
		console.log(`   ${name}: ${id}`);
	}
	console.log('\nNext step: Data will be imported automatically.\n');
}

main().catch((err) => {
	console.error('Setup failed:', err.message || err);
	process.exit(1);
});
