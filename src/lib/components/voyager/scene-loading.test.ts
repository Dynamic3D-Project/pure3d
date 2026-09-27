import { expect, test } from 'bun:test';
import { isEmptySceneDocument, isRuntimeSceneReady, SceneLoadingTracker } from './scene-loading';

test('recognizes a loaded empty document without treating a pending model scene as ready', () => {
	const state = {
		sceneLoaded: false,
		documentLoaded: true,
		emptyDocument: true,
		assetsBusy: false
	};
	expect(isRuntimeSceneReady(state)).toBe(true);
	expect(isRuntimeSceneReady({ ...state, documentLoaded: false })).toBe(false);
	expect(isRuntimeSceneReady({ ...state, assetsBusy: true })).toBe(false);
	expect(isRuntimeSceneReady({ ...state, emptyDocument: false })).toBe(false);
	expect(isRuntimeSceneReady({ ...state, emptyDocument: false, sceneLoaded: true })).toBe(true);
});

test('only accepts a valid active scene with no model references as empty', () => {
	expect(isEmptySceneDocument({ scenes: [{ nodes: [] }], nodes: [] })).toBe(true);
	expect(
		isEmptySceneDocument({ scenes: [{ nodes: [0] }], nodes: [{ children: [1] }, { model: 0 }] })
	).toBe(false);
	expect(isEmptySceneDocument({ scenes: [{ nodes: [0] }], nodes: [{ children: [0] }] })).toBe(true);
	expect(isEmptySceneDocument({ scenes: [{ nodes: [9] }], nodes: [] })).toBe(false);
	expect(isEmptySceneDocument(null)).toBe(false);
});

test('does not complete a multi-model scene when its first model becomes ready', () => {
	const loading = new SceneLoadingTracker();

	loading.downloadStarted();
	loading.downloadStarted();
	loading.downloadFinished();
	loading.modelLoaded();

	expect(loading.phase).toBe('downloading');

	loading.downloadFinished();
	expect(loading.phase).toBe('preparing');

	loading.modelLoaded();
	expect(loading.phase).toBe('preparing');
	loading.sceneLoaded();
	expect(loading.phase).toBe('complete');
});

test('waits for preparation even after all model bytes have downloaded', () => {
	const loading = new SceneLoadingTracker();

	loading.downloadStarted();
	loading.downloadFinished();

	expect(loading.phase).toBe('preparing');

	loading.modelLoaded();
	expect(loading.phase).toBe('preparing');
	loading.sceneLoaded();
	expect(loading.phase).toBe('complete');
});

test('does not complete when a later scene model has not started downloading yet', () => {
	const loading = new SceneLoadingTracker();

	loading.downloadStarted();
	loading.downloadFinished();
	loading.modelLoaded();

	expect(loading.phase).toBe('preparing');
});

test('does not complete after extra quality-level model events without runtime scene readiness', () => {
	const loading = new SceneLoadingTracker();

	for (let index = 0; index < 17; index++) loading.modelLoaded();

	expect(loading.phase).toBe('preparing');
	loading.sceneLoaded();
	expect(loading.phase).toBe('complete');
});

test('completes an empty scene only after Voyager reports runtime scene readiness', () => {
	const loading = new SceneLoadingTracker();

	expect(loading.phase).toBe('preparing');
	loading.sceneLoaded();
	expect(loading.phase).toBe('complete');
});
