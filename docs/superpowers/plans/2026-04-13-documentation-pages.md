# Documentation Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a database-backed `/documentation` section with admin CRUD (rich text editor) and public browsing with sidebar navigation.

**Architecture:** PocketBase `documentation` collection stores pages with title, slug, content (HTML), summary, order, and isPublished. Admin page provides full CRUD with a Tiptap rich text editor. Public routes render pages with a sidebar layout. Navigation updated in both main menu and admin sidebar.

**Tech Stack:** SvelteKit (Svelte 5 runes), PocketBase, Tiptap (rich text), DaisyUI, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-07-documentation-pages-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/types/documentation.ts` | Documentation interface |
| Create | `src/lib/components/ui/RichTextEditor.svelte` | Reusable Tiptap editor component |
| Create | `src/routes/documentation/+layout.svelte` | Sidebar + content layout for public docs |
| Create | `src/routes/documentation/+layout.ts` | Load all published docs for sidebar |
| Create | `src/routes/documentation/+page.svelte` | Overview/landing page with card grid |
| Create | `src/routes/documentation/[slug]/+page.svelte` | Individual doc page renderer |
| Create | `src/routes/documentation/[slug]/+page.ts` | Load single doc by slug |
| Create | `src/routes/admin/documentation/+page.svelte` | Admin CRUD page |
| Modify | `src/lib/database/client.ts` | Add Documentation interface export |
| Modify | `src/lib/models/menu-itmes.ts` | Add Documentation menu item |
| Modify | `src/routes/admin/+layout.svelte` | Add Documentation to admin nav |
| Modify | `src/lib/utils/audit.ts` | Add doc-related audit actions |

---

### Task 1: Install Tiptap Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Tiptap packages**

Run:
```bash
npm install @tiptap/core @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-underline @tiptap/extension-placeholder
```

Expected: packages added to `package.json` dependencies, `node_modules` updated.

- [ ] **Step 2: Verify installation**

Run:
```bash
npm ls @tiptap/core
```

Expected: Shows `@tiptap/core` in the dependency tree without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add Tiptap rich text editor dependencies"
```

---

### Task 2: Add Documentation Type and Audit Actions

**Files:**
- Create: `src/lib/types/documentation.ts`
- Modify: `src/lib/database/client.ts`
- Modify: `src/lib/utils/audit.ts`

- [ ] **Step 1: Create the Documentation type**

Create `src/lib/types/documentation.ts`:

```typescript
export interface Documentation {
	id: string;
	title: string;
	slug: string;
	content: string;
	summary: string;
	order: number;
	isPublished: boolean;
	created: string;
	updated: string;
}
```

- [ ] **Step 2: Add audit actions for documentation**

In `src/lib/utils/audit.ts`, add `'doc_created' | 'doc_updated' | 'doc_deleted'` to the `AuditAction` type union, and add `'documentation'` to the `AuditTargetType` type union.

Current `AuditAction` type ends with `| 'collaborator_removed'`. Update to:

```typescript
export type AuditAction =
	| 'role_change'
	| 'status_transition'
	| 'user_assigned'
	| 'user_removed'
	| 'user_created'
	| 'user_updated'
	| 'user_deleted'
	| 'review_submitted'
	| 'reviewer_assigned'
	| 'reviewer_removed'
	| 'feedback_created'
	| 'feedback_resolved'
	| 'collaborator_added'
	| 'collaborator_removed'
	| 'doc_created'
	| 'doc_updated'
	| 'doc_deleted';

export type AuditTargetType = 'user' | 'collection' | 'edition' | 'documentation';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20
```

