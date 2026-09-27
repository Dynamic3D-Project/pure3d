#!/usr/bin/env bun
import {
	feedbackEmailQueueFields,
	planFeedbackEmailQueueSchema
} from './feedback-email-queue-schema';

export async function applyFeedbackEmailQueueSchema(options: {
	baseUrl: string;
	identity: string;
	password: string;
	fetch?: typeof fetch;
}) {
	const request = options.fetch || fetch;
	const baseUrl = new URL(options.baseUrl).origin;
	const authResponse = await request(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identity: options.identity, password: options.password })
	});
	if (!authResponse.ok) throw new Error(`Authentication failed (${authResponse.status}).`);
	const { token } = (await authResponse.json()) as { token: string };
	const response = await request(`${baseUrl}/api/collections/feedback`, {
		headers: { Authorization: token }
	});
	if (!response.ok) throw new Error(`Could not load feedback schema (${response.status}).`);
	const collection = (await response.json()) as {
		id: string;
		fields: Record<string, unknown>[];
		indexes?: string[];
	};
	const plan = planFeedbackEmailQueueSchema(collection.fields || [], collection.indexes || []);
	if (!plan.changed) return false;
	const update = await request(`${baseUrl}/api/collections/${collection.id}`, {
		method: 'PATCH',
		headers: { Authorization: token, 'Content-Type': 'application/json' },
		body: JSON.stringify({ fields: plan.fields, indexes: plan.indexes })
	});
	if (!update.ok) throw new Error(`Could not update feedback schema (${update.status}).`);
	return true;
}

async function main() {
	if (!process.argv.includes('--apply')) {
		console.log(
			'Dry run: feedback requires ' + feedbackEmailQueueFields.map((field) => field.name).join(', ')
		);
		console.log('Re-run with --apply and explicit PocketBase URL and superuser credentials.');
		return;
	}
	const baseUrl = process.env.POCKETBASE_URL;
	const identity = process.env.PB_ADMIN_EMAIL;
	const password = process.env.PB_ADMIN_PASSWORD;
	if (!baseUrl || !identity || !password) {
		throw new Error(
			'POCKETBASE_URL, PB_ADMIN_EMAIL, and PB_ADMIN_PASSWORD are all required with --apply.'
		);
	}
	const changed = await applyFeedbackEmailQueueSchema({ baseUrl, identity, password });
	console.log(
		changed
			? 'Feedback email queue schema updated.'
			: 'Feedback email queue schema already current.'
	);
}

if (import.meta.main) await main();
