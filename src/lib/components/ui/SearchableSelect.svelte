<script lang="ts">
	import FloatingDropdown from './FloatingDropdown.svelte';

	let {
		id,
		options,
		values = $bindable<string[]>([]),
		multiple = true,
		onchange
	}: {
		id: string;
		options: string[];
		values?: string[];
		multiple?: boolean;
		onchange?: (values: string[]) => void;
	} = $props();

	let query = $state('');
	let open = $state(false);
	let active = $state(-1);
	let input: HTMLInputElement | undefined = $state();
	let filtered = $derived(
		options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()))
	);

	function close() {
		open = false;
		query = '';
		active = -1;
	}

	function toggle(option: string) {
		values = multiple
			? values.includes(option)
				? values.filter((value) => value !== option)
				: [...values, option]
			: [option];
		onchange?.(values);
		query = '';
		active = -1;
		if (!multiple) close();
		input?.focus();
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			open = true;
			active = Math.max(
				0,
				Math.min(filtered.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1))
			);
			requestAnimationFrame(() =>
				document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
			);
		} else if (event.key === 'Enter' && open) {
			event.preventDefault();
			const option = filtered[active < 0 ? 0 : active];
			if (option) toggle(option);
		} else if (event.key === 'Escape' || event.key === 'Tab') {
			close();
		}
	}
</script>

<div id={`${id}-searchable-select`} class="min-w-0">
	<input
		{id}
		bind:this={input}
		class="input-bordered input input-sm w-full min-w-0"
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={open}
		aria-controls={`${id}-options`}
		aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
		autocomplete="off"
		placeholder={multiple ? 'Search to select…' : values[0] || 'Search to select…'}
		bind:value={query}
		onclick={() => (open = true)}
		oninput={() => {
			open = true;
			active = -1;
		}}
		onkeydown={keydown}
		onblur={(event) => {
			if (
				!(event.relatedTarget instanceof Node) ||
				!event.currentTarget.parentElement?.contains(event.relatedTarget)
			)
				close();
		}}
	/>
	{#if values.length}
		<div class="mt-2 flex flex-wrap gap-1.5" aria-label="Selected values">
			{#each values as value (value)}
				<button
					type="button"
					class="flex max-w-full items-center gap-2 rounded-md bg-base-300 px-2 py-1 text-left text-xs"
					aria-label={`Remove ${value}`}
					onclick={() => {
						values = values.filter((item) => item !== value);
						onchange?.(values);
					}}
				>
					<span class="break-words">{value}</span><span aria-hidden="true">×</span>
				</button>
			{/each}
		</div>
	{/if}
	<FloatingDropdown {open} referenceElement={input} maxHeight={240} onclose={close}>
		<div
			id={`${id}-options`}
			role="listbox"
			aria-label="Available values"
			aria-multiselectable={multiple}
		>
			{#each filtered as option, index (option)}
				<button
					id={`${id}-option-${index}`}
					type="button"
					role="option"
					tabindex="-1"
					aria-selected={values.includes(option)}
					class="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-base-200"
					class:bg-base-200={active === index}
					onpointerdown={(event) => event.preventDefault()}
					onclick={() => toggle(option)}
				>
					<span>{option}</span><span aria-hidden="true">{values.includes(option) ? '✓' : ''}</span>
				</button>
			{:else}
				<p class="px-3 py-2 text-sm text-base-content/60" role="status">No matches found.</p>
			{/each}
		</div>
	</FloatingDropdown>
</div>
