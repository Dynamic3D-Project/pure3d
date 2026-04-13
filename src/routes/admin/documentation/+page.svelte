<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { logAudit } from '$lib/utils/audit';
	import type { Documentation } from '$lib/types/documentation';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import toast from 'svelte-french-toast';

	let docs = $state<Documentation[]>([]);
	let isLoading = $state(true);

	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let formTitle = $state('');
	let formSlug = $state('');
	let formSummary = $state('');
	let formContent = $state('');
	let formOrder = $state(0);
	let formIsPublished = $state(false);
	let isSaving = $state(false);

	let deletingId = $state<string | null>(null);

	function slugify(text: string): string {
		return text
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/[\s_]+/g, '-')
			.replace(/-+/g, '-');
	}

	let autoSlug = $state(true);

	function handleTitleInput() {
		if (autoSlug && !editingId) {
			formSlug = slugify(formTitle);
		}
	}

	onMount(() => {
		loadDocs();
	});

	async function loadDocs() {
		try {
			isLoading = true;
			const result = await pb.collection('documentation').getList(1, 100, {
				sort: 'order'
			});
			docs = result.items.map((r) => ({
				id: r.id,
				title: r.title,
				slug: r.slug,
				content: r.content,
				summary: r.summary || '',
				order: r.order,
				isPublished: r.isPublished,
				created: r.created,
				updated: r.updated
			}));
		} catch {
			toast.error('Failed to load documentation pages');
		} finally {
			isLoading = false;
		}
	}

	function resetForm() {
		showForm = false;
		editingId = null;
		formTitle = '';
		formSlug = '';
		formSummary = '';
		formContent = '';
		formOrder = docs.length;
		formIsPublished = false;
		autoSlug = true;
	}

	function startCreate() {
		resetForm();
		formOrder = docs.length;
		showForm = true;
	}

	function startEdit(doc: Documentation) {
		editingId = doc.id;
		formTitle = doc.title;
		formSlug = doc.slug;
		formSummary = doc.summary;
		formContent = doc.content;
		formOrder = doc.order;
		formIsPublished = doc.isPublished;
		autoSlug = false;
		showForm = true;
	}

	async function saveDoc() {
		if (!formTitle.trim() || !formSlug.trim()) {
			toast.error('Title and slug are required');
			return;
		}

		isSaving = true;
		try {
			const data = {
				title: formTitle.trim(),
				slug: formSlug.trim(),
				summary: formSummary.trim(),
				content: formContent,
				order: formOrder,
				isPublished: formIsPublished
			};

			if (editingId) {
				await pb.collection('documentation').update(editingId, data);
				await logAudit(
					'doc_updated',
					'documentation',
					editingId,
					authStore.user?.email || '',
					{ title: data.title }
				);
				toast.success('Page updated');
			} else {
				const record = await pb.collection('documentation').create(data);
				await logAudit(
					'doc_created',
					'documentation',
					record.id,
					authStore.user?.email || '',
					{ title: data.title }
				);
				toast.success('Page created');
			}

			resetForm();
			await loadDocs();
		} catch (e: any) {
			toast.error(e?.message || 'Failed to save page');
		} finally {
			isSaving = false;
		}
	}

	async function deleteDoc(doc: Documentation) {
		try {
			await pb.collection('documentation').delete(doc.id);
			await logAudit(
				'doc_deleted',
				'documentation',
				doc.id,
				authStore.user?.email || '',
				{ title: doc.title }
			);
			toast.success('Page deleted');
			deletingId = null;
			await loadDocs();
		} catch {
			toast.error('Failed to delete page');
		}
	}

	async function updateOrder(doc: Documentation, newOrder: number) {
		try {
			await pb.collection('documentation').update(doc.id, { order: newOrder });
			await loadDocs();
		} catch {
			toast.error('Failed to update order');
		}
	}

	async function togglePublished(doc: Documentation) {
		try {
			await pb.collection('documentation').update(doc.id, { isPublished: !doc.isPublished });
			await logAudit(
				'doc_updated',
				'documentation',
				doc.id,
				authStore.user?.email || '',
				{ title: doc.title, isPublished: !doc.isPublished }
			);
			toast.success(doc.isPublished ? 'Unpublished' : 'Published');
			await loadDocs();
		} catch {
			toast.error('Failed to update status');
		}
	}
