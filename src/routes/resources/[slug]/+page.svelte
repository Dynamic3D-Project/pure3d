<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- The resolved admin route appends the record ID as a query parameter. */
	import { resolve } from '$app/paths';
	import { kindLabels } from '$lib/content';
	import { cleanContent } from '$lib/utils/content-html';
	import { contentPath } from '$lib/cms';
	import { base } from '$app/paths';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let item = $derived(data.item);
</script>

<svelte:head
	><title>{item.title} | Pure3D</title><meta
		name="description"
		content={item.summary}
	/>{#if !item.isPublished}<meta name="robots" content="noindex,nofollow" />{/if}</svelte:head
>
<main id="resource-page" class="mx-auto max-w-4xl px-5 py-12 md:px-10">
	<div class="mb-12 flex flex-wrap items-center justify-between gap-4 text-sm">
		<a href={resolve('/resources')}>← All resources</a>{#if authStore.globalRole === 'admin'}<a
				class="btn btn-outline btn-sm"
				href={`${item.kind === 'post' ? resolve('/admin/posts') : resolve('/admin/pages')}?edit=${item.id}`}
				>Edit {item.kind === 'post' ? 'post' : 'page'}</a
			>{/if}
	</div>
	{#if !item.isPublished}<div
			class="mb-8 rounded-lg border border-base-300 bg-base-200 p-4 text-sm"
		>
			<strong>Draft preview</strong> · Only admins can view this page.
		</div>{/if}
	{#if item.expand?.parent}<a
			class="mb-5 block text-sm underline"
			href={`${base}${contentPath(item.expand.parent)}`}>← {item.expand.parent.title}</a
		>{/if}
	<p class="mb-5 text-xs tracking-[.15em] uppercase opacity-55">
		{#if Array.isArray(item.expand?.categoryIds) && item.expand.categoryIds.length}
			{#each item.expand.categoryIds as category, index (category.id)}{#if index}
					·
				{/if}<a href={`${base}/resources?category=${category.slug}`}>{category.name}</a>{/each}
		{:else}{kindLabels[item.kind] || 'Page'}{/if}
	</p>
	<h1 class="text-4xl leading-tight font-semibold tracking-tight md:text-5xl">{item.title}</h1>
	<p class="my-6 text-sm opacity-60">
		{item.author}{item.author && item.publishedAt ? ' · ' : ''}{item.publishedAt
			? new Date(item.publishedAt).toLocaleDateString('en-GB', {
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				})
			: ''}
	</p>
	{#if item.coverUrl}<img
			class="my-10 max-h-[520px] w-full rounded-xl bg-base-200 object-contain"
			src={item.coverUrl}
			alt=""
		/>{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- cleanContent strips executable HTML with an allowlist. -->
	<article class="prose mt-10 max-w-none">{@html cleanContent(item.body || '')}</article>
	{#if data.children.length}<nav
			aria-label="Child pages"
			class="mt-12 border-t border-base-300 pt-6"
		>
			<h2 class="mb-4 font-semibold">In this section</h2>
			<ul class="space-y-3">
				{#each data.children as child (child.id)}<li>
						<a class="underline" href={`${base}${contentPath(child)}`}
							>{child.title}{!child.isPublished ? ' · Draft' : ''}</a
						>
					</li>{/each}
			</ul>
		</nav>{/if}
</main>

<style>
	article :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 8px;
	}
	article :global(iframe) {
		width: 100%;
		aspect-ratio: 16/9;
		border: 0;
	}
	article :global(table) {
		display: block;
		overflow-x: auto;
	}
	article :global(a) {
		overflow-wrap: anywhere;
	}
</style>
