import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

const production = 'https://main.57-129-98-223.sslip.io';

for (const [dev, backend] of [
	[true, 'https://127.0.0.1:60020'],
	[true, production],
	[false, production]
] as const) {
	test(`${dev ? 'dev' : 'build'} session and cache scope: ${backend}`, () => {
		const result = spawnSync(
			process.execPath,
			[
				'--no-env-file',
				'-e',
				`
				import { mock } from 'bun:test';
				mock.module('$app/environment', () => ({ dev: ${dev} }));
				mock.module('$env/static/public', () => ({ PUBLIC_POCKETBASE_URL: ${JSON.stringify(backend)} }));
				const storage = new Map([['pocketbase_auth', JSON.stringify({token: 'synthetic', record: {id: 'production-user'}})]]);
				globalThis.window = {
					localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
					addEventListener() {}
				};
				const { pb, cachePrefix } = await import(${JSON.stringify(new URL('./client.ts', import.meta.url).href)});
				const inherited = pb.authStore.record?.id ?? null;
				pb.authStore.save('synthetic-new', {id: 'current-user'});
				console.log(JSON.stringify({ cachePrefix, inherited, keys: [...storage.keys()] }));
				`
			],
			{ env: { PATH: process.env.PATH!, HOME: process.env.HOME! } }
		);
		expect(result.status).toBe(0);
		const actual = JSON.parse(result.stdout.toString());
		const expectedPrefix = dev ? `pure3d:dev:${backend}` : 'pure3d';
		expect(actual.cachePrefix).toBe(expectedPrefix);
		expect(actual.inherited).toBe(dev ? null : 'production-user');
		expect(actual.keys).toContain(dev ? `${expectedPrefix}:auth` : 'pocketbase_auth');
	});
}
