#!/usr/bin/env bun
/**
 * Migration: Workflow Foundation Layer
 *
 * 1. Updates `editions` collection: new 12-value status enum + 5 new fields
 * 2. Creates `editionReviews` collection
 * 3. Creates `reviewAssignments` collection
 * 4. Creates `notifications` collection
 * 5. Migrates existing edition statuses to the new values
 *
 * Run: bun scripts/migrate-workflow-statuses.ts
 */

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@admin.local';
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || '1234567890';

let authToken = '';

// --- Status migration map (old → new) ---
const STATUS_MIGRATION_MAP: Record<string, string> = {
	submitted: 'concept_submitted',
	in_review: 'editorial_review',
	approved: 'concept_accepted',
	rejected: 'concept_rejected'
	// draft and published stay the same
};

async function authenticate() {
	const response = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			identity: ADMIN_EMAIL,
			password: ADMIN_PASSWORD
		})
	});

	if (!response.ok) {
		throw new Error(`Auth failed: ${await response.text()}`);
	}

	const data = await response.json();
	authToken = data.token;
	console.log('Authenticated as superuser\n');
}

async function apiRequest(path: string, method = 'GET', body?: unknown) {
	const response = await fetch(`${PB_URL}${path}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			Authorization: authToken
		},
		body: body ? JSON.stringify(body) : undefined
	});

	const text = await response.text();
	if (!response.ok) {
		throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
	}
	return text ? JSON.parse(text) : null;
}

async function getCollection(name: string) {
	return apiRequest(`/api/collections/${name}`);
}

async function collectionExists(name: string): Promise<boolean> {
	try {
		await getCollection(name);
		return true;
	} catch {
		return false;
	}
}

async function resolveCollectionId(name: string): Promise<string> {
	const collection = await getCollection(name);
	console.log(`  Resolved "${name}" → ${collection.id}`);
	return collection.id;
}

// --- Step 1: Update editions collection ---
async function updateEditionsCollection() {
	console.log('--- Step 1: Update editions collection ---');

	const collection = await getCollection('editions');
	const fields = collection.fields || [];

	// Resolve users collection ID for publishedBy relation
	const usersId = await resolveCollectionId('users');

	// Update status field values
	const statusField = fields.find((f: any) => f.name === 'status');
	if (statusField) {
		statusField.values = [
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
	}

	// Add new fields if they don't exist
	const newFields = [
		{ name: 'peerReviewRequested', type: 'bool', required: false },
		{ name: 'reviewStage', type: 'number', required: false },
		{ name: 'peerReviewStamp', type: 'bool', required: false },
		{ name: 'publishedAt', type: 'date', required: false },
		{
			name: 'publishedBy',
			type: 'relation',
			required: false,
			maxSelect: 1,
			collectionId: usersId,
			cascadeDelete: false
		}
	];

	for (const newField of newFields) {
		if (!fields.some((f: any) => f.name === newField.name)) {
			fields.push(newField);
		}
	}

	await apiRequest(`/api/collections/${collection.id}`, 'PATCH', { fields });
	console.log('  Updated editions collection with new status values and fields\n');
}

// --- Step 2: Create editionReviews collection ---
async function createEditionReviewsCollection() {
	console.log('--- Step 2: Create editionReviews collection ---');

	if (await collectionExists('editionReviews')) {
		console.log('  editionReviews already exists, skipping\n');
		return;
	}

	const editionsId = await resolveCollectionId('editions');
	const usersId = await resolveCollectionId('users');

	await apiRequest('/api/collections', 'POST', {
		name: 'editionReviews',
		type: 'base',
		fields: [
			{
				name: 'editionId',
				type: 'relation',
				required: true,
				maxSelect: 1,
				collectionId: editionsId,
				cascadeDelete: true
			},
			{
				name: 'reviewerId',
				type: 'relation',
				required: true,
				maxSelect: 1,
				collectionId: usersId,
				cascadeDelete: false
			},
			{ name: 'reviewStage', type: 'number', required: true },
			{
				name: 'decision',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['approve', 'reject', 'request_revisions']
			},
			{ name: 'comment', type: 'editor', required: false }
		],
		indexes: [
			'CREATE INDEX idx_editionreviews_edition ON editionReviews (editionId)',
			'CREATE INDEX idx_editionreviews_reviewer ON editionReviews (reviewerId)',
			'CREATE INDEX idx_editionreviews_stage ON editionReviews (reviewStage)'
		],
		listRule: '',
		viewRule: '',
		createRule: '',
		updateRule: '',
		deleteRule: ''
	});

	console.log('  Created editionReviews collection\n');
}

// --- Step 3: Create reviewAssignments collection ---
async function createReviewAssignmentsCollection() {
	console.log('--- Step 3: Create reviewAssignments collection ---');

	if (await collectionExists('reviewAssignments')) {
		console.log('  reviewAssignments already exists, skipping\n');
		return;
	}

	const editionsId = await resolveCollectionId('editions');
	const usersId = await resolveCollectionId('users');

	await apiRequest('/api/collections', 'POST', {
		name: 'reviewAssignments',
		type: 'base',
		fields: [
			{
				name: 'editionId',
				type: 'relation',
				required: true,
				maxSelect: 1,
				collectionId: editionsId,
				cascadeDelete: true
			},
			{
				name: 'reviewerId',
				type: 'relation',
				required: true,
				maxSelect: 1,
				collectionId: usersId,
				cascadeDelete: false
			},
			{ name: 'reviewStage', type: 'number', required: true },
			{
				name: 'assignedBy',
				type: 'relation',
				required: true,
				maxSelect: 1,
				collectionId: usersId,
				cascadeDelete: false
			},
			{
				name: 'status',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['pending', 'accepted', 'declined', 'completed']
			}
		],
		indexes: [
			'CREATE UNIQUE INDEX idx_reviewassignments_unique ON reviewAssignments (editionId, reviewerId, reviewStage)',
			'CREATE INDEX idx_reviewassignments_edition ON reviewAssignments (editionId)',
			'CREATE INDEX idx_reviewassignments_reviewer ON reviewAssignments (reviewerId)'
		],
		listRule: '',
		viewRule: '',
		createRule: '',
		updateRule: '',
		deleteRule: ''
	});

	console.log('  Created reviewAssignments collection\n');
}

// --- Step 4: Create notifications collection ---
async function createNotificationsCollection() {
	console.log('--- Step 4: Create notifications collection ---');

	if (await collectionExists('notifications')) {
		console.log('  notifications already exists, skipping\n');
		return;
	}

	const usersId = await resolveCollectionId('users');
	const editionsId = await resolveCollectionId('editions');

	await apiRequest('/api/collections', 'POST', {
		name: 'notifications',
		type: 'base',
		fields: [
			{
				name: 'recipientId',
				type: 'relation',
				required: true,
				maxSelect: 1,
				collectionId: usersId,
				cascadeDelete: true
			},
			{
				name: 'type',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: [
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
					'user_added_to_edition'
				]
			},
			{ name: 'title', type: 'text', required: true },
			{ name: 'message', type: 'text', required: false },
			{
				name: 'editionId',
				type: 'relation',
				required: false,
				maxSelect: 1,
				collectionId: editionsId,
				cascadeDelete: true
			},
			{ name: 'actionUrl', type: 'url', required: false },
			{ name: 'read', type: 'bool', required: false }
		],
		indexes: [
			'CREATE INDEX idx_notifications_recipient ON notifications (recipientId)',
			'CREATE INDEX idx_notifications_recipient_read ON notifications (recipientId, read)'
		],
		listRule: '',
		viewRule: '',
		createRule: '',
		updateRule: '',
		deleteRule: ''
	});

	console.log('  Created notifications collection\n');
}

// --- Step 5: Migrate existing edition statuses ---
async function migrateEditionStatuses() {
	console.log('--- Step 5: Migrate existing edition statuses ---');

	const result = await apiRequest('/api/collections/editions/records?perPage=500');
	const editions = result.items || [];

	let migrated = 0;
	for (const edition of editions) {
		const oldStatus = edition.status;
		const newStatus = STATUS_MIGRATION_MAP[oldStatus];

		if (newStatus) {
			await apiRequest(`/api/collections/editions/records/${edition.id}`, 'PATCH', {
				status: newStatus
			});
			console.log(`  ${edition.dcTitle || edition.title}: ${oldStatus} -> ${newStatus}`);
			migrated++;
		}
	}

	if (migrated === 0) {
		console.log('  No editions needed status migration');
	} else {
		console.log(`  Migrated ${migrated} edition(s)`);
	}
	console.log();
}

// --- Main ---
async function main() {
	console.log('Workflow Foundation Migration\n');
	console.log(`PocketBase URL: ${PB_URL}\n`);

	await authenticate();
	await updateEditionsCollection();
	await createEditionReviewsCollection();
	await createReviewAssignmentsCollection();
	await createNotificationsCollection();
	await migrateEditionStatuses();

	console.log('Migration complete!');
}

main().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});
