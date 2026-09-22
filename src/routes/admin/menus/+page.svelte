<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import {
		emptyMenu,
		newMenuLink,
		move,
		moveMenuLink,
		validateMenu,
		publishableMenu,
		menuSignature,
		type MenuConfig,
		type MenuDirectory,
		type MenuGroup
	} from '$lib/cms';
	import { menuDirectory, previewMenu, refreshMenus, menus } from '$lib/stores/navigation';
	import MenuLinkEditor from '$lib/components/admin/MenuLinkEditor.svelte';
	import toast from 'svelte-french-toast';
	let config = $state<MenuConfig>(emptyMenu()),
		directory = $state<MenuDirectory>({
			content: [],
			categories: [],
			collections: [],
			editions: []
		});
	let slot = $state<'main' | 'footer'>('main'),
		selected = $state(''),
		draftId = $state(''),
		liveId = $state(''),
		version = $state(''),
		liveVersion = $state(''),
		dirty = $state(false),
		busy = $state(false),
		error = $state(''),
		loading = $state(true);
	let dragged = $state<{ type: 'item' | 'group' | 'link'; id: string } | null>(null);
	let liveConfig = $state('');
	let item = $derived(config.items.find((i) => i.id === selected));
	let allGroups = $derived(
		config.items.flatMap((i) =>
			i.groups.map((g) => ({ id: g.id, label: `${i.label} / ${g.label}` }))
		)
	);
	function changed() {
		dirty = true;
	}
	async function load() {
		loading = true;
		draftId = '';
		liveId = '';
		liveVersion = '';
		selected = '';
		config = emptyMenu();
		error = '';
		try {
			const [draft, live, records] = await Promise.all([
				pb.collection('cms_menu_drafts').getFirstListItem(pb.filter('slot = {:slot}', { slot })),
				pb.collection('cms_menus').getFirstListItem(pb.filter('slot = {:slot}', { slot })),
				menuDirectory(true)
			]);
			config = structuredClone(draft.config);
			directory = records;
			draftId = draft.id;
			liveId = live.id;
			liveConfig = menuSignature(live.config);
			version = draft.updated;
			liveVersion = live.updated;
			selected = config.items[0]?.id || '';
			dirty = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not load menu';
		} finally {
			loading = false;
		}
	}
	async function switchMenu(value: 'main' | 'footer') {
		if (busy || loading) return;
		if (dirty && !confirm('Discard unsaved menu changes?')) return;
		slot = value;
		loading = true;
		await refreshMenus(true);
		await load();
	}
	async function save(publish = false) {
		const errors = validateMenu(config, directory);
		if (errors.length) {
			error = errors.join(' ');
			return;
		}
		busy = true;
		error = '';
		try {
			const saved = await pb
				.collection('cms_menu_drafts')
				.update(draftId, { config }, { headers: { 'X-Pure3D-Menu-Version': version } });
			version = saved.updated;
			dirty = false;
			if (publish) {
				directory = await menuDirectory(true);
				const published = publishableMenu($state.snapshot(config), directory);
				const live = await pb
					.collection('cms_menus')
					.update(
						liveId,
						{ config: published },
						{ headers: { 'X-Pure3D-Menu-Version': liveVersion } }
					);
				liveVersion = live.updated;
				liveConfig = menuSignature(published);
				await refreshMenus(true);
			}
			toast.success(publish ? 'Menu published' : 'Menu draft saved');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Save failed';
		} finally {
			busy = false;
		}
	}
	function addMenu() {
		const id = crypto.randomUUID();
		config.items.push({ id, label: 'New menu', visible: true, groups: [], landing: null });
		selected = id;
		changed();
	}
	function addGroup() {
		if (!item) return;
		item.groups.push({ id: crypto.randomUUID(), label: 'New group', prominent: false, links: [] });
		changed();
	}
	function drop(event: DragEvent, type: 'item' | 'group' | 'link', id: string, index = 0) {
		event.preventDefault();
		if (!dragged) return;
		if (type === 'item' && dragged.type !== 'item') {
			const destination = config.items.find((entry) => entry.id === id);
			if (!destination || destination.direct) {
				toast.error('Drop into an expanded menu, not a direct link.');
				dragged = null;
				return;
			}
			if (dragged.type === 'link') {
				if (!destination.groups.length)
					destination.groups.push({
						id: crypto.randomUUID(),
						label: 'Links',
						prominent: false,
						links: []
					});
				const group = destination.groups[0];
				config = moveMenuLink($state.snapshot(config), dragged.id, group.id, group.links.length);
			} else {
				const source = config.items.find((entry) =>
					entry.groups.some((group) => group.id === dragged!.id)
				);
				const group = source?.groups.find((group) => group.id === dragged!.id);
				if (source && group && source.id !== destination.id) {
					source.groups = source.groups.filter((g) => g.id !== group.id);
					destination.groups.push(group);
				}
			}
			dragged = null;
			changed();
			toast.success(`Moved to ${destination.label}`);
			return;
		}
		if (type === 'item' && dragged.type === 'item')
			config.items = move(
				config.items,
				config.items.findIndex((i) => i.id === dragged!.id),
				config.items.findIndex((i) => i.id === id)
			);
		if (type === 'group' && dragged.type === 'group' && item)
			item.groups = move(
				item.groups,
				item.groups.findIndex((g) => g.id === dragged!.id),
				item.groups.findIndex((g) => g.id === id)
			);
		if (type === 'link' && dragged.type === 'link')
			config = moveMenuLink($state.snapshot(config), dragged.id, id, index);
		dragged = null;
		changed();
	}
	function drag(event: DragEvent, type: 'item' | 'group' | 'link', id: string) {
		dragged = { type, id };
		event.dataTransfer?.setData('text/plain', id);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}
	function deleteGroup(group: MenuGroup) {
		if (!item || !confirm(`Remove “${group.label}” and its links from this menu?`)) return;
		item.groups = item.groups.filter((g) => g.id !== group.id);
		changed();
	}
	async function preview() {
		error = '';
		const errors = validateMenu(config, directory);
		if (errors.length) {
			error = errors.join(' ');
			return;
		}
		try {
			await previewMenu(slot, $state.snapshot(config));
			toast.success('Preview active: open the header menu or inspect the footer below.');
		} catch (e) {
			error = String(e);
		}
	}
	beforeNavigate(({ cancel }) => {
		if (dirty && !confirm('Discard unsaved menu changes?')) cancel();
	});
	onMount(() => {
		if (authStore.globalRole === 'admin') void load();
	});
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (dirty) {
			e.preventDefault();
			e.returnValue = '';
		}
	}}
