<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function materialHref(material: PageData['materials'][number]) {
		return material.layout === 'guide'
			? resolve('/documentation/[slug]', { slug: material.slug })
			: resolve('/resources/[slug]', { slug: material.slug });
	}
</script>

<svelte:head>
	<title>Learning Materials | PURE3D</title>
	<meta
		name="description"
		content="Guides, tutorials and practical resources for creating 3D scholarly editions with PURE3D."
	/>
</svelte:head>

<main id="learning-materials-page" class="mx-auto max-w-7xl px-5 py-14 md:px-10">
	<header class="mb-14 max-w-3xl">
		<p class="mb-4 text-xs font-semibold tracking-[0.2em] text-vermillion uppercase">
			Learn with PURE3D
		</p>
		<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">Learning Materials</h1>
		<p class="mt-5 text-lg leading-relaxed text-base-content/65">
			Explore practical guides, tutorials and answers to help you plan, create and publish a 3D
			scholarly edition.
		</p>
	</header>

	<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.materials as material, index (material.id)}
			<a
				href={materialHref(material)}
				class="group flex min-h-64 flex-col justify-between rounded-box bg-base-200 p-7 transition hover:-translate-y-1 hover:bg-base-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vermillion"
			>
				<div>
					<p class="mb-8 text-xs font-bold tracking-[0.18em] text-vermillion uppercase">
						{String(index + 1).padStart(2, '0')} · {material.layout === 'guide'
							? 'Guide'
							: 'Resource'}
					</p>
					<h2 class="text-2xl leading-tight font-semibold tracking-tight">{material.title}</h2>
					{#if material.summary}
						<p class="mt-4 line-clamp-4 leading-relaxed text-base-content/65">
							{material.summary}
						</p>
					{/if}
				</div>
				<span class="mt-8 text-sm font-semibold group-hover:underline">
					Open material <span aria-hidden="true">↗</span>
				</span>
			</a>
		{/each}
	</div>

	{#if data.materials.length === 0}
		<p class="rounded-box bg-base-200 p-8 text-base-content/65">
			Learning materials are being prepared for publication. Please check back soon.
		</p>
	{/if}
</main>
