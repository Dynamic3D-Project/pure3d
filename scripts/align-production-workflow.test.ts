/* eslint-disable @typescript-eslint/no-explicit-any -- asserts dynamic PocketBase schema metadata. */
import { expect, test } from 'bun:test';
import { plan } from './align-production-workflow';
import schema from '../pocketbase/pb_schema/collections.json';

test('workflow alignment preserves field IDs and adds the Alpha/Final schema', () => {
	const legacy = schema
		.filter((item) =>
			[
				'editions',
				'reviewAssignments',
				'editionReviews',
				'reviewFeedback',
				'notifications',
				'auditLog',
				'editionUsers'
			].includes(item.name)
		)
		.map((item) => ({
			...item,
			id: item.name,
			fields: item.fields
				.filter((field) => !/^(proposal|alpha|final|publication|workflowDecision)/.test(field.name))
				.map((field, i) => ({ ...field, id: `${item.name}-${i}` }))
		}));
	const editions = legacy.find((item) => item.name === 'editions')!;
	editions.fields.find((field) => field.name === 'status')!.values = [
		'draft',
		'final_review',
		'published'
	];
	const changes = plan(legacy);
	const aligned = changes.find((change) => change.name === 'editions')!;
	expect(aligned.fields.find((field: any) => field.name === 'status').id).toBe('editions-5');
	expect(aligned.fields.some((field: any) => field.name === 'finalReviewRound')).toBe(true);
});
