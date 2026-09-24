<script lang="ts">
	import { base } from '$app/paths';
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { safeLinkHref } from '$lib/utils/safe-link';
	let {
		href: source,
		children,
		...attributes
	}: Omit<HTMLAnchorAttributes, 'href' | 'id'> & {
		href?: string | null;
		children?: Snippet;
	} = $props();
	const href = $derived(safeLinkHref(source, base, !!attributes.download));
</script>

<a id="safe-link" {href} {...attributes}>{@render children?.()}</a>