Expected: No new errors related to the types we added.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/documentation.ts src/lib/utils/audit.ts
git commit -m "feat: add Documentation type and audit actions"
```

---

### Task 3: Build the RichTextEditor Component

**Files:**
- Create: `src/lib/components/ui/RichTextEditor.svelte`

- [ ] **Step 1: Create the Tiptap editor component**

Create `src/lib/components/ui/RichTextEditor.svelte`:

```svelte
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Image from '@tiptap/extension-image';
	import Table from '@tiptap/extension-table';
	import TableRow from '@tiptap/extension-table-row';
	import TableCell from '@tiptap/extension-table-cell';
	import TableHeader from '@tiptap/extension-table-header';
	import Underline from '@tiptap/extension-underline';
	import Placeholder from '@tiptap/extension-placeholder';

	interface Props {
		content?: string;
		placeholder?: string;
		onchange?: (html: string) => void;
	}

	let { content = '', placeholder = 'Start writing...', onchange }: Props = $props();

	let element: HTMLDivElement;
	let editor: Editor | null = null;

	onMount(() => {
		editor = new Editor({
			element,
			extensions: [
				StarterKit,
				Underline,
				Link.configure({ openOnClick: false }),
				Image,
				Table.configure({ resizable: true }),
				TableRow,
				TableCell,
				TableHeader,
				Placeholder.configure({ placeholder })
			],
			content,
			onTransaction: () => {
				// Force Svelte reactivity
				editor = editor;
			},
			onUpdate: ({ editor: e }) => {
				onchange?.(e.getHTML());
			}
		});
	});

	onDestroy(() => {
		editor?.destroy();
	});

	function setLink() {
		if (!editor) return;
		const previousUrl = editor.getAttributes('link').href;
		const url = window.prompt('URL', previousUrl);
		if (url === null) return;
		if (url === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	}

	function addImage() {
		if (!editor) return;
		const url = window.prompt('Image URL');
		if (url) {
			editor.chain().focus().setImage({ src: url }).run();
		}
	}
</script>

<div class="rounded-box border border-base-300 bg-base-100">
	<!-- Toolbar -->
	<div class="flex flex-wrap gap-1 border-b border-base-300 p-2">
		<button type="button" class="btn btn-ghost btn-xs" class:btn-active={editor?.isActive('bold')}
			onclick={() => editor?.chain().focus().toggleBold().run()} title="Bold">
			<strong>B</strong>
		</button>
		<button type="button" class="btn btn-ghost btn-xs" class:btn-active={editor?.isActive('italic')}
			onclick={() => editor?.chain().focus().toggleItalic().run()} title="Italic">
			<em>I</em>
		</button>
		<button type="button" class="btn btn-ghost btn-xs" class:btn-active={editor?.isActive('underline')}
			onclick={() => editor?.chain().focus().toggleUnderline().run()} title="Underline">
			<u>U</u>
		</button>

		<div class="divider divider-horizontal mx-0.5"></div>

		<button type="button" class="btn btn-ghost btn-xs" class:btn-active={editor?.isActive('heading', { level: 1 })}
			onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
			H1
		</button>
		<button type="button" class="btn btn-ghost btn-xs" class:btn-active={editor?.isActive('heading', { level: 2 })}
			onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
			H2
		</button>
		<button type="button" class="btn btn-ghost btn-xs" class:btn-active={editor?.isActive('heading', { level: 3 })}
			onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
			H3
		</button>

		<div class="divider divider-horizontal mx-0.5"></div>

		<button type="button" class="btn btn-ghost btn-xs" class:btn-active={editor?.isActive('bulletList')}
			onclick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet List">
			&bull; List
		</button>
		<button type="button" class="btn btn-ghost btn-xs" class:btn-active={editor?.isActive('orderedList')}
			onclick={() => editor?.chain().focus().toggleOrderedList().run()} title="Ordered List">
			1. List
		</button>
		<button type="button" class="btn btn-ghost btn-xs" class:btn-active={editor?.isActive('blockquote')}
			onclick={() => editor?.chain().focus().toggleBlockquote().run()} title="Blockquote">
			&ldquo; Quote
		</button>

		<div class="divider divider-horizontal mx-0.5"></div>

		<button type="button" class="btn btn-ghost btn-xs" class:btn-active={editor?.isActive('link')}
			onclick={setLink} title="Link">
			Link
		</button>
		<button type="button" class="btn btn-ghost btn-xs" onclick={addImage} title="Image">
			Image
		</button>
		<button type="button" class="btn btn-ghost btn-xs"
			onclick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Table">
			Table
		</button>
		<button type="button" class="btn btn-ghost btn-xs"
			onclick={() => editor?.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
			&mdash;
		</button>
	</div>

	<!-- Editor content -->
	<div bind:this={element} class="prose prose-sm max-w-none p-4 focus-within:outline-none [&_.tiptap]:min-h-[200px] [&_.tiptap]:outline-none"></div>
</div>
```

- [ ] **Step 2: Verify the component compiles**

Run:
```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20
```

Expected: No errors related to `RichTextEditor.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ui/RichTextEditor.svelte
git commit -m "feat: add reusable Tiptap rich text editor component"
```

---

### Task 4: Update Navigation Menus

**Files:**
- Modify: `src/lib/models/menu-itmes.ts`
- Modify: `src/routes/admin/+layout.svelte`

- [ ] **Step 1: Add Documentation to public menu**

In `src/lib/models/menu-itmes.ts`, add the Documentation entry before About:

```typescript
export default [
	{ title: 'Collections', path: '/collections', displayTitle: 'Collections' },
	{ title: 'Editions', path: '/editions', displayTitle: 'Editions' },
	{ title: 'Documentation', path: '/documentation', displayTitle: 'Documentation' },
	{ title: 'About', path: '/about', displayTitle: 'About' }
];
```

- [ ] **Step 2: Add Documentation to admin sidebar**

In `src/routes/admin/+layout.svelte`, add a Documentation nav item to the `navItems` array. Insert it after the Workflow item (before Audit Log):

```typescript
{
	label: 'Documentation',
	href: `${base}/admin/documentation`,
	icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
},
```

- [ ] **Step 3: Verify the app builds**

Run:
```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/models/menu-itmes.ts src/routes/admin/+layout.svelte
git commit -m "feat: add Documentation to public and admin navigation"
```

---

### Task 5: Build Public Documentation Routes

**Files:**
- Create: `src/routes/documentation/+layout.ts`
- Create: `src/routes/documentation/+layout.svelte`
- Create: `src/routes/documentation/+page.svelte`
- Create: `src/routes/documentation/[slug]/+page.ts`
- Create: `src/routes/documentation/[slug]/+page.svelte`

- [ ] **Step 1: Create the layout data loader**

Create `src/routes/documentation/+layout.ts`:

```typescript
import { pb } from '$lib/database/client';
import type { LayoutLoad } from './$types';
import type { Documentation } from '$lib/types/documentation';

export const ssr = false;

export const load: LayoutLoad = async () => {
	try {
		const result = await pb.collection('documentation').getList(1, 100, {
			filter: 'isPublished = true',
			sort: 'order',
			fields: 'id,title,slug,summary,order'
		});

		const pages: Pick<Documentation, 'id' | 'title' | 'slug' | 'summary' | 'order'>[] =
			result.items.map((r) => ({
				id: r.id,
				title: r.title,
				slug: r.slug,
				summary: r.summary || '',
				order: r.order
			}));

		return { pages };
	} catch {
		return { pages: [] };
	}
};
```

- [ ] **Step 2: Create the shared layout with sidebar**

Create `src/routes/documentation/+layout.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	let pages = $derived(data.pages);
	let currentSlug = $derived($page.params.slug || '');
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<div class="flex flex-col gap-8 lg:flex-row">
		<!-- Sidebar -->
		<nav class="shrink-0 lg:w-64">
			<!-- Mobile: horizontal scrollable tabs -->
			<div class="flex gap-2 overflow-x-auto pb-2 lg:hidden">
				<a
					href="{base}/documentation"
					class="btn btn-sm whitespace-nowrap"
					class:btn-active={!currentSlug}
				>
					Overview
				</a>
				{#each pages as p (p.id)}
					<a
						href="{base}/documentation/{p.slug}"
						class="btn btn-sm whitespace-nowrap"
						class:btn-active={currentSlug === p.slug}
					>
						{p.title}
					</a>
				{/each}
			</div>

			<!-- Desktop: vertical sidebar -->
			<div class="hidden lg:block">
				<h2 class="mb-4 text-lg font-bold">Documentation</h2>
				<ul class="menu w-full gap-1 rounded-box bg-base-200 p-2">
					<li>
						<a
							href="{base}/documentation"
							class:bg-base-300={!currentSlug}
							class:font-semibold={!currentSlug}
						>
							Overview
						</a>
					</li>
					{#each pages as p (p.id)}
						<li>
							<a
								href="{base}/documentation/{p.slug}"
								class:bg-base-300={currentSlug === p.slug}
								class:font-semibold={currentSlug === p.slug}
							>
								{p.title}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</nav>

		<!-- Content -->
		<main class="min-w-0 flex-1">
			{@render children?.()}
		</main>
	</div>
</div>
```

- [ ] **Step 3: Create the overview/landing page**

Create `src/routes/documentation/+page.svelte`:

```svelte
<script lang="ts">
	import { base } from '$app/paths';
	import type { LayoutData } from './$types';

	let { data }: { data: LayoutData } = $props();

	let pages = $derived(data.pages);
</script>

<svelte:head>
	<title>Documentation | Pure 3D</title>
	<meta name="description" content="Documentation and guides for Pure 3D" />
</svelte:head>

<div>
	<h1 class="mb-6 text-3xl font-bold">Documentation</h1>
	<p class="mb-8 text-base-content/70">
		Guides, tutorials, and resources for authors, reviewers, and users of Pure 3D.
	</p>

	{#if pages.length === 0}
		<p class="text-base-content/60">No documentation pages available yet.</p>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each pages as p (p.id)}
				<a
					href="{base}/documentation/{p.slug}"
					class="card bg-base-200 shadow-sm transition-shadow hover:shadow-md"
				>
					<div class="card-body">
						<h2 class="card-title text-lg">{p.title}</h2>
						{#if p.summary}
							<p class="text-sm text-base-content/70">{p.summary}</p>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
```

- [ ] **Step 4: Create the single page data loader**

Create `src/routes/documentation/[slug]/+page.ts`:

```typescript
import { pb } from '$lib/database/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { Documentation } from '$lib/types/documentation';

export const load: PageLoad = async ({ params }) => {
	try {
		const result = await pb.collection('documentation').getList(1, 1, {
			filter: `slug = "${params.slug}" && isPublished = true`
		});

		if (result.items.length === 0) {
			throw error(404, 'Page not found');
		}

		const record = result.items[0];
		const doc: Documentation = {
			id: record.id,
			title: record.title,
			slug: record.slug,
			content: record.content,
			summary: record.summary || '',
			order: record.order,
			isPublished: record.isPublished,
			created: record.created,
			updated: record.updated
		};

		return { doc };
	} catch (e: any) {
		if (e?.status === 404) throw e;
		throw error(404, 'Page not found');
	}
};
```

- [ ] **Step 5: Create the single page renderer**

Create `src/routes/documentation/[slug]/+page.svelte`:

```svelte
<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let doc = $derived(data.doc);
</script>

<svelte:head>
	<title>{doc.title} | Documentation | Pure 3D</title>
	<meta name="description" content={doc.summary} />
</svelte:head>

<article class="prose prose-lg max-w-none">
	<h1>{doc.title}</h1>
	{@html doc.content}
</article>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run:
```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -30
```

Expected: No errors in the documentation routes.

- [ ] **Step 7: Commit**

```bash
git add src/routes/documentation/
git commit -m "feat: add public documentation routes with sidebar layout"
```

---

### Task 6: Build Admin Documentation Page

**Files:**
- Create: `src/routes/admin/documentation/+page.svelte`

- [ ] **Step 1: Create the admin CRUD page**

Create `src/routes/admin/documentation/+page.svelte`:

```svelte
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

	// Form state
	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let formTitle = $state('');
	let formSlug = $state('');
	let formSummary = $state('');
	let formContent = $state('');
	let formOrder = $state(0);
	let formIsPublished = $state(false);
	let isSaving = $state(false);

	// Delete confirmation
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

	<!-- Form (create/edit) -->
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
						<label class="label cursor-pointer justify-start gap-3">
							<input
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

	<!-- Table -->
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -30
```

Expected: No errors in the admin documentation page.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/documentation/
git commit -m "feat: add admin documentation CRUD page with rich text editor"
```

---

### Task 7: Create PocketBase Collection and Verify End-to-End

**Files:** None (PocketBase admin UI configuration)

- [ ] **Step 1: Create the `documentation` collection in PocketBase**

Open the PocketBase admin UI and create a new collection named `documentation` with these fields:

| Field         | Type    | Options                          |
|---------------|---------|----------------------------------|
| `title`       | Text    | Required                         |
| `slug`        | Text    | Required, Unique                 |
| `content`     | Text    | (no constraints)                 |
| `summary`     | Text    | (no constraints)                 |
| `order`       | Number  | Default: 0                       |
| `isPublished` | Boolean | Default: false                   |

Set API rules:
- **List/View:** Leave empty (public access) — or use `isPublished = true` filter rule for list/view
- **Create/Update/Delete:** `@request.auth.id != ""` (authenticated users only; admin-level enforcement happens in the app layer)

- [ ] **Step 2: Start the dev server and test**

Run:
```bash
npm run dev
```

Open the browser and verify:
1. `/admin/documentation` — page loads, shows empty state, "New Page" button visible
2. Create a test page with title, slug, content, mark as published
3. `/documentation` — overview page loads, shows the card for the test page
4. `/documentation/<slug>` — individual page renders HTML content
5. Sidebar navigation highlights current page
6. Mobile: sidebar collapses to horizontal tabs

- [ ] **Step 3: Test admin operations**

Verify:
1. Edit a page — form pre-populates, save updates the record
2. Toggle published/draft — badge updates, unpublished page disappears from public routes
3. Change order — reorder reflected in sidebar
4. Delete — confirmation inline, page removed
5. Rich text editor — bold, italic, headings, lists, links, tables all produce correct HTML

- [ ] **Step 4: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: address issues found during documentation pages testing"
```

(Skip this step if no fixes were needed.)

---

### Task 8: Seed Initial Documentation Content

**Files:** None (data entry through admin UI or PocketBase API)

- [ ] **Step 1: Create the seed documentation pages**

Using the admin UI at `/admin/documentation`, create the following pages with `isPublished: true`:

| Slug             | Title                                  | Order | Summary |
|------------------|----------------------------------------|-------|---------|
| `submission`     | Submission Guidelines                  | 1     | How to submit a 3D scholarly edition to Pure 3D |
| `evaluation`     | Evaluation and Publication Process     | 2     | Overview of the editorial review and publication workflow |
| `review`         | Evaluation Guidelines for Reviewers    | 3     | Guidelines and criteria for peer reviewers |
| `platform-guide` | Voyager Explorer Guide                | 4     | How to use the Voyager 3D viewer and authoring tools |
| `tutorials`      | Tutorials                             | 5     | Step-by-step tutorials for creating 3D editions |
| `faq`            | FAQ & Troubleshooting                 | 6     | Frequently asked questions and common issues |
| `examples`       | Example Editions                      | 7     | Example editions showcasing best practices |

Content for each page should be sourced from the editorial instructions text referenced in the spec. Use placeholder content initially if the source text is not available, then replace when it is.

- [ ] **Step 2: Verify all pages appear on the public site**

Visit `/documentation` and confirm all 7 pages appear as cards. Click through each page and verify the sidebar navigation works correctly.

---

### Task 9: Add Contextual Links from Existing UI

**Files:**
- Potentially modify: `src/routes/+page.svelte` (homepage)
- Potentially modify: `src/routes/about/+page.svelte` or related about page files

This task depends on what content exists in the homepage and about page. The spec calls for:

1. **Homepage "Publish with us" CTA** — link to `/documentation/submission`
2. **About page "Publish a 3D Scholarly Edition" section** — update link to `/documentation/submission`
3. **Edition creation/editing flow** — link to `/documentation/submission` (submission guidelines)
4. **Review dashboard** — link to `/documentation/review` (reviewer guidelines)

- [ ] **Step 1: Search for existing link targets**

Run:
```bash
grep -rn "Publish with us\|Publish a 3D\|submission.*guide\|reviewer.*guide" src/routes/ --include="*.svelte"
```

Examine the output to find where these references exist and add `/documentation/<slug>` links as appropriate.

- [ ] **Step 2: Add contextual links where found**

For each location found, add an `<a href="/documentation/submission">` or `<a href="/documentation/review">` link as appropriate. Follow the existing link styling patterns in each file.

- [ ] **Step 3: Verify links work**

Start the dev server and click each contextual link to confirm it navigates to the correct documentation page.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add contextual links to documentation from homepage and workflows"
```
