# Edition File Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable cover image, 3D model, and SVX scene uploads on the `editions` collection via PocketBase file fields, backed by local disk in dev and Cloudflare R2 in production, with a live Voyager preview driven by a pure at-view SVX URI rewriter.

**Architecture:** Files stored via PocketBase `file` fields (one backend config away from S3). The `/new` route creates a draft on first user interaction and redirects to `/editions/<id>/workflow`, where shared upload components live alongside the existing Voyager viewer. A pure JSON rewriter (unit-tested with bun test) substitutes SVX scene URIs at view time so uploaded scenes render correctly despite PocketBase's filename munging.

**Tech Stack:** SvelteKit (adapter-static) + Svelte 5 runes, PocketBase JS SDK, Cloudflare R2 via PB's S3 integration, bun (runtime + test runner).

**Spec:** `docs/superpowers/specs/2026-04-17-edition-file-uploads-design.md`

---

## Task 1: Add schema fields to `editions` via setup script

**Files:**
- Modify: `scripts/create-pocketbase-collections.ts` (around the editions fields block near line 317)

- [ ] **Step 1: Add three file-field entries inside the `editions` fields array**

Open `scripts/create-pocketbase-collections.ts`. Inside the array passed to `ensureCollection({ name: 'editions', ... })` (the block that currently ends with `settingsSceneFile`), append these three fields after `settingsSceneFile`:

```ts
{
    name: 'coverImage',
    type: 'file',
    required: false,
    maxSelect: 1,
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    thumbs: ['400x300', '100x100']
},
{
    name: 'modelFile',
    type: 'file',
    required: false,
    maxSelect: 1,
    maxSize: 500 * 1024 * 1024,
    mimeTypes: ['application/octet-stream', 'model/gltf-binary', 'model/gltf+json']
},
{
    name: 'sceneDocument',
    type: 'file',
    required: false,
    maxSelect: 1,
    maxSize: 0,
    mimeTypes: ['application/json']
}
```

Note the last existing field line (`settingsSceneFile`) needs a trailing comma after it.

- [ ] **Step 2: Run the setup script against the running PocketBase**

```bash
docker compose up -d pocketbase
docker compose run --rm pocketbase-setup bun scripts/create-pocketbase-collections.ts
```

Expected: script logs show `editions` collection updated, no errors.

- [ ] **Step 3: Verify the fields exist via PocketBase API**

```bash
curl -s http://localhost:8090/api/collections/editions \
  -H "Authorization: $(curl -s -X POST http://localhost:8090/api/collections/_superusers/auth-with-password \
    -H 'Content-Type: application/json' \
    -d '{"identity":"admin@admin.local","password":"1234567890"}' | jq -r '.token')" \
  | jq '.fields[] | select(.name == "coverImage" or .name == "modelFile" or .name == "sceneDocument") | {name, type, maxSize}'
```

Expected: three JSON objects describing each file field.

- [ ] **Step 4: Commit**

```bash
git add scripts/create-pocketbase-collections.ts
git commit -m "feat: add coverImage, modelFile, sceneDocument file fields to editions"
```

---

## Task 2: Export updated schema snapshot

**Files:**
- Modify: `pocketbase/pb_schema/collections.json`

- [ ] **Step 1: Re-export the schema**

```bash
bash scripts/export-schema.sh
```

This reads the running PocketBase and overwrites `pocketbase/pb_schema/collections.json` with the current schema (including the new fields from Task 1).

- [ ] **Step 2: Verify the diff contains exactly the three new fields**

```bash
git diff pocketbase/pb_schema/collections.json | grep -E '"name": "(coverImage|modelFile|sceneDocument)"'
```

Expected: three matching lines.

- [ ] **Step 3: Commit**

```bash
git add pocketbase/pb_schema/collections.json
git commit -m "chore: refresh editions schema snapshot"
```

---

## Task 3: Configure PocketBase S3 + upload size in the setup script

**Files:**
- Modify: `scripts/create-pocketbase-collections.ts` (end of `main()`)
- Modify: `docker-compose.yml` (env block of `pocketbase-setup`)
- Modify: `.env.example`

- [ ] **Step 1: Add env var forwarding to `pocketbase-setup` in `docker-compose.yml`**

Inside the `pocketbase-setup` service's `environment:` block (which currently lists `POCKETBASE_URL` through `POCKETBASE_ADMIN_PASSWORD`), append:

```yaml
      - R2_ENDPOINT=${R2_ENDPOINT:-}
      - R2_BUCKET=${R2_BUCKET:-}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID:-}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY:-}
```

- [ ] **Step 2: Update `.env.example`**

Replace the existing R2 credentials block with:

```
# R2 / S3 settings (production only). Leave empty for local-disk storage in dev.
R2_ENDPOINT=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
```

- [ ] **Step 3: Add S3 + upload-size config at the end of `main()` in the setup script**

Open `scripts/create-pocketbase-collections.ts`. Locate the final `console.log` line inside `main()` (before the closing brace). Insert this block immediately before that final log:

