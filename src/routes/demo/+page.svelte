<script lang="ts">
	import { base } from '$app/paths';
	import type { PageData } from './$types';
	import VoyagerViewer, { type VoyagerAPI } from '$lib/components/voyager/VoyagerViewer.svelte';

	let { data }: { data: PageData } = $props();

	let edition = $derived(data.edition);
	let voyagerApi: VoyagerAPI | null = $state(null);

	function onVoyagerReady(api: VoyagerAPI) {
		voyagerApi = api;
	}
</script>

<svelte:head>
	<title>Demo (with controls) | Pure 3D</title>
	<meta
		name="description"
		content="Demo page for testing Voyager 3D viewer features with full API control panel."
	/>
</svelte:head>

<div class="min-h-screen bg-base-100">
	<div class="container mx-auto max-w-7xl px-4 py-8">
		<!-- Breadcrumbs -->
		<nav class="breadcrumbs mb-6 text-sm">
			<ul>
				<li>
					<a href="{base}/" data-sveltekit-preload-data="hover" class="link link-hover">Home</a>
				</li>
				<li class="text-base-content/70">Demo (with controls)</li>
			</ul>
		</nav>

		<!-- Title and Description -->
		<div class="mb-6">
			<h1 class="mb-2 text-3xl font-bold md:text-4xl">{edition.title}</h1>
			<p class="text-base-content/70">{edition.authors}</p>
		</div>

		<!-- Info Card -->
		<div class="alert mb-6 bg-info/10 text-info-content">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="h-6 w-6 shrink-0 stroke-info"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<div>
				<p class="mb-2 font-semibold">API Controls Demo</p>
				<p class="text-sm">
					This page shows VoyagerViewer with the full control panel for testing camera controls,
					annotations, tours, background colors, and other API features.
				</p>
				<p class="mt-2 text-sm">
					For the clickable view links demo, visit
					<a href="{base}/editions/demo" class="link link-primary">/editions/demo</a>
				</p>
			</div>
		</div>

		<!-- Voyager 3D Viewer with Controls -->
		<VoyagerViewer
			url={edition.voyagerRoot}
			document={edition.sceneFile}
			title={edition.title}
			direct={true}
			showControls={true}
			voyagerVersion={edition.voyagerVersion}
			resourceRoot={edition.voyagerResourceRoot}
			uiMode="none"
			onReady={onVoyagerReady}
		/>

		<!-- Viewer info row -->
		<div class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/50">
			{#if edition.voyagerVersion}
				<span>Voyager v{edition.voyagerVersion}</span>
			{/if}
			<span>{edition.usageConditions}</span>
			<span class="badge badge-ghost badge-sm">Demo Mode</span>
		</div>

		<!-- Tags -->
		<div class="mt-6">
			<h3 class="mb-2 text-sm font-semibold">Tags</h3>
			<div class="flex flex-wrap gap-2">
				{#each edition.tags as tag (tag)}
					<span class="badge badge-ghost border border-base-300">{tag}</span>
				{/each}
			</div>
		</div>
	</div>
</div>
