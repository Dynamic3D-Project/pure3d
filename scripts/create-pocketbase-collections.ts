#!/usr/bin/env bun
/**
 * Creates and upgrades the PocketBase schema required by the app.
 * Safe to re-run on an existing database.
 */
import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@admin.local';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || '1234567890';

const pb = new PocketBase(POCKETBASE_URL);

const openRules = {
	listRule: '',
	viewRule: '',
	createRule: '',
	updateRule: '',
	deleteRule: ''
};

const globalRoleValues = ['superadmin', 'admin', 'editorial_board', 'viewer'];
const collectionRoleValues = ['owner', 'editor', 'viewer'];
const editionRoleValues = ['author', 'collaborator', 'reviewer'];
const editionStatusValues = [
	'draft',
	'concept_submitted',
	'editorial_review',
	'concept_accepted',
	'concept_rejected',
	'alpha_review',
	'alpha_revisions',
	'alpha_accepted',
	'alpha_rejected',
	'final_review',
	'final_revisions',
	'published'
];
const notificationTypes = [
	'status_changed',
	'concept_submitted',
	'concept_accepted',
	'concept_rejected',
	'alpha_review_started',
	'alpha_revisions_requested',
	'alpha_accepted',
	'alpha_rejected',
	'final_review_started',
	'final_revisions_requested',
	'published',
	'reviewer_assigned',
	'reviewer_removed',
	'review_submitted',
	'user_added_to_edition',
	'collaborator_added',
	'collaborator_removed',
	'feedback_received'
];

type FieldDef = Record<string, unknown> & { name: string };
type CollectionType = 'base' | 'auth';
type CollectionDef = {
	name: string;
	type: CollectionType;
	fields: FieldDef[];
};

async function waitForPocketBase() {
	console.log(`Waiting for PocketBase at ${POCKETBASE_URL}...`);
	for (let attempt = 0; attempt < 30; attempt++) {
		try {
			const response = await fetch(`${POCKETBASE_URL}/api/health`);
			if (response.ok) {
				console.log('PocketBase is healthy\n');
				return;
			}
			console.log(`  attempt ${attempt + 1}: HTTP ${response.status}`);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`  attempt ${attempt + 1}: ${msg}`);
		}

		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	throw new Error('PocketBase did not become healthy in time');
}

async function authenticate() {
	console.log('Authenticating...');
	await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
	console.log('Authenticated successfully\n');
}

async function getCollection(name: string) {
	try {
		return await pb.collections.getOne(name);
	} catch {
		return null;
	}
}

function mergeFields(existingFields: Record<string, unknown>[], desiredFields: FieldDef[]) {
	const mergedFields = [...existingFields];

	for (const desiredField of desiredFields) {
		const existingIndex = mergedFields.findIndex(
			(field) => typeof field?.name === 'string' && field.name === desiredField.name
		);

		if (existingIndex === -1) {
			mergedFields.push(desiredField);
			continue;
		}

		mergedFields[existingIndex] = {
			...mergedFields[existingIndex],
			...desiredField
		};
	}

	return mergedFields;
}

async function ensureCollection(definition: CollectionDef) {
	const existing = await getCollection(definition.name);

	if (!existing) {
		const created = await pb.collections.create({
			name: definition.name,
			type: definition.type,
			fields: definition.fields
		});
		console.log(`   ${definition.name}: created`);
		return created.id;
	}

	const mergedFields = mergeFields(
		Array.isArray(existing.fields) ? existing.fields : [],
		definition.fields
	);

	await pb.collections.update(existing.id, {
		fields: mergedFields
	});

	console.log(`   ${definition.name}: ensured`);
	return existing.id;
}

function relationField(
	name: string,
	targetCollectionId: string,
	options: { required?: boolean; cascadeDelete?: boolean } = {}
): FieldDef {
	return {
		name,
		type: 'relation',
		required: options.required ?? false,
		maxSelect: 1,
		collectionId: targetCollectionId,
		cascadeDelete: options.cascadeDelete ?? false
	};
}

async function setOpenRules(name: string) {
	const collection = await pb.collections.getOne(name);
	await pb.collections.update(collection.id, openRules);
	console.log(`   ${name}: API rules set to open`);
}

