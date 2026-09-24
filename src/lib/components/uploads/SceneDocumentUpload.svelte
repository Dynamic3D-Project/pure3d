<script lang="ts">
	import type { RecordModel } from 'pocketbase';
	import FileUploadField from './FileUploadField.svelte';

	type Props = {
		record: RecordModel;
		disabled?: boolean;
		onuploaded?: (r: RecordModel) => void;
		onremoved?: (r: RecordModel) => void;
		onbusychange?: (busy: boolean) => void;
	};
	let { record = $bindable(), disabled, onuploaded, onremoved, onbusychange }: Props = $props();
</script>

<div id="scene-document-upload">
	<FileUploadField
		bind:record
		collectionName="editions"
		fieldName="sceneDocument"
		accept=".json,.svx,application/json"
		allowedExtensions={['.json', '.svx']}
		maxSize={0}
		{disabled}
		{onuploaded}
		{onremoved}
		{onbusychange}
	>
		{#snippet preview({ filename })}
			<div
				class="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 px-3 py-2.5"
			>
				<span class="truncate text-xs">{filename}</span>
				<span class="badge badge-ghost badge-sm">SVX</span>
			</div>
		{/snippet}
		{#snippet emptyPreview()}
			<div
				class="flex items-center gap-2 rounded-lg border border-dashed border-base-300 bg-base-200 px-3 py-2.5"
			>
				<span class="text-xs text-base-content/40">No scene file</span>
			</div>
		{/snippet}
	</FileUploadField>
</div>
