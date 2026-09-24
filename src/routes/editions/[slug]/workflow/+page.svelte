<script lang="ts">
	import { page } from '$app/stores';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import EditionWorkflowPage from '$lib/components/workflow/EditionWorkflowPage.svelte';
</script>

<div id="page">
	{#key `${$page.params.slug}:${authStore.appUserId || ''}`}
		<EditionWorkflowPage />
	{/key}
</div>
