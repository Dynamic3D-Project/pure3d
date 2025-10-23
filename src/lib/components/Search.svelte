<script lang="ts">
	import { pb, type Todo, type Post } from '$lib/database';
	import { debounce } from '$lib/utils/debounce';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let searchQuery = $state('');
	let searching = $state(false);
	let todoResults = $state<Todo[]>([]);
	let postResults = $state<Post[]>([]);
	let showResults = $state(false);
	let selectedIndex = $state(-1);
	let allResults = $state<Array<{ type: 'todo' | 'post'; data: Todo | Post; url: string }>>([]);
	let searchInputElement: HTMLInputElement | undefined = $state();

	async function performSearch(query: string) {
		if (!query.trim()) {
			todoResults = [];
			postResults = [];
			allResults = [];
			showResults = false;
			selectedIndex = -1;
			return;
		}

		searching = true;
		showResults = true;

		try {
			// Search todos - search in name and Description fields
			const todosPromise = pb.collection('todos').getList<Todo>(1, 5, {
				filter: `name ~ "${query}" || Description ~ "${query}"`,
				sort: '-created'
			});

			// Search posts - search in title and content fields
			const postsPromise = pb.collection('posts').getList<Post>(1, 5, {
				filter: `title ~ "${query}" || content ~ "${query}"`,
				sort: '-created'
			});

			const [todos, posts] = await Promise.all([todosPromise, postsPromise]);

			todoResults = todos.items;
			postResults = posts.items;

			// Build combined results for keyboard navigation
			allResults = [
				...todos.items.map(todo => ({ type: 'todo' as const, data: todo, url: '/' })),
				...posts.items.map(post => ({ type: 'post' as const, data: post, url: `/blog/${post.id}` }))
			];

			selectedIndex = -1;
		} catch (err) {
			console.error('Search error:', err);
		} finally {
			searching = false;
		}
	}

	// Debounce search to avoid too many API calls
	const debouncedSearch = debounce((query: string) => performSearch(query), 300);

	$effect(() => {
		debouncedSearch(searchQuery);
	});

	// Window-level keyboard handler to ensure we catch all keyboard events
	// This is more reliable than input-level handlers with DaisyUI
	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.search-container')) {
			showResults = false;
			selectedIndex = -1;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		// Only handle keyboard events if search input is focused or results are showing
		const isSearchFocused = document.activeElement === searchInputElement;

		console.log('🔍 Key pressed:', event.key);
		console.log('   isSearchFocused:', isSearchFocused);
		console.log('   showResults:', showResults);
		console.log('   allResults.length:', allResults.length);
		console.log('   selectedIndex (before):', selectedIndex);

		// Only handle navigation keys when search is active
		if (!isSearchFocused && !showResults) {
			console.log('   ⏭️  Ignoring - search not active');
			return;
		}

		// Prevent arrow keys from moving cursor when dropdown is open
		if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && showResults && allResults.length > 0) {
			event.preventDefault();
			console.log('   ✅ preventDefault() called');
		}

		switch (event.key) {
			case 'ArrowDown':
				if (!showResults || allResults.length === 0) {
					console.log('   ❌ ArrowDown blocked: showResults =', showResults, 'length =', allResults.length);
					return;
				}
				selectedIndex = selectedIndex < allResults.length - 1 ? selectedIndex + 1 : 0;
				console.log('   ✅ ArrowDown: selectedIndex changed to', selectedIndex);
				scrollToSelected();
				break;
			case 'ArrowUp':
				if (!showResults || allResults.length === 0) {
					console.log('   ❌ ArrowUp blocked: showResults =', showResults, 'length =', allResults.length);
					return;
				}
				selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : allResults.length - 1;
				console.log('   ✅ ArrowUp: selectedIndex changed to', selectedIndex);
				scrollToSelected();
				break;
			case 'Enter':
				if (!showResults || allResults.length === 0 || selectedIndex === -1) return;
				event.preventDefault();
				const selected = allResults[selectedIndex];
				console.log('   ✅ Enter pressed, navigating to:', selected?.url);
				if (selected) {
					showResults = false;
					selectedIndex = -1;
					goto(selected.url);
				}
				break;
			case 'Escape':
				if (!showResults) return;
				event.preventDefault();
				console.log('   ✅ Escape pressed, closing results');
				showResults = false;
				selectedIndex = -1;
				break;
		}
	}

	function scrollToSelected() {
		setTimeout(() => {
			const selectedElement = document.querySelector(`[data-result-index="${selectedIndex}"]`);
			selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}, 0);
	}

	function getResultIndex(todoIndex: number, isPost = false): number {
		if (isPost) {
			return todoResults.length + todoIndex;
		}
		return todoIndex;
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="search-container relative">
	<label class="input input-bordered flex items-center gap-2">
		<svg
			class="h-5 w-5 opacity-70"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
		<input
			type="text"
			bind:this={searchInputElement}
			bind:value={searchQuery}
			placeholder="Search todos and posts..."
			class="grow"
			onfocus={() => {
				if (searchQuery.trim()) showResults = true;
			}}
		/>
	</label>

	{#if showResults && searchQuery.trim()}
		<div class="card card-compact absolute z-50 mt-2 w-full bg-base-100 shadow-xl max-h-96 overflow-y-auto">
			<div class="card-body p-0">
				{#if searching}
					<div class="p-4 text-center text-sm opacity-70">
						<span class="loading loading-spinner loading-sm"></span>
						<span class="ml-2">Searching...</span>
					</div>
				{:else if todoResults.length === 0 && postResults.length === 0}
					<div class="p-4 text-center text-sm opacity-70">No results found</div>
				{:else}
					<ul class="menu menu-sm">
						<!-- Todo Results -->
						{#if todoResults.length > 0}
							<li class="menu-title">
								<span>Todos</span>
							</li>
							{#each todoResults as todo, i}
								{@const index = getResultIndex(i)}
								<li data-result-index={index}>
									<a
										href="/"
										class:active={selectedIndex === index}
										onclick={(e) => {
											e.preventDefault();
											showResults = false;
											selectedIndex = -1;
											goto('/');
										}}
									>
										<svg
											class="h-4 w-4 text-primary"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
											/>
										</svg>
										<div class="flex-1 min-w-0">
											<div class="font-medium truncate">{todo.name}</div>
											{#if todo.Description}
												<div class="text-xs opacity-70 truncate">{todo.Description}</div>
											{/if}
										</div>
									</a>
								</li>
							{/each}
						{/if}

						<!-- Post Results -->
						{#if postResults.length > 0}
							<li class="menu-title">
								<span>Blog Posts</span>
							</li>
							{#each postResults as post, i}
								{@const index = getResultIndex(i, true)}
								<li data-result-index={index}>
									<a
										href="/blog/{post.id}"
										class:active={selectedIndex === index}
										onclick={(e) => {
											e.preventDefault();
											showResults = false;
											selectedIndex = -1;
											goto(`/blog/${post.id}`);
										}}
									>
										<svg
											class="h-4 w-4 text-secondary"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
											/>
										</svg>
										<div class="flex-1 min-w-0">
											<div class="font-medium truncate">{post.title}</div>
											<div class="text-xs opacity-70 truncate">
												{new Date(post.created).toLocaleDateString()}
											</div>
										</div>
									</a>
								</li>
							{/each}
						{/if}
					</ul>
				{/if}
			</div>
		</div>
	{/if}
</div>
