import { describe, expect, test } from 'bun:test';
import v from '../pb_hooks/orcid-validation.cjs';
import { orcidAuthConfig } from '../../scripts/configure-orcid';

const id = '0000-0002-1825-0097';
const orcid = 'https://orcid.org/' + id;
const person = {
	type: 'person',
	name: 'A Researcher',
	orcid,
	role: 'creator',
	provenance: 'manual'
};
const userId = 'aaaaaaaaaaaaaaa';
const user = { orcid, orcidVerifiedAt: '2026-09-08 00:00:00.000Z' };
const validate = (items, required = false, previous = [], lookup = () => user) =>
	v.credits(items, previous, required, lookup);

describe('ORCID and credits trust boundaries', () => {
	test('checksum, canonical URL, X check digit and strict OIDC subject', () => {
		expect(v.canonicalOrcid(id)).toBe(orcid);
		expect(v.canonicalOrcid('0000-0002-1694-233X')).toBe('https://orcid.org/0000-0002-1694-233X');
		for (const invalid of [
			'0000-0002-1825-0098',
			'http://orcid.org/' + id,
			orcid + '/',
			orcid + '?x=1',
			' ' + id,
			id.toLowerCase() + '.evil',
			null
		])
			expect(() => v.canonicalOrcid(invalid)).toThrow();
		expect(v.subjectOrcid(id)).toBe(orcid);
		expect(() => v.subjectOrcid(orcid)).toThrow();
	});
	test('draft missing ORCID survives but every individual creator needs one at submission', () => {
		const missing = { ...person, orcid: null };
		expect(validate([missing])).toEqual([missing]);
		expect(() => validate([person, { ...missing, name: 'Second creator' }], true)).toThrow(
			'Every individual'
		);
		expect(() => validate([], true)).toThrow('At least one');
		expect(validate([person, { ...missing, role: 'contributor' }], true)).toHaveLength(2);
	});
	test('organizations cannot claim person identity or OAuth ownership', () => {
		expect(validate([{ ...person, type: 'org', orcid: null }], true)).toHaveLength(1);
		for (const overrides of [{ orcid }, { userId }, { provenance: 'oauth' }])
			expect(() => validate([{ ...person, type: 'org', orcid: null, ...overrides }])).toThrow();
	});
	test('userId and oauth provenance require a real verified agreeing identity', () => {
		expect(validate([{ ...person, userId, provenance: 'oauth' }])).toHaveLength(1);
		expect(() => validate([{ ...person, provenance: 'oauth' }])).toThrow();
		expect(() =>
			validate([{ ...person, userId }], false, [], () => ({ ...user, orcidVerifiedAt: '' }))
		).toThrow();
		expect(() =>
			validate([{ ...person, userId }], false, [], () => ({
				...user,
				orcid: 'https://orcid.org/0000-0002-1694-233X'
			}))
		).toThrow();
	});
	test('historical OAuth attribution without deleted account link can only be preserved', () => {
		const historical = { ...person, provenance: 'oauth' };
		expect(validate([historical], true, [historical])).toEqual([historical]);
		expect(() => validate([{ ...historical, name: 'Someone else' }], true, [historical])).toThrow();
	});
	test('reject malformed and unknown credit data', () => {
		for (const items of [
			{},
			[null],
			[{ ...person, orcid: '' }],
			[{ ...person, name: ' ' }],
			[{ ...person, verified: true }]
		])
			expect(() => validate(items)).toThrow();
	});
	test('preserves exact text, repeated credits and attribution order', () => {
		const repeated = {
			...person,
			name: '  Published  Name\n',
			contributionRole: '  Field research  '
		};
		const values = [repeated, { ...person, name: 'Another' }, repeated];
		expect(validate(values, true)).toEqual(values);
		expect(() => validate([{ ...person, name: ' \n\t' }])).toThrow();
	});
});

