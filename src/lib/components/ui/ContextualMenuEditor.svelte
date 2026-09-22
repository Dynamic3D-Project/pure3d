<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import {
		move,
		newMenuLink,
		type MenuConfig,
		type MenuDirectory,
		type MenuGroup,
		type MenuLink
	} from '$lib/cms';
	import MenuLinkEditor from '$lib/components/admin/MenuLinkEditor.svelte';

	let {
		config = $bindable(),
		selectedId = $bindable(),
		directory,
		busy = false,
		onchange = () => {},
		onclose = () => {}
	}: {
		config: MenuConfig;
		selectedId: string;
		directory: MenuDirectory;
		busy?: boolean;
		onchange?: () => void;
		onclose?: () => void;
	} = $props();

	let item = $derived(config.items.find((entry) => entry.id === selectedId));
	let index = $derived(config.items.findIndex((entry) => entry.id === selectedId));
	let allGroups = $derived(
		config.items.flatMap((entry) =>
			entry.groups.map((group) => ({ id: group.id, label: `${entry.label} / ${group.label}` }))
		)
	);
	let panel: HTMLElement;
	let menuDialog: HTMLDialogElement;
	let introductionDialog: HTMLDialogElement;
	let groupDialog: HTMLDialogElement;
	let linkDialog: HTMLDialogElement;
	let featureDialog: HTMLDialogElement;
	let footerDialog: HTMLDialogElement;
	let menuLabel = $state('');
	let menuVisible = $state(true);
	let menuDirect = $state(false);
	let menuIntroduction = $state(false);
	let menuIntroductionHeading = $state('');
	let menuIntroductionDescription = $state('');
	let menuEditId = $state('');
	let groupLabel = $state('');
	let groupProminent = $state(false);
	let groupEditId = $state('');
	let editLink = $state<MenuLink>(newMenuLink());
	let sourceLinkId = $state('');
	let linkGroupId = $state('');
	let linkPosition = $state(1);
	let linkCommit = $state<((link: MenuLink) => void) | null>(null);
	let featureKicker = $state('');
	let featureTitle = $state('');
	let featureDescription = $state('');
	let featureArtwork = $state('');
	let featureLink = $state<MenuLink>(newMenuLink());
	let footerText = $state('');
	let footerLink = $state<MenuLink | null>(null);

	function positionDialogs() {
		const bounds = panel.getBoundingClientRect();
		const center = (Math.max(0, bounds.top) + Math.min(innerHeight, bounds.bottom)) / 2;
		for (const dialog of panel.querySelectorAll<HTMLDialogElement>('dialog[open]')) {
			const height = dialog.getBoundingClientRect().height;
			dialog.style.top = `${Math.max(16, Math.min(center - height / 2, innerHeight - height - 16))}px`;
		}
	}
	async function showDialog(dialog: HTMLDialogElement) {
		await tick();
		dialog.showModal();
		positionDialogs();
	}
	onMount(() => {
		const observer = new ResizeObserver(positionDialogs);
		observer.observe(panel);
		panel.querySelectorAll('dialog').forEach((dialog) => observer.observe(dialog));
		window.addEventListener('resize', positionDialogs);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', positionDialogs);
		};
	});

	function changed() {
		if (!busy) onchange();
	}
	function openMenu(entry: typeof item = undefined) {
		if (busy) return;
		menuEditId = entry?.id || '';
		menuLabel = entry?.label || 'New menu';
		menuVisible = entry?.visible ?? true;
		menuDirect = !!entry?.direct;
		menuIntroduction = !!entry?.introduction;
		menuIntroductionHeading = entry?.introduction?.heading || '';
		menuIntroductionDescription = entry?.introduction?.description || '';
		void showDialog(menuDialog);
	}
	function openIntroduction() {
		if (busy || !item) return;
		menuIntroductionHeading = item.introduction?.heading || '';
		menuIntroductionDescription = item.introduction?.description || '';
		void showDialog(introductionDialog);
	}
	function saveMenu() {
		if (busy || !menuLabel.trim()) return;
		if (menuEditId) {
			const entry = config.items.find((current) => current.id === menuEditId);
			if (!entry) return;
			entry.label = menuLabel;
			entry.visible = menuVisible;
			entry.direct = menuDirect ? entry.direct || newMenuLink() : null;
			entry.landing = menuDirect ? null : entry.landing;
			entry.introduction = menuIntroduction
				? { heading: menuIntroductionHeading, description: menuIntroductionDescription }
				: null;
		} else {
			const id = crypto.randomUUID();
			config.items.push({
				id,
				label: menuLabel,
				visible: menuVisible,
				groups: [],
				direct: menuDirect ? newMenuLink() : null,
				introduction: menuIntroduction
					? { heading: menuIntroductionHeading, description: menuIntroductionDescription }
					: null
			});
			selectedId = id;
		}
		changed();
		menuDialog.close();
	}
	function openGroup(group?: MenuGroup) {
		if (busy || !item) return;
		groupEditId = group?.id || '';
		groupLabel = group?.label || 'New column';
		groupProminent = group?.prominent || false;
		void showDialog(groupDialog);
	}
	function saveGroup() {
		if (busy || !item || !groupLabel.trim()) return;
		const group = item.groups.find((current) => current.id === groupEditId);
		if (group) {
			group.label = groupLabel;
			group.prominent = groupProminent;
		} else
			item.groups.push({
				id: crypto.randomUUID(),
				label: groupLabel,
				prominent: groupProminent,
				links: []
			});
		changed();
		groupDialog.close();
	}
	function openGroupLink(link: MenuLink | null, groupId: string, position: number) {
		if (busy) return;
		editLink = structuredClone($state.snapshot(link || newMenuLink()));
		sourceLinkId = link?.id || '';
		linkGroupId = groupId;
		linkPosition = position + 1;
		linkCommit = (next) => {
			for (const entry of config.items)
				for (const group of entry.groups)
					group.links = group.links.filter((current) => current.id !== sourceLinkId);
			const target = config.items
				.flatMap((entry) => entry.groups)
				.find((group) => group.id === linkGroupId);
			if (target)
				target.links.splice(Math.max(0, Math.min(linkPosition - 1, target.links.length)), 0, next);
		};
		void showDialog(linkDialog);
	}
	function openLink(link: MenuLink, commit: (next: MenuLink) => void) {
		if (busy) return;
		editLink = structuredClone($state.snapshot(link));
		sourceLinkId = '';
		linkGroupId = '';
		linkPosition = 1;
		linkCommit = commit;
		void showDialog(linkDialog);
	}
	function saveLink() {
		if (busy || !editLink.label.trim()) return;
		linkCommit?.(structuredClone($state.snapshot(editLink)));
		changed();
		linkDialog.close();
	}
	function openFeature() {
		if (busy || !item) return;
		featureKicker = item.featured?.kicker || 'Featured';
		featureTitle = item.featured?.title || 'Featured page';
		featureDescription = item.featured?.description || '';
		featureArtwork = item.featured?.artwork || 'PURE3D';
		featureLink = structuredClone($state.snapshot(item.featured?.link || newMenuLink()));
		void showDialog(featureDialog);
	}
	function saveFeature() {
		if (busy || !item) return;
		item.featured = {
			kicker: featureKicker,
			title: featureTitle,
			description: featureDescription,
			artwork: featureArtwork,
			link: structuredClone($state.snapshot(featureLink))
		};
		changed();
		featureDialog.close();
	}
	function openFooter() {
		if (busy) return;
		footerText = config.helpText;
		footerLink = config.helpLink ? structuredClone($state.snapshot(config.helpLink)) : null;
		void showDialog(footerDialog);
	}
	function saveFooter() {
		if (busy) return;
		config.helpText = footerText;
		config.helpLink = footerLink && structuredClone($state.snapshot(footerLink));
		changed();
		footerDialog.close();
	}
