<script lang="ts">
	import toast from 'svelte-french-toast';
	import type { Edition } from '$lib/types/collection';

	interface Props {
		open: boolean;
		edition: Edition;
		onclose: () => void;
	}

	let { open = $bindable(), edition, onclose }: Props = $props();

	// State
	let additionalPrompt = $state('');
	let generatedImageUrl = $state<string | null>(null);
	let isGenerating = $state(false);
	let showSettings = $state(false);
	let apiKey = $state('');
	let capturedImageDataUrl = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	// Load API key from localStorage on init
	$effect(() => {
		if (open) {
			apiKey = localStorage.getItem('gemini-api-key') || '';
			generatedImageUrl = null;
			errorMessage = null;
			captureViewerScreenshot();
		}
	});

	function saveApiKey() {
		localStorage.setItem('gemini-api-key', apiKey.trim());
		toast.success('Gemini API key saved');
		showSettings = false;
	}

	function clearApiKey() {
		localStorage.removeItem('gemini-api-key');
		apiKey = '';
		toast.success('API key cleared');
	}

	/**
	 * Capture a screenshot from the 3D viewer canvas
	 */
	function captureViewerScreenshot() {
		capturedImageDataUrl = null;

		// Try to find the canvas inside the Voyager viewer (direct mode)
		const voyagerEl = document.querySelector('voyager-explorer');
		let canvas: HTMLCanvasElement | null = null;

		if (voyagerEl?.shadowRoot) {
			canvas = voyagerEl.shadowRoot.querySelector('canvas');
		}

		// Fallback: try to find any canvas in the viewer area
		if (!canvas) {
			const viewerCard = document.querySelector('.card.overflow-hidden canvas');
			if (viewerCard instanceof HTMLCanvasElement) {
				canvas = viewerCard;
			}
		}

		if (canvas) {
			try {
				capturedImageDataUrl = canvas.toDataURL('image/png');
			} catch {
				// Canvas might be tainted by cross-origin content
				console.warn('Could not capture viewer canvas (cross-origin)');
			}
		}
	}

	/**
	 * Build the AI prompt from edition metadata
	 */
	function buildPrompt(): string {
		const parts: string[] = [];

		parts.push(
			'Generate a photorealistic image that brings this historical/cultural object to life.'
		);
		parts.push(
			'Imagine it in its original context — as if you were there witnessing it in real life.'
		);
		parts.push('Create a vivid, realistic scene that recreates the moment in history.\n');

		// Core info
		if (edition.title) parts.push(`Object: ${edition.title}`);
		if (edition.description) parts.push(`Description: ${edition.description}`);
		if (edition.authors) parts.push(`Created by: ${edition.authors}`);

		// Dublin Core metadata for richer context
		if (edition.dcAbstract) parts.push(`Abstract: ${edition.dcAbstract}`);
		if (edition.dcDescription) parts.push(`Detailed description: ${edition.dcDescription}`);

		// Classification & subject
		if (edition.dcSubject?.length) parts.push(`Subject: ${edition.dcSubject.join(', ')}`);
		if (edition.dcKeyword?.length) parts.push(`Keywords: ${edition.dcKeyword.join(', ')}`);
		if (edition.tags?.length) parts.push(`Tags: ${edition.tags.join(', ')}`);

		// Historical & geographical context
		if (edition.dcCoveragePeriod?.length)
			parts.push(`Time period: ${edition.dcCoveragePeriod.join(', ')}`);
		if (edition.dcCoveragePlace) parts.push(`Place: ${edition.dcCoveragePlace}`);
		if (edition.dcCoverageCountry?.length)
			parts.push(`Country: ${edition.dcCoverageCountry.join(', ')}`);
		if (edition.dcCoverageTemporal) parts.push(`Temporal coverage: ${edition.dcCoverageTemporal}`);
		if (edition.dcCoverageGeo) parts.push(`Geographic info: ${edition.dcCoverageGeo}`);

		// Provenance
		if (edition.dcProvenance) parts.push(`Provenance: ${edition.dcProvenance}`);
		if (edition.dcSource?.length) parts.push(`Source: ${edition.dcSource.join(', ')}`);

		// Creators & institutions
		if (edition.dcCreator?.length)
			parts.push(`Original creator(s): ${edition.dcCreator.join(', ')}`);
		if (edition.dcInstitution?.length)
			parts.push(`Institution: ${edition.dcInstitution.join(', ')}`);

		// User additions
		if (additionalPrompt.trim()) {
			parts.push(`\nAdditional instructions: ${additionalPrompt.trim()}`);
		}

		return parts.join('\n');
	}

	/**
	 * Generate image using Google Gemini API (Imagen)
	 */
	async function generateImage() {
		const key = apiKey.trim() || localStorage.getItem('gemini-api-key')?.trim();
		if (!key) {
			showSettings = true;
			toast.error('Please set your Gemini API key first');
			return;
		}

		isGenerating = true;
		errorMessage = null;
		generatedImageUrl = null;

		const prompt = buildPrompt();

		try {
			// Use Gemini 2.0 Flash with image generation capability
			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{ text: prompt },
									...(capturedImageDataUrl
										? [
												{
													inlineData: {
														mimeType: 'image/png',
														data: capturedImageDataUrl.split(',')[1]
													}
												}
											]
										: [])
								]
							}
						],
						generationConfig: {
							responseModalities: ['TEXT', 'IMAGE']
						}
					})
				}
			);

			if (!response.ok) {
				const errData = await response.json().catch(() => null);
				throw new Error(
					errData?.error?.message || `API request failed with status ${response.status}`
				);
			}

			const data = await response.json();

			// Extract generated image from response
			const candidates = data.candidates || [];
			for (const candidate of candidates) {
				const parts = candidate.content?.parts || [];
				for (const part of parts) {
					if (part.inlineData?.mimeType?.startsWith('image/')) {
						generatedImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
						break;
					}
				}
				if (generatedImageUrl) break;
			}

			if (!generatedImageUrl) {
				throw new Error(
					'No image was generated. The model may not have produced an image for this prompt. Try adjusting your description.'
				);
			}
		} catch (err: any) {
			errorMessage = err.message || 'Failed to generate image';
			toast.error('Image generation failed');
		} finally {
			isGenerating = false;
		}
	}

	function downloadImage() {
		if (!generatedImageUrl) return;
		const a = document.createElement('a');
		a.href = generatedImageUrl;
		a.download = `${edition.slug || 'imagine'}-generated.png`;
		a.click();
	}

	function handleClose() {
		open = false;
		onclose();
	}
