<script lang="ts">
	import FloatingDropdown from '$lib/components/ui/FloatingDropdown.svelte';

	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		value: string;
		options: Option[];
		id?: string;
		disabled?: boolean;
		class?: string;
		onchange?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		options,
		id,
		disabled = false,
		class: className = 'w-36',
		onchange
	}: Props = $props();

	let open = $state(false);
	let buttonElement: HTMLButtonElement | undefined = $state();
	let highlightedIndex = $state(-1);

	let selectedLabel = $derived(options.find((option) => option.value === value)?.label ?? value);

	function close() {
		open = false;
		highlightedIndex = -1;
	}

	function select(nextValue: string) {
		value = nextValue;
		onchange?.(nextValue);
		close();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (disabled) return;

		if (!open && ['ArrowDown', 'Enter', ' '].includes(event.key)) {
			event.preventDefault();
			open = true;
			highlightedIndex = Math.max(
				0,
				options.findIndex((option) => option.value === value)
			);
			return;
		}

		if (!open) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const option = options[highlightedIndex];
			if (option) select(option.value);
		} else if (event.key === 'Escape' || event.key === 'Tab') {
			close();
		}
	}
</script>

<button
	{id}
	bind:this={buttonElement}
	type="button"
	class="input input-bordered flex items-center justify-between gap-2 bg-base-100 text-left text-base-content {className}"
	aria-haspopup="listbox"
	aria-expanded={open}
	{disabled}
	onclick={() => {
		if (!disabled) open = !open;
	}}
	onkeydown={handleKeydown}
>
	<span class="truncate">{selectedLabel}</span>
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 24 24"
		stroke-width="1.5"
		stroke="currentColor"
		class="size-4 shrink-0 text-base-content/60 transition-transform duration-200"
		class:rotate-180={open}
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
	</svg>
</button>

<FloatingDropdown
	{open}
	referenceElement={buttonElement}
	role="listbox"
	maxHeight={240}
	onclose={close}
>
	{#each options as option, index (option.value)}
		<button
			type="button"
			class="block w-full px-3 py-2 text-left text-sm text-base-content hover:bg-base-200 hover:text-base-content"
			class:bg-base-200={option.value === value || highlightedIndex === index}
			role="option"
			aria-selected={option.value === value}
			onmouseenter={() => (highlightedIndex = index)}
			onclick={() => select(option.value)}
		>
			{option.label}
		</button>
	{/each}
</FloatingDropdown>
