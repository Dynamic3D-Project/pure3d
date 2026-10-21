#!/usr/bin/env bun
// Production: bun --env-file=.env scripts/migrate-open-calls.ts --apply
// Add --link-page only AFTER deploying the frontend and CMS hook support.
import PocketBase from 'pocketbase';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sanitizeHtml from 'sanitize-html';
import { ensureOpenCalls } from './open-calls-schema';

const args = process.argv.slice(2);
if (args.some((arg) => !['--apply', '--link-page'].includes(arg)))
	throw new Error(
		'Usage: bun --env-file=.env scripts/migrate-open-calls.ts [--apply] [--link-page]'
	);
const apply = args.includes('--apply');
const origin = 'https://main.57-129-98-223.sslip.io';
if (new URL(process.env.PROD_POCKETBASE_URL || '').origin !== origin)
	throw new Error('Production origin must match the approved OVH backend.');
const email = process.env.POCKETBASE_PRODUCTION_ADMIN_EMAIL;
const password = process.env.POCKETBASE_PRODUCTION_ADMIN_PASSWORD;
if (!email || !password) throw new Error('Production credentials required.');
const pb = new PocketBase(origin);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(email, password);
const page = await pb.collection('content').getFirstListItem('slug = "calls" && layout = "guide"');
const html: string = page.body;
const pattern =
	/<details\s+data-cms-expandable="true"><summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
const matches = [...html.matchAll(pattern)];
if (matches.length !== 2 || matches.some((match) => /<details\b/i.test(match[2])))
	throw new Error(
		'Expected the two existing thematic calls, without nested expandables. Review source.'
	);
const months: Record<string, string> = { November: '11', January: '01' };
const calls = matches.map((match, order) => {
	const title = sanitizeHtml(match[1], { allowedTags: [], allowedAttributes: {} })
		.replace(/&nbsp;/g, ' ')
		.trim();
	const deadlineMatch = match[2].match(
		/<p><strong>Deadline:\s*<\/strong>(\d{1,2}) (November|January) (\d{4})<\/p>/
	);
	if (!title || !deadlineMatch) throw new Error('Call title or deadline requires manual review.');
	const [, day, month, year] = deadlineMatch;
	const body = match[2].replace(/^<h2>[\s\S]*?<\/h2>/, '').replace(deadlineMatch[0], '');
	return {
		id: createHash('sha256').update(`${page.id}:${title}`).digest('hex').slice(0, 15),
		title,
		body,
		deadline: `${year}-${months[month]}-${day.padStart(2, '0')} 00:00:00.000Z`,
		isPublished: page.isPublished,
		order
	};
});
const existingCollections = await pb.collections.getFullList();
const existing = existingCollections.some((collection) => collection.name === 'open_calls')
	? await pb.collection('open_calls').getFullList()
	: [];
for (const call of calls) {
	const old = existing.find((record) => record.id === call.id);
	if (old && Object.entries(call).some(([key, value]) => old[key] !== value))
		throw new Error(`Previously migrated call has changed: ${call.title}. No overwrite permitted.`);
}
console.log(`Preflight: ${calls.length} thematic calls; ${existing.length} existing records.`);
if (!apply) process.exit(0);

// A fresh, downloaded and integrity-checked database backup is required before any schema writes.
const backupKey = `open-calls-before-${Date.now()}.zip`;
await pb.backups.create(backupKey);
const backup = (await pb.backups.getFullList()).find((entry) => entry.key === backupKey);
if (!backup || backup.size <= 0) throw new Error('Backup was not created.');
const response = await fetch(pb.backups.getDownloadURL(await pb.files.getToken(), backupKey));
if (!response.ok) throw new Error('Could not download backup for verification.');
const bytes = new Uint8Array(await response.arrayBuffer());
if (bytes.length !== backup.size) throw new Error('Backup download size mismatch.');
const directory = await mkdtemp(join(tmpdir(), 'pure3d-open-calls-'));
await chmod(directory, 0o700);
const backupPath = join(directory, backupKey);
await Bun.write(backupPath, bytes);
await chmod(backupPath, 0o600);
const integrity = Bun.spawnSync(['unzip', '-t', backupPath], { stdout: 'pipe', stderr: 'pipe' });
if (integrity.exitCode !== 0) throw new Error('Backup ZIP integrity verification failed.');
console.log(`Verified backup: ${backupKey}; private local copy: ${backupPath}`);
await ensureOpenCalls(pb);
for (const call of calls) {
	if (!existing.some((record) => record.id === call.id))
		await pb.collection('open_calls').create(call);
	const saved = await pb.collection('open_calls').getOne(call.id);
	if (Object.entries(call).some(([key, value]) => saved[key] !== value))
		throw new Error(`Record readback mismatch: ${call.title}`);
}
// Re-check schema and permissions from the API, rather than trusting the write response.
await ensureOpenCalls(pb);
const anonymous = new PocketBase(origin);
const visible = await anonymous.collection('open_calls').getFullList();
if (calls.some((call) => call.isPublished && !visible.some((record) => record.id === call.id)))
	throw new Error('Published calls are not publicly readable.');
const current = await pb.collection('content').getOne(page.id);
if (current.body !== html || current.updated !== page.updated)
	throw new Error('Source page changed during migration. Records retained; page not modified.');
if (args.includes('--link-page')) {
	const component = `<div data-cms-open-calls="true" data-open-call-ids="${calls.map((call) => call.id).join(',')}"></div>`;
	let first = true;
	const body = html.replace(pattern, () => {
		if (!first) return '';
		first = false;
		return component;
	});
	await pb.collection('content').update(page.id, { body });
	if ((await pb.collection('content').getOne(page.id)).body !== body)
		throw new Error('Linked page readback mismatch.');
	console.log('Source page now references live open call records.');
} else {
	console.log('Source page preserved until frontend and hooks are deployed.');
}
console.log(`Migrated and verified ${calls.length} open calls.`);