</script>

<div>
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold">Documentation Pages</h1>
		<button class="btn btn-primary btn-sm" onclick={startCreate}>
			+ New Page
		</button>
	</div>

	{#if showForm}
		<div class="mb-8 rounded-box border border-base-300 bg-base-200 p-6">
			<h2 class="mb-4 text-lg font-semibold">
				{editingId ? 'Edit Page' : 'Create Page'}
			</h2>

			<div class="grid gap-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="form-control">
						<label class="label" for="doc-title">
							<span class="label-text">Title</span>
						</label>
						<input
							id="doc-title"
							type="text"
							class="input input-bordered"
							bind:value={formTitle}
							oninput={handleTitleInput}
							placeholder="Page title"
						/>
					</div>
					<div class="form-control">
						<label class="label" for="doc-slug">
							<span class="label-text">Slug</span>
						</label>
						<input
							id="doc-slug"
							type="text"
							class="input input-bordered"
							bind:value={formSlug}
							oninput={() => (autoSlug = false)}
							placeholder="url-friendly-slug"
						/>
					</div>
				</div>

				<div class="form-control">
					<label class="label" for="doc-summary">
						<span class="label-text">Summary</span>
					</label>
					<textarea
						id="doc-summary"
						class="textarea textarea-bordered"
						bind:value={formSummary}
						placeholder="Short description for the overview page"
						rows="2"
					></textarea>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="form-control">
						<label class="label" for="doc-order">
							<span class="label-text">Order</span>
						</label>
						<input
							id="doc-order"
							type="number"
							class="input input-bordered w-24"
							bind:value={formOrder}
							min="0"
						/>
					</div>
					<div class="form-control">
						<label class="label cursor-pointer justify-start gap-3" for="doc-published">
							<input
								id="doc-published"
								type="checkbox"
								class="toggle toggle-primary"
								bind:checked={formIsPublished}
							/>
							<span class="label-text">Published</span>
						</label>
					</div>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Content</span>
					</label>
					<RichTextEditor
						content={formContent}
						placeholder="Write your documentation page content..."
						onchange={(html) => (formContent = html)}
					/>
				</div>

				<div class="flex gap-2">
					<button class="btn btn-primary btn-sm" onclick={saveDoc} disabled={isSaving}>
						{#if isSaving}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						{editingId ? 'Update' : 'Create'}
					</button>
					<button class="btn btn-ghost btn-sm" onclick={resetForm}>Cancel</button>
				</div>
			</div>
		</div>
	{/if}

	{#if isLoading}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if docs.length === 0}
		<p class="py-12 text-center text-base-content/60">No documentation pages yet.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Order</th>
						<th>Title</th>
						<th>Slug</th>
						<th>Status</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each docs as doc (doc.id)}
						<tr>
							<td>
								<input
									type="number"
									class="input input-bordered input-xs w-16"
									value={doc.order}
									onchange={(e) => updateOrder(doc, parseInt(e.currentTarget.value) || 0)}
									min="0"
								/>
							</td>
							<td class="font-medium">{doc.title}</td>
							<td class="font-mono text-sm text-base-content/60">{doc.slug}</td>
							<td>
								<button
									class="badge cursor-pointer"
									class:badge-success={doc.isPublished}
									class:badge-ghost={!doc.isPublished}
									onclick={() => togglePublished(doc)}
								>
									{doc.isPublished ? 'Published' : 'Draft'}
								</button>
							</td>
							<td>
								<div class="flex gap-1">
									<button class="btn btn-ghost btn-xs" onclick={() => startEdit(doc)}>
										Edit
									</button>
									{#if deletingId === doc.id}
										<button class="btn btn-error btn-xs" onclick={() => deleteDoc(doc)}>
											Confirm
										</button>
										<button class="btn btn-ghost btn-xs" onclick={() => (deletingId = null)}>
											Cancel
										</button>
									{:else}
										<button class="btn btn-ghost btn-xs text-error" onclick={() => (deletingId = doc.id)}>
											Delete
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
