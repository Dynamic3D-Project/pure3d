import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(
	fileURLToPath(new URL('./VoyagerViewer.svelte', import.meta.url)),
	'utf8'
);
const editionPage = await readFile(
	fileURLToPath(new URL('../../../routes/editions/[slug]/+page.svelte', import.meta.url)),
	'utf8'
);

test('keeps custom viewer controls visible and reports unavailable actions', () => {
	expect(source).toContain('.sv-bottom-bar-container:not(.sv-tour-navigator):not(.sv-tool-bar)');
	expect(source).toContain('Measurement active — select two points on the model.');
	expect(source).toContain("querySelectorAll<HTMLElement>('.sv-tool-button')");
	expect(source).toContain('sv-property-boolean[name="Tape Tool"] ff-button');
	expect(source).toContain('ar: arAvailable');
	expect(source).toContain('AR is not available on this device or browser.');
	expect(editionPage).toContain("? 'View in AR (supported devices only)'");
	expect(editionPage).toContain(": 'AR is not available on this device or browser'");
	expect(editionPage).toContain('<span>Reset view</span>');
	expect(editionPage).toContain('left: 0.75rem;');
	expect(editionPage).toContain('flex-direction: column;');
});