```ts
	// Configure storage + upload limits. Missing R2_* env vars → local disk (dev).
	const maxUploadBytes = 500 * 1024 * 1024;
	const settingsPayload: Record<string, unknown> = {
		meta: { bodyLimit: maxUploadBytes }
	};

	const r2Endpoint = process.env.R2_ENDPOINT;
	const r2Bucket = process.env.R2_BUCKET;
	const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
	const r2Secret = process.env.R2_SECRET_ACCESS_KEY;

	if (r2Endpoint && r2Bucket && r2AccessKey && r2Secret) {
		console.log('📦 Configuring S3 storage (R2)');
		settingsPayload.s3 = {
			enabled: true,
			bucket: r2Bucket,
			region: 'auto',
			endpoint: r2Endpoint,
			accessKey: r2AccessKey,
			secret: r2Secret,
			forcePathStyle: true
		};
	} else {
		console.log('📁 Using local-disk storage (R2 env vars not set)');
	}

	try {
		// @ts-expect-error — pb.settings.update exists at runtime on the SDK
		await pb.settings.update(settingsPayload);
	} catch (err) {
		console.warn('⚠️  Could not apply storage settings:', (err as Error).message);
	}
```

- [ ] **Step 4: Run the setup script and confirm it applies settings without error**

```bash
docker compose run --rm pocketbase-setup bun scripts/create-pocketbase-collections.ts
```

Expected: log line `📁 Using local-disk storage (R2 env vars not set)` (since dev `.env` leaves them empty). No errors.

- [ ] **Step 5: Verify body-limit is raised**

```bash
curl -s http://localhost:8090/api/settings \
  -H "Authorization: $(curl -s -X POST http://localhost:8090/api/collections/_superusers/auth-with-password \
    -H 'Content-Type: application/json' \
    -d '{"identity":"admin@admin.local","password":"1234567890"}' | jq -r '.token')" \
  | jq '.meta.bodyLimit // "setting-not-present"'
```

Expected: `524288000` (or whatever the correct key is — see Step 6 if this returns `"setting-not-present"`).

- [ ] **Step 6: If the body-limit key was wrong, find the right one**

Modern PocketBase (v0.22+) stores body size under `meta.bodyLimit` or similar. If Step 5 returned `"setting-not-present"`, inspect the full settings payload:

```bash
curl -s http://localhost:8090/api/settings \
  -H "Authorization: <same-token-as-above>" \
  | jq '.'
```

Find the key that controls per-request body size (look for anything with `limit`/`maxBody`/`size` in the name). Update the `settingsPayload` in the script's step-3 code to use the correct key, rerun Step 4, repeat Step 5 until it returns `524288000`.

- [ ] **Step 7: Commit**

```bash
git add scripts/create-pocketbase-collections.ts docker-compose.yml .env.example
git commit -m "feat: configure PocketBase S3 + upload size from env on startup"
```

---

## Task 4: Write failing test for SVX URI rewriter

**Files:**
- Create: `src/lib/utils/svx-uri-rewriter.test.ts`

- [ ] **Step 1: Create the test file**

```ts
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
		expect(result.scenes[0].nodes[0].model.uri).toBe('https://a/model_1.glb');
		expect(result.scenes[0].nodes[1].annotations[0].uri).toBe('https://a/note_1.html');
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test src/lib/utils/svx-uri-rewriter.test.ts
```

Expected: FAIL with "Cannot find module './svx-uri-rewriter'" or equivalent.

---

## Task 5: Implement SVX URI rewriter to pass tests

**Files:**
- Create: `src/lib/utils/svx-uri-rewriter.ts`

- [ ] **Step 1: Write the implementation**

```ts
export type FileMap = Record<string, string>;

function basename(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? path : path.slice(slash + 1);
}

function rewriteValue(value: unknown, fileMap: FileMap): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => rewriteValue(item, fileMap));
	}
	if (value && typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
			if (key === 'uri' && typeof v === 'string') {
				const mapped = fileMap[basename(v)];
				result[key] = mapped ?? v;
			} else {
				result[key] = rewriteValue(v, fileMap);
			}
		}
		return result;
	}
	return value;
}

export function rewriteSceneJson<T extends object>(scene: T, fileMap: FileMap): T {
	return rewriteValue(scene, fileMap) as T;
}
```

- [ ] **Step 2: Run tests to verify all pass**

```bash
bun test src/lib/utils/svx-uri-rewriter.test.ts
```

