<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Menu destinations are resolved by ID and safeMenuUrl, then prefixed with base. */
	import { base, resolve } from '$app/paths';
	import { dev } from '$app/environment';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import Logo from '$lib/assets/icons/Logo.svelte';
	import collectionsIcon from '$lib/assets/icons/collections.svg?raw';
	import editionsIcon from '$lib/assets/icons/editions.svg?raw';
	import Login from '$lib/components/ui/Login/LoginButton.svelte';
	import Search from '$lib/components/Search.svelte';
	import ContextualMenuEditor from '$lib/components/ui/ContextualMenuEditor.svelte';
	import { onMount } from 'svelte';
	import {
		menus,
		refreshMenus,
		resolvedItems,
		resolvedLink,
		setMenuPreview,
		restoreLiveMenu,
		menuDirectory
	} from '$lib/stores/navigation';
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
	let { showSearch = true }: { showSearch?: boolean } = $props();
	let open = $state('');
	let mobile = $state(false);
	let root: HTMLElement;
	let headerHeight = $state(76);
	let trigger: HTMLButtonElement | null = null;
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
	let draftId = $state('');
	let liveId = $state('');
	let draftVersion = $state('');
	let liveVersion = $state('');
	let editorOwnerId = $state('');
	let dirty = $state(false);
	let saving = $state(false);
	let editorError = $state('');
	const productionDb = dev && /^https:\/\/main\.57-129-98-223\.sslip\.io/.test(pb.baseURL);
	let editingView = $derived(editing && !previewing);
	let navigation = $derived(resolvedItems($menus.main, $menus.directory));
	let selected = $derived(navigation.find((item) => item.id === open));
	let editingSelected = $derived(editorConfig.items.find((item) => item.id === open));
	let helpLink = $derived(resolvedLink($menus.main.helpLink, $menus.directory));
	const linkHref = (path: string) => (path.startsWith('/') ? `${base}${path}` : path);
	function isActive(path: string) {
		if (!path.startsWith('/')) return false;
		const [pathname, query] = path.split('?');
		const current =
			base && $page.url.pathname.startsWith(base)
				? $page.url.pathname.slice(base.length) || '/'
				: $page.url.pathname;
		return (
			(pathname === '/'
				? current === '/'
				: current === pathname || current.startsWith(`${pathname}/`)) &&
			(!query || $page.url.search === `?${query}`)
		);
	}
	function itemIsActive(item: {
		direct?: { href: string } | null;
		landing?: { href: string } | null;
		groups: { links: { href: string }[] }[];
		featured?: { link: { href: string } } | null;
	}) {
		return !!(
			(item.direct && isActive(item.direct.href)) ||
			(item.landing && isActive(item.landing.href)) ||
			item.groups.some((group) => group.links.some((link) => isActive(link.href))) ||
			(item.featured && isActive(item.featured.link.href))
		);
	}
	onMount(() => {
		void refreshMenus();
		const header = root;
		const accountClick = (event: MouseEvent) => {
			if (event.target instanceof Element && event.target.closest('#login-button')) close();
		};
		header.addEventListener('click', accountClick, true);
		const unsubscribe = pb.authStore.onChange(() => {
			if (editing && pb.authStore.record?.id !== editorOwnerId) discardEditor();
			void refreshMenus(true);
		});
		return () => {
			unsubscribe();
			header.removeEventListener('click', accountClick, true);
		};
	});
	beforeNavigate(({ cancel }) => {
		if (editing && dirty) {
			if (!confirm('Discard unsaved menu changes?')) cancel();
			else discardEditor();
		}
	});
	function close(restore = false) {
		const wasMobile = mobile;
		open = '';
		mobile = false;
		if (restore) {
			if (wasMobile) root.querySelector<HTMLButtonElement>('.mobile-toggle')?.focus();
			else trigger?.focus();
		}
	}
	function toggle(label: string, event: MouseEvent) {
		trigger = event.currentTarget as HTMLButtonElement;
		open = open === label ? '' : label;
	}
	function editorChanged() {
		if (saving) return;
		dirty = true;
		if (previewing)
			setMenuPreview('main', $state.snapshot(editorConfig), $state.snapshot(editorDirectory));
	}
	function menuWriteOptions(version: string) {
		return { headers: { 'X-Pure3D-Menu-Version': version } };
	}
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
				pb.collection('cms_menu_drafts').getFirstListItem('slot = "main"'),
				pb.collection('cms_menus').getFirstListItem('slot = "main"'),
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
			dirty = false;
			previewing = false;
			editing = true;
			open =
				editorConfig.items.find((item) => item.id === open)?.id || editorConfig.items[0]?.id || '';
		} catch (error) {
			editorError = error instanceof Error ? error.message : 'Could not load the menu draft.';
		} finally {
			saving = false;
		}
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
		setMenuPreview('main', $state.snapshot(editorConfig), $state.snapshot(editorDirectory));
	}
	async function saveEditor(publish = false) {
		if (saving || !activeEditor(editorOwnerId)) return;
		const ownerId = editorOwnerId;
		const config = $state.snapshot(editorConfig);
		const directory = $state.snapshot(editorDirectory);
		const currentDraftId = draftId;
		const currentDraftVersion = draftVersion;
		const currentLiveId = liveId;
		const currentLiveVersion = liveVersion;
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
				.update(currentDraftId, { config }, menuWriteOptions(currentDraftVersion));
			if (!activeEditor(ownerId, currentDraftId)) return;
			draftVersion = saved.updated;
			dirty = false;
			if (publish) {
				const publishDirectory = await menuDirectory(true);
				if (!activeEditor(ownerId, currentDraftId)) return;
				const published = publishableMenu(config, publishDirectory);
				const live = await pb
					.collection('cms_menus')
					.update(currentLiveId, { config: published }, menuWriteOptions(currentLiveVersion));
				if (!activeEditor(ownerId, currentDraftId)) return;
				liveVersion = live.updated;
				editorLiveConfig = structuredClone(published);
				editorDirectory = publishDirectory;
				await refreshMenus(true);
				if (!activeEditor(ownerId, currentDraftId)) return;
				if (previewing) setMenuPreview('main', config, publishDirectory);
				editorError =
					menuSignature(published) === menuSignature(config)
						? ''
						: 'Published eligible destinations. Unpublished or hidden targets remain in this draft.';
			}
		} catch (error) {
			if (!activeEditor(ownerId, currentDraftId)) return;
			editorError =
				error instanceof Error
					? error.message
					: 'Menu save failed. Your local changes remain open.';
		} finally {
			if (activeEditor(ownerId, currentDraftId)) saving = false;
		}
	}
	async function exitEditor(confirmDirty = true) {
		if (confirmDirty && dirty && !confirm('Discard unsaved menu changes?')) return;
		discardEditor();
		await refreshMenus(true);
	}
	function discardEditor() {
		restoreLiveMenu('main', $state.snapshot(editorLiveConfig));
		editing = false;
		previewing = false;
		editorError = '';
		dirty = false;
		open = '';
		editorConfig = emptyMenu();
		editorLiveConfig = emptyMenu();
		editorDirectory = { content: [], categories: [], collections: [], editions: [] };
		draftId = '';
		liveId = '';
		draftVersion = '';
		liveVersion = '';
		editorOwnerId = '';
		saving = false;
	}
	afterNavigate(() => close());
	$effect(() => {
		if (typeof document === 'undefined' || !(open || mobile)) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});
