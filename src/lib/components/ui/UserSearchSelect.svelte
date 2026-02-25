<script lang="ts">
	import { onMount } from 'svelte';

	interface User {
		id: string;
		nickname: string;
		email: string;
	}

	interface Props {
		users: User[];
		value: string;
		placeholder?: string;
		id?: string;
	}

	let { users, value = $bindable(''), placeholder = 'Search user...', id = '' }: Props = $props();

	let query = $state('');
	let isOpen = $state(false);
	let highlightedIndex = $state(-1);
	let inputEl: HTMLInputElement | undefined = $state();
	let dropdownEl: HTMLDivElement | undefined = $state();
	let containerEl: HTMLDivElement | undefined = $state();
	let dropdownMaxHeight = $state(240);

	let filtered = $derived(
		query
			? users.filter(
					(u) =>
						u.nickname.toLowerCase().includes(query.toLowerCase()) ||
						u.email.toLowerCase().includes(query.toLowerCase())
				)
			: users
	);

	let selectedUser = $derived(users.find((u) => u.id === value));

	function displayName(user: User): string {
		if (user.nickname && user.email) return `${user.nickname} (${user.email})`;
		return user.nickname || user.email;
	}

	function open() {
		isOpen = true;
		highlightedIndex = -1;
		recalcMaxHeight();
	}

	function close() {
		isOpen = false;
		highlightedIndex = -1;
		query = '';
	}

	function select(user: User) {
		value = user.id;
		close();
	}

	function clear() {
		value = '';
		query = '';
		inputEl?.focus();
	}

	function handleInputFocus() {
		open();
	}

	function handleInput() {
		if (!isOpen) open();
		highlightedIndex = 0;
		recalcMaxHeight();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
			e.preventDefault();
			open();
			return;
		}

		if (!isOpen) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlightedIndex = Math.min(highlightedIndex + 1, filtered.length - 1);
				scrollToHighlighted();
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightedIndex = Math.max(highlightedIndex - 1, 0);
				scrollToHighlighted();
				break;
			case 'Enter':
				e.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
					select(filtered[highlightedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				close();
				break;
			case 'Tab':
				close();
				break;
		}
	}

	function scrollToHighlighted() {
		if (!dropdownEl) return;
		const item = dropdownEl.querySelector(`[data-index="${highlightedIndex}"]`);
		item?.scrollIntoView({ block: 'nearest' });
	}

	function recalcMaxHeight() {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom - 12;
		dropdownMaxHeight = Math.max(Math.min(spaceBelow, 240), 80);
	}

	function handleClickOutside(e: MouseEvent) {
		if (containerEl && !containerEl.contains(e.target as Node)) {
			close();
		}
	}

	function handleScrollOrResize() {
		if (isOpen) recalcMaxHeight();
	}

	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);
		window.addEventListener('scroll', handleScrollOrResize, true);
		window.addEventListener('resize', handleScrollOrResize);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			window.removeEventListener('scroll', handleScrollOrResize, true);
			window.removeEventListener('resize', handleScrollOrResize);
		};
	});
</script>

<div id="user-search-select" class="relative" bind:this={containerEl}>
	{#if selectedUser}
		<div class="input-bordered input input-sm flex w-64 items-center gap-2">
			<span class="flex-1 truncate text-sm">{displayName(selectedUser)}</span>
			<button
				type="button"
				class="btn btn-circle btn-ghost btn-xs"
				onclick={clear}
				aria-label="Clear selection"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="size-3"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{:else}
		<input
			bind:this={inputEl}
			type="text"
			{id}
			class="input-bordered input input-sm w-64"
			{placeholder}
			bind:value={query}
			onfocus={handleInputFocus}
			oninput={handleInput}
			onkeydown={handleKeydown}
			autocomplete="off"
		/>
	{/if}

	{#if isOpen}
		<div
			bind:this={dropdownEl}
			class="absolute top-full left-0 z-50 mt-1 w-full overflow-x-hidden overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg"
			style="max-height: {dropdownMaxHeight}px"
			role="listbox"
		>
			{#if filtered.length === 0}
				<div class="px-3 py-2 text-sm text-base-content/50">No users found</div>
			{:else}
				{#each filtered as user, i (user.id)}
					<button
						type="button"
						class="flex w-full min-w-0 cursor-pointer flex-col px-3 py-2 text-left text-sm hover:bg-base-200"
						class:bg-primary={highlightedIndex === i}
						class:text-primary-content={highlightedIndex === i}
						data-index={i}
						role="option"
						aria-selected={highlightedIndex === i}
						onmouseenter={() => (highlightedIndex = i)}
						onclick={() => select(user)}
					>
						<span class="truncate font-medium">{user.nickname || user.email}</span>
						{#if user.nickname && user.email}
							<span
								class="truncate text-xs {highlightedIndex === i
									? 'opacity-70'
									: 'text-base-content/50'}"
							>
								{user.email}
							</span>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
