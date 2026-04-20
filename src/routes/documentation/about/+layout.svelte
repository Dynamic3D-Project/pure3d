<script lang="ts">
	let { children } = $props();
</script>

<article class="prose prose-lg max-w-none">
	{@render children?.()}
</article>
