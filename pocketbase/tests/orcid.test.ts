import { expect, test } from 'bun:test';

test('configuration CLI defaults to offline dry-run and never logs credentials on failure', async () => {
	const env = {
		POCKETBASE_URL: 'http://example.invalid',
		POCKETBASE_ADMIN_EMAIL: 'not-a-real-admin@example.test',
		POCKETBASE_ADMIN_PASSWORD: 'do-not-print-test-password',
		ORCID_CLIENT_ID: 'test-client',
		ORCID_CLIENT_SECRET: 'do-not-print-test-secret'
	};
	for (const args of [
		[],
		['--apply'],
		['--prepare'],
		['--prepare', '--apply'],
		['--apply', '--defer-unmapped'],
		['--apply', '--onboarding-report', '/unused'],
		['--prepare', '--defer-unmapped', '--onboarding-report', '/unused'],
		['--apply', '--defer-unmapped', '--onboarding-report'],
		['--apply', '--defer-unmapped', '--onboarding-report', '/unused', '--guard', '{}']
	]) {
		const child = Bun.spawn(
			[process.execPath, '--no-env-file', 'scripts/configure-orcid.ts', ...args],
			{ env, stdout: 'pipe', stderr: 'pipe' }
		);
		const output =
			(await new Response(child.stdout).text()) + (await new Response(child.stderr).text());
		expect(await child.exited).toBe(args.length ? 1 : 0);
		expect(output).not.toContain(env.POCKETBASE_ADMIN_PASSWORD);
		expect(output).not.toContain(env.ORCID_CLIENT_SECRET);
		expect(output).not.toContain(env.POCKETBASE_ADMIN_EMAIL);
		if (!args.length) expect(output).toContain('No credentials read, network requests or writes');
	}
});
