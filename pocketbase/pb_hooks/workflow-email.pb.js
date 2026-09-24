// Explicit opt-in only. Tests and local previews never send mail by default.
cronAdd('pure3d-workflow-email', '*/5 * * * *', () => {
	if ($os.getenv('PURE3D_WORKFLOW_EMAIL_ENABLED') !== 'true') return;
	const settings = $app.settings();
	if (!settings.smtp.enabled) return;
	const notifications = $app.findRecordsByFilter(
		'notifications',
		'emailEligible = true && emailSentAt = "" && emailAttempts < 5',
		'created',
		50,
		0
	);
	for (const notification of notifications) {
		try {
			const user = $app.findRecordById('users', notification.getString('recipientId'));
			if (!user.email() || !user.verified()) continue;
			const escape = (value) =>
				String(value)
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;');
			const url = notification.getString('actionUrl');
			const appURL = String(settings.meta.appURL).replace(/\/+$/, '');
			if (!/^https:\/\//.test(appURL) || !url.startsWith(appURL + '/')) continue;
			notification.set('emailAttempts', notification.getInt('emailAttempts') + 1);
			notification.set('emailAttemptedAt', new Date().toISOString());
			$app.save(notification);
			$app.newMailClient().send(
				new MailerMessage({
					from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
					to: [{ address: user.email() }],
					subject: 'PURE3D — ' + notification.getString('title'),
					html:
						'<p>' +
						escape(notification.getString('title')) +
						'</p><p>A publication workflow update is available. Sign in to view the details.</p><p><a href="' +
						escape(url) +
						'">Open PURE3D</a></p>'
				})
			);
			notification.set('emailSentAt', new Date().toISOString());
			$app.save(notification);
		} catch {
			console.error('Workflow email delivery failed for notification ' + notification.id);
		}
	}
});
