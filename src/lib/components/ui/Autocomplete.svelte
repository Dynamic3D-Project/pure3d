<script lang="ts">
	import { onMount } from 'svelte';
	import FloatingDropdown from '$lib/components/ui/FloatingDropdown.svelte';

	let searchValue = $state('');
	let options: string[] = [];
	let filteredOptions = $state<string[]>([]);
	let selectedIndex = $state(-1);
	let showDropdown = $state(false);
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let inputElement: HTMLInputElement | undefined = $state();

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchValue = target.value;
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			fetchOptions(searchValue);
		}, 500);
	}

	async function fetchOptions(searchTerm: string) {
		try {
			const response = await fetch(`https://jsonplaceholder.typicode.com/posts?q=${searchTerm}`);
			const data = await response.json();
			options = data.map((post: { title: string }) => post.title);
			filteredOptions = options.filter((option) =>
				option.toLowerCase().includes(searchValue.toLowerCase())
			);
			selectedIndex = -1;
			showDropdown = true;
		} catch (error) {
			console.error(error);
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				if (selectedIndex < filteredOptions.length - 1) {
					selectedIndex++;
				}
				break;
			case 'ArrowUp':
				if (selectedIndex > 0) {
					selectedIndex--;
				}
				break;
			case 'Enter':
				if (selectedIndex !== -1) {
					searchValue = filteredOptions[selectedIndex];
				}
				showDropdown = false;
				break;
			case 'Escape':
				showDropdown = false;
				break;
			default:
				break;
		}
	}

	onMount(() => {
		fetchOptions('');
	});
</script>

<div>
	<div class="mb-4 text-sm">
		Input search with auto complete, defer and keyboard navigatio (WIP).
	</div>
	<div class="relative">
		<input
			bind:this={inputElement}
			class="input w-full rounded-md border-2 border-base-300"
			type="text"
			bind:value={searchValue}
			oninput={handleInput}
			onkeydown={handleKeyDown}
			placeholder="Search..."
		/>
	</div>

	<FloatingDropdown
		open={showDropdown && !!searchValue}
		referenceElement={inputElement}
		role="listbox"
		maxHeight={240}
		onclose={() => (showDropdown = false)}
	>
		{#each filteredOptions as option, i}
			<button
				type="button"
				class="block w-full p-3 text-left text-base-content hover:bg-base-200 hover:text-base-content"
				class:bg-base-200={i === selectedIndex}
				onclick={() => {
					searchValue = option;
					showDropdown = false;
				}}
			>
				{option}
			</button>
		{/each}
	</FloatingDropdown>
</div>
