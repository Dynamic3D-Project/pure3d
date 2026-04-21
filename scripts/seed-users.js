#!/usr/bin/env node

/**
 * Seed test users into PocketBase.
 * Creates one user per global role for testing.
 *
 * Run with: node scripts/seed-users.js
 */

import fs from 'fs';

const POCKETBASE_URL =
	process.env.POCKETBASE_URL || process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
const users = JSON.parse(fs.readFileSync('./pocketbase/pb_schema/seed_users.json', 'utf8'));

async function seedUsers() {
	console.log(`Seeding users to ${POCKETBASE_URL}...\n`);

	for (const user of users) {
		try {
			const res = await fetch(`${POCKETBASE_URL}/api/collections/users/records`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: user.email,
					password: user.password,
					passwordConfirm: user.password,
					emailVisibility: true,
					nickname: user.nickname,
					role: user.role,
					userHash: user.email
				})
			});

			if (res.ok) {
				const data = await res.json();
				console.log(`  Created: ${user.nickname} [${user.role}] (${data.id})`);
			} else {
				const err = await res.json();
				if (err.data?.email?.code === 'validation_not_unique') {
					console.log(`  Exists: ${user.email} (skipping)`);
				} else {
					console.error(`  Failed ${user.email}:`, JSON.stringify(err));
				}
			}
		} catch (err) {
			console.error(`  Error seeding ${user.email}:`, err.message);
		}
	}

	await seedTestCollection();

	console.log('\nSeeding complete!');
	console.log('Test accounts:');
	console.log(`  All passwords: ${users[0].password}`);
	for (const user of users) {
		console.log(`  ${user.role.padEnd(16)} ${user.email}`);
	}
}

async function seedTestCollection() {
	const EDITOR_EMAIL = 'editor@pure3d.eu';
	const COLLECTION_TITLE = 'Editor Test Collection';

	console.log(`\nCreating test collection for ${EDITOR_EMAIL}...`);

	const checkRes = await fetch(
		`${POCKETBASE_URL}/api/collections/collections/records?filter=title='${COLLECTION_TITLE}'`
	);
	if (checkRes.ok) {
		const checkData = await checkRes.json();
		if (checkData.items?.length > 0) {
			console.log(`  Collection "${COLLECTION_TITLE}" already exists (skipping)`);
			return;
		}
	}

	const collectionRes = await fetch(`${POCKETBASE_URL}/api/collections/collections/records`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			title: COLLECTION_TITLE,
			isVisible: true,
			dcTitle: COLLECTION_TITLE,
			dcAbstract:
				'<p>A test collection where the editor user is the owner, for testing edition creation.</p>',
			dcDescription:
				'<p>Use this collection to test creating and managing editions as a collection owner.</p>'
		})
	});

	if (!collectionRes.ok) {
		const err = await collectionRes.json();
		console.error(`  Failed to create collection:`, JSON.stringify(err));
		return;
	}

	const collection = await collectionRes.json();
	console.log(`  Collection created: "${COLLECTION_TITLE}" (${collection.id})`);

	const userRes = await fetch(
		`${POCKETBASE_URL}/api/collections/users/records?filter=email='${EDITOR_EMAIL}'`
	);
	if (!userRes.ok) {
		console.error(`  Could not fetch user ${EDITOR_EMAIL}`);
		return;
	}
	const userData = await userRes.json();
	const editorId = userData.items?.[0]?.id;
	if (!editorId) {
		console.error(`  Could not find user ${EDITOR_EMAIL}`);
		return;
	}

	const collUserRes = await fetch(`${POCKETBASE_URL}/api/collections/collectionUsers/records`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			collection: collection.id,
			userId: editorId,
			user: editorId,
			role: 'owner'
		})
	});

	if (collUserRes.ok) {
		console.log(`  Editor assigned as owner of "${COLLECTION_TITLE}"`);
	} else {
		const err = await collUserRes.json();
		console.error(`  Failed to assign editor as owner:`, JSON.stringify(err));
	}
}

seedUsers();
