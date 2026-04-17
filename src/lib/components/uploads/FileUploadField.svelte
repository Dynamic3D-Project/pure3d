<script lang="ts">
	import { pb } from '$lib/database/client';
	import type { RecordModel } from 'pocketbase';
	import type { Snippet } from 'svelte';
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
		preview?: Snippet<[{ filename: string; url: string }]>;
		emptyPreview?: Snippet;
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
