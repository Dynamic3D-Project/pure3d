import { expect, test } from 'bun:test';
import { sceneDocumentLabel } from './edition-metadata';

test('scene metadata omits access tokens and fragments', () => {
	expect(sceneDocumentLabel('scene.svx.json?token=private-token')).toBe('scene.svx.json');
	expect(sceneDocumentLabel('scene.svx.json?download=1&token=private-token#view')).toBe(
		'scene.svx.json'
	);
	expect(sceneDocumentLabel('scene.svx.json#private-fragment')).toBe('scene.svx.json');
});

test('scene metadata preserves legacy document paths without changing the source', () => {
	const source = 'project/12/edition/3/scene.svx.json?token=private-token';
	expect(sceneDocumentLabel(source)).toBe('project/12/edition/3/scene.svx.json');
	expect(source).toBe('project/12/edition/3/scene.svx.json?token=private-token');
	expect(sceneDocumentLabel('scene.svx.json')).toBe('scene.svx.json');
	expect(sceneDocumentLabel('')).toBe('');
});
