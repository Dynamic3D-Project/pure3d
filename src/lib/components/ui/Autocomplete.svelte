<script lang="ts">
	import { onMount } from 'svelte';
	let searchValue = $state('');
	type PostOption = { title: string };
	let options: string[] = [];
	let filteredOptions = $state<string[]>([]);
	let selectedIndex = $state(-1);
	let showDropdown = $state(false);
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	function handleInput(event: Event) {
		searchValue = (event.currentTarget as HTMLInputElement).value;
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			fetchOptions(searchValue);
		}, 500);
	}

	async function fetchOptions(searchTerm: string) {
		try {
			const response = await fetch(`https://jsonplaceholder.typicode.com/posts?q=${searchTerm}`);
			const data = (await response.json()) as PostOption[];
			options = data.map((post) => post.title);
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
					searchValue = filteredOptions[selectedIndex] ?? searchValue;
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
			class="input w-full rounded-md border-2 border-base-300"
			type="text"
			bind:value={searchValue}
			oninput={handleInput}
			onkeydown={handleKeyDown}
			placeholder="Search..."
		/>
	</div>

	{#if showDropdown}
		{#if searchValue}
			<ul class="max-h-60 overflow-auto bg-base-200">
				{#each filteredOptions as option, i}
					<li
						class="p-3 hover:bg-secondary hover:text-secondary-content"
						class:bg-secondary={i === selectedIndex}
						class:text-secondary-content={i === selectedIndex}
					>
						{option}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
