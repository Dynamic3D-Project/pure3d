#!/usr/bin/env bun
/**
 * Migration: Add viewerHelp field to site collection
 *
 * This adds a rich text editor field to the site collection
 * for storing help content about how to use the 3D viewer.
 *
 * Run: bun scripts/add-viewer-help-field.ts
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
	console.log('✅ Authenticated\n');
}

async function getCollection(collectionName: string) {
	const response = await fetch(`${PB_URL}/api/collections/${collectionName}`, {
		headers: {
			Authorization: authToken
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to get collection: ${await response.text()}`);
	}

	return response.json();
}

async function updateCollection(collectionId: string, updateData: any) {
	const response = await fetch(`${PB_URL}/api/collections/${collectionId}`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			Authorization: authToken
		},
		body: JSON.stringify(updateData)
	});

	const text = await response.text();

	if (!response.ok) {
		console.error(`❌ Failed to update collection:`, text);
		return null;
	}

	return JSON.parse(text);
}

async function main() {
	console.log('🚀 Migration: Add viewerHelp field to site collection\n');
	console.log(`   PocketBase URL: ${PB_URL}\n`);

	await authenticate();

	// Get current site collection schema
	console.log('📦 Fetching current site collection schema...');
	const siteCollection = await getCollection('site');

	// Check existing fields
	const existingFields = siteCollection.fields || siteCollection.schema || [];
	const hasViewerHelp = existingFields.some((f: any) => f.name === 'viewerHelp');
	const hasViewerHelpVideoUrl = existingFields.some((f: any) => f.name === 'viewerHelpVideoUrl');

	if (hasViewerHelp && hasViewerHelpVideoUrl) {
		console.log('ℹ️  All fields already exist. Nothing to do.');
		return;
	}

	// Add the new fields to existing fields
	const updatedFields = [...existingFields];

	// Add viewerHelp if not exists
	if (!existingFields.some((f: any) => f.name === 'viewerHelp')) {
		updatedFields.push({
			name: 'viewerHelp',
			type: 'editor',
			required: false
		});
	}

	// Add viewerHelpVideoUrl if not exists
	if (!existingFields.some((f: any) => f.name === 'viewerHelpVideoUrl')) {
		updatedFields.push({
			name: 'viewerHelpVideoUrl',
			type: 'url',
			required: false
		});
	}

	console.log('📝 Adding viewerHelp field...');
	const result = await updateCollection('site', { fields: updatedFields });

	if (result) {
		console.log('✅ Migration complete!');
		console.log(
			'   Fields:',
			(result.fields || result.schema)?.map((f: any) => f.name).join(', ')
		);
		console.log('\n📌 Next steps:');
		console.log('   1. Go to PocketBase admin → site collection');
		console.log('   2. Edit the site record');
		console.log('   3. Add your 3D viewer help content in the viewerHelp field');
	}
}

main().catch(console.error);
