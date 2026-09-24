<script lang="ts">
	import { pb } from '$lib/database/client';
	import type { RecordModel } from 'pocketbase';
	import VoyagerPreview from './VoyagerPreview.svelte';

	type Model = { file: string; assets: string[]; scene?: string };
	type Props = {
		edition: RecordModel;
		disabled?: boolean;
		readOnly?: boolean;
		onupdated?: (record: RecordModel) => void;
		onuploadstatechange?: (uploading: boolean) => void;
	};
	let {
		edition = $bindable(),
		disabled = false,
		readOnly = false,
		onupdated,
		onuploadstatechange
	}: Props = $props();
	const mainExtensions = ['.glb', '.gltf', '.obj', '.ply'];
	const maxSize = 200 * 1024 * 1024;
	let uploading = $state(false);
	let error = $state('');
	let input: HTMLInputElement | undefined = $state();
	let models = $derived(readModels(edition.proposalModels));
	let preview = $state<{ file: string; token: string } | null>(null);

	function readModels(value: unknown): Model[] {
		return Array.isArray(value)
			? value.filter(
					(model): model is Model =>
						!!model &&
						typeof model === 'object' &&
						typeof (model as Model).file === 'string' &&
						Array.isArray((model as Model).assets)
				)
			: [];
	}
	function basename(value: string) {
		return value.slice(Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\')) + 1);
	}
	function main(files: File[]) {
		return files.filter((file) =>
			mainExtensions.some((extension) => file.name.toLowerCase().endsWith(extension))
		);
	}
	async function showPreview(file: string) {
		try {
			preview = { file, token: await pb.files.getToken() };
		} catch {
			error = 'Could not open the private preview. Please try again.';
		}
	}
	async function upload(event: Event) {
		const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
		(event.currentTarget as HTMLInputElement).value = '';
		await uploadFiles(files);
	}
	async function uploadFiles(files: File[]) {
		if (readOnly || disabled || uploading || !files.length) return;
		const mains = main(files);
		if (mains.length !== 1) {
			error = 'Choose exactly one GLB, GLTF, OBJ, or PLY primary model with its companion files.';
			return;
		}
		if (files.some((file) => file.size > maxSize)) {
			error = 'Each model or companion file must be 200 MB or smaller.';
			return;
		}
		uploading = true;
		onuploadstatechange?.(true);
		error = '';
		try {
			const form = new FormData();
			form.append('proposalModelFiles+', mains[0]);
			for (const file of files.filter(
				(file) => file !== mains[0] && !/\.svx(\.json)?$/i.test(file.name)
			))
				form.append('proposalModelAssets+', file);
			for (const file of files.filter(
				(file) => file !== mains[0] && /\.svx(\.json)?$/i.test(file.name)
			))
				form.append('proposalModelScenes+', file);
			edition = await pb.collection('editions').update(edition.id, form, { requestKey: null });
			onupdated?.(edition);
		} catch (cause) {
			error = (cause as Error).message || 'Model upload failed.';
		} finally {
			uploading = false;
			onuploadstatechange?.(false);
		}
	}
	async function remove(model: Model) {
		if (readOnly || disabled || uploading) return;
		uploading = true;
		onuploadstatechange?.(true);
		try {
			edition = await pb.collection('editions').update(
				edition.id,
				{
					'proposalModelFiles-': [model.file],
					'proposalModelAssets-': model.assets,
					'proposalModelScenes-': model.scene ? [model.scene] : []
				},
				{ requestKey: null }
			);
			onupdated?.(edition);
		} catch (cause) {
			error = (cause as Error).message || 'Could not remove model.';
		} finally {
			uploading = false;
			onuploadstatechange?.(false);
		}
	}
</script>

<div id="proposal-model-uploads" class="space-y-4">
	{#each models as model (model.file)}
		<div class="rounded-box border border-base-300 p-3">
			{#if preview?.file === model.file}
				<VoyagerPreview
					edition={{
						...edition,
						modelFile: model.file,
						modelAssets: model.assets,
						sceneDocument: model.scene
					} as RecordModel}
					title={basename(model.file)}
					fileToken={preview.token}
				/>
			{/if}
			<button type="button" class="btn btn-outline btn-sm" onclick={() => showPreview(model.file)}
				>{preview?.file === model.file ? 'Reload preview' : 'Preview model'}</button
			>
			<div class="mt-2 flex items-center justify-between gap-2 text-sm">
				<span
					>{basename(model.file)}{model.assets.length
						? ` + ${model.assets.length} companion${model.assets.length === 1 ? '' : 's'}`
						: ''}</span
				>{#if !readOnly}<button
						type="button"
						class="btn btn-ghost btn-xs"
						onclick={() => remove(model)}
						disabled={disabled || uploading}>Remove</button
					>{/if}
			</div>
		</div>
	{/each}
	{#if !readOnly}
		<div
			class="rounded-box border-2 border-dashed border-base-300 bg-base-200/40 p-6 text-center"
			role="presentation"
			ondragover={(event) => event.preventDefault()}
			ondrop={(event) => {
				event.preventDefault();
				void uploadFiles(Array.from(event.dataTransfer?.files || []));
			}}
		>
			<p class="mb-3 text-sm text-base-content/65">
				Drop one 3D model with its companion files here, or choose files below.
			</p>
			<input
				bind:this={input}
				class="hidden"
				type="file"
				multiple
				accept=".glb,.gltf,.obj,.ply,.bin,.mtl,.png,.jpg,.jpeg,.webp,.ktx2,.basis,.hdr,.exr,.svx,.svx.json,.json"
				onchange={upload}
				disabled={disabled || uploading}
			/>
			<button
				type="button"
				class="btn btn-outline btn-sm"
				onclick={() => input?.click()}
				disabled={disabled || uploading}>{uploading ? 'Uploading…' : 'Add model files'}</button
			>
		</div>
	{/if}
	{#if error}<p class="text-sm text-error">{error}</p>{/if}
</div>
