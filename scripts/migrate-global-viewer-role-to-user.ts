#!/usr/bin/env bun
import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.POCKETBASE_URL || process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || process.env.PB_ADMIN_EMAIL || 'admin@admin.local';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || process.env.PB_ADMIN_PASSWORD || '1234567890';

const pb = new PocketBase(POCKETBASE_URL);

function roleField(collection: any) {
	const fields = Array.isArray(collection.fields) ? collection.fields : collection.schema || [];
	const field = fields.find((f: any) => f?.name === 'role');
	if (!field) throw new Error('users.role field not found');
	return { fields, field };
}

async function setRoleValues(values: string[]) {
	const collection = await pb.collections.getOne('users');
	const { fields, field } = roleField(collection);
	field.values = values;
	if (field.options?.values) field.options.values = values;
	await pb.collections.update(collection.id, { fields });
}

async function main() {
	console.log(`Migrating global role value at ${POCKETBASE_URL}`);
	await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

	const existingUserDemo = await pb.collection('users').getFullList({ filter: 'email = "user@pure3d.eu"' });
	const viewerDemo = await pb.collection('users').getFullList({ filter: 'email = "viewer@pure3d.eu"' });
	if (viewerDemo.length > 0 && existingUserDemo.length === 0) {
		await pb.collection('users').update(viewerDemo[0].id, {
			email: 'user@pure3d.eu',
			nickname: 'User'
		});
		console.log('Renamed demo user email to user@pure3d.eu');
	} else if (viewerDemo.length > 0) {
		console.log('Skipped demo user email rename; user@pure3d.eu already exists');
	}

	const collection = await pb.collections.getOne('users');
	const { field } = roleField(collection);
	const currentValues = field.values || field.options?.values || [];
	const withUser = [...new Set([...currentValues, 'user'])];

	if (!withUser.includes('viewer')) {
		console.log('users.role already no longer accepts viewer');
	} else {
		await setRoleValues(withUser);
		const records = await pb.collection('users').getFullList({ filter: 'role = "viewer"' });
		for (const record of records) {
			await pb.collection('users').update(record.id, { role: 'user' });
		}
		await setRoleValues(withUser.filter((value) => value !== 'viewer'));
		console.log(`Updated ${records.length} user record(s)`);
	}

	const updated = await pb.collections.getOne('users');
	const { field: updatedField } = roleField(updated);
	console.log(`users.role values: ${(updatedField.values || updatedField.options?.values || []).join(', ')}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
