<script lang="ts">
	import { pb } from '$lib/database/client';
	import type { RecordModel } from 'pocketbase';
	import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';
	import { rewriteSceneJson, type FileMap } from '$lib/utils/svx-uri-rewriter';
	import {
		getEditionRoot,
		DEFAULT_VOYAGER_VERSION
	} from '$lib/utils/asset-urls';

	type Props = {
		edition: RecordModel;
		collectionPubNum?: number | null;
		editionPubNum?: number | null;
		title?: string;
	};
	let { edition, collectionPubNum, editionPubNum, title = 'Edition preview' }: Props = $props();

	let modelFilename = $derived((edition.modelFile as string | undefined) ?? '');
	let sceneFilename = $derived((edition.sceneDocument as string | undefined) ?? '');

	let previewDocument = $state<string>('');
	let previewRoot = $state<string>('');
	let mode = $state<'scene' | 'model' | 'legacy' | 'empty'>('empty');
	let warnMissingModel = $state(false);
	let sceneFallbackError = $state(false);

	let activeBlobUrl: string | null = null;
	let runId = 0;
	let activeAbort: AbortController | null = null;

	$effect(() => {
		const myRun = ++runId;
		warnMissingModel = false;
		sceneFallbackError = false;
		activeAbort?.abort();
		activeAbort = new AbortController();
		const signal = activeAbort.signal;

		void resolvePreview(myRun, signal);

		return () => {
			if (activeBlobUrl) {
				URL.revokeObjectURL(activeBlobUrl);
				activeBlobUrl = null;
			}
			activeAbort?.abort();
			activeAbort = null;
		};
	});

	async function resolvePreview(myRun: number, signal: AbortSignal) {
		if (myRun !== runId) return;
		if (activeBlobUrl) {
			URL.revokeObjectURL(activeBlobUrl);
			activeBlobUrl = null;
		}

		if (sceneFilename) {
			await buildSceneBlob(myRun, signal);
			return;
		}
		if (modelFilename) {
			await buildModelFallbackBlob(myRun, signal);
			return;
		}
		if (collectionPubNum && editionPubNum) {
			previewRoot = getEditionRoot(collectionPubNum, editionPubNum);
			previewDocument = 'scene.svx.json';
			mode = 'legacy';
			return;
		}
		mode = 'empty';
	}

	function buildFileMap(): FileMap {
		const map: FileMap = {};
		if (modelFilename) {
			map[modelFilename] = pb.files.getUrl(edition, modelFilename);
		}
		if (sceneFilename) {
			map[sceneFilename] = pb.files.getUrl(edition, sceneFilename);
		}
		return map;
	}

	async function buildSceneBlob(myRun: number, signal: AbortSignal) {
		try {
			const sceneUrl = pb.files.getUrl(edition, sceneFilename);
			const resp = await fetch(sceneUrl, { signal });
			if (myRun !== runId) return;
			if (!resp.ok) throw new Error(`Scene fetch failed (${resp.status})`);
			const sceneJson = await resp.json();
			if (myRun !== runId) return;
			const rewritten = rewriteSceneJson(sceneJson, buildFileMap());
			warnMissingModel = sceneReferencesMissingModel(rewritten);
			const blob = new Blob([JSON.stringify(rewritten)], { type: 'application/json' });
			activeBlobUrl = URL.createObjectURL(blob);
			previewRoot = '';
			previewDocument = activeBlobUrl;
			mode = 'scene';
		} catch (err) {
			if (signal.aborted || myRun !== runId) return;
			console.warn('Scene document load failed, falling back to model:', err);
			warnMissingModel = false;
			sceneFallbackError = true;
			await buildModelFallbackBlob(myRun, signal);
		}
	}

	async function buildModelFallbackBlob(myRun: number, _signal: AbortSignal) {
		if (myRun !== runId) return;
		if (!modelFilename) {
			mode = 'empty';
			return;
		}
		const modelUrl = pb.files.getUrl(edition, modelFilename);
		const minimalScene = {
			asset: { type: 'application/si-dpo-3d.document+json', version: '1.0' },
			scene: 0,
			scenes: [{ name: 'Scene', units: 'cm', nodes: [0], setup: 0 }],
			nodes: [{ name: 'Model', model: 0 }],
			models: [
				{
					units: 'cm',
					derivatives: [
						{ usage: 'Web3D', quality: 'High', assets: [{ uri: modelUrl, type: 'Model', byteSize: 0 }] }
					]
				}
			],
			setups: [{}],
			metas: [],
			lights: [],
			cameras: []
		};
		const blob = new Blob([JSON.stringify(minimalScene)], { type: 'application/json' });
		activeBlobUrl = URL.createObjectURL(blob);
		previewRoot = '';
		previewDocument = activeBlobUrl;
		mode = 'model';
	}

	function sceneReferencesMissingModel(scene: unknown): boolean {
		if (modelFilename) return false;
		let found = false;
		const walk = (v: unknown) => {
			if (found) return;
			if (Array.isArray(v)) v.forEach(walk);
			else if (v && typeof v === 'object') {
				for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
					if (k === 'uri' && typeof val === 'string' && /\.(glb|gltf|obj|ply)(\?|$)/i.test(val)) {
						found = true;
						return;
					}
					walk(val);
				}
			}
		};
		walk(scene);
		return found;
	}
</script>

{#if mode === 'empty'}
	<div class="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-base-300 bg-base-200">
		<div class="text-center text-base-content/40">
			<p class="text-sm font-medium">3D Model Preview</p>
			<p class="mt-1 text-xs">Upload a model to see it here</p>
		</div>
	</div>
{:else}
	<div class="space-y-2">
		{#if warnMissingModel}
			<div class="alert alert-warning">
				<span class="text-xs">Scene references a missing model</span>
			</div>
		{/if}
		{#if sceneFallbackError}
			<div class="alert alert-warning">
				<span class="text-xs">Scene document failed to load — showing model only.</span>
			</div>
		{/if}
		<div class="card overflow-hidden bg-base-200 shadow-xl">
			<div class="card-body p-0">
				<VoyagerViewer
					url={previewRoot}
					document={previewDocument}
					{title}
					direct={true}
					voyagerVersion={DEFAULT_VOYAGER_VERSION}
				/>
			</div>
		</div>
	</div>
{/if}
