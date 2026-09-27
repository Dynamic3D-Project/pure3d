import { afterAll, beforeAll, expect, test } from 'bun:test';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import PocketBase from 'pocketbase';
import { feedbackEmailQueueFields } from '../../scripts/feedback-email-queue-schema';
import { applyFeedbackEmailQueueSchema } from '../../scripts/add-feedback-email-queue-fields';

const binary = process.env.PB_TEST_BINARY;
const integration = binary ? test : test.skip;
let directory: string;
let processHandle: ReturnType<typeof Bun.spawn>;
let client: PocketBase;

beforeAll(async () => {
	if (!binary) return;
	directory = await mkdtemp(join(tmpdir(), 'pure3d-feedback-email-test-'));
	const hooks = join(directory, 'hooks');
	await mkdir(hooks);
	for (const file of ['feedback-email.pb.js', 'feedback-email-service.cjs'])
		await copyFile(resolve('pocketbase/pb_hooks', file), join(hooks, file));
	await copyFile(
		resolve('pocketbase/tests/fixtures/feedback-email.pb.js'),
		join(hooks, '00-feedback-fixture.pb.js')
	);
	await writeFile(
		join(hooks, 'feedback-schema.json'),
		JSON.stringify([
			{
				name: 'feedback',
				fields: [
					{
						name: 'status',
						type: 'select',
						required: true,
						maxSelect: 1,
						values: ['draft', 'submitted', 'resolved']
					},
					{ name: 'feedbackHtml', type: 'editor' }
				]
			},
			{ name: 'feedbackRecipients', fields: [{ name: 'email', type: 'email' }] }
		])
	);
	const socket = createServer();
	await new Promise<void>((done) => socket.listen(0, '127.0.0.1', done));
	const port = (socket.address() as { port: number }).port;
	await new Promise<void>((done) => socket.close(() => done()));
	const origin = `http://127.0.0.1:${port}`;
	processHandle = Bun.spawn(
		[
			binary,
			'serve',
			`--http=127.0.0.1:${port}`,
			`--dir=${join(directory, 'data')}`,
			`--hooksDir=${hooks}`,
			`--migrationsDir=${join(directory, 'migrations')}`
		],
		{ env: { PURE3D_FEEDBACK_EMAIL_ENABLED: 'true' }, stdout: 'pipe', stderr: 'pipe' }
	);
	for (let attempt = 0; attempt < 100; attempt++) {
		if (processHandle.exitCode !== null)
			throw new Error(
				'Disposable PB startup failed: ' + (await new Response(processHandle.stderr).text())
			);
		try {
			if ((await fetch(origin + '/api/health')).ok) break;
		} catch {
			/* starting */
		}
		await Bun.sleep(50);
	}
	client = new PocketBase(origin);
	expect(
		await applyFeedbackEmailQueueSchema({
			baseUrl: origin,
			identity: 'root@example.test',
			password: 'local-test-password-only'
		})
	).toBe(true);
	const root = new PocketBase(origin);
	await root
		.collection('_superusers')
		.authWithPassword('root@example.test', 'local-test-password-only');
	const feedback = await root.collections.getOne('feedback');
	expect(
		feedback.fields.filter((field) =>
			feedbackEmailQueueFields.some((item) => item.name === field.name)
		)
	).toHaveLength(4);
	expect(feedback.indexes).toContain(
		'CREATE INDEX idx_feedback_email_queue ON feedback (emailSentAt, emailAttempts, emailQueuedAt)'
	);
	expect(
		await applyFeedbackEmailQueueSchema({
			baseUrl: origin,
			identity: 'root@example.test',
			password: 'local-test-password-only'
		})
	).toBe(false);
}, 20000);

afterAll(async () => {
	if (processHandle) {
		processHandle.kill();
		await processHandle.exited;
	}
	if (directory) await rm(directory, { recursive: true, force: true });
});

integration(
	'rejects malicious queue values on create and update while durably queueing submission',
	async () => {
		const malicious = {
			emailQueuedAt: '2020-01-01 00:00:00.000Z',
			emailAttemptedAt: '2020-01-01 00:00:00.000Z',
			emailSentAt: '2020-01-01 00:00:00.000Z',
			emailAttempts: 99
		};
		const draft = await client
			.collection('feedback')
			.create({ status: 'draft', feedbackHtml: 'Test', ...malicious });
		expect(draft.emailQueuedAt).toBe('');
		expect(draft.emailSentAt).toBe('');
		expect(draft.emailAttempts).toBe(0);
		const submitted = await client
			.collection('feedback')
			.update(draft.id, { status: 'submitted', ...malicious });
		expect(submitted.emailQueuedAt).not.toBe('');
		expect(submitted.emailSentAt).toBe('');
		expect(submitted.emailAttempts).toBe(0);
		const resolved = await client
			.collection('feedback')
			.update(draft.id, { status: 'resolved', ...malicious });
		expect(resolved.emailQueuedAt).toBe(submitted.emailQueuedAt);
		expect(resolved.emailSentAt).toBe('');
		expect(resolved.emailAttempts).toBe(0);
	},
	10000
);