test('workflow cannot skip review or let authors publish', () => {
	expect(v.canTransition('draft', 'published', { admin: true })).toBe(false);
	expect(v.canTransition('draft', 'concept_submitted', { author: true })).toBe(true);
	expect(!!v.canTransition('final_review', 'published', { author: true })).toBe(false);
	expect(v.canTransition('final_review', 'published', { owner: true })).toBe(true);
	expect(!!v.canTransition('editorial_review', 'concept_accepted', { collaborator: true })).toBe(
		false
	);
});

test('unchanged attribution is independent of JSON object key order, not its contents', () => {
	expect(v.sameCredits([person], [Object.fromEntries(Object.entries(person).reverse())])).toBe(
		true
	);
	expect(v.sameCredits([person], [{ ...person, provenance: 'oauth' }])).toBe(false);
	expect(v.sameCredits([person], [{ ...person, unexpected: true }])).toBe(false);
});

test('canonical readiness validation rejects absent data but permits edited arrays', () => {
	const repeated = { ...person, name: '  Legacy name  ', orcid: null };
	const contributor = { ...person, name: 'Contributor', role: 'contributor', orcid: null };
	const values = [repeated, repeated, contributor];
	for (const invalid of [null, undefined, {}, '']) expect(() => validate(invalid)).toThrow();
	for (const edited of [
		[],
		values,
		[...values].reverse(),
		[...values, { ...contributor, name: 'Added later' }]
	])
		expect(validate(edited)).toEqual(edited);
});

test('public profile is an allowlist, never emails, tokens, role or local picture', () => {
	const profile = v.publicProfile(
		{
			name: { 'given-names': { value: 'Ada' }, 'family-name': { value: 'Lovelace' } },
			emails: { email: 'private@example.test' },
			access_token: 'private',
			role: 'admin',
			'researcher-urls': {
				'researcher-url': [
					{ url: { value: 'javascript:alert(1)' } },
					{ url: { value: 'https://example.test/' } }
				]
			}
		},
		{}
	);
	expect(profile).toEqual({
		nickname: 'Ada Lovelace',
		affiliation: '',
		titleRole: '',
		bio: '',
		socials: 'https://example.test/'
	});
});

test('configuration uses upstream ID-token verification rather than userinfo', () => {
	const config = orcidAuthConfig('test-client', 'test-secret');
	expect(config.passwordAuth.enabled).toBe(false);
	expect(config.otp.enabled).toBe(false);
	expect(config.oauth2.providers).toHaveLength(1);
	expect(config.oauth2.providers[0]).toMatchObject({
		name: 'oidc',
		userInfoURL: '',
		extra: { issuers: ['https://orcid.org'], jwksURL: 'https://orcid.org/oauth/jwks' }
	});
	expect(config.oauth2.mappedFields).toEqual({ id: '', name: '', username: '', avatarURL: '' });
});

test('sandbox endpoints are explicit and arbitrary issuers/environments are rejected', () => {
	const config = orcidAuthConfig('test-client', 'test-secret', 'sandbox');
	expect(config.oauth2.providers[0]).toMatchObject({
		authURL: 'https://sandbox.orcid.org/oauth/authorize',
		tokenURL: 'https://sandbox.orcid.org/oauth/token',
		extra: {
			issuers: ['https://sandbox.orcid.org'],
			jwksURL: 'https://sandbox.orcid.org/oauth/jwks'
		}
	});
	expect(v.orcidEndpoints('https://sandbox.orcid.org').publicApi).toBe(
		'https://pub.sandbox.orcid.org'
	);
	expect(() => v.orcidEndpoints('https://sandbox.orcid.org.evil.test')).toThrow();
	expect(() => orcidAuthConfig('test', 'test', 'other')).toThrow();
});

test('configuration CLI defaults to offline dry-run and never logs credentials on failure', async () => {
	const env = {
		POCKETBASE_URL: 'http://example.invalid',
		POCKETBASE_ADMIN_EMAIL: 'not-a-real-admin@example.test',
		POCKETBASE_ADMIN_PASSWORD: 'do-not-print-test-password',
		ORCID_CLIENT_ID: 'test-client',
		ORCID_CLIENT_SECRET: 'do-not-print-test-secret'
	};
	for (const args of [[], ['--apply'], ['--prepare'], ['--prepare', '--apply']]) {
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
