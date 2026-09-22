<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- PocketBase file URLs are absolute. */
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import type { RecordModel } from 'pocketbase';
	import toast from 'svelte-french-toast';
	let rows = $state<RecordModel[]>([]),
		content = $state<RecordModel[]>([]),
		query = $state(''),
		error = $state(''),
		busy = $state(false),
		selected = $state<RecordModel | null>(null),
		caption = $state(''),
		alt = $state('');
	let modal: HTMLDialogElement;
	let filtered = $derived(
		rows.filter((r) =>
			`${r.file} ${r.caption} ${r.alt}`.toLowerCase().includes(query.toLowerCase())
		)
	);
	const references = (id: string) =>
		content.filter((c) => `${c.body} ${c.coverUrl}`.includes(`/${id}/`));
	async function load() {
		try {
			[rows, content] = await Promise.all([
				pb.collection('content_assets').getFullList(),
				pb.collection('content').getFullList({ fields: 'id,title,body,coverUrl' })
			]);
		} catch (e) {
			error = String(e);
		}
	}
	async function upload(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = Array.from(input.files || []);
		busy = true;
		try {
			for (const file of files) {
				const data = new FormData();
				data.set('file', file);
				await pb.collection('content_assets').create(data);
			}
			await load();
			toast.success('Media uploaded');
		} catch (e) {
			error = String(e);
		} finally {
			busy = false;
			input.value = '';
		}
	}
	async function save() {
		if (!selected) return;
		try {
			const updated = await pb.collection('content_assets').update(selected.id, { caption, alt });
			rows = rows.map((row) => (row.id === updated.id ? updated : row));
			selected = updated;
			toast.success('Media details saved');
		} catch (e) {
			error = String(e);
		}
	}
	function open(row: RecordModel) {
		selected = row;
		caption = row.caption || '';
		alt = row.alt || '';
		modal.showModal();
	}
	async function copyLink() {
		if (!selected) return;
		try {
			await navigator.clipboard.writeText(pb.files.getURL(selected, selected.file));
			toast.success('Link copied');
		} catch {
			error = 'Could not copy link';
		}
	}
	async function remove(row: RecordModel) {
		await load();
		if (references(row.id).length) {
			error =
				'This file is still used by a page or post. Remove those references before deleting it.';
			return;
		}
		if (!confirm(`Permanently delete ${row.file}?`)) return;
		try {
			await pb.collection('content_assets').delete(row.id);
			await load();
			modal.close();
		} catch (e) {
			error = String(e);
		}
	}
	onMount(() => {
		if (authStore.globalRole === 'admin') void load();
	});
</script>

<div id="media-page">
	{#if authStore.globalRole === 'admin'}<h1 class="mb-2 text-3xl font-semibold">Media library</h1>
		<p class="mb-7 text-sm opacity-60">
			Upload once and reuse across pages and posts. Files used in content cannot be deleted here.
		</p>
		{#if error}<p role="alert" class="mb-5 alert alert-error">{error}</p>{/if}
		<div class="mb-7 flex flex-wrap gap-4">
			<label class="input"
				><span class="sr-only">Search media</span><input
					placeholder="Search media…"
					bind:value={query}
				/></label
			><input
				aria-label="Upload media"
				type="file"
				multiple
				accept="image/jpeg,image/png,image/avif,image/webp,image/gif,application/pdf,audio/mpeg,video/mp4"
				class="file-input"
				disabled={busy}
				onchange={upload}
			/>
		</div>
		<p class="mb-4 text-xs opacity-50">{filtered.length} files</p>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
			{#each filtered as row (row.id)}<button
					type="button"
					class="group min-w-0 overflow-hidden rounded-xl border border-base-300 bg-base-100 text-left transition [contain-intrinsic-size:auto_320px] [content-visibility:auto] hover:border-base-content/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
					onclick={() => open(row)}
				>
					{#if /\.(avif|png|jpg|jpeg|webp|gif)$/i.test(row.file)}<img
							src={pb.files.getURL(row, row.file)}
							alt={row.alt || ''}
							loading="lazy"
							class="aspect-square w-full bg-base-200 object-contain"
						/>{:else}<div
							class="flex aspect-square items-center justify-center bg-base-200 font-mono text-lg"
						>
							{row.file.split('.').pop()?.toUpperCase()}
						</div>{/if}
					<div class="p-3">
						<p class="truncate text-sm font-medium" title={row.file}>{row.file}</p>
						<p class="mt-1 text-xs opacity-50">Used by {references(row.id).length}</p>
					</div>
				</button>{:else}<p class="col-span-full py-12 text-center opacity-60">
					No media found.
				</p>{/each}
		</div>{:else}<p>Admin access required.</p>{/if}

	<dialog
		bind:this={modal}
		class="modal"
		aria-labelledby="media-details-title"
		onclose={() => (selected = null)}
	>
		{#if selected}
			<div class="modal-box max-w-3xl">
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<h2 id="media-details-title" class="text-xl font-semibold">Media details</h2>
						<a
							class="mt-1 block truncate text-sm underline"
							href={pb.files.getURL(selected, selected.file)}
							target="_blank"
							rel="noopener">{selected.file}</a
						>
					</div>
					<form method="dialog">
						<button class="btn btn-circle btn-ghost btn-sm" aria-label="Close">✕</button>
					</form>
				</div>

				{#if /\.(avif|png|jpg|jpeg|webp|gif)$/i.test(selected.file)}<img
						src={pb.files.getURL(selected, selected.file)}
						alt={selected.alt || ''}
						class="mt-5 max-h-96 w-full rounded-lg bg-base-200 object-contain"
					/>{:else}<div
						class="mt-5 flex h-56 items-center justify-center rounded-lg bg-base-200 font-mono text-2xl"
					>
						{selected.file.split('.').pop()?.toUpperCase()}
					</div>{/if}

				<div class="mt-5 space-y-4">
					<label class="form-control">
						<span class="label-text mb-1">Caption</span>
						<input class="input-bordered input w-full" bind:value={caption} />
					</label>
					<label class="form-control">
						<span class="label-text mb-1">Alternative text</span>
						<input class="input-bordered input w-full" bind:value={alt} />
					</label>
					<p class="text-sm opacity-60">Used by {references(selected.id).length} pages/posts</p>
				</div>

				<div
					class="modal-action flex-col-reverse items-stretch justify-between sm:flex-row sm:items-center"
				>
					<button
						class="btn text-error btn-ghost"
						disabled={references(selected.id).length > 0}
						onclick={() => remove(selected!)}>Delete</button
					>
					<div class="flex flex-col gap-2 sm:flex-row">
						<button class="btn btn-outline" onclick={copyLink}>Copy link</button>
						<button class="btn btn-primary" onclick={save}>Save details</button>
					</div>
				</div>
			</div>
		{/if}
		<form method="dialog" class="modal-backdrop"><button>Close</button></form>
	</dialog>
</div>
