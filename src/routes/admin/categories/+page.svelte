<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import type { RecordModel } from 'pocketbase';
	import toast from 'svelte-french-toast';
	import { refreshMenus } from '$lib/stores/navigation';
	let rows = $state<RecordModel[]>([]),
		posts = $state<RecordModel[]>([]),
		selected = $state(''),
		name = $state(''),
		slug = $state(''),
		description = $state(''),
		error = $state(''),
		busy = $state(false);
	async function load() {
		try {
			[rows, posts] = await Promise.all([
				pb.collection('cms_categories').getFullList({ sort: 'name' }),
				pb.collection('content').getFullList({ filter: 'kind = "post"', fields: 'id,categoryIds' })
			]);
		} catch (e) {
			error = String(e);
		}
	}
	function reset() {
		selected = '';
		name = '';
		slug = '';
		description = '';
	}
	async function save() {
		if (!name.trim() || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
			error = 'Enter a name and a URL slug using lowercase letters, numbers and hyphens.';
			return;
		}
		busy = true;
		error = '';
		try {
			const data = { name: name.trim(), slug, description };
			if (selected) await pb.collection('cms_categories').update(selected, data);
			else await pb.collection('cms_categories').create(data);
			reset();
			await load();
			toast.success('Category saved');
			await refreshMenus();
		} catch (e) {
			error = String(e);
		} finally {
			busy = false;
		}
	}
	async function remove(row: RecordModel) {
		if (
			!confirm(
				`Delete “${row.name}”? Posts are retained, but this category and its menu links will no longer appear.`
			)
		)
			return;
		try {
			await pb.collection('cms_categories').delete(row.id);
			await load();
			await refreshMenus();
		} catch (e) {
			error = String(e);
		}
	}
	onMount(() => {
		if (authStore.globalRole === 'admin') void load();
	});
</script>

<div id="categories-page">
	{#if authStore.globalRole === 'admin'}<h1 class="mb-2 text-3xl font-semibold">Categories</h1>
		<p class="mb-8 text-sm opacity-60">
			A post can belong to several categories. Category listings update automatically when posts are
			published.
		</p>
		{#if error}<p role="alert" class="mb-5 alert alert-error">{error}</p>{/if}
		<div class="grid gap-8 lg:grid-cols-[320px_1fr]">
			<form
				class="space-y-4 rounded-xl border border-base-300 p-5"
				onsubmit={(e) => {
					e.preventDefault();
					void save();
				}}
			>
				<h2 class="font-semibold">{selected ? 'Edit category' : 'New category'}</h2>
				<label class="block text-sm"
					>Name<input required class="input mt-2 w-full" bind:value={name} /></label
				><label class="block text-sm"
					>Slug<input required class="input mt-2 w-full" bind:value={slug} /></label
				><label class="block text-sm"
					>Description<textarea class="textarea mt-2 w-full" bind:value={description}
					></textarea></label
				>
				<div class="flex gap-2">
					<button class="btn btn-primary" disabled={busy}>Save category</button
					>{#if selected}<button type="button" class="btn btn-ghost" onclick={reset}>Cancel</button
						>{/if}
				</div>
			</form>
			<ul class="space-y-3">
				{#each rows as row (row.id)}<li
						class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-300 p-4"
					>
						<div>
							<h2 class="font-semibold">{row.name}</h2>
							<p class="text-xs opacity-60">
								{row.slug} · {posts.filter((p) => p.categoryIds?.includes(row.id)).length} posts
							</p>
						</div>
						<div class="flex gap-2">
							<button
								class="btn btn-sm"
								onclick={() => {
									selected = row.id;
									name = row.name;
									slug = row.slug;
									description = row.description || '';
								}}>Edit</button
							><button class="btn btn-ghost btn-sm" onclick={() => remove(row)}>Delete</button>
						</div>
					</li>{/each}
			</ul>
		</div>{:else}<p>Admin access required.</p>{/if}
</div>
