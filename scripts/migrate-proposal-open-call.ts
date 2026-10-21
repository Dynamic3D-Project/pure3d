#!/usr/bin/env bun
import PocketBase from 'pocketbase';
import { isDeepStrictEqual } from 'node:util';
import { ensureProposalOpenCall } from './open-calls-schema';
import { verifiedProductionBackup } from './production-backup';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--apply'))
	throw new Error('Usage: bun --env-file=.env scripts/migrate-proposal-open-call.ts [--apply]');
const origin = 'https://main.57-129-98-223.sslip.io';
if (new URL(process.env.PROD_POCKETBASE_URL || '').origin !== origin)
	throw new Error('Production origin must match the approved OVH backend.');
const email = process.env.POCKETBASE_PRODUCTION_ADMIN_EMAIL;
const password = process.env.POCKETBASE_PRODUCTION_ADMIN_PASSWORD;
if (!email || !password) throw new Error('Production credentials required.');
const pb = new PocketBase(origin);
await pb.collection('_superusers').authWithPassword(email, password);
const before = await pb.collections.getOne('editions');
const count = (await pb.collection('editions').getList(1, 1, { fields: 'id' })).totalItems;
await pb.collections.getOne('open_calls');
console.log(
	`Preflight: ${count} editions; optional proposalOpenCall relation ${before.fields.some((field) => field.name === 'proposalOpenCall') ? 'already exists' : 'will be added'}.`
);
if (!args.includes('--apply')) process.exit(0);
await verifiedProductionBackup(pb, 'proposal-open-call-before');
await ensureProposalOpenCall(pb);
const after = await pb.collections.getOne('editions');
const field = after.fields.find((candidate) => candidate.name === 'proposalOpenCall');
const calls = await pb.collections.getOne('open_calls');
if (
	!field ||
	field.type !== 'relation' ||
	field.collectionId !== calls.id ||
	field.maxSelect !== 1 ||
	field.required ||
	field.cascadeDelete
)
	throw new Error('Proposal relation schema readback failed.');
for (const original of before.fields) {
	const saved = after.fields.find((candidate) => candidate.id === original.id);
	if (!isDeepStrictEqual(saved, original))
		throw new Error(
			`Unrelated edition field changed: ${original.name}. Investigate before continuing.`
		);
}
for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'] as const)
	if (before[rule] !== after[rule]) throw new Error(`Edition permission changed: ${rule}`);
if ((await pb.collection('editions').getList(1, 1, { fields: 'id' })).totalItems !== count)
	throw new Error('Edition count changed during migration. Investigate before continuing.');
console.log(
	'Optional proposalOpenCall relation verified; existing fields, permissions and record count preserved.'
);
