#!/usr/bin/env bun
/**
 * Installs the private sandbox fields, index, and access rules on an existing
 * PocketBase database. Deploy the matching pb_hooks first. This script writes
 * schema only; it never creates, transfers, or deletes editions.
 */
import PocketBase from 'pocketbase';
import schema from '../pocketbase/pb_schema/collections.json';

const production = process.argv.includes('--production');
const productionOrigin = 'https://main.57-129-98-223.sslip.io';
const url = production
	? process.env.PROD_POCKETBASE_URL
	: process.env.POCKETBASE_URL || 'http://127.0.0.1:60021';
const email = production
	? process.env.POCKETBASE_PRODUCTION_ADMIN_EMAIL
	: process.env.POCKETBASE_ADMIN_EMAIL;
const password = production
	? process.env.POCKETBASE_PRODUCTION_ADMIN_PASSWORD
	: process.env.POCKETBASE_ADMIN_PASSWORD;

if (!url || !email || !password)
	throw new Error(
		production
			? 'Set PROD_POCKETBASE_URL and POCKETBASE_PRODUCTION_ADMIN_EMAIL/PASSWORD.'
			: 'Set POCKETBASE_URL and POCKETBASE_ADMIN_EMAIL/PASSWORD before migrating.'
	);
if (production && new URL(url).origin !== productionOrigin)
	throw new Error(`Production PocketBase origin must be ${productionOrigin}.`);

const desired = schema.find((collection) => collection.name === 'editions');
if (!desired) throw new Error('Editions schema is missing.');

const pb = new PocketBase(url);
await pb.collection('_superusers').authWithPassword(email, password);
const [editions, users] = await Promise.all([
	pb.collections.getOne('editions'),
	pb.collections.getOne('users')
]);
const fields = [...editions.fields] as Array<
	Record<string, unknown> & { name: string; type: string }
>;
for (const definition of desired.fields.filter((field) =>
	['isSandbox', 'sandboxOwner'].includes(field.name)
)) {
	const field = { ...definition } as Record<string, unknown> & { name: string; type: string };
	if (field.name === 'sandboxOwner') field.collectionId = users.id;
	const index = fields.findIndex((existing) => existing.name === field.name);
	if (index < 0) fields.push(field);
	else if (fields[index].type !== field.type)
		throw new Error(`Existing ${field.name} field has an incompatible type.`);
	else fields[index] = { ...fields[index], ...field };
}
const wantedIndexes = (desired.indexes || []).filter((index) =>
	/idx_editions_sandbox_owner/.test(index)
);
const indexes = [
	...(editions.indexes || []).filter((index) => !/idx_editions_sandbox_owner/.test(index)),
	...wantedIndexes
];
await pb.collections.update(editions.id, {
	fields: fields as typeof editions.fields,
	indexes,
	listRule: desired.listRule,
	viewRule: desired.viewRule
});
console.log(
	'Private sandbox schema installed. Verify the hooks and access rules before enabling it.'
);
