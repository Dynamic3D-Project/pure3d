<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let doc = $derived(data.doc);
</script>

<svelte:head>
	<title>{doc.title} | Documentation | Pure 3D</title>
	<meta name="description" content={doc.summary} />
</svelte:head>

<article class="prose prose-lg max-w-none">
	<h1>{doc.title}</h1>
	{@html doc.content}
</article>
