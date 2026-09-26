#!/usr/bin/env bun
/* eslint-disable @typescript-eslint/no-explicit-any -- PocketBase schema metadata is dynamic. */
/**
 * Production-only, additive alignment for the reviewed Alpha/Final workflow.
 * It never edits records, files, identities, auth settings, or CMS definitions.
 * Read-only is the default; --apply needs --backup KEY created immediately before it.
 */
import PocketBase from 'pocketbase';
import { appendFile, writeFile } from 'node:fs/promises';
import schema from '../pocketbase/pb_schema/collections.json';
import { mergeSchemaFields } from './schema-fields';

const origin = 'https://main.57-129-98-223.sslip.io';
const names = [
	'editions',
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback',
	'notifications',
	'auditLog',
	'editionUsers'
] as const;
const rules = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'] as const;
type Collection = Record<string, any>;

function wanted(name: string, definition: Collection) {
	if (name === 'editions')
		return definition.fields.filter(
			(field: any) =>
				field.name === 'status' ||
				/^(proposal|alpha|final|publication|workflowDecision)/.test(field.name)
		);
	if (name === 'editionReviews')
		return definition.fields.filter((field: any) => field.name !== 'comment');
	if (name === 'reviewAssignments') return definition.fields;
	if (name === 'notifications')
		return definition.fields.filter((field: any) => field.name.startsWith('email'));
	if (name === 'auditLog')
		return definition.fields.filter((field: any) => field.name === 'targetType');
	return definition.fields;
}

function desiredIndexes(name: string, definition: Collection) {
	if (name === 'editionReviews' || name === 'reviewAssignments') return definition.indexes || [];
	if (name === 'reviewFeedback' || name === 'notifications' || name === 'auditLog')
		return definition.indexes || [];
	return [];
}

export function plan(collections: Collection[]) {
	const byName = new Map(collections.map((item) => [item.name, item]));
	const output: any[] = [];
	for (const name of names) {
		const current = byName.get(name);
		const definition = schema.find((item) => item.name === name);
		if (!current || !definition) throw new Error(`Required collection is unavailable: ${name}`);
		const desiredFields = wanted(name, definition).map((field: any) =>
			field.type === 'relation' && byName.get(field.collectionId)
				? { ...field, collectionId: byName.get(field.collectionId).id }
				: field
		);
		const fields = mergeSchemaFields(current.fields, desiredFields);
		const indexes = [
			...current.indexes.filter(
				(index: string) =>
					!desiredIndexes(name, definition).some(
						(wanted: string) =>
							index.match(/INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)/i)?.[1] ===
							wanted.match(/INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)/i)?.[1]
					)
			),
			...desiredIndexes(name, definition)
		];
		const changed =
			JSON.stringify(fields) !== JSON.stringify(current.fields) ||
			JSON.stringify(indexes) !== JSON.stringify(current.indexes);
		const changedRules = Object.fromEntries(
			rules
				.filter((key) => current[key] !== (definition as any)[key])
				.map((key) => [key, (definition as any)[key]])
		);
		output.push({ id: current.id, name, before: current, fields, indexes, changed, changedRules });
	}
	return output;
}

async function duplicateCheck(pb: PocketBase) {
	for (const name of ['reviewAssignments', 'editionReviews']) {
		const rows = await pb
			.collection(name)
			.getFullList({ fields: 'id,editionId,reviewerId,reviewStage,reviewRound' });
		const seen = new Set<string>();
		for (const row of rows) {
			const key = [row.editionId, row.reviewerId, row.reviewStage, row.reviewRound || 0].join('/');
			if (seen.has(key))
				throw new Error(`Duplicate ${name} round identity blocks index alignment.`);
			seen.add(key);
		}
	}
}

async function main() {
	const args = new Set(process.argv.slice(2));
	const apply = args.has('--apply');
	const backup = process.argv[process.argv.indexOf('--backup') + 1];
	const journal = process.argv[process.argv.indexOf('--journal') + 1];
	if (process.env.POCKETBASE_URL && process.env.POCKETBASE_URL !== origin)
		throw new Error('This migration is pinned to the production PocketBase origin.');
	if (apply && (!backup || !/^[a-z0-9-]+\.zip$/.test(backup)))
		throw new Error('--apply requires a lowercase verified --backup KEY.');
	if (apply && (!journal || !journal.startsWith('/private/')))
		throw new Error('--apply requires a new private --journal PATH.');
	const email = process.env.POCKETBASE_ADMIN_EMAIL;
	const password = process.env.POCKETBASE_ADMIN_PASSWORD;
	if (!email || !password)
		throw new Error('Production PocketBase administrator credentials are required.');
	const pb = new PocketBase(origin);
	pb.autoCancellation(false);
	await pb.collection('_superusers').authWithPassword(email, password);
	const changes = plan(await pb.collections.getFullList());
	await duplicateCheck(pb);
	const summary = changes.map(({ name, before, fields, indexes, changed, changedRules }) => ({
		name,
		addedFields: fields
			.filter((field: any) => !before.fields.some((current: any) => current.name === field.name))
			.map((field: any) => field.name),
		changed,
		indexes,
		changedRules: Object.keys(changedRules)
	}));
	if (!apply)
		return console.log(JSON.stringify({ mode: 'dry-run', origin, collections: summary }, null, 2));
	const verified = (await pb.backups.getFullList()).find(
		(item) => item.key === backup && item.size > 0
	);
	if (!verified) throw new Error('The supplied backup is absent or has no verified bytes.');
	if (Date.now() - Date.parse(verified.modified || verified.created || '') > 60 * 60 * 1000)
		throw new Error(
			'The supplied backup is older than one hour. Create and verify a fresh backup.'
		);
	await writeFile(
		journal,
		JSON.stringify(
			{ origin, backup, startedAt: new Date().toISOString(), phase: 'prepared', changes },
			null,
			2
		) + '\n',
		{ flag: 'wx', mode: 0o600 }
	);
	for (const change of changes)
		if (change.changed) {
			await pb.collections.update(change.id, { fields: change.fields, indexes: change.indexes });
			await appendFile(
				journal,
				JSON.stringify({ phase: 'schema', collection: change.name, status: 'acknowledged' }) + '\n'
			);
		}
	for (const change of changes)
		if (Object.keys(change.changedRules).length) {
			await pb.collections.update(change.id, change.changedRules);
			await appendFile(
				journal,
				JSON.stringify({ phase: 'rules', collection: change.name, status: 'acknowledged' }) + '\n'
			);
		}
	const after = plan(await pb.collections.getFullList());
	if (after.some((change) => change.changed || Object.keys(change.changedRules).length))
		throw new Error('Schema readback differs after alignment; do not deploy hooks.');
	await appendFile(
		journal,
		JSON.stringify({ phase: 'complete', completedAt: new Date().toISOString() }) + '\n'
	);
	console.log(JSON.stringify({ mode: 'applied', origin, backup, collections: summary }, null, 2));
}

if (import.meta.main) await main();
