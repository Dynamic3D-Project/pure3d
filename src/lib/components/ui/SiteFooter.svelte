<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Editable links are validated and resolved before rendering. */
	import { base } from '$app/paths';
	import { beforeNavigate } from '$app/navigation';
	import ContextualMenuEditor from '$lib/components/ui/ContextualMenuEditor.svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import {
		emptyMenu,
		menuSignature,
		publishableMenu,
		validateMenu,
		type MenuConfig,
		type MenuDirectory
	} from '$lib/cms';
	import {
		menuDirectory,
		menus,
		refreshMenus,
		resolvedItems,
		resolvedLink,
		restoreLiveMenu,
		setMenuPreview
	} from '$lib/stores/navigation';
	let editing = $state(false);
	let previewing = $state(false);
	let editorConfig = $state<MenuConfig>(emptyMenu());
	let editorLiveConfig = $state<MenuConfig>(emptyMenu());
	let editorDirectory = $state<MenuDirectory>({
		content: [],
		categories: [],
		collections: [],
		editions: []
	});
	let selectedId = $state('');
	let draftId = $state('');
	let liveId = $state('');
	let draftVersion = $state('');
	let liveVersion = $state('');
	let editorOwnerId = $state('');
	let dirty = $state(false);
	let saving = $state(false);
	let editorError = $state('');
	let items = $derived(resolvedItems($menus.footer, $menus.directory));
	let primary = $derived(resolvedLink($menus.footer.primary, $menus.directory));
	let help = $derived(resolvedLink($menus.footer.helpLink, $menus.directory));
	const href = (value: string) => (value.startsWith('/') ? `${base}${value}` : value);
	const menuWriteOptions = (version: string) => ({
		headers: { 'X-Pure3D-Menu-Version': version }
	});
	function activeEditor(ownerId: string, expectedDraftId = draftId) {
		return (
			editing &&
			editorOwnerId === ownerId &&
			draftId === expectedDraftId &&
			pb.authStore.record?.id === ownerId &&
			pb.authStore.record?.role === 'admin'
		);
	}
	async function startEditing() {
		if (saving || authStore.globalRole !== 'admin') return;
		const editorId = pb.authStore.record?.id;
		if (!editorId) return;
		saving = true;
		editorError = '';
		try {
			const [draft, live, directory] = await Promise.all([
				pb.collection('cms_menu_drafts').getFirstListItem('slot = "footer"'),
				pb.collection('cms_menus').getFirstListItem('slot = "footer"'),
				menuDirectory(true)
			]);
			if (pb.authStore.record?.id !== editorId || pb.authStore.record?.role !== 'admin') return;
			editorConfig = structuredClone(draft.config);
			editorLiveConfig = structuredClone(live.config);
			editorDirectory = directory;
			draftId = draft.id;
			liveId = live.id;
			draftVersion = draft.updated;
			liveVersion = live.updated;
			editorOwnerId = editorId;
			selectedId = editorConfig.items[0]?.id || '';
			dirty = false;
			previewing = false;
			editing = true;
		} catch (error) {
			editorError = error instanceof Error ? error.message : 'Could not load the footer draft.';
		} finally {
			saving = false;
		}
	}
	function editorChanged() {
		if (!saving) dirty = true;
	}
	async function togglePreview() {
		if (!editing || saving) return;
		if (previewing) {
			previewing = false;
			await refreshMenus(true);
			return;
		}
		const errors = validateMenu(editorConfig, editorDirectory);
		if (errors.length) {
			editorError = errors.join(' ');
			return;
		}
		editorError = '';
		previewing = true;
		setMenuPreview('footer', $state.snapshot(editorConfig), $state.snapshot(editorDirectory));
	}
	async function saveEditor(publish = false) {
		if (saving || !activeEditor(editorOwnerId)) return;
		const ownerId = editorOwnerId;
		const config = $state.snapshot(editorConfig);
		const directory = $state.snapshot(editorDirectory);
		const currentDraftId = draftId;
		const errors = validateMenu(config, directory);
		if (errors.length) {
			editorError = errors.join(' ');
			return;
		}
		saving = true;
		editorError = '';
		try {
			const saved = await pb
				.collection('cms_menu_drafts')
				.update(currentDraftId, { config }, menuWriteOptions(draftVersion));
			if (!activeEditor(ownerId, currentDraftId)) return;
			draftVersion = saved.updated;
			dirty = false;
			if (publish) {
				const publishDirectory = await menuDirectory(true);
				if (!activeEditor(ownerId, currentDraftId)) return;
				const published = publishableMenu(config, publishDirectory);
				const live = await pb
					.collection('cms_menus')
					.update(liveId, { config: published }, menuWriteOptions(liveVersion));
				if (!activeEditor(ownerId, currentDraftId)) return;
				liveVersion = live.updated;
				editorLiveConfig = structuredClone(published);
				editorDirectory = publishDirectory;
				await refreshMenus(true);
				if (!activeEditor(ownerId, currentDraftId)) return;
				if (previewing) setMenuPreview('footer', config, publishDirectory);
				editorError =
					menuSignature(published) === menuSignature(config)
						? ''
						: 'Published eligible destinations. Unpublished or hidden targets remain in this draft.';
			}
		} catch (error) {
			if (activeEditor(ownerId, currentDraftId))
				editorError =
					error instanceof Error
						? error.message
						: 'Footer save failed. Your local changes remain open.';
		} finally {
			if (activeEditor(ownerId, currentDraftId)) saving = false;
		}
	}
	async function exitEditor() {
		if (dirty && !confirm('Discard unsaved footer changes?')) return;
		discardEditor();
		await refreshMenus(true);
	}
	function discardEditor() {
		restoreLiveMenu('footer', $state.snapshot(editorLiveConfig));
		editing = false;
		previewing = false;
		dirty = false;
		editorError = '';
	}
	beforeNavigate(({ cancel }) => {
		if (!editing) return;
		if (dirty && !confirm('Discard unsaved footer changes?')) cancel();
		else discardEditor();
	});
