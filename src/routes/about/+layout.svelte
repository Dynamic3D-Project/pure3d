<script lang="ts">
	let { children } = $props();
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="prose prose-lg max-w-none">
		{@render children?.()}
	</div>
</div>
