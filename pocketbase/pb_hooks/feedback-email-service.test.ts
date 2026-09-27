import { describe, expect, test } from 'bun:test';
import service from './feedback-email-service.cjs';

describe('feedback email queue', () => {
	test('queues only the draft to submitted transition', () => {
		expect(service.shouldQueue('draft', 'submitted')).toBe(true);
		expect(service.shouldQueue('submitted', 'submitted')).toBe(false);
		expect(service.shouldQueue('draft', 'draft')).toBe(false);
	});

	test('requires both explicit opt-in and SMTP', () => {
		expect(service.deliveryEnabled('true', true)).toBe(true);
		expect(service.deliveryEnabled('TRUE', true)).toBe(false);
		expect(service.deliveryEnabled('true', false)).toBe(false);
	});

	test('preserves existing queue state on later client updates', () => {
		const original = {
			emailQueuedAt: '2026-09-26T10:00:00Z',
			emailAttemptedAt: '2026-09-26T10:05:00Z',
			emailSentAt: '',
			emailAttempts: 2
		};
		expect(service.queueState('submitted', 'resolved', 'later', original, true)).toEqual(original);
		expect(service.queueState('draft', 'submitted', 'now', original, true)).toEqual({
			emailQueuedAt: 'now',
			emailAttemptedAt: '',
			emailSentAt: '',
			emailAttempts: 0
		});
		expect(service.queueState('draft', 'submitted', 'now', original, false)).toEqual(original);
	});

	test('escapes feedback text and creates a private recipient list', () => {
		const delivery = service.createDelivery(
			{
				participantName: '<Ada>',
				participantEmail: 'ada@example.test',
				category: 'bug',
				severity: 'major',
				pageUrl: 'https://example.test/page',
				feedbackHtml: '<p>Broken &amp; slow</p>'
			},
			['one@example.test', '', 'two@example.test']
		);

		expect(delivery.recipients).toEqual(['one@example.test', 'two@example.test']);
		expect(delivery.body).toContain('Participant: <Ada>');
		expect(delivery.body).toContain('Broken &amp; slow');
		expect(delivery.body).not.toContain('<p>');
	});
});
