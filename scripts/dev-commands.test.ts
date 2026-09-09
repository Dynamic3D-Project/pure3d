import { expect, test } from 'bun:test';
import packageJson from '../package.json';

const production = 'https://main.57-129-98-223.sslip.io';

test('Vite scripts explicitly select their runtime environment', () => {
	expect(packageJson.scripts.dev).toBe('NODE_ENV=development vite dev');
	expect(packageJson.scripts.build).toBe('NODE_ENV=production vite build');
});
// Never inherit private .env values or include config/command output in failures.
const env = {
	PATH: process.env.PATH!,
	HOME: process.env.HOME!,
	PUBLIC_POCKETBASE_URL: production,
	PUBLIC_ASSET_BASE_URL: `${production}/assets`,
	POCKETBASE_URL: production,
	R2_ENDPOINT: 'https://synthetic-production.example',
	R2_ACCESS_KEY_ID: 'synthetic-production-key',
	R2_SECRET_ACCESS_KEY: 'synthetic-production-secret',
	ORCID_ISSUER: 'https://orcid.org',
	ORCID_CLIENT_ID: 'synthetic-production-client',
	ORCID_CLIENT_SECRET: 'synthetic-production-secret',
	DEV_HTTPS: '1',
	DEV_POCKETBASE_TARGET: production,
	DEV_ASSET_TARGET: `${production}/assets`,
	DEV_ASSET_BUCKET: 'synthetic-production-bucket',
	MINIO_ROOT_USER: 'synthetic-local-user',
	MINIO_ROOT_PASSWORD: 'synthetic-local-secret'
};

function run(command: string[], extra: Record<string, string> = {}) {
	const result = Bun.spawnSync(command, { env: { ...env, ...extra } });
	if (result.exitCode !== 0) throw new Error(`${command[0]} check failed (output withheld)`);
	return result.stdout.toString();
}

function config(mode: string, extra: Record<string, string> = {}) {
	return JSON.parse(
		run(
			[
				'docker',
				'compose',
				'--env-file',
				'/dev/null',
				'-f',
				'docker-compose.yml',
				'-f',
				`docker-compose.${mode}.yml`,
				'config',
				'--format',
				'json'
			],
			extra
		)
	).services;
}

for (const custom of [false, true]) {
	test(`local config ignores production settings (${custom ? 'custom' : 'default'} ports)`, () => {
		const pbPort = custom ? '61021' : '60021';
		const assetPort = custom ? '61023' : '60023';
		const bucket = custom ? 'custom-assets' : 'pure3d-assets';
		const frontend = `https://127.0.0.1:${custom ? '61020' : '60020'}`;
		const services = config(
			'local',
			custom
				? {
						POCKETBASE_PORT: pbPort,
						MINIO_API_PORT: assetPort,
						FRONTEND_PORT: '61020',
						MINIO_CONSOLE_PORT: '61024',
						R2_BUCKET: bucket
					}
				: {}
		);
		for (const name of ['frontend', 'pocketbase', 'pocketbase-setup']) {
			expect(services[name].environment.PUBLIC_POCKETBASE_URL === frontend).toBe(true);
		}
		for (const name of ['frontend', 'pocketbase-setup']) {
			const values = services[name].environment;
			expect(values.PUBLIC_ASSET_BASE_URL === `${frontend}/assets`).toBe(true);
			expect(values.ORCID_CLIENT_ID === '' && values.ORCID_CLIENT_SECRET === '').toBe(true);
		}
		const setup = services['pocketbase-setup'].environment;
		expect(setup.POCKETBASE_URL === 'http://pocketbase:8090').toBe(true);
		expect(setup.R2_ENDPOINT === 'http://minio:9000').toBe(true);
		expect(setup.R2_ACCESS_KEY_ID === env.MINIO_ROOT_USER).toBe(true);
		expect(setup.R2_SECRET_ACCESS_KEY === env.MINIO_ROOT_PASSWORD).toBe(true);
		expect(setup.R2_BUCKET === bucket).toBe(true);
		expect(services.pocketbase.environment.ORCID_ISSUER === 'https://orcid.org').toBe(true);
		expect(setup.ORCID_ISSUER === 'https://orcid.org').toBe(true);
		expect(setup.ORCID_ENVIRONMENT === 'production').toBe(true);
		const frontendEnv = services.frontend.environment;
		expect(frontendEnv.DEV_HTTPS === '1').toBe(true);
		expect(frontendEnv.DEV_POCKETBASE_TARGET === 'http://pocketbase:8090').toBe(true);
		expect(frontendEnv.DEV_ASSET_TARGET === 'http://minio:9000').toBe(true);
		expect(frontendEnv.DEV_ASSET_BUCKET === bucket).toBe(true);
		expect(JSON.stringify(services['pocketbase-setup'].command).includes('configure-orcid')).toBe(
			false
		);
		for (const [name, target, published] of [
			['pocketbase', 8090, pbPort],
			['minio', 9000, assetPort],
			['frontend', 14273, custom ? '61020' : '60020'],
			['minio', 9001, custom ? '61024' : '60024']
		] as const) {
			expect(
				services[name].ports.some(
					(port: { target: number; published: string }) =>
						port.target === target && port.published === published
				)
			).toBe(true);
		}
	});
}

test('production frontend pins OVH even when public settings point elsewhere', () => {
	const services = config('prod', {
		PUBLIC_POCKETBASE_URL: 'http://localhost:1',
		PUBLIC_ASSET_BASE_URL: 'http://localhost:2'
	});
	expect(services.frontend.environment.PUBLIC_POCKETBASE_URL === production).toBe(true);
	expect(services.frontend.environment.PUBLIC_ASSET_BASE_URL === `${production}/assets`).toBe(true);
	expect(services.frontend.environment.DEV_HTTPS === '0').toBe(true);
});

