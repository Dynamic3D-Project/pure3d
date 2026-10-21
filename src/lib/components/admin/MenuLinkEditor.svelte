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
	const instanceId = $props.id();
	let query = $state('');
	let open = $state(false);
	let highlighted = $state(0);
	let resultsElement: HTMLDivElement;
	let filteredOptions = $derived(
		options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
	);
	let selectedOption = $derived(options.find((option) => option.value === link.target.value));
	function closeSearch() {
		open = false;
		query = '';
		highlighted = 0;
	}
	function typeChanged(event: Event) {
		closeSearch();
		link.target = {
			type: (event.currentTarget as HTMLSelectElement).value as TargetType,
			value: ''
		};
		onchange();
	}
	function selectDestination(value: string) {
		const option = options.find((o) => o.value === value);
		link.target.value = value;
		if (option && (link.label === 'New link' || !link.label.trim()))
			link.label = String('rawLabel' in option ? option.rawLabel : option.label);
		closeSearch();
		onchange();
	}
	function searchKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			event.stopPropagation();
			closeSearch();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!open) {
				open = true;
				highlighted = 0;
			} else {
				highlighted = Math.max(
					0,
					Math.min(filteredOptions.length - 1, highlighted + (event.key === 'ArrowDown' ? 1 : -1))
				);
			}
			resultsElement?.children[highlighted]?.scrollIntoView({ block: 'nearest' });
		} else if (event.key === 'Enter' && open) {
			event.preventDefault();
			const option = filteredOptions[highlighted];
			if (option) selectDestination(option.value);
		} else if (event.key === 'Tab') closeSearch();
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
		<div class="destination-field text-xs">
			<label for={`${instanceId}-destination`}>Destination</label>
			{#if link.target.type === 'external'}<input
					id={`${instanceId}-destination`}
					aria-label="Destination"
					class="input mt-1 w-full"
					placeholder="https://…"
					bind:value={link.target.value}
					oninput={onchange}
				/>{:else}<input
					id={`${instanceId}-destination`}
					aria-label="Destination"
					class="input mt-1 w-full"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={open}
					aria-controls={`${instanceId}-destinations`}
					aria-activedescendant={open && filteredOptions[highlighted]
						? `${instanceId}-option-${highlighted}`
						: undefined}
					autocomplete="off"
					placeholder={open ? 'Search destinations…' : 'Choose a destination…'}
					value={open ? query : (selectedOption?.label ?? '')}
					onfocus={() => (open = true)}
					onclick={() => (open = true)}
					oninput={(event) => {
						query = event.currentTarget.value;
						open = true;
						highlighted = 0;
					}}
					onblur={closeSearch}
					onkeydown={searchKeydown}
				/>
				{#if open}
					<div
						class="destination-results"
						role="listbox"
						aria-label="Destinations"
						id={`${instanceId}-destinations`}
						bind:this={resultsElement}
					>
						{#each filteredOptions as option, index (option.value)}
							<button
								type="button"
								role="option"
								id={`${instanceId}-option-${index}`}
								aria-selected={link.target.value === option.value}
								class:highlighted={highlighted === index}
								tabindex="-1"
								onmousedown={(event) => event.preventDefault()}
								onclick={() => selectDestination(option.value)}
							>
								{option.label}
							</button>
						{:else}
							<p class="p-3 text-sm text-base-content/60" role="status">No destinations found.</p>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
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
	.destination-field {
		position: relative;
		min-width: 0;
	}
	.destination-results {
		position: absolute;
		z-index: 20;
		top: 100%;
		left: 0;
		width: 100%;
		max-height: 240px;
		overflow-y: auto;
		margin-top: 4px;
		padding: 4px;
		border: 1px solid var(--color-base-300);
		border-radius: var(--radius-field, 0.5rem);
		background: var(--color-base-100);
		box-shadow: 0 8px 20px #0002;
	}
	.destination-results button {
		display: block;
		width: 100%;
		padding: 8px;
		text-align: left;
		font-size: 0.875rem;
		white-space: normal;
		overflow-wrap: anywhere;
		border: 0;
		background: transparent;
	}
	.destination-results button:hover,
	.destination-results button.highlighted {
		background: var(--color-base-200);
	}
	@container (min-width: 640px) {
		.fields {
			grid-template-columns: minmax(0, 1fr) 150px minmax(0, 1fr) auto;
		}
	}
</style>
