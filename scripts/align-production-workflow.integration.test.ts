import { afterAll, beforeAll, expect, test } from 'bun:test';
import { copyFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import PocketBase from 'pocketbase';
import schema from '../pocketbase/pb_schema/collections.json';
import { plan } from './align-production-workflow';

const binary = process.env.PB_TEST_BINARY;
const integration = binary ? test : test.skip;
let directory = '';
let processHandle: ReturnType<typeof Bun.spawn>;
let root: PocketBase;

function legacySchema() {
	return schema
		.filter((item) =>
			[
				'users',
				'collections',
				'editions',
				'collectionUsers',
				'editionUsers',
				'auditLog',
				'editionReviews',
				'reviewAssignments',
				'notifications',
				'reviewFeedback'
			].includes(item.name)
		)
		.map((item) => {
			const fields = item.fields
				.map((field) => ({ ...field, values: field.values && [...field.values] }))
				.filter((field) => {
					if (item.name === 'editions')
						return !/^(proposal|alpha|final|publication|workflowDecision)/.test(field.name);
					if (item.name === 'reviewAssignments')
						return !['reviewRound', 'editionTitle', 'dueAt', 'replacementReason'].includes(
							field.name
						);
					if (item.name === 'editionReviews')
						return ![
							'reviewRound',
							'reviewStatus',
							'technicalComments',
							'valueRating',
							'valueExplanation',
							'experienceComments',
							'generalComments',
							'recommendationExplanation',
							'collaborationInterest',
							'submittedAt',
							'feedbackReleasedAt',
							'finalAnswers'
						].includes(field.name);
					if (item.name === 'notifications') return !field.name.startsWith('email');
					return true;
				});
			if (item.name === 'editions') {
				const status = fields.find((field) => field.name === 'status')!;
				status.values = status.values.filter(
					(value) => !['final_accepted', 'publication_requested'].includes(value)
				);
			}
			return { ...item, fields };
		});
}

beforeAll(async () => {
	if (!binary) return;
	directory = await mkdtemp('/tmp/pure3d-workflow-alignment-');
	const hooks = join(directory, 'hooks');
	await mkdir(hooks);
	await copyFile(
		resolve('pocketbase/tests/fixtures/orcid.pb.js'),
		join(hooks, '00-test-fixture.pb.js')
	);
	await writeFile(join(hooks, 'schema.json'), JSON.stringify(legacySchema()));
	const server = createServer();
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	const port = (server.address() as { port: number }).port;
	await new Promise<void>((done) => server.close(() => done()));
	processHandle = Bun.spawn(
		[
			binary,
			'serve',
			'--http=127.0.0.1:' + port,
			'--dir=' + join(directory, 'data'),
			'--hooksDir=' + hooks
		],
		{ stdout: 'pipe', stderr: 'pipe' }
	);
	const origin = 'http://127.0.0.1:' + port;
	for (let i = 0; i < 100; i++) {
		try {
			if ((await fetch(origin + '/api/health')).ok) break;
		} catch {
			/* starting */
		}
		await Bun.sleep(50);
	}
	root = new PocketBase(origin);
	await root
		.collection('_superusers')
		.authWithPassword('root@example.test', 'local-test-password-only');
}, 20_000);

afterAll(async () => {
	if (processHandle) {
		processHandle.kill();
		await processHandle.exited;
	}
	if (directory) await rm(directory, { recursive: true, force: true });
});

integration('applies the Alpha/Final schema additively to legacy round-zero records', async () => {
	const before = await root.collections.getFullList();
	const legacy = await root.collection('editions').getOne('legacy000000000');
	const editionField = before
		.find((item) => item.name === 'editions')!
		.fields.find((field) => field.name === 'title')!;
	for (const change of plan(before))
		if (change.changed)
			await root.collections.update(change.id, { fields: change.fields, indexes: change.indexes });
	for (const change of plan(await root.collections.getFullList()))
		if (Object.keys(change.changedRules).length)
			await root.collections.update(change.id, change.changedRules);
	const after = await root.collections.getFullList();
	expect(
		plan(after).every((change) => !change.changed && Object.keys(change.changedRules).length === 0)
	).toBe(true);
	const editions = after.find((item) => item.name === 'editions')!;
	expect(editions.fields.find((field) => field.name === 'title')!.id).toBe(editionField.id);
	expect(editions.fields.some((field) => field.name === 'alphaReviewRound')).toBe(true);
	expect(editions.fields.find((field) => field.name === 'status')!.values).toContain(
		'publication_requested'
	);
	expect((await root.collection('editions').getOne(legacy.id)).title).toBe(legacy.title);
});
