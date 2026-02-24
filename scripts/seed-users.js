#!/usr/bin/env node

/**
 * Seed users into PocketBase
 * Run with: node scripts/seed-users.js
 */

const fs = require('fs');

const POCKETBASE_URL = process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
const users = JSON.parse(fs.readFileSync('./pocketbase/pb_schema/seed_users.json', 'utf8'));

async function seedUsers() {
	console.log(`🌱 Seeding users to ${POCKETBASE_URL}...\n`);

	for (const user of users) {
		try {
			const response = await fetch(`${POCKETBASE_URL}/api/collections/userProfiles/records`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(user)
			});

			if (response.ok) {
				const data = await response.json();
				console.log(`✅ Created user: ${user.email}`);
			} else {
				const error = await response.json();
				console.log(`❌ Failed to create ${user.email}: ${error.message}`);
			}
		} catch (err) {
			console.error(`❌ Error creating ${user.email}:`, err.message);
		}
	}

	console.log('\n✨ Seeding complete!');
}

seedUsers();
