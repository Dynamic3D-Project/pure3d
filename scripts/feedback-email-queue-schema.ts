import { mergeSchemaFields } from './schema-fields';

export const feedbackEmailQueueFields = [
	{ name: 'emailQueuedAt', type: 'date' },
	{ name: 'emailAttemptedAt', type: 'date' },
	{ name: 'emailSentAt', type: 'date' },
	{ name: 'emailAttempts', type: 'number', onlyInt: true, min: 0 }
] as const;

export const feedbackEmailQueueIndex =
	'CREATE INDEX idx_feedback_email_queue ON feedback (emailSentAt, emailAttempts, emailQueuedAt)';

function indexName(value: string): string {
	return value.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+([^\s]+)\s+/i)?.[1]?.toLowerCase() || '';
}

export function planFeedbackEmailQueueSchema(
	existingFields: Record<string, unknown>[],
	existingIndexes: string[]
) {
	const fields = mergeSchemaFields(existingFields, [...feedbackEmailQueueFields]);
	const expectedName = indexName(feedbackEmailQueueIndex);
	const namedIndexes = existingIndexes.filter((value) => indexName(value) === expectedName);
	if (namedIndexes.some((value) => value.trim() !== feedbackEmailQueueIndex)) {
		throw new Error(`Index ${expectedName} exists with a conflicting definition.`);
	}
	const indexes = namedIndexes.length
		? existingIndexes
		: [...existingIndexes, feedbackEmailQueueIndex];
	return {
		fields,
		indexes,
		changed:
			JSON.stringify(fields) !== JSON.stringify(existingFields) ||
			JSON.stringify(indexes) !== JSON.stringify(existingIndexes)
	};
}
