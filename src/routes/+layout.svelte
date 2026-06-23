<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import FeedbackPill from '$lib/components/ui/FeedbackPill.svelte';
	import Header from '$lib/components/ui/Header.svelte';
	import { Toaster } from 'svelte-french-toast';

	let { children } = $props();
</script>

<Header />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="-mt-10">
	{@render children?.()}
</div>

<FeedbackPill />

<Toaster />
