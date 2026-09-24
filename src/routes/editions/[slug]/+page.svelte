<script lang="ts">
	import EditionView from '$lib/components/editions/EditionView.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<div id="page"><EditionView {data} /></div>
