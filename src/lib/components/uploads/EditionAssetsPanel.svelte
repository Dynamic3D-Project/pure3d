<script lang="ts">
	import type { RecordModel } from 'pocketbase';
	import ModelFilesUpload from './ModelFilesUpload.svelte';
	import SceneDocumentUpload from './SceneDocumentUpload.svelte';
	import VoyagerPreview from './VoyagerPreview.svelte';
	import VoyagerSceneEditor from './VoyagerSceneEditor.svelte';

	type Props = {
		edition: RecordModel;
		collectionPubNum?: number | null;
		editionPubNum?: number | null;
		disabled?: boolean;
		onupdated?: (r: RecordModel) => void;
		onbusychange?: (busy: boolean) => void;
	};
	let {
		edition = $bindable(),
		collectionPubNum,
		editionPubNum,
		disabled = false,
		onupdated,
		onbusychange
	}: Props = $props();

	function handleUpdated(r: RecordModel) {
		edition = r;
		onupdated?.(r);
	}

	let uploaderRef: ModelFilesUpload | undefined = $state();
	let modelBusy = $state(false);
	let sceneBusy = $state(false);
	let editorBusy = $state(false);
	$effect(() => {
		onbusychange?.(modelBusy || sceneBusy || editorBusy);
	});
</script>

<div id="edition-assets-panel" class="space-y-4">
	<VoyagerPreview
		{edition}
		{collectionPubNum}
		{editionPubNum}
		title={edition.title || 'Edition preview'}
		onFiles={disabled || modelBusy || sceneBusy || editorBusy
			? undefined
			: (files) => uploaderRef?.uploadFiles(files)}
	/>
	<VoyagerSceneEditor
		{edition}
		{collectionPubNum}
		{editionPubNum}
		disabled={disabled || modelBusy || sceneBusy}
		onupdated={handleUpdated}
		onbusychange={(busy) => (editorBusy = busy)}
	/>

	<div class="rounded-xl border border-base-300 bg-base-100 p-5">
		<h3 class="mb-3 text-sm font-semibold tracking-wide text-base-content/50 uppercase">
			3D Model Files
		</h3>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<div class="mb-1 text-xs text-base-content/60">
					Model file(s)
					<span class="text-base-content/40">— drop a GLTF/OBJ with its companions</span>
				</div>
				<ModelFilesUpload
					bind:this={uploaderRef}
					bind:record={edition}
					disabled={disabled || sceneBusy || editorBusy}
					onbusychange={(busy) => (modelBusy = busy)}
					onuploaded={handleUpdated}
					onremoved={handleUpdated}
				/>
			</div>
			<div>
				<div class="mb-1 text-xs text-base-content/60">Scene file (SVX)</div>
				<SceneDocumentUpload
					bind:record={edition}
					disabled={disabled || modelBusy || editorBusy}
					onbusychange={(busy) => (sceneBusy = busy)}
					onuploaded={handleUpdated}
					onremoved={handleUpdated}
				/>
			</div>
		</div>
	</div>
</div>
