import { describe, expect, test } from 'bun:test';
import {
	feedbackEmailQueueFields,
	feedbackEmailQueueIndex,
	planFeedbackEmailQueueSchema
} from './feedback-email-queue-schema';

describe('feedback email queue schema plan', () => {
	test('adds a missing index even when every field already exists', () => {
		const plan = planFeedbackEmailQueueSchema(feedbackEmailQueueFields, []);
		expect(plan.fields).toEqual(feedbackEmailQueueFields);
		expect(plan.indexes).toEqual([feedbackEmailQueueIndex]);
		expect(plan.changed).toBe(true);
	});

	test('preserves unrelated fields and indexes', () => {
		const plan = planFeedbackEmailQueueSchema(
			[{ id: 'existing', name: 'title', type: 'text' }],
			['CREATE INDEX idx_other ON feedback (status)']
		);
		expect(plan.fields[0]).toEqual({ id: 'existing', name: 'title', type: 'text' });
		expect(plan.indexes[0]).toBe('CREATE INDEX idx_other ON feedback (status)');
	});

	test('rejects incompatible queue fields and conflicting named indexes', () => {
		expect(() =>
			planFeedbackEmailQueueSchema([{ name: 'emailAttempts', type: 'text' }], [])
		).toThrow('emailAttempts');
		expect(() =>
			planFeedbackEmailQueueSchema(
				[],
				['CREATE INDEX idx_feedback_email_queue ON feedback (emailQueuedAt)']
			)
		).toThrow('idx_feedback_email_queue');
	});

	test('is unchanged when compatible fields and the exact index exist', () => {
		expect(
			planFeedbackEmailQueueSchema(feedbackEmailQueueFields, [feedbackEmailQueueIndex]).changed
		).toBe(false);
	});
});
