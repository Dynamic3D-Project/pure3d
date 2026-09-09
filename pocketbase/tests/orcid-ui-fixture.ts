// Synthetic browser fixture only. Never deploy; no application environment or credentials.
import { mkdtemp, mkdir, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import PocketBase from 'pocketbase';
import schema from '../pb_schema/collections.json';
import { orcidAuthConfig } from '../../scripts/configure-orcid';

const directory = await mkdtemp(join(tmpdir(), 'orcid-ui-'));
const hooks = join(directory, 'hooks');
await mkdir(hooks);
for (const file of [
	'orcid.pb.js',
	'orcid-service.cjs',
	'orcid-validation.cjs',
	'review-service.cjs',
	'activity-service.cjs',
	'orcid-readiness.cjs'
])
	await copyFile(resolve('pocketbase/pb_hooks', file), join(hooks, file));
await copyFile(resolve('pocketbase/tests/fixtures/orcid.pb.js'), join(hooks, 'test-fixture.pb.js'));
await copyFile(resolve('pocketbase/tests/fixtures/orcid-ui.pb.js'), join(hooks, 'zz-ui.pb.js'));
const origin = 'http://127.0.0.1:60121';
const backend = Bun.spawn(
	[
		process.env.PB_TEST_BINARY!,
		'serve',
		'--http=127.0.0.1:60121',
		'--dir=' + join(directory, 'data'),
		'--hooksDir=' + hooks,
		'--migrationsDir=' + join(directory, 'migrations')
	],
	{
		env: { ORCID_ISSUER: 'https://orcid.org', PB_TEST_BOOTSTRAP_ONLY: '1' },
		stdout: Bun.file(join(directory, 'backend.log')),
		stderr: 'inherit'
	}
);
process.on('exit', () => backend.kill());
process.on('SIGTERM', () => {
	backend.kill();
	process.exit(0);
});
process.on('SIGINT', () => {
	backend.kill();
	process.exit(0);
});
for (let i = 0; i < 100; i++) {
	if (backend.exitCode !== null)
		throw new Error('Synthetic backend failed to start; see ' + directory);
	try {
		if ((await fetch(origin + '/api/health')).ok) break;
	} catch {
		/* starting */
	}
	await Bun.sleep(100);
}
const bootstrap = Bun.spawn(
	[process.execPath, '--no-env-file', 'scripts/create-pocketbase-collections.ts'],
	{
		env: {
			POCKETBASE_URL: origin,
			POCKETBASE_ADMIN_EMAIL: 'root@example.test',
			POCKETBASE_ADMIN_PASSWORD: 'local-test-password-only'
		},
		stdout: Bun.file(join(directory, 'bootstrap.log')),
		stderr: 'inherit'
	}
);
assert.equal(await bootstrap.exited, 0, 'Full application schema bootstrap must succeed');
const root = new PocketBase(origin);
await root
	.collection('_superusers')
	.authWithPassword('root@example.test', 'local-test-password-only');
await root.collections.update('users', {
	oauth2: { ...orcidAuthConfig('test-client', 'test-secret', 'production').oauth2, enabled: false }
});
await root.settings.update({ meta: { appURL: 'http://127.0.0.1:60025' } });
// The real bootstrap calls alignOrcidSchema; do not replace any rules for browser convenience.
for (const desired of schema) {
	const actual = await root.collections.getOne(desired.name);
	for (const key of [
		'listRule',
		'viewRule',
		'createRule',
		'updateRule',
		'deleteRule',
		'manageRule'
	]) {
		if (key in desired)
			assert.deepEqual(actual[key], desired[key as keyof typeof desired], desired.name + '.' + key);
	}
}
await root.send('/_test/seed-ui', { method: 'POST' });
for (const [collection, id] of [
	['collections', 'uicollection001'],
	['editions', 'uiedition000001']
]) {
	const record = await root.collection(collection).getOne(id);
	record.credits[0].userId = 'author000000000';
	record.credits[0].provenance = 'oauth';
	await root.collection(collection).update(id, { credits: record.credits });
}
await root.collection('editionUsers').create({
	editionId: 'uiedition000002',
	userId: 'author000000000',
	user: 'author000000000',
	role: 'author'
});
const readiness = await (await fetch(origin + '/api/pure3d/orcid/ready')).json();
assert.deepEqual(readiness.checks, { hooks: true, auth: false, schema: true, credits: true });
console.log(
	JSON.stringify({ directory, origin, launcherPid: process.pid, backendPid: backend.pid })
);
await backend.exited;
