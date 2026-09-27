import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(fileURLToPath(new URL('./Search.svelte', import.meta.url)), 'utf8');

test('does not run a deferred query after its results are closed', () => {
	expect(source).toContain('if (!showResults) return;');
	expect(source).toContain('searchRequests.schedule(() => void performSearch(searchQuery), 250);');
	expect(source).toContain('function cancelSearch()');
	expect(source).toContain('++searchRequest;');
	expect(source).toContain('searchRequests.cancel();');
});
