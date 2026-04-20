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

	<div class="rounded-xl border border-base-300 bg-base-100 p-5">
		<h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">
			Cover Image
		</h3>
		<CoverImageUpload
			bind:record={edition}
			{disabled}
			onuploaded={handleUpdated}
			onremoved={handleUpdated}
		/>
	</div>
</div>
