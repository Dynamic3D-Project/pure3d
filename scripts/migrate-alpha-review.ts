#!/usr/bin/env bun
import PocketBase from 'pocketbase';
import schema from '../pocketbase/pb_schema/collections.json';

export async function migrateAlphaReview(pb: PocketBase) {
	const names = [
		'editions',
		'editionReviews',
		'reviewAssignments',
		'reviewFeedback',
		'editionUsers',
		'notifications'
	];
	// Install fields first: rules and unique indexes depend on reviewRound.
	for (const name of names) {
		const current = await pb.collections.getOne(name);
		const desired = schema.find((collection) => collection.name === name)!;
		const additions = desired.fields.filter((field) =>
			name === 'editions'
				? /^(alpha|final|publication|workflowDecision|status$)/.test(field.name)
				: name === 'editionReviews'
					? !['editionId', 'reviewerId', 'comment', 'created', 'updated'].includes(field.name)
					: name === 'reviewAssignments'
						? ['reviewRound', 'editionTitle', 'dueAt', 'replacementReason'].includes(field.name)
						: name === 'notifications' && field.name.startsWith('email')
		);
		const fields = current.fields.map((field: { name: string }) => ({
			...field,
			...additions.find((item) => item.name === field.name)
		}));
		for (const field of additions)
			if (!fields.some((item: { name: string }) => item.name === field.name)) fields.push(field);
		const indexes = current.indexes.filter(
			(index: string) => !/idx_editionReviews_identity|idx_reviewassignments_unique/.test(index)
		);
		indexes.push(
			...(desired.indexes || []).filter((index) =>
				/idx_editionReviews_identity|idx_reviewassignments_unique/.test(index)
			)
		);
		await pb.collections.update(current.id, { fields, indexes });
	}
	for (const name of names) {
		const desired = schema.find((collection) => collection.name === name)!;
		await pb.collections.update(name, {
			listRule: desired.listRule,
			viewRule: desired.viewRule,
			createRule: desired.createRule,
			updateRule: desired.updateRule,
			deleteRule: desired.deleteRule
		});
	}
}

if (import.meta.main) {
	const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://127.0.0.1:60021');
	if (!process.env.POCKETBASE_ADMIN_EMAIL || !process.env.POCKETBASE_ADMIN_PASSWORD)
		throw new Error('Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD.');
	await pb
		.collection('_superusers')
		.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);
	await migrateAlphaReview(pb);
	console.log(
		'Alpha/Final Review and publication fields, indexes, and access rules installed. Existing review records were preserved.'
	);
}
