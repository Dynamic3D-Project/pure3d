#!/usr/bin/env bun
/**
 * Creates and upgrades the PocketBase schema required by the app.
 * Safe to re-run on an existing database.
 */
import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
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

const globalRoleValues = ['admin', 'editorial_board', 'user'];
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
const feedbackCategories = [
	'bug',
	'confusing',
	'upload_issue',
	'viewer_issue',
	'metadata_workflow',
	'missing_feature',
	'other'
];
const feedbackSeverities = ['minor', 'important', 'blocking', 'suggestion'];
const feedbackStatuses = ['draft', 'submitted', 'reviewed', 'resolved'];

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
	try {
		await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
		console.log('Authenticated successfully\n');
	} catch (err: any) {
		console.error('Auth error:');
		console.error('  url:      ', pb.baseUrl);
		console.error('  email:    ', ADMIN_EMAIL);
		console.error('  status:   ', err?.status);
		console.error('  message:  ', err?.message);
		console.error('  response: ', JSON.stringify(err?.response ?? err?.data ?? err, null, 2));
		throw err;
	}
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

/**
 * Detect relation fields whose target collection changed. PB rejects this
 * in a single update with "validation_field_relation_change", so we have to
 * drop and re-add across two separate update calls.
 */
function findRelationRetargets(
	existingFields: Record<string, unknown>[],
	desiredFields: FieldDef[]
): string[] {
	const names: string[] = [];
	for (const desired of desiredFields) {
		const existing = existingFields.find((f) => f?.name === desired.name);
		if (!existing) continue;
		if (
			desired.type === 'relation' &&
			existing.type === 'relation' &&
			typeof desired.collectionId === 'string' &&
			typeof existing.collectionId === 'string' &&
			desired.collectionId !== existing.collectionId
		) {
			names.push(desired.name);
		}
	}
	return names;
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

	const existingFieldsArr = Array.isArray(existing.fields) ? existing.fields : [];

	// Handle relation-target retargets with a pre-update that drops those
	// fields, so the main update can add them fresh pointing at the new
	// target. PB refuses to change a relation's collectionId in place.
	const retargets = findRelationRetargets(existingFieldsArr, definition.fields);
	let workingFields = existingFieldsArr;
	if (retargets.length > 0) {
		console.log(`   ${definition.name}: retargeting relation(s): ${retargets.join(', ')}`);
		workingFields = existingFieldsArr.filter(
			(f) => typeof f?.name !== 'string' || !retargets.includes(f.name as string)
		);
		try {
			await pb.collections.update(existing.id, { fields: workingFields });
		} catch (err: any) {
			console.error(`   ${definition.name}: retarget-drop failed`);
			console.error('     status: ', err?.status);
			console.error('     message:', err?.message);
			console.error('     response:', JSON.stringify(err?.response ?? err?.data ?? err, null, 2));
			throw err;
		}
	}

	const mergedFields = mergeFields(workingFields, definition.fields);

	try {
		await pb.collections.update(existing.id, {
			fields: mergedFields
		});
	} catch (err: any) {
		console.error(`   ${definition.name}: update failed`);
		console.error('     status: ', err?.status);
		console.error('     message:', err?.message);
		console.error('     response:', JSON.stringify(err?.response ?? err?.data ?? err, null, 2));
		throw err;
	}

	console.log(`   ${definition.name}: ensured`);
	return existing.id;
}