async function main() {
	console.log('Creating PocketBase schema');
	console.log(`   URL: ${POCKETBASE_URL}`);
	console.log(`   Admin: ${ADMIN_EMAIL}\n`);

	await waitForPocketBase();
	await authenticate();

	const collectionIds: Record<string, string> = {};

	console.log('Phase 1: Creating base collections...\n');

	collectionIds['users'] = await ensureCollection({
		name: 'users',
		type: 'auth',
		fields: []
	});

	collectionIds['userProfiles'] = await ensureCollection({
		name: 'userProfiles',
		type: 'base',
		fields: [
			{ name: 'user', type: 'text', required: false },
			{ name: 'userHash', type: 'text', required: false },
			{ name: 'email', type: 'email', required: true },
			{ name: 'nickname', type: 'text', required: true },
			{
				name: 'role',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: globalRoleValues
			},
			{ name: 'pbAuthId', type: 'text', required: false }
		]
	});

	collectionIds['site'] = await ensureCollection({
		name: 'site',
		type: 'base',
		fields: [
			{ name: 'name', type: 'text', required: true },
			{ name: 'blog', type: 'url', required: false },
			{ name: 'lastPublished', type: 'text', required: false },
			{ name: 'processing', type: 'bool', required: false },
			{ name: 'featured', type: 'json', required: false },
			{ name: 'publishedProjectCount', type: 'number', required: false },
			{ name: 'sweeperStartTm', type: 'text', required: false },
			{ name: 'dcDateCreated', type: 'text', required: false },
			{ name: 'dcDateModified', type: 'text', required: false },
			{ name: 'viewerHelp', type: 'editor', required: false },
			{ name: 'viewerHelpVideoUrl', type: 'url', required: false }
		]
	});

	collectionIds['keywords'] = await ensureCollection({
		name: 'keywords',
		type: 'base',
		fields: [
			{ name: 'name', type: 'text', required: true },
			{ name: 'category', type: 'text', required: true },
			{ name: 'value', type: 'text', required: true }
		]
	});

	collectionIds['collections'] = await ensureCollection({
		name: 'collections',
		type: 'base',
		fields: [
			{ name: 'mongoId', type: 'text', required: false },
			{ name: 'title', type: 'text', required: true },
			{ name: 'isVisible', type: 'bool', required: false },
			{ name: 'lastPublished', type: 'text', required: false },
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
			{ name: 'dcDateCreated', type: 'text', required: false },
			{ name: 'dcDateModified', type: 'text', required: false }
		]
	});

	collectionIds['editions'] = await ensureCollection({
		name: 'editions',
		type: 'base',
		fields: [
			{ name: 'mongoId', type: 'text', required: false },
			{ name: 'title', type: 'text', required: true },
			{ name: 'isPublished', type: 'bool', required: false },
			{ name: 'pubNum', type: 'number', required: false },
			{ name: 'thumbnail', type: 'url', required: false },
			{
				name: 'status',
				type: 'select',
				required: false,
				maxSelect: 1,
				values: editionStatusValues
			},
			{ name: 'dcTitle', type: 'text', required: false },
			{ name: 'dcSubtitle', type: 'text', required: false },
			{ name: 'dcCreator', type: 'json', required: false },
			{ name: 'dcContributor', type: 'json', required: false },
			{ name: 'dcInstitution', type: 'json', required: false },
			{ name: 'dcAbstract', type: 'editor', required: false },
			{ name: 'dcDescription', type: 'editor', required: false },
			{ name: 'dcContact', type: 'text', required: false },
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
			{ name: 'dcDatePublished', type: 'text', required: false },
			{ name: 'dcDateUnPublished', type: 'text', required: false },
			{ name: 'dcDateCreated', type: 'text', required: false },
			{ name: 'dcDateModified', type: 'text', required: false },
			{ name: 'dcDoi', type: 'json', required: false },
			{ name: 'peerReviewKind', type: 'text', required: false },
			{ name: 'peerReviewContent', type: 'editor', required: false },
			{ name: 'peerReviewRequested', type: 'bool', required: false },
			{ name: 'reviewStage', type: 'number', required: false },
			{ name: 'peerReviewStamp', type: 'bool', required: false },
			{ name: 'publishedAt', type: 'text', required: false },
			{ name: 'authorToolName', type: 'text', required: false },
			{ name: 'authorToolVersion', type: 'text', required: false },
			{ name: 'sceneFile', type: 'text', required: false },
			{ name: 'settingsAuthorToolName', type: 'text', required: false },
			{ name: 'settingsAuthorToolVersion', type: 'text', required: false },
			{ name: 'settingsSceneFile', type: 'text', required: false }
		]
	});

	collectionIds['collectionUsers'] = await ensureCollection({
		name: 'collectionUsers',
		type: 'base',
		fields: [
			{ name: 'mongoId', type: 'text', required: false },
			{ name: 'userHash', type: 'text', required: false },
			{
				name: 'role',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: collectionRoleValues
			}
		]
	});

	collectionIds['editionUsers'] = await ensureCollection({
		name: 'editionUsers',
		type: 'base',
		fields: [
			{ name: 'mongoId', type: 'text', required: false },
			{ name: 'userHash', type: 'text', required: false },
			{
				name: 'role',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: editionRoleValues
			}
		]
	});

	collectionIds['auditLog'] = await ensureCollection({
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

	console.log('\nPhase 2: Adding relation fields...\n');

	await ensureCollection({
		name: 'collections',
		type: 'base',
		fields: [
			relationField('site', collectionIds['site']),
			relationField('siteId', collectionIds['site'])
		]
	});

	await ensureCollection({
		name: 'editions',
		type: 'base',
		fields: [
			relationField('collection', collectionIds['collections'], { cascadeDelete: true }),
			relationField('publishedBy', collectionIds['userProfiles'])
		]
	});

	await ensureCollection({
		name: 'collectionUsers',
		type: 'base',
		fields: [
			relationField('collection', collectionIds['collections'], { cascadeDelete: true }),
			relationField('user', collectionIds['userProfiles']),
			relationField('userId', collectionIds['userProfiles'])
		]
	});

	await ensureCollection({
		name: 'editionUsers',
		type: 'base',
		fields: [
			relationField('edition', collectionIds['editions'], { cascadeDelete: true }),
			relationField('editionId', collectionIds['editions'], { cascadeDelete: true }),
			relationField('user', collectionIds['userProfiles']),
			relationField('userId', collectionIds['userProfiles'])
		]
	});

	console.log('\nPhase 3: Creating workflow and notification collections...\n');

	collectionIds['editionReviews'] = await ensureCollection({
		name: 'editionReviews',
		type: 'base',
		fields: [
			relationField('editionId', collectionIds['editions'], { required: true, cascadeDelete: true }),
			relationField('reviewerId', collectionIds['userProfiles'], { required: true }),
			{ name: 'reviewStage', type: 'number', required: true },
			{
				name: 'decision',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['approve', 'reject', 'request_revisions']
			},
			{ name: 'comment', type: 'text', required: false }
		]
	});

	collectionIds['reviewAssignments'] = await ensureCollection({
		name: 'reviewAssignments',
		type: 'base',
		fields: [
			relationField('editionId', collectionIds['editions'], { required: true, cascadeDelete: true }),
			relationField('reviewerId', collectionIds['userProfiles'], { required: true }),
			relationField('assignedBy', collectionIds['userProfiles'], { required: true }),
			{ name: 'reviewStage', type: 'number', required: true },
			{
				name: 'status',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['pending', 'accepted', 'declined', 'completed']
			}
		]
	});

	collectionIds['reviewFeedback'] = await ensureCollection({
		name: 'reviewFeedback',
		type: 'base',
		fields: [
			relationField('editionId', collectionIds['editions'], { required: true, cascadeDelete: true }),
			relationField('reviewerId', collectionIds['userProfiles'], { required: true }),
			{ name: 'reviewStage', type: 'number', required: true },
			{
				name: 'category',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['general', 'annotation', 'article']
			},
			{ name: 'targetLabel', type: 'text', required: false },
			{ name: 'comment', type: 'text', required: true },
			{ name: 'resolved', type: 'bool', required: false }
		]
	});

	collectionIds['notifications'] = await ensureCollection({
		name: 'notifications',
		type: 'base',
		fields: [
			relationField('recipientId', collectionIds['userProfiles'], { required: true, cascadeDelete: true }),
			relationField('editionId', collectionIds['editions'], { cascadeDelete: true }),
			{
				name: 'type',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: notificationTypes
			},
			{ name: 'title', type: 'text', required: true },
			{ name: 'message', type: 'text', required: false },
			{ name: 'actionUrl', type: 'text', required: false },
			{ name: 'read', type: 'bool', required: false }
		]
	});

	console.log('\nPhase 4: Setting open API rules...\n');

	for (const name of [
		'users',
		'userProfiles',
		'site',
		'keywords',
		'collections',
		'editions',
		'collectionUsers',
		'editionUsers',
		'auditLog',
		'editionReviews',
		'reviewAssignments',
		'reviewFeedback',
		'notifications'
	]) {
		await setOpenRules(name);
	}

	console.log('\nSchema is ready.\n');
}

main().catch((error) => {
	console.error('Setup failed:', error.message || error);
	process.exit(1);
});
