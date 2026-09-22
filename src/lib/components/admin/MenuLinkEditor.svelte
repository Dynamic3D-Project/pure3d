<script lang="ts">
	import { applicationRoutes, type MenuLink, type MenuDirectory, type TargetType } from '$lib/cms';
	let {
		link = $bindable(),
		directory,
		onchange = () => {}
	}: { link: MenuLink; directory: MenuDirectory; onchange?: () => void } = $props();
	let options = $derived(
		link.target.type === 'content'
			? directory.content.map((r) => ({
					value: r.id,
					rawLabel: r.title,
					label: `${r.title} ${r.layout === 'guide' ? '· Guide' : ''}${!r.isPublished ? ' · Draft' : ''}`
				}))
			: link.target.type === 'category'
				? directory.categories.map((r) => ({ value: r.id, label: r.name }))
				: link.target.type === 'collection'
					? directory.collections.map((r) => ({ value: r.id, label: r.title }))
					: link.target.type === 'edition'
						? directory.editions.map((r) => ({ value: r.id, label: r.dcTitle || r.title }))
						: applicationRoutes
	);
	function typeChanged(event: Event) {
		link.target = {
			type: (event.currentTarget as HTMLSelectElement).value as TargetType,
			value: ''
		};
		onchange();
	}
	function destinationChanged(event: Event) {
		const option = options.find(
			(o) => o.value === (event.currentTarget as HTMLSelectElement).value
		);
		if (option && (link.label === 'New link' || !link.label.trim()))
			link.label = String('rawLabel' in option ? option.rawLabel : option.label);
		onchange();
	}
</script>

<div id="menu-link-editor">
	<div class="fields grid min-w-0 gap-3">
		<label class="text-xs"
			>Label<input class="input mt-1 w-full" bind:value={link.label} oninput={onchange} /></label
		>
		<label class="text-xs"
			>Link to<select
				aria-label="Link to"
				class="select mt-1 w-full"
				value={link.target.type}
				onchange={typeChanged}
				><option value="content">Page or post</option><option value="category">Category</option
				><option value="collection">Collection</option><option value="edition">Edition</option
				><option value="route">Application</option><option value="external">External URL</option
				></select
			></label
		>
		<label class="text-xs"
			>Destination{#if link.target.type === 'external'}<input
					aria-label="Destination"
					class="input mt-1 w-full"
					placeholder="https://…"
					bind:value={link.target.value}
					oninput={onchange}
				/>{:else}<select
					aria-label="Destination"
					class="select mt-1 w-full"
					bind:value={link.target.value}
					onchange={destinationChanged}
					><option value="">Choose a destination…</option
					>{#each options as option (option.value)}<option value={option.value}
							>{option.label}</option
						>{/each}</select
				>{/if}</label
		>
		<label class="flex items-center gap-2 self-end pb-3 text-xs"
			><input
				class="checkbox checkbox-sm"
				type="checkbox"
				bind:checked={link.visible}
				{onchange}
			/>Visible</label
		>
	</div>
</div>

<style>
	#menu-link-editor {
		container-type: inline-size;
		min-width: 0;
	}
	.fields > label {
		min-width: 0;
	}
	@container (min-width: 640px) {
		.fields {
			grid-template-columns: minmax(0, 1fr) 150px minmax(0, 1fr) auto;
		}
	}
</style>