async function renameCollectionIfNeeded(from: string, to: string) {
	const existing = await getCollection(to);
	if (existing) return existing.id;

	const legacy = await getCollection(from);
	if (!legacy) return null;

	await pb.collections.update(legacy.id, { name: to });
	console.log(`   ${from}: renamed to ${to}`);
	return legacy.id;
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

async function dropLegacyUserProfiles() {
	try {
		const existing = await pb.collections.getOne('userProfiles');
		await pb.collections.delete(existing.id);
		console.log('   dropped legacy userProfiles collection\n');
	} catch {
		// collection already absent — nothing to do
	}
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
		fields: [
			{ name: 'nickname', type: 'text', required: false },
			{
				name: 'role',
				type: 'select',
				required: false,
				maxSelect: 1,
				values: globalRoleValues
			},
			{ name: 'userHash', type: 'text', required: false }
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
			{ name: 'dcDateModified', type: 'text', required: false },
			{
				name: 'coverImage',
				type: 'file',
				required: false,
				maxSelect: 1,
				maxSize: 20 * 1024 * 1024,
				mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
				thumbs: ['400x300', '100x100']
			}
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
			{ name: 'settingsSceneFile', type: 'text', required: false },
			{
				name: 'coverImage',
				type: 'file',
				required: false,
				maxSelect: 1,
				maxSize: 20 * 1024 * 1024,
				mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
				thumbs: ['400x300', '100x100']
			},
			{
				name: 'modelFile',
				type: 'file',
				required: false,
				maxSelect: 1,
				maxSize: 500 * 1024 * 1024,
				mimeTypes: []
			},
			{
				name: 'modelAssets',
				type: 'file',
				required: false,
				maxSelect: 200,
				maxSize: 500 * 1024 * 1024,
				mimeTypes: []
			},
			{
				name: 'sceneDocument',
				type: 'file',
				required: false,
				maxSelect: 1,
				maxSize: 0,
				mimeTypes: []
			}
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
			relationField('publishedBy', collectionIds['users'])
		]
	});

	await ensureCollection({
		name: 'collectionUsers',
		type: 'base',
		fields: [
			relationField('collection', collectionIds['collections'], { cascadeDelete: true }),
			relationField('user', collectionIds['users']),
			relationField('userId', collectionIds['users'])
		]
	});

	await ensureCollection({
		name: 'editionUsers',
		type: 'base',
		fields: [
			relationField('edition', collectionIds['editions'], { cascadeDelete: true }),
			relationField('editionId', collectionIds['editions'], { cascadeDelete: true }),
			relationField('user', collectionIds['users']),
			relationField('userId', collectionIds['users'])
		]
	});

	console.log('\nPhase 3: Creating workflow and notification collections...\n');

	collectionIds['editionReviews'] = await ensureCollection({
		name: 'editionReviews',
		type: 'base',
		fields: [
			relationField('editionId', collectionIds['editions'], { required: true, cascadeDelete: true }),
			relationField('reviewerId', collectionIds['users'], { required: true }),
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
			relationField('reviewerId', collectionIds['users'], { required: true }),
			relationField('assignedBy', collectionIds['users'], { required: true }),
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
			relationField('reviewerId', collectionIds['users'], { required: true }),
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
			relationField('recipientId', collectionIds['users'], { required: true, cascadeDelete: true }),
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

	await renameCollectionIfNeeded('workshopFeedback', 'feedback');
	collectionIds['feedback'] = await ensureCollection({
		name: 'feedback',
		type: 'base',
		fields: [
			{ name: 'participantName', type: 'text', required: false },
			{ name: 'participantEmail', type: 'email', required: false },
			relationField('edition', collectionIds['editions'], { cascadeDelete: false }),
			{ name: 'editionUrl', type: 'text', required: false },
			{
				name: 'category',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: feedbackCategories
			},
			{
				name: 'severity',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: feedbackSeverities
			},
			{ name: 'feedbackHtml', type: 'editor', required: false },
			{
				name: 'images',
				type: 'file',
				required: false,
				maxSelect: 20,
				maxSize: 20 * 1024 * 1024,
				mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
				thumbs: ['400x300']
			},
			{ name: 'pageUrl', type: 'text', required: false },
			{ name: 'browserInfo', type: 'json', required: false },
			{
				name: 'status',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: feedbackStatuses
			},
			relationField('createdBy', collectionIds['users'])
		]
	});

	console.log('\nPhase 4: Dropping legacy userProfiles (if present)...\n');
	await dropLegacyUserProfiles();

	console.log('\nPhase 5: Setting open API rules...\n');

	for (const name of [
		'users',
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
		'notifications',
		'feedback'
	]) {
		await setOpenRules(name);
	}

	// Configure S3-compatible storage only when all four R2_* env vars are present.
	// Per-field `maxSize` on file fields gates upload sizes (PocketBase v0.22+
	// removed the global body-limit setting).
	const r2Endpoint = process.env.R2_ENDPOINT;
	const r2Bucket = process.env.R2_BUCKET;
	const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
	const r2Secret = process.env.R2_SECRET_ACCESS_KEY;

	if (r2Endpoint && r2Bucket && r2AccessKey && r2Secret) {
		console.log('📦 Configuring S3-compatible storage');
		try {
			await pb.settings.update({
				s3: {
					enabled: true,
					bucket: r2Bucket,
					region: 'auto',
					endpoint: r2Endpoint,
					accessKey: r2AccessKey,
					secret: r2Secret,
					forcePathStyle: true
				}
			});
		} catch (err) {
			console.warn('⚠️  Could not apply S3 settings:', err);
		}
	} else {
		console.log('📁 Using local-disk storage (R2 env vars not set)');
	}

	console.log('\nSchema is ready.\n');
}

main().catch((error) => {
	console.error('Setup failed:', error.message || error);
	process.exit(1);
});
