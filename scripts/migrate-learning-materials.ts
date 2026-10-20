#!/usr/bin/env bun
import PocketBase from 'pocketbase';
import { learningMaterialFields } from './cms-schema';

const seedSlugs = [
	'voyager-video-tutorials',
	'voyager-tutorial-on-25-northumberland-road',
	'3d-model-faq-troubleshooting',
	'platform-guide',
	'tutorials'
];
const production = process.argv.includes('--production');
const url = production
	? process.env.PROD_POCKETBASE_URL || ''
	: process.env.POCKETBASE_URL || 'http://127.0.0.1:60021';
const email = production
	? process.env.POCKETBASE_PRODUCTION_ADMIN_EMAIL
	: process.env.POCKETBASE_ADMIN_EMAIL;
const password = production
	? process.env.POCKETBASE_PRODUCTION_ADMIN_PASSWORD
	: process.env.POCKETBASE_ADMIN_PASSWORD;

const origin = new URL(url).origin;
if (production
	? origin !== 'https://main.57-129-98-223.sslip.io'
	: !['http://127.0.0.1:60021', 'http://localhost:60021'].includes(origin))
	throw new Error('PocketBase origin is not approved for this migration.');

if (process.argv.slice(2).join(' ') !== (production ? '--apply --production' : '--apply'))
	throw new Error('Usage: bun scripts/migrate-learning-materials.ts --apply [--production]');
if (!email || !password)
	throw new Error('Required environment-specific admin credentials are missing.');

const pb = new PocketBase(origin);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(email, password);

const before = await pb.collections.getOne('content');
if (before.fields.some((field) => learningMaterialFields.some((next) => next.name === field.name)))
	throw new Error('Learning materials schema already exists; no changes were made.');

const records = await pb.collection('content').getFullList({
	filter: seedSlugs.map((slug) => pb.filter('slug = {:slug}', { slug })).join(' || '),
});
const bySlug = new Map(records.map((record) => [record.slug, record]));
const missing = seedSlugs.filter((slug) => !bySlug.has(slug));
if (missing.length) throw new Error(`Required seed content is missing: ${missing.join(', ')}`);
if (records.length !== seedSlugs.length)
	throw new Error('One or more seed slugs match multiple content records; no changes were made.');
if (records.some((record) => record.kind !== 'page'))
	throw new Error('Seed content must consist of CMS pages.');

if (production) {
	const backupKey = `materials-before-${Date.now()}.zip`;
	await pb.backups.create(backupKey);
	const backup = (await pb.backups.getFullList()).find((entry) => entry.key === backupKey);
	if (!backup || backup.size <= 0) throw new Error('Fresh production backup verification failed.');
	console.log(`Verified production backup: ${backup.key} (${backup.size} bytes).`);
}

await pb.collections.update(before.id, {
	fields: [...before.fields, ...learningMaterialFields]
});
for (const [learningMaterialOrder, slug] of seedSlugs.entries())
	await pb.collection('content').update(bySlug.get(slug)!.id, {
		learningMaterial: true,
		learningMaterialOrder
	});

const schema = await pb.collections.getOne('content');
for (const field of learningMaterialFields)
	if (!schema.fields.some((actual) => actual.name === field.name && actual.type === field.type))
		throw new Error(`Schema read-back failed: ${field.name}`);
for (const [index, slug] of seedSlugs.entries()) {
	const original = bySlug.get(slug)!;
	const actual = await pb.collection('content').getOne(original.id);
	if (!actual.learningMaterial || actual.learningMaterialOrder !== index)
		throw new Error(`Card read-back failed: ${slug}`);
	for (const key of ['title', 'slug', 'body', 'summary', 'isPublished', 'layout', 'parent', 'order'])
		if (actual[key] !== original[key]) throw new Error(`Unexpected content change: ${slug}/${key}`);
}

console.log(`Learning materials schema installed and ${seedSlugs.length} cards seeded.`);
