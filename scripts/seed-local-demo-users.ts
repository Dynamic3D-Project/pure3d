#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import PocketBase from 'pocketbase';

type DemoUser = {
	email: string;
	password: string;
	nickname: string;
	role: 'admin' | 'user';
};

const seedUsers = JSON.parse(
	readFileSync(new URL('../pocketbase/pb_schema/seed_users.json', import.meta.url), 'utf8')
) as DemoUser[];

export const demoUsers = seedUsers.filter(({ role }) => role === 'admin' || role === 'user');

export async function seedLocalDemoUsers(pb: PocketBase) {
	const usersCollection = await pb.collections.getOne('users');
	await pb.collections.update(usersCollection.id, {
		passwordAuth: { ...usersCollection.passwordAuth, enabled: true }
	});

	const users = pb.collection('users');
	const existingByEmail = new Map(
		(await users.getFullList()).map((record) => [record.email.toLowerCase(), record])
	);

	for (const user of demoUsers) {
		const data = {
			...user,
			passwordConfirm: user.password,
			emailVisibility: true,
			verified: true,
			userHash: user.email
		};
		const existing = existingByEmail.get(user.email.toLowerCase());
		if (existing) await users.update(existing.id, data);
		else await users.create(data);
	}
}

async function main() {
	const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://localhost:60021');
	await pb
		.collection('_superusers')
		.authWithPassword(
			process.env.POCKETBASE_ADMIN_EMAIL || 'admin@admin.local',
			process.env.POCKETBASE_ADMIN_PASSWORD || '1234567890'
		);
	await seedLocalDemoUsers(pb);
	console.log('Local Admin and User demo logins are ready.');
}

if (import.meta.main) {
	main().catch((error) => {
		console.error('Local demo user setup failed:', error.message || error);
		process.exit(1);
	});
}
