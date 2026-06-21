<script lang="ts">
	import type { RecordModel } from 'pocketbase';
	import ModelFilesUpload from './ModelFilesUpload.svelte';
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

	let uploaderRef: ModelFilesUpload | undefined = $state();
</script>

<div class="space-y-4">
	<VoyagerPreview
		{edition}
		{collectionPubNum}
		{editionPubNum}
		title={edition.title || 'Edition preview'}
		onFiles={(files) => uploaderRef?.uploadFiles(files)}
	/>

	<div class="rounded-xl border border-base-300 bg-base-100 p-5">
		<h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">
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
					{disabled}
					onuploaded={handleUpdated}
					onremoved={handleUpdated}
				/>
			</div>
			<div>
				<div class="mb-1 text-xs text-base-content/60">Scene file (SVX)</div>
				<SceneDocumentUpload
					bind:record={edition}
					{disabled}
					onuploaded={handleUpdated}
					onremoved={handleUpdated}
				/>
			</div>
		</div>
	</div>
</div>