</script>

<dialog class="modal" class:modal-open={open}>
	<div class="modal-box max-w-3xl">
		<!-- Header -->
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-bold">Imagine — AI Image Generation</h3>
			<div class="flex items-center gap-2">
				<!-- Settings toggle -->
				<button
					type="button"
					class="btn btn-circle btn-ghost btn-sm"
					onclick={() => (showSettings = !showSettings)}
					title="Gemini API Settings"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="h-5 w-5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
				</button>
				<button type="button" class="btn btn-circle btn-ghost btn-sm" onclick={handleClose}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						class="h-5 w-5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Settings Panel (collapsible) -->
		{#if showSettings}
			<div class="mb-4 rounded-lg bg-base-300 p-4">
				<h4 class="mb-2 text-sm font-semibold">Gemini API Configuration</h4>
				<p class="mb-3 text-xs text-base-content/60">
					Enter your Google Gemini API key. Get one at
					<a
						href="https://aistudio.google.com/apikey"
						target="_blank"
						rel="noopener noreferrer"
						class="link link-primary">Google AI Studio</a
					>. The key is stored locally in your browser.
				</p>
				<div class="flex gap-2">
					<input
						type="password"
						class="input input-bordered flex-1 input-sm"
						placeholder="Enter your Gemini API key..."
						bind:value={apiKey}
						onkeydown={(e) => e.key === 'Enter' && saveApiKey()}
					/>
					<button type="button" class="btn btn-primary btn-sm" onclick={saveApiKey}>Save</button>
					{#if apiKey}
						<button type="button" class="btn btn-ghost btn-sm" onclick={clearApiKey}
							>Clear</button
						>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Current view preview -->
		{#if capturedImageDataUrl}
			<div class="mb-4">
				<p class="mb-1 text-xs font-semibold text-base-content/60">Current view (reference)</p>
				<img
					src={capturedImageDataUrl}
					alt="Current 3D viewer capture"
					class="h-32 w-auto rounded-lg border border-base-300 object-contain"
				/>
			</div>
		{/if}

		<!-- Metadata summary -->
		<div class="mb-4 rounded-lg bg-base-200 p-3">
			<p class="mb-1 text-xs font-semibold text-base-content/60">
				Context from edition metadata
			</p>
			<div class="flex flex-wrap gap-1">
				<span class="badge badge-sm badge-primary">{edition.title}</span>
				{#if edition.dcCoveragePeriod?.length}
					{#each edition.dcCoveragePeriod as period}
						<span class="badge badge-sm badge-secondary">{period}</span>
					{/each}
				{/if}
				{#if edition.dcCoveragePlace}
					<span class="badge badge-sm badge-accent">{edition.dcCoveragePlace}</span>
				{/if}
				{#each edition.tags as tag}
					<span class="badge badge-ghost badge-sm">{tag}</span>
				{/each}
				{#if edition.dcSubject?.length}
					{#each edition.dcSubject.slice(0, 3) as subject}
						<span class="badge badge-ghost badge-sm">{subject}</span>
					{/each}
				{/if}
				{#if edition.dcKeyword?.length}
					{#each edition.dcKeyword.slice(0, 3) as kw}
						<span class="badge badge-outline badge-sm">{kw}</span>
					{/each}
				{/if}
			</div>
			{#if edition.description}
				<p class="mt-2 line-clamp-2 text-xs text-base-content/60">{edition.description}</p>
			{/if}
		</div>

		<!-- Additional prompt input -->
		<div class="mb-4">
			<label for="additional-prompt" class="mb-1 block text-sm font-semibold"
				>Additional instructions (optional)</label
			>
			<textarea
				id="additional-prompt"
				class="textarea textarea-bordered w-full"
				rows="3"
				placeholder="Add details to guide the image generation... e.g., 'Show it in a museum setting with dramatic lighting' or 'Recreate it being used in ancient times'"
				bind:value={additionalPrompt}
			></textarea>
		</div>

		<!-- Error message -->
		{#if errorMessage}
			<div class="alert alert-error mb-4">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				<span class="text-sm">{errorMessage}</span>
			</div>
		{/if}

		<!-- Generated Image -->
		{#if generatedImageUrl}
			<div class="mb-4">
				<p class="mb-2 text-sm font-semibold">Generated Image</p>
				<img
					src={generatedImageUrl}
					alt="AI generated visualization of {edition.title}"
					class="w-full rounded-lg shadow-lg"
				/>
			</div>
		{/if}

		<!-- Loading state -->
		{#if isGenerating}
			<div class="mb-4 flex flex-col items-center gap-3 py-8">
				<span class="loading loading-spinner loading-lg text-primary"></span>
				<p class="text-sm text-base-content/60">
					Generating a realistic visualization of <strong>{edition.title}</strong>...
				</p>
				<p class="text-xs text-base-content/40">This may take a few seconds</p>
			</div>
		{/if}

		<!-- Actions -->
		<div class="modal-action">
			{#if generatedImageUrl}
				<button type="button" class="btn btn-outline btn-sm" onclick={downloadImage}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						class="h-4 w-4"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
						/>
					</svg>
					Download
				</button>
				<button type="button" class="btn btn-primary btn-sm" onclick={generateImage}>
					Regenerate
				</button>
			{:else}
				<button type="button" class="btn" onclick={handleClose}>Cancel</button>
				<button
					type="button"
					class="btn btn-primary"
					onclick={generateImage}
					disabled={isGenerating}
				>
					{#if isGenerating}
						<span class="loading loading-spinner loading-sm"></span>
						Generating...
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="2"
							stroke="currentColor"
							class="h-5 w-5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
							/>
						</svg>
						Imagine
					{/if}
				</button>
			{/if}
		</div>
	</div>

	<!-- Backdrop -->
	<form method="dialog" class="modal-backdrop">
		<button type="button" onclick={handleClose}>close</button>
	</form>
</dialog>
