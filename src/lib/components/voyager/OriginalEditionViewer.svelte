<script lang="ts">
	import type { PageData } from '../../../routes/editions/[slug]/$types';
	import VoyagerViewer, { type VoyagerAPI } from './VoyagerViewer.svelte';
	import CircleHelpIcon from '~icons/lucide/circle-help';
	import MessageCircleIcon from '~icons/lucide/message-circle';
	import BookOpenIcon from '~icons/lucide/book-open';
	import MapIcon from '~icons/lucide/map';
	import WrenchIcon from '~icons/lucide/wrench';
	import RulerIcon from '~icons/lucide/ruler';
	import RotateCcwIcon from '~icons/lucide/rotate-ccw';

	interface Props {
		edition: PageData['edition'];
		isFullWindow: boolean;
		doi: string;
		hasHelp: boolean;
		fetchOverrides?: Array<{ url: string; content: string }>;
		onReady: (api: VoyagerAPI) => void;
		onModelLoaded: (bytes: number) => void;
		onHelp: () => void;
		onMetadata: () => void;
	}

	let {
		edition,
		isFullWindow,
		doi,
		hasHelp,
		fetchOverrides,
		onReady,
		onModelLoaded,
		onHelp,
		onMetadata
	}: Props = $props();
	let api = $state<VoyagerAPI | null>(null);
	const direct = $derived(!!edition.voyagerRoot);
	const showVoyagerMenu = $derived(
		(edition as { showVoyagerMenu?: boolean }).showVoyagerMenu !== false
	);
</script>

<!-- Original presentation restored from aedd633 (2026-09-09); no external reading UI. -->
<div id="original-edition-viewer" class:full-window={isFullWindow}>
	<div class="original-surface relative overflow-hidden rounded-lg bg-base-200">
		<VoyagerViewer
			url={direct ? edition.voyagerRoot : edition.voyagerUrl}
			document={edition.sceneFile}
			title={edition.title}
			{direct}
			voyagerVersion={edition.voyagerVersion}
			resourceRoot={edition.voyagerResourceRoot}
			uiMode="menu|title|language"
			{fetchOverrides}
			companionAssets={edition.uploadedAssetMap
				? { baseDir: edition.voyagerRoot, byBasename: edition.uploadedAssetMap }
				: undefined}
			{onModelLoaded}
			onReady={(viewerApi) => {
				api = viewerApi;
				onReady(viewerApi);
			}}
			{isFullWindow}
			{showVoyagerMenu}
		/>
		<div
			class="absolute right-3 z-10 flex gap-2 transition-all duration-300"
			class:top-3={!isFullWindow}
			class:top-20={isFullWindow}
		>
			{#if hasHelp}<button
					type="button"
					class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
					onclick={onHelp}
					aria-label="How to use the 3D viewer"
					title="How to use the 3D viewer"
					><CircleHelpIcon class="h-5 w-5" aria-hidden="true" /></button
				>{/if}
		</div>
		{#if !showVoyagerMenu && api}
			<div
				class="absolute left-3 z-10 flex flex-col gap-2"
				class:top-3={!isFullWindow}
				class:top-20={isFullWindow}
			>
				<button
					class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
					onclick={() => api?.toggleAnnotations()}
					aria-label="Toggle annotations"
					title="Toggle annotations"><MessageCircleIcon class="h-5 w-5" /></button
				>
				<button
					class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
					onclick={() => api?.toggleReader()}
					aria-label="Toggle reader"
					title="Toggle reader"><BookOpenIcon class="h-5 w-5" /></button
				>
				<button
					class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
					onclick={() => api?.toggleTours()}
					aria-label="Toggle tours"
					title="Toggle tours"><MapIcon class="h-5 w-5" /></button
				>
				<button
					class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
					onclick={() => api?.toggleTools()}
					aria-label="Toggle tools"
					title="Toggle tools"><WrenchIcon class="h-5 w-5" /></button
				>
				<button
					class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
					onclick={() => api?.toggleMeasurement()}
					aria-label="Toggle measurement"
					title="Toggle measurement"><RulerIcon class="h-5 w-5" /></button
				>
				<button
					class="btn btn-circle border-0 bg-base-100/80 shadow-lg btn-sm hover:bg-base-100"
					onclick={() => api?.resetCamera()}
					aria-label="Reset camera"
					title="Reset camera"><RotateCcwIcon class="h-5 w-5" /></button
				>
			</div>
		{/if}
	</div>
	{#if !isFullWindow}
		<div class="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-1 pt-3 text-xs">
			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-base-content/60">
				{#if edition.usageConditions}<span
						><span class="font-mono text-[9px] tracking-[0.1em] uppercase">License</span><span
							class="ml-1 font-medium text-base-content/80">{edition.usageConditions}</span
						></span
					>{/if}
				{#if doi}<a
						href={`https://doi.org/${doi}`}
						target="_blank"
						rel="noreferrer"
						class="font-medium text-base-content/80 underline decoration-base-content/25 underline-offset-4 hover:decoration-base-content"
						>Cite this edition</a
					>{/if}
			</div>
			<button
				type="button"
				class="min-h-8 font-medium text-base-content/60 transition-colors hover:text-base-content"
				onclick={onMetadata}>View full metadata →</button
			>
		</div>
	{/if}
</div>

<style>
	.full-window,
	.full-window .original-surface {
		height: 100%;
	}
</style>
