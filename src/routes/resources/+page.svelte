<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Internal paths use resolve; category links append a query string. */
	import { resolve } from '$app/paths';
	import { kindLabels } from '$lib/content';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let query = $state('');
	let items = $derived(
		data.items.filter((item) =>
			`${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase())
		)
	);
</script>

<svelte:head
	><title>{data.categoryName || 'Resources'} | Pure3D</title><meta
		name="description"
		content="Explore research, publications, tutorials and stories from the PURE3D community."
	/></svelte:head
>
<main id="resources-page" class="mx-auto max-w-7xl px-5 py-14 md:px-10">
	<div class="mb-14 flex flex-wrap items-end justify-between gap-6">
		<div>
			<p class="mb-4 text-xs tracking-[.2em] uppercase opacity-60">
				Ideas, practice & perspectives
			</p>
			<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">
				{data.categoryName || 'A library for 3D scholarship'}
			</h1>
			<p class="mt-5 max-w-2xl text-lg opacity-65">
				{data.description ||
					'Learn from the research, explore new perspectives, and find your next step.'}
			</p>
		</div>
		{#if authStore.globalRole === 'admin'}<a
				href={resolve('/admin/content')}
				class="btn btn-outline">Manage content ↗</a
			>{/if}
	</div>
	<div class="mb-9 flex flex-wrap items-center justify-between gap-5 border-y border-base-300 py-5">
		<nav class="flex flex-wrap gap-4" aria-label="Resource categories">
			<a class:font-bold={!data.category} href={resolve('/resources')}>All posts</a
			>{#each data.categories as category (category.id)}<a
					class:font-bold={data.category === category.id}
					href={`${resolve('/resources')}?category=${category.slug}`}>{category.name}</a
				>{/each}
		</nav>
		<label class="input"
			><span class="sr-only">Search resources</span><input
				type="search"
				placeholder="Search resources…"
				bind:value={query}
			/></label
		>
	</div>
	{#if authStore.globalRole === 'admin'}<p class="mb-6 rounded-lg bg-base-200 p-4 text-sm">
			Admin preview includes drafts. Draft content is not visible to public visitors.
		</p>{/if}
	<div class="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
		{#each items as item (item.id)}<a
				class="group overflow-hidden rounded-xl border border-base-300 bg-base-100"
				href={resolve('/resources/[slug]', { slug: item.slug })}
				><div class="aspect-[16/10] overflow-hidden bg-base-200">
					{#if item.coverUrl}<img
							src={item.coverUrl}
							alt=""
							loading="lazy"
							class="h-full w-full object-cover"
						/>{:else}<div
							class="flex h-full items-center justify-center text-3xl tracking-widest opacity-25"
						>
							PURE3D
						</div>{/if}
				</div>
				<div class="p-6">
					<p class="mb-3 text-xs tracking-wider uppercase opacity-60">
						{data.categories
							.filter((c) => item.categoryIds?.includes(c.id))
							.map((c) => c.name)
							.join(' · ') || kindLabels[item.kind]}{#if !item.isPublished}
							· Draft{/if}
					</p>
					<h2 class="text-xl leading-snug font-semibold group-hover:underline">{item.title}</h2>
					<p class="mt-3 line-clamp-3 text-sm leading-relaxed opacity-65">{item.summary}</p>
					<p class="mt-6 text-xs opacity-50">
						{item.publishedAt
							? new Date(item.publishedAt).toLocaleDateString('en-GB', {
									year: 'numeric',
									month: 'long',
									day: 'numeric'
								})
							: ''}
					</p>
				</div></a
			>{/each}
	</div>
	{#if items.length === 0}<p class="py-20 text-center opacity-60">
			{query
				? 'No resources match your search.'
				: 'Resources are being prepared for publication. Please check back soon.'}
		</p>{/if}
</main>
