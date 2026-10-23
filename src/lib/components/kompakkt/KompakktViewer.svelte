<script lang="ts">
	import type { EditionViewData } from '$lib/components/editions/edition-view';
	import { kompakktViewerUrl, resolveKompakktResource } from './kompakkt-resource';

	let { edition }: { edition: EditionViewData['edition'] } = $props();
	let requested = $state(false);
	let loading = $state(false);
	let error = $state('');
	let viewerUrl = $state('');
	let frameLoaded = $state(false);
	let frameSlow = $state(false);

	$effect(() => {
		if (!requested || !edition.isPublished) return;
		const controller = new AbortController();
		loading = true;
		error = '';
		resolveKompakktResource(
			edition.voyagerRoot,
			edition.sceneFile,
			edition.uploadedAssetMap ?? {},
			controller.signal
		)
			.then((resource) => {
				if (!controller.signal.aborted) viewerUrl = kompakktViewerUrl(resource);
			})
			.catch((reason: unknown) => {
				if (!controller.signal.aborted)
					error =
						reason instanceof TypeError
							? 'The public assets could not be reached. Their host may need CORS permission for this site and Kompakkt. Please use Voyager or try again.'
							: reason instanceof Error
								? reason.message
								: 'The public model could not load. Please use Voyager or try again.';
			})
			.finally(() => {
				if (!controller.signal.aborted) loading = false;
			});
		const timeout = setTimeout(() => {
			if (loading) {
				controller.abort();
				loading = false;
				error = 'The public assets took too long to respond. Try again or return to Voyager.';
			}
		}, 30_000);
		return () => {
			controller.abort();
			clearTimeout(timeout);
		};
	});

	$effect(() => {
		if (!viewerUrl) return;
		frameLoaded = false;
		frameSlow = false;
		const timeout = setTimeout(() => (frameSlow = true), 30_000);
		return () => clearTimeout(timeout);
	});
</script>

<div id="kompakkt-viewer" class="overflow-hidden rounded-lg bg-base-200">
	<div class="space-y-3 p-4 text-sm">
		<p>
			Kompakkt is an external viewer hosted at kompakkt.de. Loading it shares the public model URL
			and your network information with that service. Voyager annotations, tours, camera settings
			and scene positioning are not transferred.
		</p>
		{#if !edition.isPublished}
			<p role="status">Kompakkt is only available for published editions with public assets.</p>
		{:else if !edition.voyagerRoot}
			<p role="status">This edition has no directly accessible scene. Please use Voyager.</p>
		{:else if !requested}
			<button type="button" class="btn btn-sm btn-primary" onclick={() => (requested = true)}
				>Load external Kompakkt viewer</button
			>
		{:else if loading}
			<p role="status">Checking public model assets…</p>
		{:else if error}
			<p role="alert">{error}</p>
			<button type="button" class="btn btn-outline btn-sm" onclick={() => (requested = false)}
				>Try again</button
			>
		{/if}
		{#if viewerUrl}
			<p class="text-base-content/70">
				{frameLoaded
					? 'External viewer opened. Model loading and errors are shown by Kompakkt.'
					: 'Opening external viewer…'}
				If the model does not appear, return to Voyager using the switch above.
			</p>
			{#if frameSlow && !frameLoaded}<p role="status">
					Kompakkt is taking longer than expected or could not be reached.
				</p>{/if}
		{/if}
	</div>
	{#if viewerUrl}
		<iframe
			src={viewerUrl}
			title={`Kompakkt 3D viewer: ${edition.title}`}
			class="h-[495px] w-full border-0"
			sandbox="allow-scripts allow-same-origin"
			referrerpolicy="no-referrer"
			allow="fullscreen"
			onload={() => (frameLoaded = true)}
			onerror={() => {
				error = 'The external viewer could not load. Please return to Voyager.';
				viewerUrl = '';
			}}
		></iframe>
	{/if}
</div>
