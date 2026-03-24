#!/usr/bin/env node

/**
 * Seed test users into PocketBase (auth + profile).
 * Creates one user per global role for testing.
 *
 * Run with: node scripts/seed-users.js
 */

import fs from 'fs';

const POCKETBASE_URL =
	process.env.POCKETBASE_URL || process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:7090';
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

	console.log('Seeding complete!');
	console.log('\nTest accounts:');
	console.log(`  All passwords: ${users[0].password}`);
	for (const user of users) {
		console.log(`  ${user.role.padEnd(16)} ${user.email}`);
	}
}

seedUsers();
