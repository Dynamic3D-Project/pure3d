#!/usr/bin/env bun
/**
 * Migration: Set API rules on PocketBase collections + create auditLog collection.
 *
 * Sets all CRUD rules to "" (unrestricted) on admin-managed collections.
 * App-level RBAC handles authorization; PocketBase acts as the data store.
 * Public pages already filter by isVisible/isPublished in their queries.
 */
import PocketBase from 'pocketbase';

const PB_URL = process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:7090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@admin.local';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || '1234567890';

const pb = new PocketBase(PB_URL);

async function main() {
	console.log(`Connecting to PocketBase at ${PB_URL}...`);

	// Authenticate as superuser
	await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
	console.log('Authenticated as superuser.');

	const openRules = {
		listRule: '',
		viewRule: '',
		createRule: '',
		updateRule: '',
		deleteRule: ''
	};

	// Update existing collections
	const collectionsToUpdate = [
		'users',
		'collections',
		'editions',
		'collectionUsers',
		'editionUsers'
	];

	for (const name of collectionsToUpdate) {
		try {
			const coll = await pb.collections.getOne(name);
			await pb.collections.update(coll.id, openRules);
			console.log(`  ${name}: API rules updated`);
		} catch (error: any) {
			console.error(`  ${name}: FAILED - ${error.message}`);
		}
	}

	// Create or update auditLog collection
	let auditLogExists = false;
	try {
		await pb.collections.getOne('auditLog');
		auditLogExists = true;
	} catch {
		// doesn't exist
	}

	if (auditLogExists) {
		try {
			const coll = await pb.collections.getOne('auditLog');
			await pb.collections.update(coll.id, openRules);
			console.log('  auditLog: already exists, API rules updated');
		} catch (err: any) {
			console.error('  auditLog update failed:', err.message);
		}
	} else {
		try {
			await pb.collections.create({
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
				],
				...openRules
			});
			console.log('  auditLog: created with API rules');
		} catch (err: any) {
			console.error('  auditLog creation failed:', err.message);
			if (err.response?.data)
				console.error('  Details:', JSON.stringify(err.response.data, null, 2));
		}
	}

	console.log('\nDone. All collections now have open API rules.');
}

main().catch((err) => {
	console.error('Migration failed:', err.message);
	process.exit(1);
});
