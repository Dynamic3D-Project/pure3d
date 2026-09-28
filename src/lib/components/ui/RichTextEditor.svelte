<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import { NodeSelection, TextSelection } from '@tiptap/pm/state';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Image from '@tiptap/extension-image';
	import { Table } from '@tiptap/extension-table';
	import TableRow from '@tiptap/extension-table-row';
	import TableCell from '@tiptap/extension-table-cell';
	import TableHeader from '@tiptap/extension-table-header';
	import Underline from '@tiptap/extension-underline';
	import Placeholder from '@tiptap/extension-placeholder';
	import { VideoEmbed, embedUrl } from '$lib/utils/editor-embed';
	import {
		CmsActions,
		CmsCallout,
		CmsColumn,
		CmsColumns,
		ContentImageFigure,
		CmsEditionGrid,
		CmsExpandable,
		CmsLogoGrid,
		CmsProfileCards,
		CmsProjectFacts,
		CmsSummary,
		calloutContent,
		columnsContent,
		contentImageFigure,
		expandableContent,
		logoGridContent,
		profileCardsContent,
		projectFactsContent
	} from '$lib/utils/editor-content-components';
	import {
		calloutStyles,
		isCmsColumnCount,
		maxEditionReferences,
		maxLogoItems,
		maxProfileCards,
		maxProfileLinks,
		maxProjectFacts,
		normaliseContentImage,
		normaliseLogoItems,
		normaliseProfileCards,
		normaliseProjectFacts,
		parseEditionIds,
		safeContentUrl,
		serialiseEditionIds,
		type CalloutStyle,
		type ContentImage,
		type LogoItem,
		type ProfileCard,
		type ProjectFact
	} from '$lib/utils/content-components';
	import ArrowDownIcon from '~icons/lucide/arrow-down';
	import ArrowUpIcon from '~icons/lucide/arrow-up';
	import BoldIcon from '~icons/lucide/bold';
	import ChevronDownIcon from '~icons/lucide/chevron-down';
	import ExternalLinkIcon from '~icons/lucide/external-link';
	import Heading1Icon from '~icons/lucide/heading-1';
	import Heading2Icon from '~icons/lucide/heading-2';
	import Heading3Icon from '~icons/lucide/heading-3';
	import ImageIcon from '~icons/lucide/image';
	import InfoIcon from '~icons/lucide/info';
	import ItalicIcon from '~icons/lucide/italic';
	import LayoutGridIcon from '~icons/lucide/layout-grid';
	import LinkIcon from '~icons/lucide/link';
	import ListIcon from '~icons/lucide/list';
	import ListOrderedIcon from '~icons/lucide/list-ordered';
	import PanelTopOpenIcon from '~icons/lucide/panel-top-open';
	import PencilIcon from '~icons/lucide/pencil';
	import PlusIcon from '~icons/lucide/plus';
	import QuoteIcon from '~icons/lucide/quote';
	import SeparatorHorizontalIcon from '~icons/lucide/separator-horizontal';
	import TableIcon from '~icons/lucide/table-2';
	import TrashIcon from '~icons/lucide/trash-2';
	import UnderlineIcon from '~icons/lucide/underline';
	import VideoIcon from '~icons/lucide/video';

	interface Props {
		content?: string;
		placeholder?: string;
		minHeight?: string;
		enableImagePaste?: boolean;
		uploadImage?: (file: File) => Promise<string>;
		onchange?: (html: string) => void;
		cmsComponents?: boolean;
		cmsEditions?: { id: string; title: string }[];
	}

	let {
		content = '',
		placeholder = 'Start writing...',
		minHeight = '200px',
		enableImagePaste = false,
		uploadImage,
		onchange,
		cmsComponents = false,
		cmsEditions = []
	}: Props = $props();

	let element: HTMLDivElement;
	let editor: Editor | null = $state(null);
	let isUploadingImage = $state(false);
	let editionPickerOpen = $state(false);
	let editionQuery = $state('');
	let editionIds = $state<string[]>([]);
	let editionLimitReached = $state(false);
	let insertMenu = $state<HTMLDetailsElement>();
	let insertMenuSummary = $state<HTMLElement>();
	type ComponentEditorKind = 'profiles' | 'logos' | 'facts' | 'image';
	let componentDialog = $state<HTMLDialogElement>();
	let componentEditorKind = $state<ComponentEditorKind>();
	let componentEditorError = $state('');
	let componentEditorTarget = $state<{ name: string; position: number }>();
	let draftProfiles = $state<ProfileCard[]>([]);
	let draftLogos = $state<LogoItem[]>([]);
	let draftFacts = $state<ProjectFact[]>([]);
	let draftImage = $state<ContentImage>({ src: '', alt: '', caption: '' });
	let matchingEditions = $derived(
		cmsEditions.filter(
			(edition) =>
				edition.title.toLowerCase().includes(editionQuery.toLowerCase()) &&
				!editionIds.includes(edition.id)
		)
	);

	onMount(() => {
		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({ link: false, underline: false }),
				Underline,
				Link.configure({ openOnClick: false }),
				Image,
				ContentImageFigure,
				VideoEmbed,
				Table.configure({ resizable: true }),
				TableRow,
				TableCell,
				TableHeader,
				Placeholder.configure({ placeholder }),
				...(cmsComponents
					? [
							CmsCallout,
							CmsActions,
							CmsColumn,
							CmsColumns,
							CmsEditionGrid.configure({
								editionTitle: (id: string) =>
									cmsEditions.find((edition) => edition.id === id)?.title || id
							}),
							CmsSummary,
							CmsExpandable,
							CmsProfileCards,
							CmsLogoGrid,
							CmsProjectFacts
						]
					: [])
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
			editor.commands.setContent(content, {});
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
		openComponentEditor('image');
	}
	function addVideo() {
		const value = window.prompt('YouTube, Vimeo or SoundCloud player URL');
		if (!value) return;
		const src = embedUrl(value);
		if (!src) {
			window.alert('Enter a valid HTTPS YouTube, Vimeo or SoundCloud player link.');
			return;
		}
		editor
			?.chain()
			.focus()
			.insertContent({ type: 'videoEmbed', attrs: { src, title: 'Embedded video' } })
			.run();
	}

	function setCallout(style: CalloutStyle) {
		if (!editor) return;
		if (editor.isActive('cmsCallout'))
			editor.chain().focus().updateAttributes('cmsCallout', { style }).run();
		else editor.chain().focus().insertContent(calloutContent(style)).run();
	}

	function closeInsertMenu() {
		insertMenu?.removeAttribute('open');
	}

	function handleInsertMenuKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !insertMenu?.open) return;
		event.preventDefault();
		event.stopPropagation();
		closeInsertMenu();
		insertMenuSummary?.focus();
	}

	function insertCallout() {
		setCallout('info');
		closeInsertMenu();
	}

	function activeNode(name: string) {
		if (!editor) return null;
		for (let depth = editor.state.selection.$from.depth; depth > 0; depth--) {
			if (editor.state.selection.$from.node(depth).type.name === name)
				return {
					node: editor.state.selection.$from.node(depth),
					position: editor.state.selection.$from.before(depth)
				};
		}
		return null;
	}

	function setColumns(value: number) {
		if (!editor || !isCmsColumnCount(value)) return;
		const active = activeNode('cmsColumns');
		if (!active) editor.chain().focus().insertContent(columnsContent(value)).run();
		else {
			const schema = editor.schema;
			const columnType = schema.nodes.cmsColumn;
			const columns = Array.from({ length: value }, (_, index) => {
				const content = Array.from(active.node.maybeChild(index)?.content.content || []);
				if (index === value - 1)
					for (let extra = value; extra < active.node.childCount; extra++)
						content.push(...active.node.child(extra).content.content);
				if (!content.length) content.push(schema.nodes.paragraph.create());
				return columnType.create(null, content);
			});
			const replacement = schema.nodes.cmsColumns.create({ count: value }, columns);
			editor.commands.command(({ tr, dispatch }) => {
				if (dispatch)
					dispatch(
						tr
							.replaceWith(active.position, active.position + active.node.nodeSize, replacement)
							.setSelection(TextSelection.near(tr.doc.resolve(active.position + 1)))
							.scrollIntoView()
					);
				return true;
			});
		}
		closeInsertMenu();
	}

	function selectedNode(name: string) {
		if (!editor || !(editor.state.selection instanceof NodeSelection)) return null;
		return editor.state.selection.node.type.name === name
			? { node: editor.state.selection.node, position: editor.state.selection.from }
			: null;
	}

	function openComponentEditor(kind: ComponentEditorKind) {
		if (!editor) return;
		const names = {
			profiles: 'cmsProfileCards',
			logos: 'cmsLogoGrid',
			facts: 'cmsProjectFacts',
			image: 'contentImageFigure'
		} as const;
		const selected = selectedNode(names[kind]);
		componentEditorTarget = selected
			? { name: names[kind], position: selected.position }
			: undefined;
		componentEditorError = '';
		if (kind === 'profiles') {
			const items = normaliseProfileCards(selected?.node.attrs.items || []);
			draftProfiles = items.length
				? items
				: [{ name: '', role: '', bio: '', image: '', alt: '', links: [] }];
		}
		if (kind === 'logos') {
			const items = normaliseLogoItems(selected?.node.attrs.items || []);
			draftLogos = items.length ? items : [{ name: '', image: '', alt: '', href: '' }];
		}
		if (kind === 'facts') {
			const items = normaliseProjectFacts(selected?.node.attrs.items || []);
			draftFacts = items.length ? items : [{ label: '', value: '' }];
		}
		if (kind === 'image') {
			const legacyImage = selectedNode('image');
			componentEditorTarget = legacyImage
				? { name: 'image', position: legacyImage.position }
				: componentEditorTarget;
			draftImage = normaliseContentImage(selected?.node.attrs || legacyImage?.node.attrs || {}) || {
				src: '',
				alt: '',
				caption: ''
			};
		}
		componentEditorKind = kind;
		componentDialog?.showModal();
		closeInsertMenu();
	}

	function closeComponentEditor() {
		componentDialog?.close();
	}

	function addComponentItem(kind: Exclude<ComponentEditorKind, 'image'>) {
		if (kind === 'profiles')
			draftProfiles = [
				...draftProfiles,
				{ name: '', role: '', bio: '', image: '', alt: '', links: [] }
			];
		if (kind === 'logos') draftLogos = [...draftLogos, { name: '', image: '', alt: '', href: '' }];
		if (kind === 'facts') draftFacts = [...draftFacts, { label: '', value: '' }];
	}

	function moveComponentItem(
		kind: Exclude<ComponentEditorKind, 'image'>,
		index: number,
		direction: -1 | 1
	) {
		const move = <T,>(items: T[]) => {
			const next = [...items];
			const target = index + direction;
			if (target < 0 || target >= next.length) return next;
			[next[index], next[target]] = [next[target], next[index]];
			return next;
		};
		if (kind === 'profiles') draftProfiles = move(draftProfiles);
		if (kind === 'logos') draftLogos = move(draftLogos);
		if (kind === 'facts') draftFacts = move(draftFacts);
	}

	function removeComponentItem(kind: Exclude<ComponentEditorKind, 'image'>, index: number) {
		if (kind === 'profiles')
			draftProfiles = draftProfiles.filter((_, itemIndex) => itemIndex !== index);
		if (kind === 'logos') draftLogos = draftLogos.filter((_, itemIndex) => itemIndex !== index);
		if (kind === 'facts') draftFacts = draftFacts.filter((_, itemIndex) => itemIndex !== index);
	}

	function addProfileLink(index: number) {
		draftProfiles = draftProfiles.map((profile, profileIndex) =>
			profileIndex === index && profile.links.length < maxProfileLinks
				? { ...profile, links: [...profile.links, { label: '', href: '' }] }
				: profile
		);
	}

	function moveProfileLink(profileIndex: number, linkIndex: number, direction: -1 | 1) {
		draftProfiles = draftProfiles.map((profile, index) => {
			if (index !== profileIndex) return profile;
			const target = linkIndex + direction;
			if (target < 0 || target >= profile.links.length) return profile;
			const links = [...profile.links];
			[links[linkIndex], links[target]] = [links[target], links[linkIndex]];
			return { ...profile, links };
		});
	}

	function removeProfileLink(profileIndex: number, linkIndex: number) {
		draftProfiles = draftProfiles.map((profile, index) =>
			index === profileIndex
				? { ...profile, links: profile.links.filter((_, itemIndex) => itemIndex !== linkIndex) }
				: profile
		);
	}

	function saveComponentEditor() {
		if (!editor || !componentEditorKind) return;
		const component = componentEditorKind;
		const normalised =
			component === 'profiles'
				? normaliseProfileCards(draftProfiles)
				: component === 'logos'
					? normaliseLogoItems(draftLogos)
					: component === 'facts'
						? normaliseProjectFacts(draftFacts)
						: normaliseContentImage(draftImage);
		const expected =
			component === 'profiles'
				? draftProfiles.length
				: component === 'logos'
					? draftLogos.length
					: component === 'facts'
						? draftFacts.length
						: 1;
		if (
			!normalised ||
			(Array.isArray(normalised) && (!normalised.length || normalised.length !== expected))
		) {
			componentEditorError = 'Complete all required fields with safe, valid URLs before saving.';
			return;
		}
		const content =
			component === 'profiles'
				? profileCardsContent(normalised as ProfileCard[])
				: component === 'logos'
					? logoGridContent(normalised as LogoItem[])
					: component === 'facts'
						? projectFactsContent(normalised as ProjectFact[])
						: contentImageFigure(normalised as ContentImage);
		editor.commands.command(({ state, tr, dispatch }) => {
			const target = componentEditorTarget;
			if (target && state.doc.nodeAt(target.position)?.type.name === target.name) {
				const node = state.doc.nodeAt(target.position)!;
				if (target.name === 'image')
					tr.replaceWith(
						target.position,
						target.position + node.nodeSize,
						state.schema.nodeFromJSON(content)
					);
				else
					tr.setNodeMarkup(target.position, undefined, { ...node.attrs, ...(content.attrs || {}) });
			} else tr.replaceSelectionWith(state.schema.nodeFromJSON(content));
			if (dispatch) dispatch(tr.scrollIntoView());
			return true;
		});
		closeComponentEditor();
	}

	function setActions() {
		if (!editor) return;
		const current = editor.isActive('cmsActions') ? editor.getAttributes('cmsActions') : {};
		const primaryLabel = window.prompt(
			'Primary action label',
			current.primaryLabel || 'Learn more'
		);
		if (!primaryLabel?.trim()) return;
		const primaryHref = safeContentUrl(
			window.prompt('Primary action destination', current.primaryHref || '') || ''
		);
		if (!primaryHref) return window.alert('Enter a safe local, HTTPS, HTTP or mailto destination.');
		const secondaryLabel =
			window.prompt('Secondary action label (optional)', current.secondaryLabel || '') || '';
		const secondaryHref = secondaryLabel
			? safeContentUrl(
					window.prompt('Secondary action destination', current.secondaryHref || '') || ''
				)
			: '';
		if (secondaryLabel && !secondaryHref)
			return window.alert('Enter a safe local, HTTPS, HTTP or mailto destination.');
		const attrs = { primaryLabel: primaryLabel.trim(), primaryHref, secondaryLabel, secondaryHref };
		if (editor.isActive('cmsActions'))
			editor.chain().focus().updateAttributes('cmsActions', attrs).run();
		else editor.chain().focus().insertContent({ type: 'cmsActions', attrs }).run();
	}

	function editEditionGrid() {
		if (!editor) return;
		editionIds = editor.isActive('cmsEditionGrid')
			? parseEditionIds(editor.getAttributes('cmsEditionGrid').ids || '')
			: [];
		editionQuery = '';
		editionLimitReached = false;
		editionPickerOpen = true;
		closeInsertMenu();
	}

	function addEdition(id: string) {
		if (editionIds.length >= maxEditionReferences) {
			editionLimitReached = true;
			return;
		}
		editionIds = [...editionIds, id];
	}

	function saveEditionGrid() {
		if (!editor || editionIds.length === 0) return;
		let attrs: { ids: string };
		try {
			attrs = { ids: serialiseEditionIds(editionIds) };
		} catch (error) {
			editionLimitReached = error instanceof Error;
			return;
		}
		if (editor.isActive('cmsEditionGrid'))
			editor.chain().focus().updateAttributes('cmsEditionGrid', attrs).run();
		else editor.chain().focus().insertContent({ type: 'cmsEditionGrid', attrs }).run();
		editionPickerOpen = false;
	}

	async function handlePaste(event: ClipboardEvent) {
		if (!enableImagePaste || !uploadImage || !editor) return;
		const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
			file.type.startsWith('image/')
		);
		if (files.length === 0) return;

		event.preventDefault();
		isUploadingImage = true;
		try {
			for (const file of files) {
				const url = await uploadImage(file);
				editor
					.chain()
					.focus()
					.setImage({ src: url, alt: file.name || 'Pasted image' })
					.run();
			}
		} finally {
			isUploadingImage = false;
		}
	}
