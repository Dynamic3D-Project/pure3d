<script lang="ts">
	import { pb, type Todo } from '$lib/database';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		initialTodos?: Todo[];
		userId?: string;
		error?: string | null;
	}

	let { initialTodos = [], userId, error: initialError = null }: Props = $props();

	let todos = $state(initialTodos || []);
	let error = $state(initialError);
	let newTodoName = $state('');
	let newTodoDescription = $state('');
	let creating = $state(false);

	// Real-time subscriptions
	onMount(() => {
		// Subscribe to todos collection changes
		pb.collection('todos').subscribe('*', (e) => {
			if (e.action === 'create') {
				// Add new todo to the list
				todos = [e.record as Todo, ...todos];
			} else if (e.action === 'update') {
				// Update existing todo
				todos = todos.map((t) => (t.id === e.record.id ? (e.record as Todo) : t));
			} else if (e.action === 'delete') {
				// Remove deleted todo
				todos = todos.filter((t) => t.id !== e.record.id);
			}
		});
	});

	onDestroy(() => {
		// Unsubscribe when component is destroyed
		pb.collection('todos').unsubscribe('*');
	});

	async function createTodo() {
		if (!newTodoName.trim()) return;

		creating = true;
		try {
			await pb.collection('todos').create<Todo>({
				name: newTodoName,
				Description: newTodoDescription || '',
				completed: false,
				user: userId
			});

			// Real-time subscription will handle adding to the list

			// Reset form
			newTodoName = '';
			newTodoDescription = '';
		} catch (err) {
			console.error('Error creating todo:', err);
			alert('Failed to create todo');
		} finally {
			creating = false;
		}
	}

	async function toggleTodo(todo: Todo) {
		try {
			await pb.collection('todos').update<Todo>(todo.id, {
				completed: !todo.completed
			});

			// Real-time subscription will handle updating the list
		} catch (err) {
			console.error('Error updating todo:', err);
		}
	}
</script>

<!-- Create Todo Form -->
<div class="card bg-base-100 shadow-xl mb-8">
	<div class="card-body">
		<h2 class="card-title">Create New Todo</h2>
		<form onsubmit={(e) => { e.preventDefault(); createTodo(); }} class="space-y-4">
			<div class="form-control">
				<label class="label" for="name">
					<span class="label-text">Task Name</span>
				</label>
				<input
					id="name"
					type="text"
					bind:value={newTodoName}
					required
					placeholder="What needs to be done?"
					class="input input-bordered w-full"
				/>
			</div>

			<div class="form-control">
				<label class="label" for="description">
					<span class="label-text">Description (optional)</span>
				</label>
				<textarea
					id="description"
					bind:value={newTodoDescription}
					rows="3"
					placeholder="Add more details..."
					class="textarea textarea-bordered w-full"
				></textarea>
			</div>

			<button
				type="submit"
				disabled={creating || !newTodoName.trim()}
				class="btn btn-primary"
			>
				{creating ? 'Creating...' : 'Add Todo'}
			</button>
		</form>
	</div>
</div>

{#if error}
	<div class="alert alert-error">
		<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
		<div>
			<div class="font-semibold">Error:</div>
			<div>{error}</div>
			<div class="text-sm">
				Check the PocketBase API Rules for the 'todos' collection.
			</div>
		</div>
	</div>
{:else if todos.length === 0}
	<div class="alert alert-info">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>
		<span>No todos yet. Create one above!</span>
	</div>
{:else}
	<div class="space-y-3">
		{#each todos as todo (todo.id)}
			<div class="card bg-base-100 shadow-sm hover:shadow-md transition">
				<div class="card-body p-4">
					<div class="flex items-start gap-4">
						<input
							type="checkbox"
							checked={todo.completed}
							onchange={() => toggleTodo(todo)}
							class="checkbox checkbox-primary mt-1"
						/>
						<div class="flex-1">
							<h3
								class="text-lg font-medium"
								class:line-through={todo.completed}
								class:opacity-40={todo.completed}
							>
								{todo.name}
							</h3>
							{#if todo.Description}
								<div
									class="prose prose-sm mt-2 max-w-none"
									class:opacity-40={todo.completed}
								>
									{@html todo.Description}
								</div>
							{/if}
							<div class="mt-2 text-sm opacity-60">
								Created: {new Date(todo.created).toLocaleDateString()}
							</div>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
