<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { logAudit } from '$lib/utils/audit';
	import type { Documentation } from '$lib/types/documentation';
	import FloatingSelect from '$lib/components/ui/FloatingSelect.svelte';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import toast from 'svelte-french-toast';

	let docs = $state<Documentation[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state('');
	let filteredDocs = $derived(
		docs.filter((doc) => {
			const query = searchQuery.toLowerCase();
			const matchesSearch =
				!query ||
				doc.title.toLowerCase().includes(query) ||
				doc.slug.toLowerCase().includes(query) ||
				doc.summary.toLowerCase().includes(query);
			const matchesStatus =
				!statusFilter ||
				(statusFilter === 'published' && doc.isPublished) ||
				(statusFilter === 'draft' && !doc.isPublished);

			return matchesSearch && matchesStatus;
		})
	);
	let hasActiveFilters = $derived(Boolean(searchQuery || statusFilter));
	const statusFilterOptions = [
		{ value: '', label: 'All statuses' },
		{ value: 'published', label: 'Published' },
		{ value: 'draft', label: 'Draft' }
	];

	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let formTitle = $state('');
	let formSlug = $state('');
	let formSummary = $state('');
	let formContent = $state('');
	let formOrder = $state(0);
	let formIsPublished = $state(false);
	let isSaving = $state(false);
	let isReordering = $state(false);
	let draggedDocId = $state<string | null>(null);
	let dragOverDocId = $state<string | null>(null);

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
		formOrder = docs.length + 1;
		formIsPublished = false;
		autoSlug = true;
	}

	function startCreate() {
		resetForm();
		formOrder = docs.length + 1;
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

	function handleDragStart(event: DragEvent, doc: Documentation) {
		draggedDocId = doc.id;
		event.dataTransfer?.setData('text/plain', doc.id);
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(event: DragEvent, doc: Documentation) {
		if (!draggedDocId || draggedDocId === doc.id) return;
		event.preventDefault();
		dragOverDocId = doc.id;
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function clearDragState() {
		draggedDocId = null;
		dragOverDocId = null;
	}

	async function handleDrop(event: DragEvent, targetDoc: Documentation) {
		event.preventDefault();
		const sourceId = draggedDocId || event.dataTransfer?.getData('text/plain');
		clearDragState();

		if (!sourceId || sourceId === targetDoc.id) return;
		await reorderDocs(sourceId, targetDoc.id);
	}

	async function reorderDocs(sourceId: string, targetId: string) {
		const sourceIndex = docs.findIndex((doc) => doc.id === sourceId);
		const targetIndex = docs.findIndex((doc) => doc.id === targetId);

		if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

		const previousDocs = docs;
		const previousOrders = new Map(previousDocs.map((doc) => [doc.id, doc.order]));
		const nextDocs = [...docs];
		const [movedDoc] = nextDocs.splice(sourceIndex, 1);
		nextDocs.splice(targetIndex, 0, movedDoc);
		const orderedDocs = nextDocs.map((doc, index) => ({ ...doc, order: index + 1 }));

		docs = orderedDocs;
		isReordering = true;

		try {
			await Promise.all(
				orderedDocs
					.filter((doc) => previousOrders.get(doc.id) !== doc.order)
					.map((doc) => pb.collection('documentation').update(doc.id, { order: doc.order }))
			);
			toast.success('Documentation order updated');
		} catch {
			docs = previousDocs;
			toast.error('Failed to update order');
			await loadDocs();
		} finally {
			isReordering = false;
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
					<span class="label">
						<span class="label-text">Content</span>
					</span>
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

	<div class="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div>
				<h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/70">Filters</h2>
				<p class="text-xs text-base-content/50">Find pages by title, slug, summary, or status.</p>
			</div>
			{#if hasActiveFilters}
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					onclick={() => {
						searchQuery = '';
						statusFilter = '';
					}}
				>
					Clear
				</button>
			{/if}
		</div>
		<div class="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_13rem]">
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Search</span></span>
				<input
					type="text"
					placeholder="Title, slug, or summary..."
					class="input input-bordered w-full bg-base-200/40"
					bind:value={searchQuery}
				/>
			</label>
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Status</span></span>
				<FloatingSelect
					id="documentation-status-filter"
					bind:value={statusFilter}
					options={statusFilterOptions}
					class="w-full bg-base-200/40"
				/>
			</label>
		</div>
	</div>

	{#if isLoading}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if docs.length === 0}
		<p class="py-12 text-center text-base-content/60">No documentation pages yet.</p>
	{:else if filteredDocs.length === 0}
		<p class="py-12 text-center text-base-content/60">No documentation pages match the selected filters.</p>
	{:else}
		<div class="mb-3 flex items-center gap-3 text-sm text-base-content/60">
			<span>Drag pages by the handle to reorder them.</span>
			{#if hasActiveFilters}
				<span>Showing {filteredDocs.length} of {docs.length} pages.</span>
			{/if}
			{#if isReordering}
				<span class="inline-flex items-center gap-2 text-base-content">
					<span class="loading loading-spinner loading-xs"></span>
					Saving order...
				</span>
			{/if}
		</div>
		<div class="overflow-x-auto rounded-box border border-base-300 bg-base-100">
			<table class="table">
				<thead>
					<tr>
						<th class="w-24">Reorder</th>
						<th>Title</th>
						<th>Slug</th>
						<th>Status</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredDocs as doc (doc.id)}
						<tr
							draggable={!isReordering}
							class={`transition-colors ${dragOverDocId === doc.id ? 'bg-primary/10' : ''}`}
							class:opacity-50={draggedDocId === doc.id}
							ondragstart={(event) => handleDragStart(event, doc)}
							ondragover={(event) => handleDragOver(event, doc)}
							ondragleave={() => (dragOverDocId = dragOverDocId === doc.id ? null : dragOverDocId)}
							ondrop={(event) => handleDrop(event, doc)}
							ondragend={clearDragState}
						>
							<td>
								<button
									type="button"
									class="btn btn-ghost btn-sm cursor-grab gap-2 active:cursor-grabbing"
									disabled={isReordering}
									aria-label={`Drag to reorder ${doc.title}`}
									title="Drag to reorder"
								>
									<span class="grid gap-0.5" aria-hidden="true">
										<span class="h-0.5 w-4 rounded-full bg-current opacity-70"></span>
										<span class="h-0.5 w-4 rounded-full bg-current opacity-70"></span>
										<span class="h-0.5 w-4 rounded-full bg-current opacity-70"></span>
									</span>
								</button>
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