Expected: 7 passing tests, 0 failures.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/svx-uri-rewriter.ts src/lib/utils/svx-uri-rewriter.test.ts
git commit -m "feat: add pure SVX scene URI rewriter with tests"
```

---

## Task 6: Generic `FileUploadField.svelte` component

**Files:**
- Create: `src/lib/components/uploads/FileUploadField.svelte`

- [ ] **Step 1: Implement the generic component**

```svelte
<script lang="ts">
	import { pb } from '$lib/database/client';
	import type { RecordModel } from 'pocketbase';
	import toast from 'svelte-french-toast';

	type Props = {
		record: RecordModel;
		collectionName: string;
		fieldName: string;
		accept: string;
		maxSize: number;
		allowedExtensions?: string[];
		disabled?: boolean;
		onuploaded?: (record: RecordModel) => void;
		onremoved?: (record: RecordModel) => void;
		preview?: (args: { filename: string; url: string }) => unknown;
		emptyPreview?: () => unknown;
	};

	let {
		record,
		collectionName,
		fieldName,
		accept,
		maxSize,
		allowedExtensions,
		disabled = false,
		onuploaded,
		onremoved,
		preview,
		emptyPreview
	}: Props = $props();

	let currentFilename = $derived((record as any)[fieldName] as string | '');
	let progress = $state(0);
	let uploading = $state(false);
	let errorMsg = $state('');
	let pendingFile = $state<File | null>(null);
	let currentXhr: XMLHttpRequest | null = null;
	let inputEl: HTMLInputElement | undefined = $state();

	function humanSize(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
		return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}

	function validate(file: File): string | null {
		if (maxSize > 0 && file.size > maxSize) {
			return `File is ${humanSize(file.size)}, max allowed is ${humanSize(maxSize)}`;
		}
		if (allowedExtensions && allowedExtensions.length > 0) {
			const lower = file.name.toLowerCase();
			if (!allowedExtensions.some((ext) => lower.endsWith(ext.toLowerCase()))) {
				return `Extension not allowed. Accepted: ${allowedExtensions.join(', ')}`;
			}
		}
		return null;
	}

	function upload(file: File) {
		const vErr = validate(file);
		if (vErr) {
			errorMsg = vErr;
			return;
		}

		if (currentXhr) {
			currentXhr.abort();
			currentXhr = null;
		}

		uploading = true;
		errorMsg = '';
		progress = 0;
		pendingFile = file;

		const form = new FormData();
		form.append(fieldName, file);

		const xhr = new XMLHttpRequest();
		currentXhr = xhr;
		const url = `${pb.baseUrl}/api/collections/${collectionName}/records/${record.id}`;
		xhr.open('PATCH', url);
		const token = pb.authStore.token;
		if (token) xhr.setRequestHeader('Authorization', token);

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) {
				progress = Math.round((e.loaded / e.total) * 100);
			}
		};

		xhr.onload = async () => {
			currentXhr = null;
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const updated = await pb.collection(collectionName).getOne(record.id);
					record = updated;
					onuploaded?.(updated);
					pendingFile = null;
					progress = 0;
				} catch (err) {
					errorMsg = (err as Error).message || 'Failed to refresh record';
				}
			} else {
				let msg = `Upload failed (${xhr.status})`;
				try {
					const body = JSON.parse(xhr.responseText);
					msg = body?.message || msg;
				} catch {
					/* noop */
				}
				errorMsg = msg;
				toast.error(msg);
			}
			uploading = false;
		};

		xhr.onerror = () => {
			currentXhr = null;
			uploading = false;
			errorMsg = 'Network error';
			toast.error('Network error while uploading');
		};

		xhr.onabort = () => {
			currentXhr = null;
			uploading = false;
		};

		xhr.send(form);
	}

	function onFilePicked(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) upload(file);
	}

	async function remove() {
		if (!currentFilename) return;
		try {
			const updated = await pb.collection(collectionName).update(record.id, {
				[`${fieldName}-`]: true
			});
			record = updated;
			onremoved?.(updated);
		} catch (err) {
			toast.error((err as Error).message || 'Failed to remove file');
		}
	}

	function retry() {
		if (pendingFile) upload(pendingFile);
	}

	function pick() {
		inputEl?.click();
	}

	let fileUrl = $derived(currentFilename ? pb.files.getUrl(record, currentFilename) : '');
</script>

