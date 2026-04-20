<script lang="ts">
	import type { RecordModel } from 'pocketbase';
	import FileUploadField from './FileUploadField.svelte';

	type Props = {
		record: RecordModel;
		disabled?: boolean;
		onuploaded?: (r: RecordModel) => void;
		onremoved?: (r: RecordModel) => void;
	};
	let { record = $bindable(), disabled, onuploaded, onremoved }: Props = $props();
</script>

<FileUploadField
	bind:record
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
