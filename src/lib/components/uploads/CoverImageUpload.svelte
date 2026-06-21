<script lang="ts">
	import { pb } from '$lib/database/client';
	import type { RecordModel } from 'pocketbase';
	import FileUploadField from './FileUploadField.svelte';

	type Props = {
		record: RecordModel;
		collectionName?: string;
		fallbackUrl?: string | null;
		disabled?: boolean;
		onuploaded?: (r: RecordModel) => void;
		onremoved?: (r: RecordModel) => void;
	};
	let {
		record = $bindable(),
		collectionName = 'editions',
		fallbackUrl = null,
		disabled,
		onuploaded,
		onremoved
	}: Props = $props();
</script>

<FileUploadField
	bind:record
	{collectionName}
	fieldName="coverImage"
	accept="image/jpeg,image/png,image/webp,image/avif"
	maxSize={20 * 1024 * 1024}
	{disabled}
	{onuploaded}
	{onremoved}
>
	{#snippet preview({ filename })}
		<div class="overflow-hidden rounded-lg border border-base-300">
			<img
				src={pb.files.getURL(record, filename, { thumb: '400x300' })}
				alt="Cover"
				class="aspect-[4/3] w-full object-cover"
			/>
		</div>
	{/snippet}
	{#snippet emptyPreview()}
		<div class="overflow-hidden rounded-lg border border-base-300">
			{#if fallbackUrl}
				<img src={fallbackUrl} alt="Cover" class="aspect-[4/3] w-full object-cover" />
			{:else}
				<div
					class="flex aspect-[4/3] items-center justify-center border-2 border-dashed border-base-300 bg-base-200"
				>
					<div class="text-center text-base-content/40">
						<p class="text-xs">Cover Image</p>
						<p class="mt-1 text-xs">JPG, PNG, WebP, AVIF (max 20 MB)</p>
					</div>
				</div>
			{/if}
			{#if fallbackUrl}
				<p class="border-t border-base-300 bg-base-200/60 px-3 py-2 text-xs text-base-content/60">
					Current asset image. Upload a cover image to replace it.
				</p>
			{/if}
		</div>
	{/snippet}
</FileUploadField>
