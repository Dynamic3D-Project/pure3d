<script lang="ts">
	import LoginForm from '$lib/components/ui/Login/LoginForm.svelte';
</script>

<svelte:head>
	<title>Sign in with ORCID | PURE3D</title>
	<meta
		name="description"
		content="Connect your ORCID identity to your PURE3D research and author credits."
	/>
</svelte:head>

<div id="page" class="flex min-h-[75vh] items-center justify-center bg-base-200 px-4 py-12">
	<div class="w-full max-w-lg rounded-xl border border-base-300 bg-base-100 shadow-sm">
		<LoginForm />
	</div>
</div>
