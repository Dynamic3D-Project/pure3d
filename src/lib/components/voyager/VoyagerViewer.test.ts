import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(
	fileURLToPath(new URL('./VoyagerViewer.svelte', import.meta.url)),
	'utf8'
);
const editionView = await readFile(
	fileURLToPath(new URL('../editions/EditionView.svelte', import.meta.url)),
	'utf8'
);

test('keeps custom viewer controls visible and reports unavailable actions', () => {
	expect(source).toContain('.sv-bottom-bar-container:not(.sv-tour-navigator):not(.sv-tool-bar)');
	expect(source).toContain('Measurement active — select two points on the model.');
	expect(source).toContain("querySelectorAll<HTMLElement>('.sv-tool-button')");
	expect(source).toContain('sv-property-boolean[name="Tape Tool"] ff-button');
	expect(source).toContain('ar: arAvailable');
	expect(source).toContain('AR is not available on this device or browser.');
	expect(editionView).toContain("? 'View in AR (supported devices only)'");
	expect(editionView).toContain(": 'AR is not available on this device or browser'");
	expect(editionView).toContain('<span>Reset view</span>');
	expect(editionView).toContain('left: 0.75rem;');
	expect(editionView).toContain('flex-direction: column;');
});

test('uses CVViewer sceneLoaded rather than model-load event counts for readiness', () => {
	expect(source).toContain(".get?.('CVViewer')?.outs?.sceneLoaded");
	expect(source).toContain('const outputs = [sceneLoaded, assetPath, busy]');
	expect(source).toContain('emptySceneDocument = isEmptySceneDocument(source)');
	expect(source).toContain("output.on?.('value', update, scope)");
	expect(source).toContain("scope.defer(() => output.off?.('value', update, scope))");
	expect(source).toContain('handleRuntimeSceneLoaded');
	expect(source).not.toContain('onmodel-load={handleModelReady}');
});

test('keeps the edition cover reactive until the active viewer is ready', () => {
	expect(source).toContain('let sceneReady = $state(false)');
	expect(source).toContain('const viewerReady = $derived(direct ? sceneReady : iframeLoaded)');
	expect(source).toContain('class:is-ready={viewerReady}');
	expect(source).toContain('sceneLoaded === true && assetsBusy === false');
	expect(source).toContain('onload={handleIframeLoad}');
	expect(editionView).toContain('coverUrl={editionCoverUrl}');
});
