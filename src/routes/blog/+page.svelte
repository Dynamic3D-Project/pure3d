<script lang="ts">
	import { pb, type Post } from '$lib/database';
	import { onMount } from 'svelte';
	import Search from '$lib/components/Search.svelte';

	let posts = $state<Post[]>([]);
	let error = $state<string | null>(null);
	let loading = $state(true);

	onMount(async () => {
		try {
			const result = await pb.collection('posts').getList<Post>(1, 50, {
				sort: '-created'
			});
			posts = result.items;
		} catch (err) {
			console.error('Error loading posts:', err);
			error = 'Failed to load blog posts';
		} finally {
			loading = false;
		}
	});
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-4xl font-bold">Blog</h1>
				<p class="mt-2 text-base-content/70">Read our latest posts</p>
			</div>
			<a
				href="/"
				data-sveltekit-preload-data="hover"
				class="hover:bg-neutral-focus rounded-lg bg-neutral px-4 py-2 text-sm font-medium text-neutral-content"
			>
				← Home
			</a>
		</div>
		<div class="flex max-w-2xl items-center">
			<Search />
		</div>
	</div>

	{#if loading}
		<div class="rounded-lg border border-base-300 bg-base-200 p-8 text-center">
			<p class="text-base-content/70">Loading posts...</p>
		</div>
	{:else if error}
		<div class="rounded-lg border border-error bg-error/10 p-4 text-error">
			<p class="font-semibold">Error:</p>
			<p>{error}</p>
		</div>
	{:else if posts.length === 0}
		<div class="rounded-lg border border-base-300 bg-base-200 p-8 text-center">
			<p class="text-base-content/70">No blog posts yet.</p>
		</div>
	{:else}
		<div class="space-y-6">
			{#each posts as post (post.id)}
				<article
					class="rounded-lg border border-base-300 bg-base-100 p-6 shadow-sm transition hover:shadow-md"
				>
					<a href="/blog/{post.id}" data-sveltekit-preload-data="hover" class="block">
						<h2 class="text-2xl font-semibold text-base-content transition hover:text-primary">
							{post.title}
						</h2>
						<div class="mt-2 text-sm text-base-content/60">
							{new Date(post.created).toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric'
							})}
						</div>
						<div class="prose prose-sm mt-4 line-clamp-3 max-w-none text-base-content/80">
							{@html post.content}
						</div>
						<div class="hover:text-primary-focus mt-4 font-medium text-primary">Read more →</div>
					</a>
				</article>
			{/each}
		</div>
	{/if}
</div>
