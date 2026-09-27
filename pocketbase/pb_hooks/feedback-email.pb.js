/* eslint-disable @typescript-eslint/no-require-imports -- PocketBase hooks use Goja's CommonJS loader. */
onRecordCreateRequest((event) => {
	for (const field of ['emailQueuedAt', 'emailAttemptedAt', 'emailSentAt'])
		event.record.set(field, '');
	event.record.set('emailAttempts', 0);
	event.next();
}, 'feedback');

onRecordUpdateRequest((event) => {
	const service = require(__hooks + '/feedback-email-service.cjs');
	const original = event.record.original();
	const queue = service.queueState(
		original.getString('status'),
		event.record.getString('status'),
		new Date().toISOString(),
		{
			emailQueuedAt: original.getString('emailQueuedAt'),
			emailAttemptedAt: original.getString('emailAttemptedAt'),
			emailSentAt: original.getString('emailSentAt'),
			emailAttempts: original.getInt('emailAttempts')
		},
		$os.getenv('PURE3D_FEEDBACK_EMAIL_ENABLED') === 'true'
	);
	for (const field in queue) event.record.set(field, queue[field]);
	event.next();
}, 'feedback');

// Explicit opt-in only. Delivery failures never roll back or alter submitted feedback content.
cronAdd('pure3d-feedback-email', '*/5 * * * *', () => {
	const service = require(__hooks + '/feedback-email-service.cjs');
	const settings = $app.settings();
	if (!service.deliveryEnabled($os.getenv('PURE3D_FEEDBACK_EMAIL_ENABLED'), settings.smtp.enabled))
		return;
	const records = $app.findRecordsByFilter(
		'feedback',
		'emailQueuedAt != "" && emailSentAt = "" && emailAttempts < 5',
		'emailQueuedAt',
		50,
		0
	);
	const recipientEmails = $app
		.findAllRecords('feedbackRecipients')
		.map((record) => record.getString('email'));
	for (const feedback of records) {
		try {
			feedback.set('emailAttempts', feedback.getInt('emailAttempts') + 1);
			feedback.set('emailAttemptedAt', new Date().toISOString());
			$app.save(feedback);
			const delivery = service.createDelivery(
				{
					participantName: feedback.getString('participantName'),
					participantEmail: feedback.getString('participantEmail'),
					category: feedback.getString('category'),
					severity: feedback.getString('severity'),
					pageUrl: feedback.getString('pageUrl'),
					editionUrl: feedback.getString('editionUrl'),
					feedbackHtml: feedback.getString('feedbackHtml')
				},
				recipientEmails
			);
			if (!delivery.recipients.length) throw new Error('No feedback email recipients configured.');
			$app.newMailClient().send(
				new MailerMessage({
					from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
					bcc: delivery.recipients.map((address) => ({ address })),
					subject: delivery.subject,
					text: delivery.body
				})
			);
			feedback.set('emailSentAt', new Date().toISOString());
			$app.save(feedback);
		} catch {
			console.error('Feedback email delivery failed for feedback ' + feedback.id);
		}
	}
});
