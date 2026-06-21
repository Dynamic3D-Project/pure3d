import { describe, expect, test } from 'bun:test';
import { rewriteSceneJson } from './svx-uri-rewriter';

describe('rewriteSceneJson', () => {
	test('returns input unchanged when scene has no uri entries', () => {
		const scene = { asset: { version: '1.0' }, scenes: [{ name: 'S' }] };
		const result = rewriteSceneJson(scene, {});
		expect(result).toEqual(scene);
	});

	test('rewrites a top-level model uri to the mapped absolute url', () => {
		const scene = { models: [{ uri: 'model.glb' }] };
		const fileMap = { 'model.glb': 'https://cdn.example/abc/model_xyz.glb' };
		const result = rewriteSceneJson(scene, fileMap) as typeof scene;
		expect(result.models[0].uri).toBe('https://cdn.example/abc/model_xyz.glb');
	});

	test('matches by basename when scene references a subfolder path', () => {
		const scene = { articles: [{ uri: 'articles/intro.html' }] };
		const fileMap = { 'intro.html': 'https://cdn.example/abc/intro_xyz.html' };
		const result = rewriteSceneJson(scene, fileMap) as typeof scene;
		expect(result.articles[0].uri).toBe('https://cdn.example/abc/intro_xyz.html');
	});

	test('matches PocketBase-normalized filenames with hyphens', () => {
		const scene = { models: [{ uri: 'workshop-artifact.obj' }] };
		const fileMap = { 'workshop_artifact.obj': 'https://cdn.example/abc/workshop_artifact_x.obj' };
		const result = rewriteSceneJson(scene, fileMap) as typeof scene;
		expect(result.models[0].uri).toBe('https://cdn.example/abc/workshop_artifact_x.obj');
	});

	test('leaves uri alone when no matching entry in fileMap', () => {
		const scene = { models: [{ uri: 'missing.glb' }] };
		const result = rewriteSceneJson(scene, {}) as typeof scene;
		expect(result.models[0].uri).toBe('missing.glb');
	});

	test('recurses into nested objects and arrays', () => {
		const scene = {
			scenes: [
				{
					nodes: [
						{ model: { uri: 'model.glb' } },
						{ annotations: [{ uri: 'note.html' }] }
					]
				}
			]
		};
		const fileMap = {
			'model.glb': 'https://a/model_1.glb',
			'note.html': 'https://a/note_1.html'
		};
		const result = rewriteSceneJson(scene, fileMap) as typeof scene;
		expect(result.scenes![0].nodes[0].model!.uri).toBe('https://a/model_1.glb');
		expect(result.scenes![0].nodes[1].annotations![0].uri).toBe('https://a/note_1.html');
	});

	test('does not mutate the input object', () => {
		const scene = { models: [{ uri: 'model.glb' }] };
		const original = JSON.parse(JSON.stringify(scene));
		rewriteSceneJson(scene, { 'model.glb': 'https://a/model_1.glb' });
		expect(scene).toEqual(original);
	});

	test('ignores non-string uri values defensively', () => {
		const scene = { weird: { uri: 42 } };
		const result = rewriteSceneJson(scene, {}) as typeof scene;
		expect(result.weird.uri).toBe(42);
	});
});
