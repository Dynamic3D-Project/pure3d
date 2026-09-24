<script lang="ts">
	import { mount, unmount } from 'svelte';
	import ContentEditionGrid from './ContentEditionGrid.svelte';
	import { cleanContent } from '$lib/utils/content-html';
	import { parseEditionIds } from '$lib/utils/content-components';

	interface Props {
		content?: string;
		className?: string;
	}

	let { content = '', className = 'prose max-w-none' }: Props = $props();
	let element = $state<HTMLElement>();
	let html = $derived(cleanContent(content));

	$effect(() => {
		void html;
		if (!element) return;
		const mounted = Array.from(
			element.querySelectorAll<HTMLElement>('[data-cms-editions]')
		).flatMap((target) => {
			const ids = parseEditionIds(target.dataset.cmsEditions || '');
			return ids.length ? [mount(ContentEditionGrid, { target, props: { ids } })] : [];
		});
		return () => mounted.forEach((component) => void unmount(component));
	});
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- cleanContent uses a strict allowlist before rendering. -->
<article id="content-renderer" bind:this={element} class={className}>{@html html}</article>

<style>
	#content-renderer :global([data-cms-callout]) {
		margin: 1.5rem 0;
		padding: 1rem 1.25rem;
		border-left: 0.25rem solid var(--color-info);
		border-radius: var(--radius-box);
		background: color-mix(in oklch, var(--color-info) 10%, transparent);
	}
	#content-renderer :global([data-cms-callout='success']) {
		border-color: var(--color-success);
		background: color-mix(in oklch, var(--color-success) 10%, transparent);
	}
	#content-renderer :global([data-cms-callout='warning']) {
		border-color: var(--color-warning);
		background: color-mix(in oklch, var(--color-warning) 12%, transparent);
	}
	#content-renderer :global([data-cms-actions='true']) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 1.5rem 0;
	}
	#content-renderer :global([data-cms-action]) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-base-content);
		border-radius: var(--radius-field);
		font-weight: 600;
		text-decoration: none;
	}
	#content-renderer :global([data-cms-action='primary']) {
		background: var(--color-base-content);
		color: var(--color-base-100);
	}
	#content-renderer :global([data-cms-expandable]) {
		margin: 1.5rem 0;
		padding: 1rem;
		border: 1px solid var(--color-base-300);
		border-radius: var(--radius-box);
	}
	#content-renderer :global([data-cms-expandable] > summary) {
		cursor: pointer;
		font-weight: 600;
	}
	#content-renderer :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-control);
	}
	#content-renderer :global(iframe) {
		width: 100%;
		aspect-ratio: 16/9;
		border: 0;
	}
	#content-renderer :global(table) {
		display: block;
		overflow-x: auto;
	}
	#content-renderer :global(a) {
		overflow-wrap: anywhere;
	}
</style>
