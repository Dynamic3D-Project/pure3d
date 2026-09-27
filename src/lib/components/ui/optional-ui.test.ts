import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const component = async (name: string) =>
	readFile(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');

test('defers optional rich feedback editing until the dialog opens', async () => {
	const source = await component('FeedbackPill.svelte');

	expect(source).not.toContain(
		"import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte'"
	);
	expect(source).toContain("import('$lib/components/ui/RichTextEditor.svelte')");
});

test('defers administrator menu editors from shared navigation', async () => {
	const [header, footer] = await Promise.all([
		component('Header.svelte'),
		component('SiteFooter.svelte')
	]);

	for (const source of [header, footer]) {
		expect(source).not.toContain(
			"import ContextualMenuEditor from '$lib/components/ui/ContextualMenuEditor.svelte'"
		);
		expect(source).toContain("import('$lib/components/ui/ContextualMenuEditor.svelte')");
	}
});
