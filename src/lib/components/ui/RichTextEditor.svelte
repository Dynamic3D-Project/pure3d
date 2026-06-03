<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Image from '@tiptap/extension-image';
	import { Table } from '@tiptap/extension-table';
	import TableRow from '@tiptap/extension-table-row';
	import TableCell from '@tiptap/extension-table-cell';
	import TableHeader from '@tiptap/extension-table-header';
	import Underline from '@tiptap/extension-underline';
	import Placeholder from '@tiptap/extension-placeholder';

	interface Props {
		content?: string;
		placeholder?: string;
		minHeight?: string;
		onchange?: (html: string) => void;
	}

	let {
		content = '',
		placeholder = 'Start writing...',
		minHeight = '200px',
		onchange
	}: Props = $props();

	let element: HTMLDivElement;
	let editor: Editor | null = $state(null);

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
				editor = editor;
			},
			onUpdate: ({ editor: e }) => {
				onchange?.(e.getHTML());
			}
		});
	});

	// Update editor content when the content prop changes externally
	$effect(() => {
		if (editor && content !== editor.getHTML()) {
			editor.commands.setContent(content, { emitUpdate: false });
		}
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
	<div class="flex flex-wrap items-center border-b border-base-300 bg-base-200 px-1 py-1">
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			class:btn-active={editor?.isActive('bold')}
			onclick={() => editor?.chain().focus().toggleBold().run()}
			title="Bold"
		>
			<strong>B</strong>
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			class:btn-active={editor?.isActive('italic')}
			onclick={() => editor?.chain().focus().toggleItalic().run()}
			title="Italic"
		>
			<em>I</em>
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			class:btn-active={editor?.isActive('underline')}
			onclick={() => editor?.chain().focus().toggleUnderline().run()}
			title="Underline"
		>
			<u>U</u>
		</button>

		<div class="mx-1 h-5 w-px bg-base-300"></div>

		<button
			type="button"
			class="btn btn-ghost btn-xs"
			class:btn-active={editor?.isActive('heading', { level: 1 })}
			onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
			title="Heading 1"
		>
			H1
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			class:btn-active={editor?.isActive('heading', { level: 2 })}
			onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
			title="Heading 2"
		>
			H2
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			class:btn-active={editor?.isActive('heading', { level: 3 })}
			onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
			title="Heading 3"
		>
			H3
		</button>

		<div class="mx-1 h-5 w-px bg-base-300"></div>

		<button
			type="button"
			class="btn btn-ghost btn-xs"
			class:btn-active={editor?.isActive('bulletList')}
			onclick={() => editor?.chain().focus().toggleBulletList().run()}
			title="Bullet List"
		>
			&bull; List
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			class:btn-active={editor?.isActive('orderedList')}
			onclick={() => editor?.chain().focus().toggleOrderedList().run()}
			title="Ordered List"
		>
			1. List
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			class:btn-active={editor?.isActive('blockquote')}
			onclick={() => editor?.chain().focus().toggleBlockquote().run()}
			title="Blockquote"
		>
			&ldquo; Quote
		</button>

		<div class="mx-1 h-5 w-px bg-base-300"></div>

		<button
			type="button"
			class="btn btn-ghost btn-xs"
			class:btn-active={editor?.isActive('link')}
			onclick={setLink}
			title="Link"
		>
			Link
		</button>
		<button type="button" class="btn btn-ghost btn-xs" onclick={addImage} title="Image">
			Image
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			onclick={() =>
				editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
			title="Table"
		>
			Table
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			onclick={() => editor?.chain().focus().setHorizontalRule().run()}
			title="Horizontal Rule"
		>
			&mdash;
		</button>
	</div>

	<!-- Editor content -->
	<div
		bind:this={element}
		class="editor-wrapper prose prose-sm max-w-none p-4 focus-within:outline-none"
		style:--editor-min-h={minHeight}
	></div>
</div>

<style>
	.editor-wrapper :global(.tiptap) {
		min-height: var(--editor-min-h, 200px);
		outline: none;
	}
</style>