</script>

<svelte:window
	onbeforeunload={(event) => {
		if (editing && dirty) {
			event.preventDefault();
			event.returnValue = '';
		}
	}}
/>
<footer id="site-footer" class="border-t border-base-300 bg-base-200 px-6 py-10">
	{#if editing}<div class="editorbar" role="status">
			<div><strong>● Editing footer</strong><span>Navigation changes only.</span></div>
			<div>
				<span>{dirty ? 'Unsaved changes' : 'Draft saved'}{previewing ? ' · Previewing' : ''}</span
				><button
					class="btn btn-sm btn-primary"
					disabled={saving || !dirty}
					onclick={() => saveEditor()}>Save draft</button
				><button class="btn btn-outline btn-sm" disabled={saving} onclick={togglePreview}
					>{previewing ? 'Back to editing' : 'Preview'}</button
				><button class="btn btn-outline btn-sm" disabled={saving} onclick={exitEditor}
					>Exit editing</button
				><button class="btn btn-sm btn-primary" disabled={saving} onclick={() => saveEditor(true)}
					>Publish</button
				>
			</div>
		</div>{/if}
	{#if editorError}<div class="editor-error" role="alert">{editorError}</div>{/if}
	{#if editing && !previewing}<ContextualMenuEditor
			bind:config={editorConfig}
			bind:selectedId
			directory={editorDirectory}
			busy={saving}
			menuName="Footer"
			showItemPicker
			onchange={editorChanged}
			onclose={exitEditor}
		/>{/if}
	<div class="mx-auto max-w-7xl">
		<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
			{#each items as item (item.id)}<section>
					<h2 class="mb-4 text-sm font-semibold">{item.label}</h2>
					{#if item.direct}<a class="text-sm underline" href={href(item.direct.href)}
							>{item.direct.label}</a
						>{:else}{#each item.groups as group (group.id)}<div class="mb-5">
								<h3 class="mb-2 text-xs opacity-50">{group.label}</h3>
								<ul class="space-y-2 text-sm">
									{#each group.links as link (link.id)}<li>
											<a class="hover:underline" href={href(link.href)}>{link.label}</a>
										</li>{/each}
								</ul>
							</div>{/each}{/if}
					{#if item.featured}<aside class="mt-4 rounded-lg border border-base-300 p-4">
							<p class="text-xs opacity-60">{item.featured.kicker}</p>
							<p class="my-3 text-2xl tracking-widest">{item.featured.artwork}</p>
							<h3 class="font-semibold">{item.featured.title}</h3>
							<p class="my-2 text-sm opacity-60">{item.featured.description}</p>
							<a class="text-sm underline" href={href(item.featured.link.href)}
								>{item.featured.link.label}</a
							>
						</aside>{/if}
				</section>{/each}
		</div>
		<div
			class="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-base-300 pt-6 text-sm"
		>
			<p>
				{$menus.footer.helpText}
				{#if help}<a class="underline" href={href(help.href)}>{help.label}</a>{/if}
			</p>
			{#if primary}<a class="btn btn-sm btn-primary" href={href(primary.href)}>{primary.label}</a
				>{/if}
			{#if authStore.globalRole === 'admin' && !editing}<button
					class="edit-entry"
					disabled={saving}
					onclick={startEditing}>✎ Edit footer</button
				>{/if}
		</div>
	</div>
</footer>

<style>
	a {
		overflow-wrap: anywhere;
	}
	.editorbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin: -40px -24px 0;
		min-height: 52px;
		padding: 8px max(24px, calc((100vw - 1360px) / 2));
		background: var(--color-ink-2);
		color: #fff;
		font-size: 12px;
	}
	.editorbar > div {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.editorbar span {
		color: #d3ddc7;
	}
	.edit-entry {
		border: 1px solid currentColor;
		border-radius: var(--radius-control);
		padding: 7px 10px;
		white-space: nowrap;
	}
	.editorbar button {
		color: #fff;
		white-space: nowrap;
	}
	.editor-error {
		margin: 0 -24px;
		padding: 10px 40px;
		background: var(--color-error);
		color: var(--color-error-content);
		font-size: 12px;
	}
	.edit-entry {
		font-size: 12px;
	}
	@media (max-width: 700px) {
		.editorbar {
			align-items: flex-start;
			flex-direction: column;
			padding-block: 12px;
		}
		.editorbar > div:last-child {
			flex-wrap: wrap;
		}
		.editorbar > div:first-child span {
			display: none;
		}
	}
</style>
