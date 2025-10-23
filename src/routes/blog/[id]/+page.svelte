<script lang="ts">
	import { pb, type Post } from '$lib/database';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let post = $state<Post | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);

	onMount(async () => {
		try {
			const postId = $page.params.id;
			post = await pb.collection('posts').getOne<Post>(postId);
		} catch (err) {
			console.error('Error loading post:', err);
			error = 'Blog post not found';
		} finally {
			loading = false;
		}
	});
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
	{#if loading}
		<div class="rounded-lg border border-base-300 bg-base-200 p-8 text-center">
			<p class="text-base-content/70">Loading post...</p>
		</div>
	{:else if error || !post}
		<div class="rounded-lg border border-error bg-error/10 p-4 text-error">
			<p class="font-semibold">Error:</p>
			<p>{error || 'Post not found'}</p>
		</div>
	{:else}
		<article class="rounded-lg border border-base-300 bg-base-100 p-8 shadow-sm">
			<header class="mb-8">
				<h1 class="text-4xl font-bold text-base-content">
					{post.title}
				</h1>
				<div class="mt-4 flex items-center gap-4 text-sm text-base-content/70">
					<time datetime={post.created}>
						Published: {new Date(post.created).toLocaleDateString('en-US', {
							year: 'numeric',
							month: 'long',
							day: 'numeric'
						})}
					</time>
					{#if post.updated !== post.created}
						<span>•</span>
						<time datetime={post.updated}>
							Updated: {new Date(post.updated).toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric'
							})}
						</time>
					{/if}
				</div>
			</header>

			<div class="prose prose-lg max-w-none">
				{@html post.content}
			</div>
		</article>
	{/if}

	<div class="mt-8 flex items-center justify-between">
		<a
			href="/blog"
			class="inline-flex items-center text-sm text-base-content/70 hover:text-base-content"
		>
			← Back to blog
		</a>
		<a
			href="/"
			class="inline-flex items-center text-sm text-base-content/70 hover:text-base-content"
		>
			Home
		</a>
	</div>
</div>