<div class="space-y-2">
	<input
		bind:this={inputEl}
		type="file"
		{accept}
		class="hidden"
		{disabled}
		onchange={onFilePicked}
	/>

	{#if currentFilename && !uploading}
		{#if preview}
			{@render preview({ filename: currentFilename, url: fileUrl })}
		{:else}
			<div class="text-xs">{currentFilename}</div>
		{/if}
		<div class="flex gap-2">
			<button type="button" class="btn btn-outline btn-xs" onclick={pick} {disabled}>
				Replace
			</button>
			<button type="button" class="btn btn-ghost btn-xs" onclick={remove} {disabled}>
				Remove
			</button>
		</div>
	{:else if uploading}
		<div class="space-y-1">
			<div class="text-xs text-base-content/60">Uploading {humanSize(pendingFile?.size ?? 0)}...</div>
			<progress class="progress w-full progress-primary" value={progress} max="100"></progress>
			<div class="text-xs text-base-content/40">{progress}%</div>
		</div>
	{:else}
		{#if emptyPreview}
			{@render emptyPreview()}
		{/if}
		<button type="button" class="btn btn-outline btn-sm w-full" onclick={pick} {disabled}>
			Choose file
		</button>
	{/if}

	{#if errorMsg}
		<div class="alert alert-sm alert-error">
			<span class="text-xs">{errorMsg}</span>
			{#if pendingFile}
				<button type="button" class="btn btn-ghost btn-xs" onclick={retry}>Retry</button>
			{/if}
		</div>
	{/if}
</div>
```

- [ ] **Step 2: Type-check the file**

```bash
bun run check 2>&1 | grep -A2 "FileUploadField"
```

Expected: no errors mentioning `FileUploadField.svelte`. (If `bun run check` hits pre-existing errors in other files, that's fine — only verify this new file is clean.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/uploads/FileUploadField.svelte
git commit -m "feat: add generic FileUploadField component"
```

---

## Task 7: Specialised upload wrappers

**Files:**
- Create: `src/lib/components/uploads/CoverImageUpload.svelte`
- Create: `src/lib/components/uploads/ModelFileUpload.svelte`
- Create: `src/lib/components/uploads/SceneDocumentUpload.svelte`

- [ ] **Step 1: Create `CoverImageUpload.svelte`**

```svelte
<script lang="ts">
	import { pb } from '$lib/database/client';
	import type { RecordModel } from 'pocketbase';
	import FileUploadField from './FileUploadField.svelte';

	type Props = {
		record: RecordModel;
		disabled?: boolean;
		onuploaded?: (r: RecordModel) => void;
		onremoved?: (r: RecordModel) => void;
	};
	let { record, disabled, onuploaded, onremoved }: Props = $props();
</script>

<FileUploadField
	{record}
	collectionName="editions"
	fieldName="coverImage"
	accept="image/jpeg,image/png,image/webp,image/avif"
	maxSize={20 * 1024 * 1024}
	{disabled}
	{onuploaded}
	{onremoved}
>
	{#snippet preview({ filename, url })}
		<div class="overflow-hidden rounded-lg border border-base-300">
			<img
				src={pb.files.getUrl(record, filename, { thumb: '400x300' })}
				alt="Cover"
				class="aspect-[4/3] w-full object-cover"
			/>
		</div>
	{/snippet}
	{#snippet emptyPreview()}
		<div class="flex aspect-[4/3] items-center justify-center rounded-lg border-2 border-dashed border-base-300 bg-base-200">
			<div class="text-center text-base-content/40">
				<p class="text-xs">Cover Image</p>
				<p class="mt-1 text-xs">JPG, PNG, WebP, AVIF (max 20 MB)</p>
			</div>
		</div>
	{/snippet}
</FileUploadField>
```

- [ ] **Step 2: Create `ModelFileUpload.svelte`**

```svelte
<script lang="ts">
	import type { RecordModel } from 'pocketbase';
	import FileUploadField from './FileUploadField.svelte';

	type Props = {
		record: RecordModel;
		disabled?: boolean;
		onuploaded?: (r: RecordModel) => void;
		onremoved?: (r: RecordModel) => void;
	};
	let { record, disabled, onuploaded, onremoved }: Props = $props();
</script>

<FileUploadField
	{record}
	collectionName="editions"
	fieldName="modelFile"
	accept=".glb,.gltf,.obj,.ply"
	allowedExtensions={['.glb', '.gltf', '.obj', '.ply']}
	maxSize={500 * 1024 * 1024}
	{disabled}
	{onuploaded}
	{onremoved}
>
	{#snippet preview({ filename })}
		<div class="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 px-3 py-2.5">
			<span class="truncate text-xs">{filename}</span>
		</div>
	{/snippet}
	{#snippet emptyPreview()}
		<div class="flex items-center gap-2 rounded-lg border border-dashed border-base-300 bg-base-200 px-3 py-2.5">
			<span class="text-xs text-base-content/40">No model file</span>
		</div>
	{/snippet}
</FileUploadField>
```

- [ ] **Step 3: Create `SceneDocumentUpload.svelte`**

```svelte
<script lang="ts">
	import type { RecordModel } from 'pocketbase';
	import FileUploadField from './FileUploadField.svelte';

	type Props = {
		record: RecordModel;
		disabled?: boolean;
		onuploaded?: (r: RecordModel) => void;
		onremoved?: (r: RecordModel) => void;
	};
	let { record, disabled, onuploaded, onremoved }: Props = $props();
</script>

<FileUploadField
	{record}
	collectionName="editions"
	fieldName="sceneDocument"
	accept=".json,.svx,application/json"
	allowedExtensions={['.json', '.svx']}
	maxSize={0}
	{disabled}
	{onuploaded}
	{onremoved}
>
	{#snippet preview({ filename })}
		<div class="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 px-3 py-2.5">
			<span class="truncate text-xs">{filename}</span>
			<span class="badge badge-sm badge-ghost">SVX</span>
		</div>
	{/snippet}
	{#snippet emptyPreview()}
		<div class="flex items-center gap-2 rounded-lg border border-dashed border-base-300 bg-base-200 px-3 py-2.5">
			<span class="text-xs text-base-content/40">No scene file</span>
		</div>
	{/snippet}
</FileUploadField>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/uploads/CoverImageUpload.svelte \
        src/lib/components/uploads/ModelFileUpload.svelte \
        src/lib/components/uploads/SceneDocumentUpload.svelte
git commit -m "feat: add cover/model/scene upload wrapper components"
```

---

## Task 8: `VoyagerPreview.svelte` with resolution order + rewriter

**Files:**
- Create: `src/lib/components/uploads/VoyagerPreview.svelte`

- [ ] **Step 1: Create the component**

```svelte
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

	let modelFilename = $derived((edition as any).modelFile as string | '');
	let sceneFilename = $derived((edition as any).sceneDocument as string | '');

	let previewUrl = $state<string>('');
	let previewDocument = $state<string>('');
	let previewRoot = $state<string>('');
	let mode = $state<'scene' | 'model' | 'legacy' | 'empty'>('empty');
	let warnMissingModel = $state(false);

	let activeBlobUrl: string | null = null;

	$effect(() => {
		warnMissingModel = false;
		void resolvePreview();
		return () => {
			if (activeBlobUrl) {
				URL.revokeObjectURL(activeBlobUrl);
				activeBlobUrl = null;
			}
		};
	});

	async function resolvePreview() {
		if (activeBlobUrl) {
			URL.revokeObjectURL(activeBlobUrl);
			activeBlobUrl = null;
		}

		if (sceneFilename) {
			await buildSceneBlob();
			return;
		}
		if (modelFilename) {
			await buildModelFallbackBlob();
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

	async function buildSceneBlob() {
		try {
			const sceneUrl = pb.files.getUrl(edition, sceneFilename);
			const resp = await fetch(sceneUrl);
			if (!resp.ok) throw new Error(`Scene fetch failed (${resp.status})`);
			const sceneJson = await resp.json();
			const rewritten = rewriteSceneJson(sceneJson, buildFileMap());
			warnMissingModel = sceneReferencesMissingModel(rewritten);
			const blob = new Blob([JSON.stringify(rewritten)], { type: 'application/json' });
			activeBlobUrl = URL.createObjectURL(blob);
			previewRoot = '';
			previewDocument = activeBlobUrl;
			mode = 'scene';
		} catch {
			await buildModelFallbackBlob();
		}
	}

	async function buildModelFallbackBlob() {
		if (!modelFilename) {
			mode = 'empty';
			return;
		}
		const modelUrl = pb.files.getUrl(edition, modelFilename);
		const minimalScene = {
			asset: { type: 'application/si-dpo-3d.document+json', version: '1.0' },
			scene: 0,
			scenes: [{ name: 'Scene', units: 'cm', nodes: [0] }],
			nodes: [{ name: 'Model', model: 0 }],
			models: [{ units: 'cm', derivatives: [{ usage: 'Web3D', quality: 'High', assets: [{ uri: modelUrl, type: 'Model', byteSize: 0 }] }] }]
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
					if (k === 'uri' && typeof val === 'string' && /\.(glb|gltf|obj|ply)$/i.test(val)) {
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
			<div class="alert alert-warning alert-sm">
				<span class="text-xs">Scene references a missing model</span>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/uploads/VoyagerPreview.svelte
git commit -m "feat: add VoyagerPreview with scene/model/legacy fallback"
```

---

## Task 9: Compose `EditionAssetsPanel.svelte`

**Files:**
- Create: `src/lib/components/uploads/EditionAssetsPanel.svelte`

- [ ] **Step 1: Create the composed panel**

```svelte
<script lang="ts">
	import type { RecordModel } from 'pocketbase';
	import CoverImageUpload from './CoverImageUpload.svelte';
	import ModelFileUpload from './ModelFileUpload.svelte';
	import SceneDocumentUpload from './SceneDocumentUpload.svelte';
	import VoyagerPreview from './VoyagerPreview.svelte';

	type Props = {
		edition: RecordModel;
		collectionPubNum?: number | null;
		editionPubNum?: number | null;
		disabled?: boolean;
		onupdated?: (r: RecordModel) => void;
	};
	let {
		edition = $bindable(),
		collectionPubNum,
		editionPubNum,
		disabled = false,
		onupdated
	}: Props = $props();

	function handleUpdated(r: RecordModel) {
		edition = r;
		onupdated?.(r);
	}
</script>

<div class="space-y-4">
	<VoyagerPreview {edition} {collectionPubNum} {editionPubNum} title={edition.title || 'Edition preview'} />

	<div class="rounded-xl border border-base-300 bg-base-100 p-5">
		<h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">
			3D Model Files
		</h3>
		<div class="space-y-3">
			<div>
				<div class="mb-1 text-xs text-base-content/60">Model file</div>
				<ModelFileUpload
					{edition}
					{disabled}
					onuploaded={handleUpdated}
					onremoved={handleUpdated}
				/>
			</div>
			<div>
				<div class="mb-1 text-xs text-base-content/60">Scene file (SVX)</div>
				<SceneDocumentUpload
					{edition}
					{disabled}
					onuploaded={handleUpdated}
					onremoved={handleUpdated}
				/>
			</div>
		</div>
	</div>

	<div class="rounded-xl border border-base-300 bg-base-100 p-5">
		<h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">
			Cover Image
		</h3>
		<CoverImageUpload
			{edition}
			{disabled}
			onuploaded={handleUpdated}
			onremoved={handleUpdated}
		/>
	</div>
</div>
```

Note the `ModelFileUpload`/`CoverImageUpload`/`SceneDocumentUpload` components take a `record` prop named `record` in Task 7; update the call sites here. Fix: change `{edition}` to `record={edition}` in each call.

- [ ] **Step 2: Fix the prop name**

Replace each instance of the pattern `<XxxUpload {edition}` in the file you just wrote with `<XxxUpload record={edition}` — three occurrences.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/uploads/EditionAssetsPanel.svelte
git commit -m "feat: add EditionAssetsPanel composing all edition uploads + preview"
```

---

## Task 10: Convert `/new` into first-interaction bootstrap

**Files:**
- Modify: `src/routes/collections/[slug]/editions/new/+page.svelte`

- [ ] **Step 1: Replace the page contents**

Overwrite the entire file with:

```svelte
<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { hasPermission } from '$lib/utils/permissions';
	import { Permission, CollectionRole, EditionStatus, type UserRoleContext } from '$lib/types/roles';
	import toast from 'svelte-french-toast';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let collection = $derived(data.collection);

	let title = $state('');
	let creating = $state(false);
	let authorized = $state<boolean | null>(null);
	let collectionRole = $state<CollectionRole | undefined>(undefined);
	let roleContext = $derived<UserRoleContext>({
		globalRole: authStore.globalRole,
		collectionRole
	});
	let canCreate = $derived(hasPermission(roleContext, Permission.EditionCreate));

	onMount(async () => {
		if (authStore.appUserId && collection.id) {
			try {
				const result = await pb.collection('collectionUsers').getList(1, 1, {
					filter: `collection = "${collection.id}" && userId = "${authStore.appUserId}"`
				});
				if (result.items.length > 0) {
					collectionRole = result.items[0].role as CollectionRole;
				}
			} catch {
				/* no-op */
			}
		}
		authorized = canCreate;
	});

	async function createDraftAndRedirect() {
		if (creating) return;
		if (!title.trim()) {
			toast.error('Title is required');
			return;
		}
		creating = true;
		try {
			const record = await pb.collection('editions').create({
				title: title.trim(),
				collection: collection.id,
				status: EditionStatus.Draft,
				isPublished: false
			});
			if (authStore.appUserId) {
				try {
					await pb.collection('editionUsers').create({
						edition: record.id,
						editionId: record.id,
						user: authStore.appUserId,
						userId: authStore.appUserId,
						role: 'author'
					});
				} catch {
					/* non-critical */
				}
			}
			goto(`${base}/editions/${record.id}/workflow`);
		} catch (e: unknown) {
			toast.error((e as Error)?.message || 'Failed to create edition');
			creating = false;
		}
	}
</script>

<svelte:head>
	<title>New Edition | {collection.title} | Pure 3D</title>
</svelte:head>

<div class="container mx-auto max-w-xl px-4 py-12">
	<nav class="breadcrumbs mb-4 text-sm">
		<ul>
			<li><a href="{base}/" class="link link-hover">Home</a></li>
			<li><a href="{base}/collections" class="link link-hover">Collections</a></li>
			<li><a href="{base}/collections/{collection.id}" class="link link-hover">{collection.title}</a></li>
			<li class="text-base-content/70">New Edition</li>
		</ul>
	</nav>

	{#if authorized === null}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if !authorized}
		<div class="alert alert-error">
			<span>You don't have permission to create editions in this collection.</span>
		</div>
	{:else}
		<div class="space-y-4">
			<div>
				<h1 class="text-2xl font-bold">New Edition</h1>
				<p class="text-sm text-base-content/60">in <strong>{collection.title}</strong></p>
			</div>
			<form onsubmit={(e) => { e.preventDefault(); createDraftAndRedirect(); }} class="space-y-3">
				<div class="form-control">
					<label class="label" for="title">
						<span class="label-text font-medium">Title *</span>
					</label>
					<input
						id="title"
						type="text"
						class="input-bordered input"
						bind:value={title}
						required
						placeholder="Edition title"
						disabled={creating}
					/>
					<p class="mt-1 text-xs text-base-content/50">
						You'll continue editing — including uploading files — on the next page.
					</p>
				</div>
				<div class="flex justify-end gap-2">
					<a href="{base}/collections/{collection.id}" class="btn btn-ghost btn-sm">Cancel</a>
					<button type="submit" class="btn btn-primary btn-sm" disabled={creating || !title.trim()}>
						{#if creating}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Continue
					</button>
				</div>
			</form>
		</div>
	{/if}
</div>
```

- [ ] **Step 2: Smoke-test manually**

```bash
docker compose up -d
```

Visit `http://localhost:8080/collections/<any-collection-id>/editions/new`, enter a title, click Continue. Expected: redirect to `/editions/<new-id>/workflow` with the draft created.

- [ ] **Step 3: Commit**

```bash
git add src/routes/collections/[slug]/editions/new/+page.svelte
git commit -m "feat: reduce new-edition route to title + create-draft + redirect"
```

---

## Task 11: Wire `EditionAssetsPanel` into the workflow page

**Files:**
- Modify: `src/routes/editions/[slug]/workflow/+page.svelte`

- [ ] **Step 1: Add the import near the top of the `<script>` block**

Add alongside the other component imports (near where `VoyagerViewer` is currently imported, or in the same import group):

```ts
import EditionAssetsPanel from '$lib/components/uploads/EditionAssetsPanel.svelte';
```

- [ ] **Step 2: Identify the `collectionPubNum` and `editionPubNum` variables currently in scope**

Run:

```bash
grep -n "collectionPubNum\|editionPubNum\|voyagerRoot\|hasScene" src/routes/editions/\[slug\]/workflow/+page.svelte | head -20
```

Record which `$state` / `$derived` names hold these values.

- [ ] **Step 3: Replace the "Left Column: 3D Viewer or Upload" block**

In the template, find the block identified earlier (starts around line 538 with `<!-- Left Column: 3D Viewer or Upload -->` and ends before the cover-image upload block at the closing `</div>` before `<!-- Right Column: Tabbed Sidebar -->`). Replace the entire left column's viewer + upload placeholders with:

```svelte
<!-- Left Column: 3D Viewer + Asset Uploads -->
<div class="min-w-0 flex-1 space-y-4">
	{#if edition}
		<EditionAssetsPanel
			edition={edition}
			collectionPubNum={collectionPubNum}
			editionPubNum={editionPubNum}
			onupdated={(r) => (edition = r)}
		/>
	{/if}
</div>
```

Also delete the separate "Cover image upload (below viewer)" block that follows — the `EditionAssetsPanel` handles cover upload inside itself.

If the current page uses a different variable name than `edition` for the loaded record, substitute accordingly. If `collectionPubNum` / `editionPubNum` are not currently derived, add them as `$derived` from the existing edition/collection state.

- [ ] **Step 4: Manually verify end-to-end**

```bash
docker compose up -d
```

1. Create a new edition via `/new` (Task 10).
2. On the workflow page, upload a small GLB model. Confirm the progress bar appears and the filename shows on success.
3. Confirm the Voyager preview renders the model (model-only fallback, Tier 1).
4. Upload a test SVX scene referencing the model by basename. Confirm the preview re-renders from the scene (Tier 2).
5. Upload a cover image. Confirm the thumbnail displays.
6. Reload the page. Confirm all three files persist and the preview still renders.

- [ ] **Step 5: Commit**

```bash
git add src/routes/editions/[slug]/workflow/+page.svelte
git commit -m "feat: wire EditionAssetsPanel into edition workflow page"
```

---

## Task 12: Asset URL helper update

**Files:**
- Modify: `src/lib/utils/asset-urls.ts`

- [ ] **Step 1: Add `getEditionCoverUrl` helper**

Append to the end of `src/lib/utils/asset-urls.ts` (after the `VoyagerVersion` export):

```ts
import type { RecordModel } from 'pocketbase';
import { pb } from '$lib/database/client';

export function getEditionCoverUrl(
	edition: RecordModel,
	collectionPubNum?: number | null,
	editionPubNum?: number | null
): string | null {
	const coverImage = (edition as any).coverImage as string | '';
	if (coverImage) return pb.files.getUrl(edition, coverImage, { thumb: '400x300' });
	const thumbnail = (edition as any).thumbnail as string | '';
	if (thumbnail) return thumbnail;
	if (collectionPubNum && editionPubNum) {
		return getEditionThumbnailUrl(collectionPubNum, editionPubNum);
	}
	return null;
}
```

- [ ] **Step 2: Use the helper in `EditionCard.svelte`**

Open `src/lib/components/cards/EditionCard.svelte`. Find any current thumbnail-URL-derivation logic (search for `thumbnail` or `getEditionThumbnailUrl`). Replace with a call to `getEditionCoverUrl(edition, collectionPubNum, editionPubNum)`, falling back to a placeholder div when it returns `null`.

Exact edit depends on the current component shape — preserve its existing markup, only swap the URL source.

- [ ] **Step 3: Manually verify**

Reload `/editions` and any edition list. Editions with legacy `thumbnail` URLs should render exactly as before. An edition with an uploaded `coverImage` should render from the PocketBase file URL.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/asset-urls.ts src/lib/components/cards/EditionCard.svelte
git commit -m "feat: prefer uploaded coverImage in edition thumbnail resolution"
```

---

## Task 13: Document R2 setup in DEV.md

**Files:**
- Modify: `DEV.md`

- [ ] **Step 1: Append an R2 section at the end of the file**

```md

## R2 storage (production)

In development, PocketBase stores uploaded edition assets on local disk (`pocketbase/pb_data/storage/`). In production we use Cloudflare R2 as an S3-compatible backend.

### One-time R2 bucket setup

1. Create an R2 bucket (e.g., `pure3d-uploads`) in the Cloudflare dashboard.
2. Create an R2 API token with Object Read + Write on that bucket. Note the Access Key ID, Secret Access Key, and endpoint (`https://<account>.r2.cloudflarestorage.com`).
3. Apply a CORS policy on the bucket permitting `GET` and `PUT` from the production frontend origin:

```json
[
  {
    "AllowedOrigins": ["https://<your-frontend-domain>"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Environment variables

In the production `.env`:

```
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_BUCKET=pure3d-uploads
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

The `pocketbase-setup` container applies these to PocketBase's storage settings on every `docker compose up`. No code changes are required to switch between local disk (dev) and R2 (prod).

### Switching an existing dev environment to R2

1. Fill in the four `R2_*` env vars.
2. Restart the stack: `docker compose down && docker compose up -d`.
3. The setup service logs `📦 Configuring S3 storage (R2)` when it runs.

Files already on local disk remain there (orphaned). Migrating them is out of scope for this setup — uploads from this point forward flow to R2.
```

- [ ] **Step 2: Commit**

```bash
git add DEV.md
git commit -m "docs: document R2 storage setup for production"
```

---

## Task 14: Legacy smoke test

**Files:** (no changes — verification only)

- [ ] **Step 1: Open an imported edition**

Find a legacy edition (one with a non-zero `pubNum` and no uploaded files):

```bash
curl -s http://localhost:8090/api/collections/editions/records?perPage=5 \
  -H "Authorization: <admin-token>" \
  | jq '.items[] | select(.pubNum > 0 and (.coverImage // "") == "" and (.modelFile // "") == "") | {id, title, pubNum}'
```

Pick any result's `id`.

- [ ] **Step 2: Visit its workflow page**

Open `http://localhost:8080/editions/<id>/workflow`. Expected: Voyager renders from the legacy CDN path (the "legacy" branch of `VoyagerPreview`), cover shows the legacy thumbnail or derived CDN icon.

- [ ] **Step 3: Visit its edition card context**

Open a page listing editions (e.g., `http://localhost:8080/editions`). Confirm the same legacy edition's card renders identically to before.

- [ ] **Step 4: If either step above regressed, fix**

Regressions point at the resolution order in `VoyagerPreview.svelte` (Task 8) or `getEditionCoverUrl` (Task 12). Re-verify the branch picked is `legacy` for editions with `pubNum` set and no uploaded files.

- [ ] **Step 5: Commit (no-op if nothing changed, otherwise a fix commit)**

If any fixes were needed:

```bash
git add -p
git commit -m "fix: preserve legacy CDN fallback for imported editions"
```

---

## Task 15: Manual QA checklist (captured in PR description)

**Files:** (no changes — verification only)

- [ ] **Step 1: Run through the full user flow and record results**

Paste this as the PR description's "Manual verification" section, ticking each item:

```
- [ ] Create a new edition from /collections/<slug>/editions/new; confirm redirect to /editions/<id>/workflow.
- [ ] Upload a 20 MB AVIF cover image; confirm progress bar, success, thumbnail renders.
- [ ] Upload a 300 MB GLB model; confirm progress bar advances and completes.
- [ ] Confirm model-only Voyager preview renders after model upload.
- [ ] Upload an SVX scene referencing the model; confirm preview switches to full scene with annotations/camera.
- [ ] Remove the model; confirm "Scene references a missing model" warning appears.
- [ ] Re-upload a different model; confirm warning clears and preview updates.
- [ ] Replace the cover image; confirm thumbnail updates.
- [ ] Reject oversized upload (attempt 25 MB cover image); confirm client-side rejection before network call.
- [ ] Reject wrong-extension upload (attempt .txt as model); confirm client-side rejection.
- [ ] Cancel tab during upload; confirm no orphan file on record.
- [ ] Reload workflow page; confirm all three files persist and preview still renders.
- [ ] Open a legacy (imported, pre-upload) edition; confirm it still renders from CDN unchanged.
```

- [ ] **Step 2: Final commit if any follow-up fixes were made**

```bash
git status
# If clean, no-op. Otherwise:
git add -p
git commit -m "fix: resolve manual QA findings"
```

---

## Self-review notes

Covered against the spec:
- Schema changes (Tasks 1–2)
- PocketBase S3 + upload-size config (Task 3)
- URI rewriter with tests (Tasks 4–5)
- Component hierarchy `FileUploadField` → specialised wrappers → `EditionAssetsPanel` + `VoyagerPreview` (Tasks 6–9)
- Route changes: `/new` bootstrap, `/workflow` wiring (Tasks 10–11)
- Asset URL fallback (Task 12)
- Docs: R2 setup in DEV.md (Task 13)
- Regression and QA verification (Tasks 14–15)

Deferred to follow-up issues (explicit non-goals):
- `articleFiles` multi-file field for HTML article references inside SVX.
- Abandoned-draft cleanup job (mitigated via first-interaction creation).
- Local disk → R2 file migration script.
- Automated end-to-end upload tests.
- MinIO docker-compose service.
