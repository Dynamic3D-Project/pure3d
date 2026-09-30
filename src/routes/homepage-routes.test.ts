import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

async function routeSource(relativePath: string) {
	return readFile(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

test('serves the new homepage at root and preserves the previous homepage at /home1', async () => {
	const [root, home1] = await Promise.all([
		routeSource('./+page.svelte'),
		routeSource('./home1/+page.svelte')
	]);
	expect(root).toContain("import Home3 from './home3/Home3.svelte'");
	expect(root).toContain('<Home3 />');
	expect(home1).toContain('class="hero-editions"');
	expect(home1).toContain('Collections as <em>scholarly contexts</em>');
});
