#!/usr/bin/env bun
/**
 * Migration: Supporting Features (#11, #12, #14)
 *
 * 1. Creates `reviewFeedback` collection for granular reviewer feedback
 * 2. Updates `notifications` collection with 3 new notification types
 *
 * Idempotent — safe to re-run.
 *
 * Run: bun scripts/migrate-supporting-features.ts
 */

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:7090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@admin.local';
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || '1234567890';

let authToken = '';

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

// --- Step 1: Create reviewFeedback collection ---
async function createReviewFeedbackCollection() {
	console.log('--- Step 1: Create reviewFeedback collection ---');

	if (await collectionExists('reviewFeedback')) {
		console.log('  reviewFeedback already exists, skipping\n');
		return;
	}

	await apiRequest('/api/collections', 'POST', {
		name: 'reviewFeedback',
		type: 'base',
		fields: [
			{
				name: 'editionId',
				type: 'relation',
				required: true,
				maxSelect: 1,
				collectionId: 'editions',
				cascadeDelete: true
			},
			{
				name: 'reviewerId',
				type: 'relation',
				required: true,
				maxSelect: 1,
				collectionId: 'userProfiles',
				cascadeDelete: false
			},
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
		],
		indexes: [
			'CREATE INDEX idx_reviewfeedback_edition ON reviewFeedback (editionId)',
			'CREATE INDEX idx_reviewfeedback_reviewer ON reviewFeedback (reviewerId)',
			'CREATE INDEX idx_reviewfeedback_stage ON reviewFeedback (reviewStage)',
			'CREATE INDEX idx_reviewfeedback_resolved ON reviewFeedback (resolved)'
		],
		listRule: '',
		viewRule: '',
		createRule: '',
		updateRule: '',
		deleteRule: ''
	});

	console.log('  Created reviewFeedback collection\n');
}

// --- Step 2: Update notifications collection with new types ---
async function updateNotificationsCollection() {
	console.log('--- Step 2: Update notifications collection ---');

	const collection = await getCollection('notifications');
	const fields = collection.fields || [];

	const typeField = fields.find((f: any) => f.name === 'type');
	if (!typeField) {
		console.log('  ERROR: type field not found on notifications collection\n');
		return;
	}

	const newTypes = ['collaborator_added', 'collaborator_removed', 'feedback_received'];
	const existingValues: string[] = typeField.values || [];
	let added = 0;

	for (const t of newTypes) {
		if (!existingValues.includes(t)) {
			existingValues.push(t);
			added++;
		}
	}

	if (added === 0) {
		console.log('  Notification types already up to date, skipping\n');
		return;
	}

	typeField.values = existingValues;

	await apiRequest(`/api/collections/${collection.id}`, 'PATCH', { fields });
	console.log(`  Added ${added} new notification type(s): ${newTypes.join(', ')}\n`);
}

// --- Main ---
async function main() {
	console.log('Supporting Features Migration (#11, #12, #14)\n');
	console.log(`PocketBase URL: ${PB_URL}\n`);

	await authenticate();
	await createReviewFeedbackCollection();
	await updateNotificationsCollection();

	console.log('Migration complete!');
}

main().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});