/>
<svelte:head><title>Menus | Pure3D Admin</title></svelte:head>
<div id="menus-page">
	{#if authStore.globalRole !== 'admin'}<p>Admin access required.</p>{:else}
		<header class="mb-7 flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="text-xs tracking-widest uppercase opacity-50">Navigation</p>
				<h1 class="mt-2 text-3xl font-semibold">Menus</h1>
				<p class="mt-2 text-sm opacity-60">
					Arrange destinations without changing the design. Draft page links stay in preview.
					Publish the pages, then publish this menu to include them.
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<button class="btn btn-outline" disabled={busy || loading || !draftId} onclick={preview}
					>Preview</button
				><button
					class="btn btn-outline"
					disabled={busy || loading || !draftId}
					onclick={() => save()}>Save draft</button
				><button
					class="btn btn-neutral"
					disabled={busy || loading || !draftId}
					onclick={() => save(true)}>Publish menu</button
				>
			</div>
		</header>
		{#if error}<div role="alert" class="mb-5 alert alert-error">
				{error}<button onclick={load}>Reload</button>
			</div>{/if}
		<div class="mb-6 flex flex-wrap gap-3">
			<button
				class="btn btn-sm"
				class:btn-neutral={slot === 'main'}
				disabled={busy || loading}
				onclick={() => switchMenu('main')}>Main menu</button
			><button
				class="btn btn-sm"
				class:btn-neutral={slot === 'footer'}
				disabled={busy || loading}
				onclick={() => switchMenu('footer')}>Footer</button
			><span class="self-center text-sm opacity-60"
				>{dirty
					? 'Unsaved changes'
					: menuSignature(publishableMenu(config, directory)) === liveConfig
						? 'Published menu'
						: 'Saved draft · not published'}{#if $menus.preview}
					· Preview active{/if}</span
			>
		</div>
		{#if loading}<p>Loading menu…</p>{:else}
			<div inert={busy} class="grid min-w-0 gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
				<aside class="space-y-3">
					<h2 class="text-sm font-semibold">Top-level items</h2>
					<p class="text-xs opacity-60">Drag the handle, or use the arrow buttons.</p>
					{#each config.items as entry, index (entry.id)}<div
							class="rounded-lg border border-base-300 p-3"
							class:bg-base-200={selected === entry.id}
							role="group"
							aria-label={entry.label}
							ondragover={(e) => e.preventDefault()}
							ondrop={(e) => drop(e, 'item', entry.id)}
						>
							<div class="flex items-center gap-2">
								<button
									draggable="true"
									ondragstart={(e) => drag(e, 'item', entry.id)}
									ondragend={() => (dragged = null)}
									aria-label={`Drag ${entry.label}`}
									class="cursor-grab p-2">⠿</button
								><button
									class="min-w-0 flex-1 text-left text-sm font-semibold"
									onclick={() => (selected = entry.id)}
									>{entry.label}{!entry.visible ? ' (hidden)' : ''}</button
								>
							</div>
							<div class="mt-2 flex gap-2">
								<button
									class="btn btn-xs"
									aria-label={`Move ${entry.label} up`}
									disabled={index === 0}
									onclick={() => {
										config.items = move(config.items, index, index - 1);
										changed();
									}}>↑</button
								><button
									class="btn btn-xs"
									aria-label={`Move ${entry.label} down`}
									disabled={index === config.items.length - 1}
									onclick={() => {
										config.items = move(config.items, index, index + 1);
										changed();
									}}>↓</button
								>
							</div>
						</div>{/each}<button class="btn w-full btn-outline btn-sm" onclick={addMenu}
						>+ Add menu item</button
					>
				</aside>
				<div class="min-w-0 space-y-6">
					{#if item}
						<section class="space-y-4 rounded-xl border border-base-300 p-5">
							<div class="flex flex-wrap items-end gap-4">
								<label class="min-w-0 flex-1 text-sm"
									>Menu label<input
										class="input mt-2 w-full"
										bind:value={item.label}
										oninput={changed}
									/></label
								><label class="flex items-center gap-2 pb-3 text-sm"
									><input
										type="checkbox"
										class="checkbox checkbox-sm"
										bind:checked={item.visible}
										onchange={changed}
									/>Visible</label
								><button
									class="btn btn-outline btn-sm btn-error"
									onclick={() => {
										if (confirm(`Remove menu “${item?.label}”?`)) {
											config.items = config.items.filter((i) => i.id !== selected);
											selected = config.items[0]?.id || '';
											changed();
										}
									}}>Remove menu</button
								>
							</div>
							<label class="flex items-center gap-2 text-sm"
								><input
									class="checkbox checkbox-sm"
									type="checkbox"
									checked={!!item.direct}
									onchange={(e) => {
										if (item) {
											item.direct = e.currentTarget.checked ? newMenuLink() : null;
											if (item.direct) item.landing = null;
										}
										changed();
									}}
								/>Direct link instead of an expanded menu</label
							>{#if item.direct}<MenuLinkEditor
									bind:link={item.direct}
									{directory}
									onchange={changed}
								/>{/if}
							<label class="flex items-center gap-2 text-sm"
								><input
									class="checkbox checkbox-sm"
									type="checkbox"
									checked={!!item.introduction}
									onchange={(e) => {
										if (item)
											item.introduction = e.currentTarget.checked
												? { heading: 'Menu introduction', description: '' }
												: null;
										changed();
									}}
								/>Show menu introduction</label
							>{#if item.introduction}<div class="grid gap-3 sm:grid-cols-2">
									<label class="text-xs"
										>Heading<input
											class="input mt-1 w-full"
											bind:value={item.introduction.heading}
											oninput={changed}
										/></label
									><label class="text-xs"
										>Sentence<input
											class="input mt-1 w-full"
											bind:value={item.introduction.description}
											oninput={changed}
										/></label
									>
								</div>{/if}
							>{#if !item.direct}<label class="flex items-center gap-2 text-sm"
									><input
										class="checkbox checkbox-sm"
										type="checkbox"
										checked={!!item.landing}
										onchange={(e) => {
											if (item) item.landing = e.currentTarget.checked ? newMenuLink() : null;
											changed();
										}}
									/>Landing link beside the menu chevron</label
								>{#if item.landing}<MenuLinkEditor
										bind:link={item.landing}
										{directory}
										onchange={changed}
									/>{/if}{/if}
						</section>
						{#if !item.direct}
							{#each item.groups as group, index (group.id)}<section
									class="rounded-xl border border-base-300 p-5"
									role="group"
									aria-label={`Group ${group.label}`}
									ondragover={(e) => e.preventDefault()}
									ondrop={(e) => {
										if (dragged?.type === 'group') drop(e, 'group', group.id);
										else if (dragged?.type === 'link')
											drop(e, 'link', group.id, group.links.length);
									}}
								>
									<div class="mb-5 flex flex-wrap items-end gap-3">
										<button
											draggable="true"
											ondragstart={(e) => drag(e, 'group', group.id)}
											ondragend={() => (dragged = null)}
											aria-label={`Drag group ${group.label}`}
											class="cursor-grab p-3">⠿</button
										><label class="min-w-0 flex-1 text-xs"
											>Column heading<input
												class="input mt-1 w-full"
												bind:value={group.label}
												oninput={changed}
											/></label
										><label class="flex items-center gap-2 pb-3 text-xs"
											><input
												class="checkbox checkbox-sm"
												type="checkbox"
												bind:checked={group.prominent}
												onchange={changed}
											/>Large links</label
										><button
											class="btn btn-xs"
											aria-label={`Move group ${group.label} up`}
											disabled={index === 0}
											onclick={() => {
												if (item) item.groups = move(item.groups, index, index - 1);
												changed();
											}}>↑</button
										><button
											class="btn btn-xs"
											aria-label={`Move group ${group.label} down`}
											disabled={index === item.groups.length - 1}
											onclick={() => {
												if (item) item.groups = move(item.groups, index, index + 1);
												changed();
											}}>↓</button
										><button class="btn btn-ghost btn-xs" onclick={() => deleteGroup(group)}
											>Remove group</button
										>
									</div>
									<div class="space-y-4">
										{#each group.links as link, linkIndex (link.id)}<div
												class="rounded-lg bg-base-200 p-4"
												role="group"
												aria-label={`Link ${link.label}`}
												ondragover={(e) => e.preventDefault()}
												ondrop={(e) => {
													e.stopPropagation();
													drop(e, 'link', group.id, linkIndex);
												}}
											>
												<MenuLinkEditor
													bind:link={group.links[linkIndex]}
													{directory}
													onchange={changed}
												/>
												<div class="mt-3 flex flex-wrap items-center gap-2">
													<button
														draggable="true"
														ondragstart={(e) => drag(e, 'link', link.id)}
														ondragend={() => (dragged = null)}
														class="btn cursor-grab btn-xs"
														aria-label={`Drag link ${link.label}`}>⠿ Drag</button
													><button
														class="btn btn-xs"
														aria-label={`Move link ${link.label} up`}
														disabled={linkIndex === 0}
														onclick={() => {
															group.links = move(group.links, linkIndex, linkIndex - 1);
															changed();
														}}>↑</button
													><button
														class="btn btn-xs"
														aria-label={`Move link ${link.label} down`}
														disabled={linkIndex === group.links.length - 1}
														onclick={() => {
															group.links = move(group.links, linkIndex, linkIndex + 1);
															changed();
														}}>↓</button
													><select
														aria-label={`Move ${link.label} to group`}
														class="select max-w-64 select-xs"
														value={group.id}
														onchange={(e) => {
															config = moveMenuLink(
																$state.snapshot(config),
																link.id,
																e.currentTarget.value,
																999
															);
															changed();
														}}
														>{#each allGroups as destination (destination.id)}<option
																value={destination.id}>{destination.label}</option
															>{/each}</select
													><button
														class="btn btn-ghost btn-xs"
														onclick={() => {
															group.links = group.links.filter((l) => l.id !== link.id);
															changed();
														}}>Remove link</button
													>
												</div>
											</div>{/each}
									</div>
									<button
										class="btn mt-4 btn-outline btn-sm"
										onclick={() => {
											group.links.push(newMenuLink());
											changed();
										}}>+ Add link</button
									>
								</section>{/each}
							<button class="btn btn-outline" onclick={addGroup}>+ Add column / group</button>
							<section class="space-y-4 rounded-xl border border-base-300 p-5">
								<label class="flex items-center gap-3 font-semibold"
									><input
										class="checkbox checkbox-sm"
										type="checkbox"
										checked={!!item.featured}
										onchange={(e) => {
											if (item)
												item.featured = e.currentTarget.checked
													? {
															kicker: 'Featured',
															title: 'Featured page',
															description: '',
															artwork: 'PURE3D',
															link: newMenuLink()
														}
													: null;
											changed();
										}}
									/>Featured item</label
								>{#if item.featured}<div class="grid gap-3 sm:grid-cols-2">
										<label class="text-xs"
											>Eyebrow<input
												class="input mt-1 w-full"
												bind:value={item.featured.kicker}
												oninput={changed}
											/></label
										><label class="text-xs"
											>Headline<input
												class="input mt-1 w-full"
												bind:value={item.featured.title}
												oninput={changed}
											/></label
										><label class="text-xs"
											>Description<input
												class="input mt-1 w-full"
												bind:value={item.featured.description}
												oninput={changed}
											/></label
										><label class="text-xs"
											>Artwork text<input
												class="input mt-1 w-full"
												bind:value={item.featured.artwork}
												oninput={changed}
											/></label
										>
									</div>
									<MenuLinkEditor
										bind:link={item.featured.link}
										{directory}
										onchange={changed}
									/>{/if}
							</section>
						{/if}
					{:else}<p class="rounded-xl border border-dashed border-base-300 p-10">
							Add a menu item to get started.
						</p>{/if}
					<section class="space-y-4 rounded-xl border border-base-300 p-5">
						<h2 class="font-semibold">
							{slot === 'main' ? 'Header action & menu footer' : 'Footer note & action'}
						</h2>
						<label class="flex items-center gap-2 text-sm"
							><input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={!!config.primary}
								onchange={(e) => {
									config.primary = e.currentTarget.checked ? newMenuLink() : null;
									changed();
								}}
							/>Show primary button</label
						>{#if config.primary}<MenuLinkEditor
								bind:link={config.primary}
								{directory}
								onchange={changed}
							/>{/if}<label class="block text-sm"
							>Footer text<input
								class="input mt-2 w-full"
								bind:value={config.helpText}
								oninput={changed}
							/></label
						><label class="flex items-center gap-2 text-sm"
							><input
								class="checkbox checkbox-sm"
								type="checkbox"
								checked={!!config.helpLink}
								onchange={(e) => {
									config.helpLink = e.currentTarget.checked ? newMenuLink() : null;
									changed();
								}}
							/>Show supporting link</label
						>{#if config.helpLink}<MenuLinkEditor
								bind:link={config.helpLink}
								{directory}
								onchange={changed}
							/>{/if}
					</section>
				</div>
			</div>{/if}
	{/if}
</div>