test('Make targets select explicit overrides; production starts only frontend', () => {
	for (const target of [
		'dev',
		'dev-web',
		'bun-dev',
		'install',
		'db',
		'seed-assets',
		'stack',
		'db-logs',
		'db-stop',
		'stack-stop'
	]) {
		const output = run(['make', '-n', target]);
		const commands = output.split('\n').filter((line) => line.includes('docker compose'));
		expect(commands.length > 0).toBe(true);
		expect(
			commands.every((line) => line.includes('-f docker-compose.yml -f docker-compose.local.yml'))
		).toBe(true);
		expect(output.includes('configure-orcid')).toBe(false);
		if (target === 'dev-web' || target === 'bun-dev') {
			expect(output.indexOf('export PUBLIC_POCKETBASE_URL=') > output.indexOf('. ./.env')).toBe(
				true
			);
			expect(
				output.includes('export PUBLIC_POCKETBASE_URL="https://127.0.0.1:${FRONTEND_PORT:-60020}"')
			).toBe(true);
			expect(output.includes('export PUBLIC_ASSET_BASE_URL="$PUBLIC_POCKETBASE_URL/assets"')).toBe(
				true
			);
			expect(output.includes('DEV_HTTPS=1')).toBe(true);
			expect(
				output.includes('DEV_POCKETBASE_TARGET="http://127.0.0.1:${POCKETBASE_PORT:-60021}"')
			).toBe(true);
			expect(output.includes('DEV_ASSET_TARGET="http://127.0.0.1:${MINIO_API_PORT:-60023}"')).toBe(
				true
			);
			expect(output.includes('DEV_ASSET_BUCKET="${R2_BUCKET:-pure3d-assets}"')).toBe(true);
		}
		expect(output.includes('mkcert -install')).toBe(
			['dev', 'dev-web', 'bun-dev', 'stack'].includes(target)
		);
	}
	const output = run(['make', '-n', 'dev-prod']);
	expect(output.includes('mkcert')).toBe(false);
	expect(output.includes('Connected to production: changes affect live data.')).toBe(true);
	const commands = output.split('\n').filter((line) => line.includes('docker compose'));
	expect(commands.length === 1).toBe(true);
	expect(
		commands[0].trim() ===
			'docker compose -f docker-compose.yml -f docker-compose.prod.yml up --no-deps frontend'
	).toBe(true);
});

test('certificate target only generates missing files and protects the key (dry run)', () => {
	const output = run(['make', '-n', 'dev-cert']);
	expect(output.includes('command -v mkcert')).toBe(true);
	expect(
		output.includes('[ ! -f .certs/localhost.pem ] || [ ! -f .certs/localhost-key.pem ]')
	).toBe(true);
	expect(output.includes('mkcert -install')).toBe(true);
	expect(
		output.includes(
			'mkcert -cert-file .certs/localhost.pem -key-file .certs/localhost-key.pem localhost 127.0.0.1 ::1'
		)
	).toBe(true);
	expect(output.includes('chmod 600 .certs/localhost-key.pem')).toBe(true);
});

test('Vite gates certificate reads and safely rewrites local proxy paths', () => {
	// Evaluate config with stubbed imports; never execute plugins or read real certificates/.env.
	run([
		'bun',
		'--no-env-file',
		'-e',
		`
		import { strict as assert } from 'node:assert';
		const reads = [];
		const source = await Bun.file('vite.config.ts').text();
		const code = new Bun.Transpiler({ loader: 'ts' }).transformSync(source)
			.replace(/^import .*;$/gm, '').replace('export default', 'return');
		const config = new Function('defineConfig', 'readFileSync', 'execSync', 'sveltekit',
			'paraglideVitePlugin', 'devtoolsJson', 'Icons', code)(
			value => value, path => { reads.push(path); return 'fake'; }, () => 'test',
			() => [], () => ({}), () => ({}), () => ({})
		);
		for (const flags of [{ command: 'build' }, { command: 'serve', isPreview: true }]) {
			assert.equal(config(flags).server.https, undefined);
			assert.equal(config(flags).server.proxy, undefined);
		}
		process.env.DEV_HTTPS = '0';
		assert.equal(config({ command: 'serve' }).server.https, undefined);
		assert.equal(reads.length, 0);
		process.env.DEV_HTTPS = '1';
		process.env.DEV_ASSET_BUCKET = 'bucket/$&?';
		const { server } = config({ command: 'serve', isPreview: false });
		assert.deepEqual(reads, ['.certs/localhost.pem', '.certs/localhost-key.pem']);
		assert.equal(server.strictPort, true);
		const proxies = Object.entries(server.proxy);
		const api = proxies.find(([key]) => new RegExp(key).test('/api/oauth2-redirect'))[1];
		const [assetPattern, assets] = proxies.find(([key]) => new RegExp(key).test('/assets/project/a'));
		assert.equal(api.target, process.env.DEV_POCKETBASE_TARGET);
		assert.equal(assets.target, process.env.DEV_ASSET_TARGET);
		assert.equal(new RegExp(assetPattern).test('/assets-other'), false);
		assert.equal(assets.rewrite('/assets/project/a.glb?x=1'), '/bucket%2F%24%26%3F/project/a.glb?x=1');
		assert.equal(assets.rewrite('/assets?x=1'), '/bucket%2F%24%26%3F?x=1');
		assert.equal(assets.rewrite('/assets-other'), '/assets-other');
	`
	]);
});
