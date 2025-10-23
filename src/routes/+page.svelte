<script lang="ts">
	import { pb, type Todo, authStore } from '$lib/database';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Header from '$lib/components/ui/Header.svelte';
	import Todos from '$lib/components/Todos.svelte';

	let todos = $state<Todo[]>([]);
	let error = $state<string | null>(null);
	let loading = $state(true);

	onMount(async () => {
		// Only fetch todos if user is authenticated
		if (!pb.authStore.isValid) {
			loading = false;
			return;
		}

		try {
			const result = await pb.collection('todos').getFullList<Todo>({
				sort: '-created'
			});
			todos = result;
		} catch (err) {
			console.error('Error fetching todos:', err);
			error = err instanceof Error ? err.message : 'Failed to fetch todos';
		} finally {
			loading = false;
		}
	});
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
	{#if loading}
		<div class="py-8 text-center">
			<p class="text-base-content/70">Loading...</p>
		</div>
	{:else if !pb.authStore.isValid}
		<div class="py-12 text-center">
			<h2 class="mb-4 text-2xl font-bold">Welcome!</h2>
			<p class="text-base-content/70">Please login using the button in the header to view your todos.</p>
		</div>
	{:else}
		<Todos initialTodos={todos} userId={pb.authStore.model?.id} {error} />
	{/if}
</div>
