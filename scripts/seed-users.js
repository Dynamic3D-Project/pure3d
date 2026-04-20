#!/usr/bin/env node

/**
 * Seed test users into PocketBase (auth + profile).
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
			// 1. Create PocketBase auth record
			const authRes = await fetch(`${POCKETBASE_URL}/api/collections/users/records`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: user.email,
					password: user.password,
					passwordConfirm: user.password,
					emailVisibility: true
				})
			});

			let pbAuthId = '';

			if (authRes.ok) {
				const authData = await authRes.json();
				pbAuthId = authData.id;
				console.log(`  Auth record created: ${user.email} (${pbAuthId})`);
			} else {
				const err = await authRes.json();
				// If user already exists, try to find their ID
				if (err.data?.email?.code === 'validation_not_unique') {
					console.log(`  Auth record exists: ${user.email} (skipping auth creation)`);
					// Fetch existing auth record by email
					const listRes = await fetch(
						`${POCKETBASE_URL}/api/collections/users/records?filter=email='${user.email}'`
					);
					if (listRes.ok) {
						const listData = await listRes.json();
						if (listData.items?.length > 0) {
							pbAuthId = listData.items[0].id;
						}
					}
				} else {
					console.error(`  Failed auth for ${user.email}:`, JSON.stringify(err));
					continue;
				}
			}

			// 2. Check if userProfile already exists
			const profileCheckRes = await fetch(
				`${POCKETBASE_URL}/api/collections/userProfiles/records?filter=email='${user.email}'`
			);
			if (profileCheckRes.ok) {
				const profileCheckData = await profileCheckRes.json();
				if (profileCheckData.items?.length > 0) {
					console.log(`  Profile exists: ${user.email} (skipping)\n`);
					continue;
				}
			}

			// 3. Create userProfile record
			const profileRes = await fetch(
				`${POCKETBASE_URL}/api/collections/userProfiles/records`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						user: user.email,
						userHash: user.email,
						email: user.email,
						nickname: user.nickname,
						role: user.role,
						pbAuthId: pbAuthId
					})
				}
			);

			if (profileRes.ok) {
				console.log(`  Profile created: ${user.nickname} [${user.role}]\n`);
			} else {
				const err = await profileRes.json();
				console.error(`  Failed profile for ${user.email}:`, JSON.stringify(err));
			}
		} catch (err) {
			console.error(`  Error seeding ${user.email}:`, err.message);
		}
	}

	// 4. Create a test collection owned by the editor user
	await seedTestCollection();

	console.log('Seeding complete!');
	console.log('\nTest accounts:');
	console.log(`  All passwords: ${users[0].password}`);
	for (const user of users) {
		console.log(`  ${user.role.padEnd(16)} ${user.email}`);
	}
}

async function seedTestCollection() {
	const EDITOR_EMAIL = 'editor@pure3d.eu';
	const COLLECTION_TITLE = 'Editor Test Collection';

	console.log(`Creating test collection for ${EDITOR_EMAIL}...\n`);

	// Check if the test collection already exists
	const checkRes = await fetch(
		`${POCKETBASE_URL}/api/collections/collections/records?filter=title='${COLLECTION_TITLE}'`
	);
	if (checkRes.ok) {
		const checkData = await checkRes.json();
		if (checkData.items?.length > 0) {
			console.log(`  Collection "${COLLECTION_TITLE}" already exists (skipping)\n`);
			return;
		}
	}

	// Create the collection
	const collectionRes = await fetch(
		`${POCKETBASE_URL}/api/collections/collections/records`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: COLLECTION_TITLE,
				isVisible: true,
				dcTitle: COLLECTION_TITLE,
				dcAbstract: '<p>A test collection where the editor user is the owner, for testing edition creation.</p>',
				dcDescription: '<p>Use this collection to test creating and managing editions as a collection owner.</p>'
			})
		}
	);

	if (!collectionRes.ok) {
		const err = await collectionRes.json();
		console.error(`  Failed to create collection:`, JSON.stringify(err));
		return;
	}

	const collection = await collectionRes.json();
	console.log(`  Collection created: "${COLLECTION_TITLE}" (${collection.id})`);

	// Look up the editor's userProfile ID (collectionUsers.userId is a relation to userProfiles)
	const profileRes = await fetch(
		`${POCKETBASE_URL}/api/collections/userProfiles/records?filter=email='${EDITOR_EMAIL}'`
	);
	if (!profileRes.ok) {
		console.error(`  Could not fetch userProfile for ${EDITOR_EMAIL}`);
		return;
	}
	const profileData = await profileRes.json();
	const editorProfileId = profileData.items?.[0]?.id;
	if (!editorProfileId) {
		console.error(`  Could not find userProfile for ${EDITOR_EMAIL}`);
		return;
	}

	// Assign the editor as owner of this collection
	const collUserRes = await fetch(
		`${POCKETBASE_URL}/api/collections/collectionUsers/records`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				collection: collection.id,
				userId: editorProfileId,
				user: editorProfileId,
				role: 'owner'
			})
		}
	);

	if (collUserRes.ok) {
		console.log(`  Editor assigned as owner of "${COLLECTION_TITLE}"\n`);
	} else {
		const err = await collUserRes.json();
		console.error(`  Failed to assign editor as owner:`, JSON.stringify(err));
	}
}

seedUsers();