</script>

{#snippet destinationIcon(path: string | undefined)}
	{#if path === '/collections' || path === '/editions'}
		<span
			class="destination-icon"
			class:collections-icon={path === '/collections'}
			class:editions-icon={path === '/editions'}
			aria-hidden="true"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- Trusted, local SVG assets; no user-provided markup. -->
			{@html path === '/collections' ? collectionsIcon : editionsIcon}
		</span>
	{/if}
{/snippet}

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && !root?.querySelector('dialog[open]')) close(true);
	}}
	onbeforeunload={(event) => {
		if (editing && dirty) {
			event.preventDefault();
			event.returnValue = '';
		}
	}}
/>
<nav
	id="header"
	bind:this={root}
	bind:clientHeight={headerHeight}
	style:--header-height={`${headerHeight}px`}
	aria-label="Main navigation"
	onfocusout={(e) => {
		if (e.relatedTarget instanceof Node && !root.contains(e.relatedTarget)) close();
	}}
>
	{#if editing}
		<div class="editorbar" role="status">
			<div>
				<strong>● Editing menu</strong><span>Navigation changes only. Pages stay intact.</span>
			</div>
			<div>
				<span>{dirty ? 'Unsaved changes' : 'Draft saved'}{previewing ? ' · Previewing' : ''}</span>
				<button
					class="btn btn-sm btn-primary"
					disabled={saving || !dirty}
					onclick={() => saveEditor()}>Save draft</button
				>
				<button class="btn btn-outline btn-sm" disabled={saving} onclick={togglePreview}
					>{previewing ? 'Back to editing' : 'Preview'}</button
				>
				<button class="btn btn-outline btn-sm" disabled={saving} onclick={() => exitEditor()}
					>Exit editing</button
				>
				<button class="btn btn-sm btn-primary" disabled={saving} onclick={() => saveEditor(true)}
					>Publish</button
				>
			</div>
		</div>
	{/if}
	<div class="bar">
		<a href={resolve('/')} aria-label="Pure3D home" class="logo"
			><Logo />{#if dev}<small class:production={productionDb}
					>{productionDb ? 'production db' : 'local preview'}</small
				>{/if}</a
		>
		{#if showSearch}<div class="header-search"><Search /></div>{/if}
		<div class="desktop-links">
			{#if editingView}
				{#each editorConfig.items as item (item.id)}
					<button
						class:active={open === item.id}
						aria-expanded={open === item.id}
						aria-controls="contextual-menu-editor"
						onclick={(event) => toggle(item.id, event)}
						>{@render destinationIcon(item.direct?.target.value)}{item.label}{!item.visible
							? ' (hidden)'
							: ''}<span aria-hidden="true">{open === item.id ? '⌃' : '⌄'}</span></button
					>
				{/each}
			{:else}
				{#each navigation as item (item.id)}
					{#if item.direct}<a
							class:publishing-cta={item.direct.href === '/documentation'}
							class:active={isActive(item.direct.href)}
							href={linkHref(item.direct.href)}
							>{@render destinationIcon(
								item.direct.href
							)}{item.label}{#if item.direct.href === '/documentation'}<span aria-hidden="true"
									>↗</span
								>{/if}</a
						>{:else if item.landing && (item.groups.length || item.featured)}<div
							class="nav-split"
							class:publishing-cta={item.landing.href === '/documentation'}
						>
							<a class:active={isActive(item.landing.href)} href={linkHref(item.landing.href)}
								>{item.landing.label}</a
							><button
								class:active={open === item.id || itemIsActive(item)}
								aria-label={`Open ${item.label} menu`}
								aria-expanded={open === item.id}
								aria-controls="navigation-panel"
								onclick={(e) => toggle(item.id, e)}
								><span aria-hidden="true">{open === item.id ? '⌃' : '⌄'}</span></button
							>
						</div>{:else if item.landing}<a
							class:active={isActive(item.landing.href)}
							href={linkHref(item.landing.href)}>{item.landing.label}</a
						>{:else}<button
							class:active={open === item.id || itemIsActive(item)}
							aria-expanded={open === item.id}
							aria-controls="navigation-panel"
							onclick={(e) => toggle(item.id, e)}
							>{item.label}<span aria-hidden="true">{open === item.id ? '⌃' : '⌄'}</span></button
						>{/if}{/each}
			{/if}
		</div>
		{#if $menus.error}<button class="text-xs text-error" onclick={() => refreshMenus(true)}
				>Menu unavailable · Retry</button
			>{/if}
		<div class="tools">
			<Login />
			<button
				class="mobile-toggle"
				aria-label={mobile ? 'Close navigation' : 'Open navigation'}
				aria-expanded={mobile}
				onclick={() => {
					mobile = !mobile;
					open = '';
				}}>{mobile ? '×' : '☰'}</button
			>
		</div>
	</div>
	{#if editorError}<div class="editor-error" role="alert">{editorError}</div>{/if}
	{#if mobile || selected || editingView}<div class="expansion">
			{#if mobile}<div class="mobile-links">
					{#if editingView}
						{#each editorConfig.items as item (item.id)}<button
								aria-expanded={open === item.id}
								onclick={(event) => toggle(item.id, event)}
								>{@render destinationIcon(item.direct?.target.value)}{item.label}<span
									aria-hidden="true">{open === item.id ? '−' : '+'}</span
								></button
							>{/each}
					{:else}{#each navigation as item (item.id)}{#if item.direct}<a
									class:publishing-cta={item.direct.href === '/documentation'}
									class:active={isActive(item.direct.href)}
									href={linkHref(item.direct.href)}
									>{@render destinationIcon(item.direct.href)}{item.label}</a
								>{:else if item.landing && (item.groups.length || item.featured)}<div
									class="mobile-split"
								>
									<a class:active={isActive(item.landing.href)} href={linkHref(item.landing.href)}
										>{item.landing.label}</a
									><button
										aria-label={`Open ${item.label} menu`}
										aria-expanded={open === item.id}
										onclick={(e) => toggle(item.id, e)}
										><span aria-hidden="true">{open === item.id ? '−' : '+'}</span></button
									>
								</div>{:else if item.landing}<a
									class:active={isActive(item.landing.href)}
									href={linkHref(item.landing.href)}>{item.landing.label}</a
								>{:else}<button aria-expanded={open === item.id} onclick={(e) => toggle(item.id, e)}
									>{item.label}<span aria-hidden="true">{open === item.id ? '−' : '+'}</span
									></button
								>{/if}{/each}{/if}
				</div>{/if}
			{#if editingView && editingSelected}
				<ContextualMenuEditor
					bind:config={editorConfig}
					bind:selectedId={open}
					directory={editorDirectory}
					busy={saving}
					onchange={editorChanged}
					onclose={() => (open = '')}
				/>
			{:else if selected}
				<div id="navigation-panel" class="panel">
					<div class="columns">
						{#if selected.introduction}<section class="introduction">
								<p>{selected.label}</p>
								<h2>{selected.introduction.heading}</h2>
								<p>{selected.introduction.description}</p>
							</section>{/if}
						{#each selected.groups as group (group.id)}<section
								class:prominent={'prominent' in group && group.prominent}
							>
								<h2>{group.label}</h2>
								<ul>
									{#each group.links as link (link.id)}<li>
											<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Navigation data includes query strings and is prefixed with the app base. -->
											<a href={linkHref(link.href)}>{link.label}</a>
										</li>{/each}
								</ul>
							</section>{/each}
						{#if selected.featured}<aside class="feature">
								<p>{selected.featured.kicker}</p>
								<div class="fair">
									<small>{selected.featured.kicker}</small><strong
										>{selected.featured.artwork} <span>↗</span></strong
									>
								</div>
								<h3>{selected.featured.title}</h3>
								<p>{selected.featured.description}</p>
								<a href={linkHref(selected.featured.link.href)}>{selected.featured.link.label}</a>
							</aside>{/if}
					</div>
					<div class="panel-footer">
						<span
							>{$menus.main.helpText}
							{#if helpLink}<a href={linkHref(helpLink.href)}>{helpLink.label}</a>{/if}</span
						>
						<div class="panel-actions">
							{#if authStore.globalRole === 'admin' && !editing}
								<button class="edit-entry" onclick={startEditing} disabled={saving}
									>✎ Edit menu</button
								>
							{/if}
							<button onclick={() => close(true)}>Close menu ×</button>
						</div>
					</div>
				</div>
			{/if}
		</div>{/if}
	{#if open || mobile}<button
			class="scrim"
			aria-label="Close navigation overlay"
			tabindex="-1"
			onclick={() => close(true)}
		></button>{/if}
	{#if $menus.preview && !editing}<div
			class="fixed right-5 bottom-5 left-5 z-90 flex max-w-[calc(100vw-2.5rem)] items-center gap-4 rounded-xl border border-base-300 bg-base-100 px-5 py-3 text-xs shadow-lg sm:right-auto sm:text-sm"
		>
			<span>Menu draft preview · only you see this</span><button
				class="underline"
				onclick={() => refreshMenus(true)}>Exit preview</button
			>
		</div>{/if}
</nav>

<style>
	.destination-icon {
		flex-shrink: 0;
		display: inline-flex;
		transition: transform 160ms ease-out;
	}
	.desktop-links .publishing-cta {
		align-self: center;
		align-items: stretch;
		min-height: 44px;
		border-radius: var(--radius-field);
		background: var(--color-primary);
		gap: 0;
	}
	.desktop-links .publishing-cta > a,
	.desktop-links .publishing-cta > button {
		color: #fff;
		border-bottom: 0;
		padding: 12px 16px;
		font-size: 13px;
	}
	.desktop-links .publishing-cta > a {
		padding-right: 8px;
	}
	.desktop-links .publishing-cta > button {
		padding-left: 8px;
	}
	.desktop-links .publishing-cta > button span {
		color: inherit;
	}
	.desktop-links .publishing-cta:hover {
		background: var(--color-forest-hover);
	}
	.desktop-links > a.publishing-cta {
		padding: 12px 20px;
		gap: 10px;
		border-bottom: 0;
		color: #fff;
		font-size: 13px;
	}
	.destination-icon :global(svg) {
		overflow: visible;
	}
	.collections-icon :global(rect) {
		transform-box: fill-box;
		transform-origin: center bottom;
		transition:
			rotate 160ms ease-out,
			translate 160ms ease-out;
	}
	a:is(:hover, :focus-visible) .collections-icon :global(rect:nth-child(1)),
	button:is(:hover, :focus-visible) .collections-icon :global(rect:nth-child(1)) {
		rotate: 5deg;
		translate: 1px -1px;
	}
	a:is(:hover, :focus-visible) .collections-icon :global(rect:nth-child(2)),
	button:is(:hover, :focus-visible) .collections-icon :global(rect:nth-child(2)) {
		rotate: 2deg;
		translate: 0 -0.5px;
	}
	a:is(:hover, :focus-visible) .editions-icon,
	button:is(:hover, :focus-visible) .editions-icon,
	a:is(:hover, :focus-visible) .collections-icon,
	button:is(:hover, :focus-visible) .collections-icon {
		transform: translateY(-2px) rotate(-3deg);
	}
	.mobile-links > a {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	nav {
		position: sticky;
		top: 0;
		z-index: 70;
		margin-bottom: 2.5rem;
		border-bottom: 1px solid var(--color-base-300);
	}
	.editorbar {
		position: relative;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
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
	.editorbar strong {
		white-space: nowrap;
	}
	.editorbar span {
		color: #d3ddc7;
	}
	.editorbar button {
		color: #fff;
		white-space: nowrap;
	}
	.editor-error {
		position: relative;
		z-index: 3;
		padding: 10px 40px;
		background: var(--color-error);
		color: var(--color-error-content);
		font-size: 12px;
	}
	nav::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		background: color-mix(in srgb, var(--color-base-100) 88%, transparent);
		-webkit-backdrop-filter: blur(24px) saturate(110%);
		backdrop-filter: blur(24px) saturate(110%);
		pointer-events: none;
	}
	.bar {
		position: relative;
		z-index: 2;
		max-width: 1440px;
		margin: auto;
		display: flex;
		align-items: center;
		gap: 32px;
		padding: 0 40px;
		min-height: 76px;
	}
	.logo {
		width: 108px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.logo small {
		font-size: 9px;
		letter-spacing: 0.06em;
		color: #627053;
	}
	.logo small.production {
		color: #a35000;
	}
	.header-search {
		width: clamp(210px, 20vw, 320px);
		flex: 0 1 320px;
		min-width: 190px;
	}
	.header-search :global(#search) {
		width: 100%;
	}
	.desktop-links {
		display: flex;
		justify-content: flex-end;
		gap: clamp(12px, 2vw, 38px);
		min-width: 0;
		overflow-x: auto;
		flex: 1;
		align-self: stretch;
	}
	.desktop-links button,
	.desktop-links a {
		white-space: nowrap;
		font-size: 14px;
		display: flex;
		align-items: center;
		gap: 8px;
		border-bottom: 2px solid transparent;
		cursor: pointer;
	}
	.desktop-links button.active {
		border-color: #43523c;
		font-weight: 600;
	}
	.desktop-links a.active {
		border-color: #43523c;
		font-weight: 600;
	}
	.nav-split {
		display: flex;
		align-items: stretch;
	}
	.nav-split button {
		padding-left: 7px;
		padding-right: 0;
	}
	.desktop-links button span {
		color: #777;
		font-size: 12px;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 20px;
	}
	.edit-entry {
		border: 1px solid #9da58f;
		border-radius: var(--radius-control);
		padding: 9px 12px;
		font-size: 12px;
		white-space: nowrap;
		cursor: pointer;
	}
	.mobile-toggle {
		display: none;
	}
	.expansion {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 2;
		max-height: calc(100dvh - var(--header-height));
		overflow: auto;
		overscroll-behavior: contain;
	}
	.panel,
	.mobile-links {
		position: relative;
		z-index: 2;
		background: var(--color-base-100);
	}
	.panel {
		border-top: 1px solid var(--color-base-300);
		overflow: visible;
		animation: reveal 0.18s ease-out;
	}
	.columns {
		overflow-wrap: anywhere;
		max-width: 1440px;
		margin: auto;
		padding: 42px 40px 32px;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: clamp(24px, 4vw, 72px);
	}
	.columns h2,
	.feature > p {
		font-size: 12px;
		color: var(--color-base-content);
		opacity: 0.6;
		margin: 0 0 22px;
	}
	.columns ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 17px;
		font-size: 14px;
	}
	.columns .prominent ul {
		font-size: 28px;
		font-weight: 600;
		line-height: 1.15;
		letter-spacing: -0.6px;
	}
	.columns a:hover {
		text-decoration: underline;
		text-underline-offset: 5px;
	}
	.columns a {
		overflow-wrap: anywhere;
	}
	.introduction {
		max-width: 320px;
	}
	.introduction > p:first-child {
		margin: 0 0 16px;
		color: #5e6f60;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.introduction h2 {
		margin: 0 0 12px;
		color: var(--color-base-content);
		font-family: Georgia, serif;
		font-size: 28px;
		font-weight: 400;
		letter-spacing: -0.03em;
		opacity: 1;
	}
	.introduction > p:last-child {
		margin: 0;
		color: var(--color-base-content);
		font-size: 13px;
		line-height: 1.6;
		opacity: 0.65;
	}
	.feature {
		border-left: 1px solid var(--color-base-300);
		padding-left: 30px;
	}
	.fair {
		padding: 18px 20px;
		background: #e8eadf;
		color: #43523c;
		border-radius: var(--radius-surface);
		height: 112px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	.fair small {
		font-size: 9px;
		letter-spacing: 1.5px;
	}
	.fair strong {
		font-size: 30px;
		font-weight: 400;
	}
	.fair span {
		float: right;
		font-size: 22px;
	}
	.feature h3 {
		font-size: 18px;
		line-height: 1.35;
		margin: 16px 0 12px;
	}
	.feature > p {
		margin-bottom: 15px;
	}
	.feature > a {
		font-size: 12px;
		color: #476044;
	}
	.panel-footer {
		max-width: 1360px;
		margin: 0 auto;
		border-top: 1px solid var(--color-base-300);
		padding: 22px 0;
		display: flex;
		justify-content: space-between;
		gap: 22px;
		font-size: 12px;
		color: var(--color-base-content);
	}
	.panel-footer a {
		color: #476044;
	}
	.panel-actions {
		display: flex;
		align-items: center;
		gap: 20px;
	}
	.panel-footer button {
		white-space: nowrap;
		cursor: pointer;
	}
	.scrim {
		position: fixed;
		inset: var(--header-height) 0 0;
		background: #202b252b;
		backdrop-filter: blur(6px);
		z-index: 1;
		border: 0;
		cursor: default;
	}
	.mobile-links {
		display: none;
	}
	button:focus-visible,
	a:focus-visible {
		outline: 2px solid #627053;
		outline-offset: 5px;
	}
	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (max-width: 1150px) {
		.bar {
			padding: 0 24px;
			gap: 22px;
		}
		.desktop-links {
			gap: 24px;
		}
		.tools {
			gap: 12px;
		}
		.columns {
			padding: 32px 24px;
			gap: 24px;
			grid-template-columns: 1.2fr 1fr 1fr;
		}
		.feature {
			display: none;
		}
		.panel-footer {
			margin: 0 24px;
		}
	}
	@media (max-width: 900px) {
		.editorbar {
			padding: 8px 15px;
			align-items: flex-start;
		}
		.editorbar > div:first-child span {
			display: none;
		}
		.editorbar > div:last-child {
			gap: 4px;
			flex-wrap: wrap;
			justify-content: flex-end;
		}
		.editor-error {
			padding: 10px 18px;
		}
		.bar {
			padding: 0 18px;
			min-height: 68px;
			gap: 12px;
		}
		.logo {
			width: 100px;
		}
		.desktop-links {
			display: none;
		}
		.tools {
			margin-left: auto;
			gap: 8px;
		}
		.mobile-toggle {
			display: block;
			font-size: 23px;
			width: 40px;
			height: 44px;
			cursor: pointer;
		}
		.mobile-links {
			display: flex;
			flex-direction: column;
			padding: 14px 24px;
			border-top: 1px solid var(--color-base-300);
		}
		.mobile-links button {
			overflow-wrap: anywhere;
			display: flex;
			justify-content: space-between;
			font-size: 22px;
			padding: 11px 0;
			text-align: left;
		}
		.mobile-links > a {
			padding: 14px 0;
			font-size: 14px;
			color: #476044;
		}
		.mobile-links > a.publishing-cta {
			margin-top: 8px;
			padding: 12px 16px;
			border-radius: var(--radius-field);
			background: var(--color-primary);
			color: var(--color-primary-content);
		}
		.mobile-links > a.publishing-cta:hover {
			background: var(--color-forest-hover);
		}
		.mobile-split {
			display: flex;
			align-items: center;
			justify-content: space-between;
			border-bottom: 1px solid var(--color-base-300);
		}
		.mobile-split a {
			flex: 1;
			padding: 14px 0;
			font-size: 14px;
			color: #476044;
		}
		.mobile-split button {
			padding-left: 16px;
		}
		.columns {
			display: flex;
			flex-direction: column;
			padding: 24px;
			gap: 28px;
		}
		.columns .prominent ul {
			font-size: 22px;
		}
		.columns h2 {
			margin-bottom: 15px;
		}
		.columns ul {
			gap: 14px;
		}
		.expansion {
			max-height: calc(100dvh - var(--header-height));
		}
		.panel-footer {
			padding: 20px 0;
			flex-direction: column;
		}
		.panel-footer button {
			text-align: left;
		}
		.scrim {
			top: var(--header-height);
		}
	}
	@media (max-width: 650px) {
		.bar {
			flex-wrap: wrap;
			padding-top: 12px;
			padding-bottom: 14px;
		}
		.header-search {
			order: 4;
			width: 100%;
			flex-basis: 100%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.panel {
			animation: none;
		}
	}
</style>