</script>

<svelte:window onkeydown={handleInsertMenuKeydown} />

<div id="rich-text-editor" class="rounded-box border border-base-300 bg-base-100">
	<!-- Toolbar -->
	<div class="editor-toolbar" role="toolbar" aria-label="Text formatting">
		<div class="toolbar-group" role="group" aria-label="Text style">
			<button
				type="button"
				class="toolbar-button"
				class:is-active={editor?.isActive('bold')}
				aria-label="Bold"
				aria-pressed={editor?.isActive('bold') ?? false}
				title="Bold"
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleBold().run()}><BoldIcon /></button
			>
			<button
				type="button"
				class="toolbar-button"
				class:is-active={editor?.isActive('italic')}
				aria-label="Italic"
				aria-pressed={editor?.isActive('italic') ?? false}
				title="Italic"
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleItalic().run()}><ItalicIcon /></button
			>
			<button
				type="button"
				class="toolbar-button"
				class:is-active={editor?.isActive('underline')}
				aria-label="Underline"
				aria-pressed={editor?.isActive('underline') ?? false}
				title="Underline"
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon /></button
			>
		</div>
		<span class="toolbar-divider" aria-hidden="true"></span>
		<div class="toolbar-group" role="group" aria-label="Headings">
			{#each [1, 2, 3] as level (level)}
				<button
					type="button"
					class="toolbar-button"
					class:is-active={editor?.isActive('heading', { level })}
					aria-label={`Heading ${level}`}
					aria-pressed={editor?.isActive('heading', { level }) ?? false}
					title={`Heading ${level}`}
					disabled={!editor}
					onclick={() =>
						editor
							?.chain()
							.focus()
							.toggleHeading({ level: level as 1 | 2 | 3 })
							.run()}
				>
					{#if level === 1}<Heading1Icon />{:else if level === 2}<Heading2Icon
						/>{:else}<Heading3Icon />{/if}
				</button>
			{/each}
		</div>
		<span class="toolbar-divider" aria-hidden="true"></span>
		<div class="toolbar-group" role="group" aria-label="Lists and quote">
			<button
				type="button"
				class="toolbar-button"
				class:is-active={editor?.isActive('bulletList')}
				aria-label="Bulleted list"
				aria-pressed={editor?.isActive('bulletList') ?? false}
				title="Bulleted list"
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleBulletList().run()}><ListIcon /></button
			>
			<button
				type="button"
				class="toolbar-button"
				class:is-active={editor?.isActive('orderedList')}
				aria-label="Numbered list"
				aria-pressed={editor?.isActive('orderedList') ?? false}
				title="Numbered list"
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleOrderedList().run()}
				><ListOrderedIcon /></button
			>
			<button
				type="button"
				class="toolbar-button"
				class:is-active={editor?.isActive('blockquote')}
				aria-label="Block quote"
				aria-pressed={editor?.isActive('blockquote') ?? false}
				title="Block quote"
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleBlockquote().run()}><QuoteIcon /></button
			>
		</div>
		<span class="toolbar-divider" aria-hidden="true"></span>
		<div class="toolbar-group" role="group" aria-label="Insert content">
			<button
				type="button"
				class="toolbar-button"
				class:is-active={editor?.isActive('link')}
				aria-label="Add or edit link"
				aria-pressed={editor?.isActive('link') ?? false}
				title="Add or edit link"
				disabled={!editor}
				onclick={setLink}><LinkIcon /></button
			>
			<button
				type="button"
				class="toolbar-button"
				aria-label="Add image"
				title="Add image"
				disabled={!editor}
				onclick={addImage}><ImageIcon /></button
			>
			<button
				type="button"
				class="toolbar-button"
				aria-label="Embed video"
				title="Embed video"
				disabled={!editor}
				onclick={addVideo}><VideoIcon /></button
			>
			<button
				type="button"
				class="toolbar-button"
				aria-label="Insert table"
				title="Insert table"
				disabled={!editor}
				onclick={() =>
					editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
				><TableIcon /></button
			>
			<button
				type="button"
				class="toolbar-button"
				aria-label="Insert divider"
				title="Insert divider"
				disabled={!editor}
				onclick={() => editor?.chain().focus().setHorizontalRule().run()}
				><SeparatorHorizontalIcon /></button
			>
		</div>
		{#if cmsComponents}
			<span class="toolbar-divider" aria-hidden="true"></span>
			<div class="cms-toolbar-group">
				<details bind:this={insertMenu} class="dropdown relative">
					<summary
						bind:this={insertMenuSummary}
						class="toolbar-button toolbar-menu-button"
						aria-label="Insert component"
						title="Insert component"><PlusIcon /><ChevronDownIcon class="chevron" /></summary
					>
					<div class="component-menu dropdown-content">
						<button type="button" onclick={insertCallout}><InfoIcon /><span>Callout</span></button>
						<button type="button" onclick={() => setColumns(2)}
							><LayoutGridIcon /><span>Two columns</span></button
						>
						<button type="button" onclick={() => setColumns(3)}
							><LayoutGridIcon /><span>Three columns</span></button
						>
						<button type="button" onclick={() => setColumns(4)}
							><LayoutGridIcon /><span>Four columns</span></button
						>
						<button type="button" onclick={() => openComponentEditor('profiles')}
							><LayoutGridIcon /><span>Profile cards</span></button
						>
						<button type="button" onclick={() => openComponentEditor('logos')}
							><LayoutGridIcon /><span>Logo grid</span></button
						>
						<button type="button" onclick={() => openComponentEditor('facts')}
							><LayoutGridIcon /><span>Project facts</span></button
						>
						<button
							type="button"
							onclick={() => {
								setActions();
								closeInsertMenu();
							}}><ExternalLinkIcon /><span>Action links</span></button
						>
						<button type="button" onclick={editEditionGrid}
							><LayoutGridIcon /><span>Edition grid</span></button
						>
						<button
							type="button"
							onclick={() => {
								editor?.chain().focus().insertContent(expandableContent()).run();
								closeInsertMenu();
							}}><PanelTopOpenIcon /><span>Expandable section</span></button
						>
					</div>
				</details>
				{#if editor?.isActive('cmsCallout')}
					<label class="callout-style" title="Callout style"
						><span class="sr-only">Callout style</span><InfoIcon /><select
							value={editor.getAttributes('cmsCallout').style}
							onchange={(event) => setCallout(event.currentTarget.value as CalloutStyle)}
							>{#each calloutStyles as style (style)}<option value={style}>{style}</option
								>{/each}</select
						></label
					>
				{/if}
				{#if editor?.isActive('cmsActions')}
					<button
						type="button"
						class="toolbar-button"
						aria-label="Edit action links"
						title="Edit action links"
						onclick={setActions}><PencilIcon /></button
					>
				{/if}
				{#if editor?.isActive('cmsEditionGrid')}
					<button
						type="button"
						class="toolbar-button"
						aria-label="Edit edition grid"
						title="Edit edition grid"
						onclick={editEditionGrid}><LayoutGridIcon /></button
					>
				{/if}
				{#if editor?.isActive('cmsColumns')}
					<label class="callout-style" title="Column count"
						><span class="sr-only">Column count</span><LayoutGridIcon /><select
							value={editor.getAttributes('cmsColumns').count}
							onchange={(event) => setColumns(Number(event.currentTarget.value))}
							><option value="2">2 columns</option><option value="3">3 columns</option><option
								value="4">4 columns</option
							></select
						></label
					>
				{/if}
				{#if editor?.isActive('cmsProfileCards')}
					<button
						type="button"
						class="toolbar-button"
						aria-label="Edit profile cards"
						title="Edit profile cards"
						onclick={() => openComponentEditor('profiles')}><PencilIcon /></button
					>
				{/if}
				{#if editor?.isActive('cmsLogoGrid')}
					<button
						type="button"
						class="toolbar-button"
						aria-label="Edit logo grid"
						title="Edit logo grid"
						onclick={() => openComponentEditor('logos')}><PencilIcon /></button
					>
				{/if}
				{#if editor?.isActive('cmsProjectFacts')}
					<button
						type="button"
						class="toolbar-button"
						aria-label="Edit project facts"
						title="Edit project facts"
						onclick={() => openComponentEditor('facts')}><PencilIcon /></button
					>
				{/if}
			</div>
		{/if}
	</div>
	{#if editionPickerOpen}
		<div class="space-y-3 border-b border-base-300 p-3">
			<label class="block text-sm font-medium"
				>Choose published editions<input
					class="input mt-1 w-full"
					type="search"
					placeholder="Search editions…"
					bind:value={editionQuery}
				/></label
			>
			{#if editionIds.length}
				<ul class="space-y-2" aria-label="Selected editions">
					{#each editionIds as id, index (id)}
						{@const edition = cmsEditions.find((item) => item.id === id)}
						<li class="flex items-center gap-2 text-sm">
							<span class="min-w-0 flex-1 truncate">{edition?.title || id}</span>
							<button
								type="button"
								class="picker-icon-button"
								aria-label={`Move ${edition?.title || id} up`}
								title="Move up"
								disabled={index === 0}
								onclick={() =>
									(editionIds = editionIds.map((value, position) =>
										position === index - 1
											? editionIds[index]
											: position === index
												? editionIds[index - 1]
												: value
									))}><ArrowUpIcon /></button
							>
							<button
								type="button"
								class="picker-icon-button"
								aria-label={`Move ${edition?.title || id} down`}
								title="Move down"
								disabled={index === editionIds.length - 1}
								onclick={() =>
									(editionIds = editionIds.map((value, position) =>
										position === index + 1
											? editionIds[index]
											: position === index
												? editionIds[index + 1]
												: value
									))}><ArrowDownIcon /></button
							>
							<button
								type="button"
								class="picker-icon-button danger"
								aria-label={`Remove ${edition?.title || id}`}
								title="Remove"
								onclick={() => (editionIds = editionIds.filter((value) => value !== id))}
								><TrashIcon /></button
							>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="text-xs opacity-60">Up to {maxEditionReferences} published editions.</p>
			{#if editionLimitReached}<p role="alert" class="text-sm text-error">
					Remove an edition before adding another.
				</p>{/if}
			<div class="max-h-40 overflow-y-auto rounded border border-base-300">
				{#each matchingEditions as edition (edition.id)}
					<button
						type="button"
						class="block min-h-11 w-full px-3 text-left text-sm hover:bg-base-200"
						onclick={() => addEdition(edition.id)}>{edition.title}</button
					>
				{/each}
			</div>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="btn btn-sm btn-primary"
					disabled={!editionIds.length}
					onclick={saveEditionGrid}>Insert edition grid</button
				>
				<button type="button" class="btn btn-sm" onclick={() => (editionPickerOpen = false)}
					>Cancel</button
				>
			</div>
		</div>
	{/if}
	<dialog
		bind:this={componentDialog}
		class="modal"
		aria-labelledby="content-component-editor-title"
		onkeydown={(event) => {
			event.stopPropagation();
			if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
				event.preventDefault();
				saveComponentEditor();
			}
		}}
		onclose={() => {
			componentEditorKind = undefined;
			componentEditorError = '';
			componentEditorTarget = undefined;
		}}
	>
		<div class="modal-box max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto">
			<h2 id="content-component-editor-title" class="text-lg font-semibold">
				{componentEditorKind === 'profiles'
					? 'Edit profile cards'
					: componentEditorKind === 'logos'
						? 'Edit logo grid'
						: componentEditorKind === 'facts'
							? 'Edit project facts'
							: 'Edit image'}
			</h2>
			<p class="mt-1 text-sm opacity-70">Changes are saved only when you select Save.</p>
			{#if componentEditorKind === 'profiles'}
				<div class="component-form-list">
					{#each draftProfiles as profile, index (index)}
						<fieldset class="component-form-card">
							<legend>Profile {index + 1}</legend>
							<div class="component-form-actions">
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									disabled={index === 0}
									onclick={() => moveComponentItem('profiles', index, -1)}>Move up</button
								>
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									disabled={index === draftProfiles.length - 1}
									onclick={() => moveComponentItem('profiles', index, 1)}>Move down</button
								>
								<button
									type="button"
									class="btn text-error btn-ghost btn-xs"
									onclick={() => removeComponentItem('profiles', index)}>Remove</button
								>
							</div>
							<label
								>Name<input
									class="input-bordered input w-full"
									maxlength="120"
									required
									bind:value={profile.name}
								/></label
							>
							<label
								>Role or affiliation<input
									class="input-bordered input w-full"
									maxlength="120"
									bind:value={profile.role}
								/></label
							>
							<label
								>Biography<textarea
									class="textarea-bordered textarea w-full"
									maxlength="500"
									bind:value={profile.bio}
								></textarea></label
							>
							<label
								>Image URL<input
									class="input-bordered input w-full"
									type="text"
									inputmode="url"
									maxlength="2048"
									bind:value={profile.image}
								/></label
							>
							<label
								>Image description<input
									class="input-bordered input w-full"
									maxlength="240"
									bind:value={profile.alt}
								/></label
							>
							<fieldset class="component-link-list">
								<legend>Links</legend>
								{#each profile.links as link, linkIndex (linkIndex)}
									<div class="component-link-row">
										<label
											>Label<input
												class="input-bordered input w-full"
												maxlength="80"
												required
												bind:value={link.label}
											/></label
										>
										<label
											>Destination<input
												class="input-bordered input w-full"
												type="text"
												inputmode="url"
												maxlength="2048"
												required
												bind:value={link.href}
											/></label
										>
										<div class="component-form-actions">
											<button
												type="button"
												class="btn btn-ghost btn-xs"
												disabled={linkIndex === 0}
												onclick={() => moveProfileLink(index, linkIndex, -1)}>Move up</button
											>
											<button
												type="button"
												class="btn btn-ghost btn-xs"
												disabled={linkIndex === profile.links.length - 1}
												onclick={() => moveProfileLink(index, linkIndex, 1)}>Move down</button
											>
											<button
												type="button"
												class="btn text-error btn-ghost btn-xs"
												onclick={() => removeProfileLink(index, linkIndex)}>Remove</button
											>
										</div>
									</div>
								{/each}
								<button
									type="button"
									class="btn btn-ghost btn-sm"
									disabled={profile.links.length >= maxProfileLinks}
									onclick={() => addProfileLink(index)}>Add link</button
								>
							</fieldset>
						</fieldset>
					{/each}
				</div>
				<button
					type="button"
					class="btn mt-3 btn-sm"
					disabled={draftProfiles.length >= maxProfileCards}
					onclick={() => addComponentItem('profiles')}>Add profile</button
				>
			{:else if componentEditorKind === 'logos'}
				<div class="component-form-list">
					{#each draftLogos as logo, index (index)}
						<fieldset class="component-form-card">
							<legend>Logo {index + 1}</legend>
							<div class="component-form-actions">
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									disabled={index === 0}
									onclick={() => moveComponentItem('logos', index, -1)}>Move up</button
								>
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									disabled={index === draftLogos.length - 1}
									onclick={() => moveComponentItem('logos', index, 1)}>Move down</button
								>
								<button
									type="button"
									class="btn text-error btn-ghost btn-xs"
									onclick={() => removeComponentItem('logos', index)}>Remove</button
								>
							</div>
							<label
								>Name<input
									class="input-bordered input w-full"
									maxlength="120"
									required
									bind:value={logo.name}
								/></label
							>
							<label
								>Image URL<input
									class="input-bordered input w-full"
									type="text"
									inputmode="url"
									maxlength="2048"
									required
									bind:value={logo.image}
								/></label
							>
							<label
								>Image description<input
									class="input-bordered input w-full"
									maxlength="240"
									bind:value={logo.alt}
								/></label
							>
							<label
								>Link<input
									class="input-bordered input w-full"
									type="text"
									inputmode="url"
									maxlength="2048"
									bind:value={logo.href}
								/></label
							>
						</fieldset>
					{/each}
				</div>
				<button
					type="button"
					class="btn mt-3 btn-sm"
					disabled={draftLogos.length >= maxLogoItems}
					onclick={() => addComponentItem('logos')}>Add logo</button
				>
			{:else if componentEditorKind === 'facts'}
				<div class="component-form-list">
					{#each draftFacts as fact, index (index)}
						<fieldset class="component-form-card">
							<legend>Fact {index + 1}</legend>
							<div class="component-form-actions">
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									disabled={index === 0}
									onclick={() => moveComponentItem('facts', index, -1)}>Move up</button
								>
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									disabled={index === draftFacts.length - 1}
									onclick={() => moveComponentItem('facts', index, 1)}>Move down</button
								>
								<button
									type="button"
									class="btn text-error btn-ghost btn-xs"
									onclick={() => removeComponentItem('facts', index)}>Remove</button
								>
							</div>
							<label
								>Label<input
									class="input-bordered input w-full"
									maxlength="120"
									required
									bind:value={fact.label}
								/></label
							>
							<label
								>Value<textarea
									class="textarea-bordered textarea w-full"
									maxlength="500"
									required
									bind:value={fact.value}
								></textarea></label
							>
						</fieldset>
					{/each}
				</div>
				<button
					type="button"
					class="btn mt-3 btn-sm"
					disabled={draftFacts.length >= maxProjectFacts}
					onclick={() => addComponentItem('facts')}>Add fact</button
				>
			{:else if componentEditorKind === 'image'}
				<div class="component-form-list">
					<label
						>Image URL<input
							class="input-bordered input w-full"
							type="text"
							inputmode="url"
							maxlength="2048"
							required
							bind:value={draftImage.src}
						/></label
					>
					<label
						>Image description<input
							class="input-bordered input w-full"
							maxlength="240"
							bind:value={draftImage.alt}
						/></label
					>
					<label
						>Caption<textarea
							class="textarea-bordered textarea w-full"
							maxlength="500"
							bind:value={draftImage.caption}
						></textarea></label
					>
				</div>
			{/if}
			{#if componentEditorError}<p class="mt-3 text-sm text-error" role="alert">
					{componentEditorError}
				</p>{/if}
			<div class="modal-action">
				<button type="button" class="btn" onclick={closeComponentEditor}>Cancel</button>
				<button type="button" class="btn btn-primary" onclick={saveComponentEditor}>Save</button>
			</div>
		</div>
	</dialog>

	<!-- Editor content -->
	<div class="relative">
		{#if isUploadingImage}
			<div
				class="absolute top-2 right-2 z-10 inline-flex items-center gap-2 rounded bg-base-100 px-3 py-1 text-xs shadow"
			>
				<span class="loading loading-xs loading-spinner"></span>
				Uploading image...
			</div>
		{/if}
		<div
			bind:this={element}
			class="editor-wrapper prose prose-sm max-w-none p-4 focus-within:outline-none"
			style:--editor-min-h={minHeight}
			onpaste={handlePaste}
		></div>
	</div>
</div>

<style>
	.editor-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem;
		border-bottom: 1px solid var(--color-base-300);
		background: var(--color-base-200);
	}
	.toolbar-group,
	.cms-toolbar-group {
		display: flex;
		align-items: center;
		gap: 0.125rem;
	}
	.toolbar-button,
	.picker-icon-button {
		display: inline-flex;
		width: 2rem;
		height: 2rem;
		flex: 0 0 2rem;
		align-items: center;
		justify-content: center;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		color: color-mix(in oklch, var(--color-base-content) 78%, transparent);
		transition:
			background-color 120ms ease,
			border-color 120ms ease,
			color 120ms ease;
	}
	.toolbar-button:hover:not(:disabled),
	.picker-icon-button:hover:not(:disabled) {
		border-color: var(--color-base-300);
		background: var(--color-base-100);
		color: var(--color-base-content);
	}
	.toolbar-button.is-active {
		border-color: color-mix(in oklch, var(--color-primary) 30%, transparent);
		background: color-mix(in oklch, var(--color-primary) 14%, var(--color-base-100));
		color: var(--color-primary);
	}
	.toolbar-button:focus-visible,
	.picker-icon-button:focus-visible,
	.component-menu button:focus-visible,
	.callout-style select:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	.toolbar-button:disabled,
	.picker-icon-button:disabled {
		cursor: not-allowed;
		opacity: 0.35;
	}
	.toolbar-button :global(svg),
	.picker-icon-button :global(svg),
	.callout-style :global(svg),
	.component-menu :global(svg) {
		width: 1rem;
		height: 1rem;
		stroke-width: 1.8;
	}
	.toolbar-divider {
		width: 1px;
		height: 1.25rem;
		margin: 0 0.125rem;
		background: var(--color-base-300);
	}
	.toolbar-menu-button {
		width: 2.5rem;
		flex-basis: 2.5rem;
		gap: 0.125rem;
		list-style: none;
		cursor: pointer;
	}
	.toolbar-menu-button::-webkit-details-marker {
		display: none;
	}
	.toolbar-menu-button :global(.chevron) {
		width: 0.75rem;
		height: 0.75rem;
		transition: transform 120ms ease;
	}
	details[open] .toolbar-menu-button :global(.chevron) {
		transform: rotate(180deg);
	}
	.component-menu {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.375rem);
		right: 0;
		display: grid;
		width: 14rem;
		max-width: calc(100vw - 2rem);
		gap: 0.25rem;
		padding: 0.375rem;
		border: 1px solid var(--color-base-300);
		border-radius: 0.625rem;
		background: var(--color-base-100);
		box-shadow: 0 12px 30px color-mix(in oklch, var(--color-base-content) 14%, transparent);
	}
	.component-menu button {
		display: flex;
		min-height: 2.5rem;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.625rem;
		border-radius: 0.375rem;
		text-align: left;
		font-size: 0.875rem;
	}
	.component-menu button:hover {
		background: var(--color-base-200);
	}
	.callout-style {
		display: flex;
		height: 2rem;
		align-items: center;
		gap: 0.25rem;
		padding-left: 0.5rem;
		border: 1px solid var(--color-base-300);
		border-radius: 0.375rem;
		background: var(--color-base-100);
	}
	.callout-style select {
		height: 100%;
		padding: 0 1.5rem 0 0.25rem;
		border: 0;
		background: transparent;
		font-size: 0.75rem;
		text-transform: capitalize;
	}
	.picker-icon-button {
		border-color: var(--color-base-300);
		background: var(--color-base-100);
	}
	.picker-icon-button.danger {
		color: var(--color-error);
	}
	@media (max-width: 40rem) {
		.cms-toolbar-group {
			width: 100%;
		}
		.component-menu {
			position: fixed;
			top: auto;
			bottom: 1rem;
			left: 1rem;
			right: auto;
			width: calc(100vw - 2rem);
		}
	}
	.editor-wrapper :global(iframe) {
		width: 100%;
		aspect-ratio: 16/9;
		border: 0;
	}
	.editor-wrapper :global(.tiptap) {
		min-height: var(--editor-min-h, 200px);
		outline: none;
	}
	.editor-wrapper :global([data-cms-callout]) {
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		border-left: 0.25rem solid var(--color-info);
		border-radius: var(--radius-box);
		background: color-mix(in oklch, var(--color-info) 10%, transparent);
	}
	.editor-wrapper :global([data-cms-callout='success']) {
		border-color: var(--color-success);
		background: color-mix(in oklch, var(--color-success) 10%, transparent);
	}
	.editor-wrapper :global([data-cms-callout='warning']) {
		border-color: var(--color-warning);
		background: color-mix(in oklch, var(--color-warning) 12%, transparent);
	}
	.editor-wrapper :global(.cms-editor-actions),
	.editor-wrapper :global(.cms-editor-edition-grid) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		border: 1px dashed var(--color-base-content);
		border-radius: var(--radius-box);
		background: var(--color-base-200);
		cursor: pointer;
	}
	.editor-wrapper :global(.cms-editor-actions) {
		background: var(--color-base-content);
		color: var(--color-base-100);
	}
	.editor-wrapper :global(.cms-editor-edition-grid span) {
		width: 100%;
		font-size: 0.875rem;
	}
	.editor-wrapper :global([data-cms-columns]) {
		display: grid;
		grid-template-columns: repeat(var(--cms-columns, 2), minmax(0, 1fr));
		gap: 1rem;
		margin: 1rem 0;
	}
	.editor-wrapper :global([data-cms-columns='2']) {
		--cms-columns: 2;
	}
	.editor-wrapper :global([data-cms-columns='3']) {
		--cms-columns: 3;
	}
	.editor-wrapper :global([data-cms-columns='4']) {
		--cms-columns: 4;
	}
	.editor-wrapper :global([data-cms-column]) {
		min-width: 0;
		padding: 0.75rem;
		border: 1px dashed var(--color-base-300);
		border-radius: var(--radius-box);
	}
	.editor-wrapper :global([data-cms-columns]:focus-within) {
		outline: 2px solid var(--color-primary);
		outline-offset: 0.25rem;
	}
	.editor-wrapper :global([data-cms-profiles]),
	.editor-wrapper :global([data-cms-logo-grid]),
	.editor-wrapper :global([data-cms-project-facts]) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: 0.75rem;
		margin: 1rem 0;
	}
	.editor-wrapper :global([data-cms-profile]),
	.editor-wrapper :global([data-cms-logo]),
	.editor-wrapper :global([data-cms-project-fact]),
	.editor-wrapper :global(figure[data-content-image]) {
		min-width: 0;
		margin: 0;
		padding: 0.75rem;
		border: 1px dashed var(--color-base-300);
		border-radius: var(--radius-box);
		background: var(--color-base-200);
	}
	.editor-wrapper :global([data-cms-profile] > img) {
		width: 4rem;
		height: 4rem;
		margin: 0 0 0.75rem;
		border-radius: 50%;
		object-fit: cover;
	}
	.editor-wrapper :global([data-cms-profile-links]) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.editor-wrapper :global([data-cms-profile-link]) {
		font-size: 0.875rem;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.editor-wrapper :global([data-cms-logo] img),
	.editor-wrapper :global(figure[data-content-image] img) {
		display: block;
		max-width: 100%;
		height: auto;
		margin: 0 auto;
	}
	.editor-wrapper :global([data-cms-logo] figcaption),
	.editor-wrapper :global(figure[data-content-image] figcaption) {
		margin-top: 0.5rem;
		font-size: 0.875rem;
	}
	.component-form-list {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}
	.component-form-card {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--color-base-300);
		border-radius: var(--radius-box);
	}
	.component-form-card legend {
		padding: 0 0.25rem;
		font-weight: 600;
	}
	.component-form-card label,
	.component-form-list > label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.component-form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.editor-wrapper :global(details[data-cms-expandable]) {
		margin: 1rem 0;
		padding: 0.75rem;
		border: 1px solid var(--color-base-300);
		border-radius: var(--radius-box);
	}
	.editor-wrapper :global(.cms-editor-expandable-content) {
		padding-top: 0.5rem;
	}
	@media (min-width: 40.0625rem) and (max-width: 64rem) {
		.editor-wrapper :global([data-cms-columns='3']),
		.editor-wrapper :global([data-cms-columns='4']) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 40rem) {
		.editor-wrapper :global([data-cms-columns]) {
			grid-template-columns: 1fr;
		}
	}
</style>
