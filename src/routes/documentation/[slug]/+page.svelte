<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- All guide and admin links include the app base. */
	import { base } from '$app/paths';
	import type { PageData } from './$types';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import ContentRenderer from '$lib/components/content/ContentRenderer.svelte';

	let { data }: { data: PageData } = $props();

	let doc = $derived(data.doc);
	let currentIndex = $derived(data.pages.findIndex((page) => page.slug === doc.slug));
	let previousPage = $derived(
		currentIndex > 0
			? data.pages[currentIndex - 1]
			: currentIndex === 0
				? { title: 'Get started', slug: '' }
				: null
	);
	let nextPage = $derived(
		currentIndex >= 0 && currentIndex < data.pages.length - 1 ? data.pages[currentIndex + 1] : null
	);
</script>

<svelte:head>
	<title>{doc.title} | Documentation | Pure 3D</title>
	<meta name="description" content={doc.summary} />
</svelte:head>

<div id="documentation-slug-page">
	{#if authStore.globalRole === 'admin'}<div class="mb-6 flex items-center justify-between gap-3">
			<span class="text-sm opacity-60"
				>{doc.isPublished ? 'Published guide' : 'Draft preview · admins only'}</span
			><a class="btn btn-outline btn-sm" href={`${base}/admin/pages?edit=${doc.id}`}>Edit page</a>
		</div>{/if}
	<section class="prose max-w-none">
		<h1>{doc.title}</h1>
		<ContentRenderer content={doc.body} />
	</section>

	<nav class="mt-16 grid grid-cols-2 gap-4 border-t border-base-300 pt-6" aria-label="Guide pages">
		{#if previousPage}
			<a
				href={previousPage.slug
					? `${base}/documentation/${previousPage.slug}`
					: `${base}/documentation`}
				rel="prev"
				class="group justify-self-start rounded-xl p-3 transition hover:bg-base-200 sm:p-4"
			>
				<span class="block text-xs font-bold tracking-wider text-base-content/50 uppercase">
					← Previous
				</span>
				<span class="mt-1 block font-semibold group-hover:underline">{previousPage.title}</span>
			</a>
		{/if}

		{#if nextPage}
			<a
				href={`${base}/documentation/${nextPage.slug}`}
				rel="next"
				class="group col-start-2 justify-self-end rounded-xl p-3 text-right transition hover:bg-base-200 sm:p-4"
			>
				<span class="block text-xs font-bold tracking-wider text-base-content/50 uppercase">
					Next →
				</span>
				<span class="mt-1 block font-semibold group-hover:underline">{nextPage.title}</span>
			</a>
		{/if}
	</nav>
</div>
