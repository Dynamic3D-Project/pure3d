<script lang="ts">
	import type { PageData } from './$types';
	import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';
	import VoyagerAPIDemo from '$lib/components/voyager/VoyagerAPIDemo.svelte';
	import EditionPage from '../editions/[slug]/+page.svelte';

	let { data }: { data: PageData } = $props();

	let apiEdition = $derived(data.apiEdition);
	let topTab = $state<'showcase' | 'controls' | 'integration'>('showcase');
</script>

<svelte:head>
	<title>Demo | Pure 3D</title>
	<meta
		name="description"
		content="Public Pure 3D demo combining scholarly edition tabs, peer review, printables, and Voyager API controls."
	/>
</svelte:head>

<div class="min-h-screen bg-base-100">
	<div class="container mx-auto max-w-7xl px-4 py-8">
		<div role="tablist" class="tabs-boxed tabs mb-8 w-full overflow-x-auto bg-base-200 p-1">
			<button
				role="tab"
				class="tab shrink-0"
				class:tab-active={topTab === 'showcase'}
				onclick={() => (topTab = 'showcase')}
			>
				Edition Showcase
			</button>
			<button
				role="tab"
				class="tab shrink-0"
				class:tab-active={topTab === 'controls'}
				onclick={() => (topTab = 'controls')}
			>
				API Controls
			</button>
			<button
				role="tab"
				class="tab shrink-0"
				class:tab-active={topTab === 'integration'}
				onclick={() => (topTab = 'integration')}
			>
				Integration Examples
			</button>
		</div>

		{#if topTab === 'showcase'}
			<EditionPage
				data={{
					edition: data.edition,
					siblingEditions: data.siblingEditions,
					viewerHelp: null,
					viewerHelpVideoUrl: null
				} as any}
				embedded
			/>
		{:else if topTab === 'controls'}
			<section class="space-y-6">
				<div class="alert bg-info/10 text-info-content">
					<div>
						<p class="font-semibold">API Controls Sandbox</p>
						<p class="text-sm">This preserves the original `/demo` behavior: a separate Voyager model with the full control panel for testing camera controls, annotations, tours, tools, measurement, and background options.</p>
					</div>
				</div>
				<VoyagerViewer
					url={apiEdition.voyagerRoot}
					document={apiEdition.sceneFile}
					title={apiEdition.title}
					direct={true}
					showControls={true}
					voyagerVersion={apiEdition.voyagerVersion}
					resourceRoot={apiEdition.voyagerResourceRoot}
					uiMode="none"
				/>
			</section>
		{:else if topTab === 'integration'}
			<section class="space-y-6">
				<div class="alert bg-base-200">
					<div>
						<p class="font-semibold">Integration Examples</p>
						<p class="text-sm text-base-content/70">Compare direct and iframe integration modes, review API methods, and follow links to Voyager documentation.</p>
					</div>
				</div>
				<VoyagerAPIDemo />
			</section>
		{/if}
	</div>
</div>
