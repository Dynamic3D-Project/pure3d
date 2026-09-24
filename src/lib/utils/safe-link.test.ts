import { expect, test } from 'bun:test';
import { safeLinkHref } from './safe-link';

test('resolves content paths under the app base without duplicating it', () => {
	expect(safeLinkHref('/editions/one', '/preview')).toBe('/preview/editions/one');
	expect(safeLinkHref('/preview/editions/one', '/preview')).toBe('/preview/editions/one');
	expect(safeLinkHref('#details', '/preview')).toBe('#details');
	expect(safeLinkHref('https://example.org/file', '/preview')).toBe('https://example.org/file');
});

test('rejects executable and ambiguous content URLs', () => {
	for (const value of [
		'javascript:alert(1)',
		'java\nscript:alert(1)',
		'//other.test',
		'/\\other.test',
		'data:text/html,<script>alert(1)</script>',
		'relative/path'
	]) {
		expect(safeLinkHref(value, '/preview')).toBeUndefined();
	}
});

test('permits generated plain-text resources only for downloads', () => {
	const resource = 'data:text/plain;charset=utf-8,Hello%20world';
	expect(safeLinkHref(resource)).toBeUndefined();
	expect(safeLinkHref(resource, '', true)).toBe(resource);
	expect(safeLinkHref('data:text/html,hello', '', true)).toBeUndefined();
});
