<script lang="ts">
	import { base } from '$app/paths';
	import type { LayoutData } from './$types';

	let { data }: { data: LayoutData } = $props();

	let pages = $derived(data.pages);
</script>

<svelte:head>
	<title>Documentation | Pure 3D</title>
	<meta name="description" content="Documentation and guides for Pure 3D" />
</svelte:head>

<div>
	<h1 class="mb-6 text-3xl font-bold">Documentation</h1>
	<p class="mb-8 text-base-content/70">
		Guides, tutorials, and resources for authors, reviewers, and users of Pure 3D.
	</p>

	{#if pages.length === 0}
		<p class="text-base-content/60">No documentation pages available yet.</p>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each pages as p (p.id)}
				<a
					href="{base}/documentation/{p.slug}"
					class="card bg-base-200 shadow-sm transition-shadow hover:shadow-md"
				>
					<div class="card-body">
						<h2 class="card-title text-lg">{p.title}</h2>
						{#if p.summary}
							<p class="text-sm text-base-content/70">{p.summary}</p>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