</script>

<section
	id="contextual-menu-editor"
	bind:this={panel}
	class="panel editor-panel"
	aria-label="Edit navigation"
>
	<fieldset disabled={busy}>
		<div class="editor-toolbar">
			<span>Header menu</span>
			{#if item}
				<strong>{item.label}</strong><button
					aria-label={`Edit ${item.label} menu`}
					onclick={() => openMenu(item)}>✎</button
				>
				<button
					aria-label={`Move ${item.label} menu left`}
					disabled={index === 0}
					onclick={() => {
						if (!busy) {
							config.items = move(config.items, index, index - 1);
							changed();
						}
					}}>←</button
				>
				<button
					aria-label={`Move ${item.label} menu right`}
					disabled={index === config.items.length - 1}
					onclick={() => {
						if (!busy) {
							config.items = move(config.items, index, index + 1);
							changed();
						}
					}}>→</button
				>
				<button
					aria-label={`Remove ${item.label} menu`}
					onclick={() => {
						if (!busy && confirm(`Remove menu “${item?.label}”?`)) {
							config.items = config.items.filter((entry) => entry.id !== selectedId);
							selectedId = config.items[0]?.id || '';
							changed();
						}
					}}>Remove</button
				>
			{/if}
			<a href={resolve('/admin/pages')}>All pages ↗</a><button onclick={() => openMenu(undefined)}
				>+ Add menu</button
			>
		</div>
		{#if item}
			{#if item.direct}
				<div class="direct-row">
					<span>{item.direct.label}</span><button
						aria-label={`Edit ${item.direct.label} link`}
						onclick={() =>
							openLink(item!.direct!, (next) => {
								if (item) item.direct = next;
							})}>⋯</button
					>
				</div>
			{:else}
				<div class="editor-columns">
					{#if item.introduction}
						<section class="edit-column introduction-card">
							<div class="column-heading">
								<h2>{item.label}</h2>
								<button aria-label="Edit menu introduction" onclick={openIntroduction}>✎</button>
							</div>
							<h3>{item.introduction.heading}</h3>
							<p>{item.introduction.description}</p>
						</section>
					{:else}
						<button class="add-column" onclick={openIntroduction}>+ Add introduction</button>
					{/if}
					{#each item.groups as group, groupIndex (group.id)}
						<section class="edit-column">
							<div class="column-heading">
								<h2>{group.label}</h2>
								<button aria-label={`Edit ${group.label} column`} onclick={() => openGroup(group)}
									>✎</button
								><button
									aria-label={`Move ${group.label} column left`}
									disabled={groupIndex === 0}
									onclick={() => {
										if (!busy && item) {
											item.groups = move(item.groups, groupIndex, groupIndex - 1);
											changed();
										}
									}}>←</button
								><button
									aria-label={`Move ${group.label} column right`}
									disabled={groupIndex === item.groups.length - 1}
									onclick={() => {
										if (!busy && item) {
											item.groups = move(item.groups, groupIndex, groupIndex + 1);
											changed();
										}
									}}>→</button
								><button
									aria-label={`Remove ${group.label} column`}
									onclick={() => {
										if (!busy && item && confirm(`Remove “${group.label}” and its links?`)) {
											item.groups = item.groups.filter((entry) => entry.id !== group.id);
											changed();
										}
									}}>Remove</button
								>
							</div>
							{#each group.links as link, linkIndex (link.id)}<div
									class:prominent={group.prominent}
									class="link-row"
								>
									<span>{link.label}{!link.visible ? ' (hidden)' : ''}</span><button
										aria-label={`Edit ${link.label} link`}
										onclick={() => openGroupLink(link, group.id, linkIndex)}>⋯</button
									>
								</div>{/each}
							<button class="add" onclick={() => openGroupLink(null, group.id, group.links.length)}
								>+ Add page or link</button
							>
						</section>
					{/each}
					<button class="add-column" onclick={() => openGroup()}>+ Add column</button>
				</div>
				<div class="editor-secondary">
					<button
						onclick={() =>
							openLink(item!.landing || newMenuLink(), (next) => {
								if (item) item.landing = next;
							})}>{item.landing ? 'Edit landing link' : 'Add landing link'}</button
					>{#if item.landing}<button
							onclick={() => {
								if (!busy && item) {
									item.landing = null;
									changed();
								}
							}}>Remove landing link</button
						>{/if}
					<button onclick={openFeature}
						>{item.featured ? 'Edit featured item' : 'Add featured item'}</button
					>{#if item.featured}<button
							onclick={() => {
								if (!busy && item) {
									item.featured = null;
									changed();
								}
							}}>Remove featured item</button
						>{/if}
				</div>
			{/if}
			<div class="editor-secondary">
				<button
					onclick={() =>
						openLink(config.primary || newMenuLink(), (next) => (config.primary = next))}
					>{config.primary ? 'Edit header action' : 'Add header action'}</button
				>{#if config.primary}<button
						onclick={() => {
							if (!busy) {
								config.primary = null;
								changed();
							}
						}}>Remove header action</button
					>{/if}<button onclick={openFooter}>Edit menu footer</button>
			</div>
		{/if}
	</fieldset>
	<div class="panel-footer">
		<span>Navigation changes only. Pages stay intact.</span><button onclick={onclose}
			>Close menu ×</button
		>
	</div>
	<dialog bind:this={introductionDialog} aria-labelledby="introduction-dialog-title">
		<form
			onsubmit={(event) => {
				event.preventDefault();
				if (busy || !item || !menuIntroductionHeading.trim() || !menuIntroductionDescription.trim())
					return;
				item.introduction = {
					heading: menuIntroductionHeading.trim(),
					description: menuIntroductionDescription.trim()
				};
				changed();
				introductionDialog.close();
			}}
		>
			<fieldset disabled={busy}>
				<h2 id="introduction-dialog-title">Edit menu introduction</h2>
				<label>Heading <input required bind:value={menuIntroductionHeading} /></label>
				<label
					>Description <textarea required rows="3" bind:value={menuIntroductionDescription}
					></textarea></label
				>
				<div class="dialog-actions">
					<button type="button" onclick={() => introductionDialog.close()}>Cancel</button><button
						type="submit">Apply</button
					>
				</div>
			</fieldset>
		</form>
	</dialog>
	<dialog bind:this={menuDialog} aria-labelledby="menu-dialog-title">
		<form
			method="dialog"
			onsubmit={(event) => {
				event.preventDefault();
				saveMenu();
			}}
		>
			<fieldset disabled={busy}>
				<h2 id="menu-dialog-title">{menuEditId ? 'Edit menu' : 'Add menu'}</h2>
				<label>Menu label <input required bind:value={menuLabel} /></label><label
					><input type="checkbox" bind:checked={menuVisible} /> Visible</label
				><label><input type="checkbox" bind:checked={menuDirect} /> Direct link</label><label
					><input type="checkbox" bind:checked={menuIntroduction} /> Show menu introduction</label
				>{#if menuIntroduction}<label
						>Introduction heading <input required bind:value={menuIntroductionHeading} /></label
					><label
						>Introduction sentence <input
							required
							bind:value={menuIntroductionDescription}
						/></label
					>{/if}
				<div class="dialog-actions">
					<button type="button" onclick={() => menuDialog.close()}>Cancel</button><button
						type="submit">Apply</button
					>
				</div>
			</fieldset>
		</form>
	</dialog>
	<dialog bind:this={groupDialog} aria-labelledby="column-dialog-title">
		<form
			method="dialog"
			onsubmit={(event) => {
				event.preventDefault();
				saveGroup();
			}}
		>
			<fieldset disabled={busy}>
				<h2 id="column-dialog-title">{groupEditId ? 'Edit column' : 'Add column'}</h2>
				<label>Column heading <input required bind:value={groupLabel} /></label><label
					><input type="checkbox" bind:checked={groupProminent} /> Large links</label
				>
				<div class="dialog-actions">
					<button type="button" onclick={() => groupDialog.close()}>Cancel</button><button
						type="submit">Apply</button
					>
				</div>
			</fieldset>
		</form>
	</dialog>
	<dialog bind:this={linkDialog} aria-labelledby="link-dialog-title">
		<form
			method="dialog"
			onsubmit={(event) => {
				event.preventDefault();
				saveLink();
			}}
		>
			<fieldset disabled={busy}>
				<h2 id="link-dialog-title">Edit navigation link</h2>
				<MenuLinkEditor
					bind:link={editLink}
					{directory}
					onchange={() => {}}
				/>{#if linkGroupId}<label
						>Column <select bind:value={linkGroupId}
							>{#each allGroups as group (group.id)}<option value={group.id}>{group.label}</option
								>{/each}</select
						></label
					><label>Position <input type="number" min="1" bind:value={linkPosition} /></label>{/if}
				<div class="dialog-actions">
					<button type="button" onclick={() => linkDialog.close()}>Cancel</button><button
						type="submit">Apply</button
					>
				</div>
			</fieldset>
		</form>
	</dialog>
	<dialog bind:this={featureDialog} aria-labelledby="feature-dialog-title">
		<form
			method="dialog"
			onsubmit={(event) => {
				event.preventDefault();
				saveFeature();
			}}
		>
			<fieldset disabled={busy}>
				<h2 id="feature-dialog-title">Edit featured item</h2>
				<label>Eyebrow <input bind:value={featureKicker} /></label><label
					>Headline <input bind:value={featureTitle} /></label
				><label>Description <input bind:value={featureDescription} /></label><label
					>Artwork text <input bind:value={featureArtwork} /></label
				><MenuLinkEditor bind:link={featureLink} {directory} onchange={() => {}} />
				<div class="dialog-actions">
					<button type="button" onclick={() => featureDialog.close()}>Cancel</button><button
						type="submit">Apply</button
					>
				</div>
			</fieldset>
		</form>
	</dialog>
	<dialog bind:this={footerDialog} aria-labelledby="footer-dialog-title">
		<form
			method="dialog"
			onsubmit={(event) => {
				event.preventDefault();
				saveFooter();
			}}
		>
			<fieldset disabled={busy}>
				<h2 id="footer-dialog-title">Edit menu footer</h2>
				<label>Footer callout <input bind:value={footerText} /></label><label
					><input
						type="checkbox"
						checked={!!footerLink}
						onchange={(event) => (footerLink = event.currentTarget.checked ? newMenuLink() : null)}
					/> Show supporting link</label
				>{#if footerLink}<MenuLinkEditor
						bind:link={footerLink}
						{directory}
						onchange={() => {}}
					/>{/if}
				<div class="dialog-actions">
					<button type="button" onclick={() => footerDialog.close()}>Cancel</button><button
						type="submit">Apply</button
					>
				</div>
			</fieldset>
		</form>
	</dialog>
</section>

<style>
	.editor-panel {
		position: relative;
		background: var(--color-base-100);
		border-top: 1px solid var(--color-base-300);
		padding: 24px max(40px, calc((100% - 1360px) / 2));
		min-width: 0;
	}
	fieldset {
		min-width: 0;
		border: 0;
		margin: 0;
		padding: 0;
	}
	.editor-toolbar,
	.column-heading,
	.editor-secondary,
	.direct-row,
	.link-row,
	.dialog-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.editor-toolbar {
		flex-wrap: wrap;
		margin-bottom: 18px;
		font-size: 12px;
	}
	.editor-toolbar > span {
		color: var(--color-base-content);
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.editor-toolbar button,
	.editor-toolbar a,
	.column-heading button,
	.editor-secondary button,
	.direct-row button,
	.link-row button,
	.add,
	.dialog-actions button {
		border: 1px solid var(--color-base-300);
		border-radius: 4px;
		padding: 6px 8px;
		font-size: 12px;
	}
	.editor-columns {
		display: flex;
		align-items: stretch;
		gap: 14px;
		overflow-x: auto;
		padding-bottom: 4px;
	}
	.edit-column {
		flex: 0 0 390px;
		min-width: 0;
		border: 1px solid #cbd3c0;
		border-radius: 7px;
		background: color-mix(in srgb, var(--color-base-100) 86%, #edf2e8);
		padding: 15px;
	}
	.introduction-card h3 {
		font-family: var(--font-serif);
		font-size: 28px;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
	.introduction-card > p {
		margin-top: 16px;
		font-size: 14px;
		line-height: 1.6;
		opacity: 0.7;
		overflow-wrap: anywhere;
	}
	.add-column {
		flex: 0 0 160px;
		min-height: 170px;
		border: 1px dashed #c1cbb6;
		border-radius: 7px;
		font-size: 12px;
		color: #506244;
	}
	.panel-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		border-top: 1px solid var(--color-base-300);
		margin-top: 24px;
		padding-top: 22px;
		font-size: 12px;
	}
	button:not(:disabled) {
		cursor: pointer;
	}
	button:focus-visible,
	a:focus-visible {
		outline: 2px solid #627053;
		outline-offset: 3px;
	}
	.column-heading {
		flex-wrap: wrap;
		border-bottom: 1px solid var(--color-base-300);
		padding-bottom: 12px;
		margin-bottom: 12px;
	}
	.column-heading h2 {
		flex: 1;
		margin: 0;
		font-size: 12px;
		font-weight: 400;
	}
	.link-row,
	.direct-row {
		justify-content: space-between;
		gap: 12px;
		margin: 0 0 12px;
	}
	.link-row span {
		font-size: 16px;
		overflow-wrap: anywhere;
	}
	.link-row.prominent span {
		font-size: 28px;
		font-weight: 600;
		letter-spacing: -0.6px;
		line-height: 1.15;
	}
	.editor-secondary {
		flex-wrap: wrap;
		margin-top: 16px;
	}
	dialog {
		position: fixed;
		inset: 16px 0 auto;
		margin: 0 auto;
		width: min(440px, calc(100vw - 32px));
		max-height: calc(100dvh - 32px);
		overflow-y: auto;
		border: 1px solid var(--color-base-300);
		border-radius: 10px;
		background: var(--color-base-100);
		color: var(--color-base-content);
		box-shadow: 0 24px 80px #14241030;
	}
	dialog::backdrop {
		background: #1e281a38;
	}
	dialog form {
		display: grid;
		gap: 12px;
		padding: 24px;
	}
	dialog h2 {
		margin: 0;
		font-size: 20px;
	}
	dialog label {
		display: grid;
		gap: 5px;
		font-size: 12px;
	}
	dialog label:has(> input[type='checkbox']) {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
	}
	dialog input[type='checkbox'] {
		flex-shrink: 0;
	}
	dialog input:not([type='checkbox']),
	dialog textarea,
	dialog select {
		border: 1px solid var(--color-base-300);
		border-radius: 4px;
		background: var(--color-base-100);
		padding: 9px;
	}
	.dialog-actions {
		justify-content: flex-end;
		margin-top: 10px;
	}
	@media (max-width: 700px) {
		.editor-panel {
			padding: 24px;
		}
		.editor-columns {
			flex-direction: column;
		}
		.edit-column,
		.add-column {
			flex-basis: auto;
		}
		.add-column {
			min-height: 60px;
		}
		.panel-footer {
			align-items: flex-start;
			flex-direction: column;
		}
		.link-row.prominent span {
			font-size: 22px;
		}
	}
</style>
