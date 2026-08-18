function feedbackPlainText(value) {
	return String(value || '')
		.replace(/&nbsp;/g, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

onRecordUpdateRequest((event) => {
	const previousStatus = event.record.original().getString('status');
	const currentStatus = event.record.getString('status');
	event.next();

	if (previousStatus !== 'draft' || currentStatus !== 'submitted') return;

	let recipients;
	try {
		recipients = event.app.findAllRecords('feedbackRecipients');
	} catch (error) {
		console.log('Feedback email recipients could not be loaded:', error);
		return;
	}

	if (!recipients.length) return;

	const participant = event.record.getString('participantName') || 'Anonymous';
	const participantEmail = event.record.getString('participantEmail') || 'Not provided';
	const category = event.record.getString('category') || 'other';
	const severity = event.record.getString('severity') || 'minor';
	const pageUrl = event.record.getString('pageUrl') || event.record.getString('editionUrl');
	const feedback =
		feedbackPlainText(event.record.getString('feedbackHtml')) || 'No written feedback.';
	const body = [
		'New Pure3D feedback was submitted.',
		'',
		'Participant: ' + participant,
		'Participant email: ' + participantEmail,
		'Category: ' + category,
		'Severity: ' + severity,
		'Page: ' + (pageUrl || 'Not provided'),
		'',
		feedback
	].join('\n');

	for (const recipient of recipients) {
		const email = recipient.getString('email');
		if (!email) continue;

		try {
			const message = new MailerMessage({
				from: {
					address: event.app.settings().meta.senderAddress,
					name: event.app.settings().meta.senderName
				},
				to: [{ address: email }],
				subject: 'New Pure3D feedback (' + severity + ')',
				text: body
			});
			event.app.newMailClient().send(message);
		} catch (error) {
			console.log('Feedback email could not be sent to ' + email + ':', error);
		}
	}
}, 'feedback');
