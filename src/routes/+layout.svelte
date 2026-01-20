<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import Header from '$lib/components/ui/Header.svelte';
	import { Toaster } from 'svelte-french-toast';

	let { children } = $props();
</script>

<Header />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}

<Toaster />
