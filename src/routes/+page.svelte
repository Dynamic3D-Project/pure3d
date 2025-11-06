<script lang="ts">
	import { pb, authStore } from '$lib/database';
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
	{#if !pb.authStore.isValid}
		<div class="py-12 text-center">
			<h2 class="mb-4 text-2xl font-bold">Welcome!</h2>
			<p class="text-base-content/70">
				Please login using the button in the header to view your collections and editions.
			</p>
		</div>
	{:else}
		<div class="py-12 text-center">
			<h2 class="mb-4 text-2xl font-bold">Welcome back!</h2>
			<p class="text-base-content/70 mb-6">
				Explore your collections and editions using the navigation menu.
			</p>
			<div class="flex gap-4 justify-center">
				<a href="/collections" class="btn btn-primary">View Collections</a>
				<a href="/editions" class="btn btn-secondary">View Editions</a>
			</div>
		</div>
	{/if}
</div>
