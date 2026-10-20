<script lang="ts">
	import { onMount, tick } from 'svelte';
	import FloatingDropdown from '$lib/components/ui/FloatingDropdown.svelte';
	import {
		applyPalette,
		isPalette,
		paletteFields,
		palettes,
		type Palette,
		type PaletteKey
	} from './palettes';

	let { class: className = '' }: { class?: string } = $props();
	let open = $state(false);
	let buttonElement: HTMLButtonElement | undefined = $state();
	let panel: HTMLDivElement | undefined = $state();
	let colors = $state<Palette>({ ...palettes[0].colors });
	let selected = $state('pure3d');
	let darkHero = $state(true);
	let storageError = $state('');
	const storageKey = 'pure3d-palette';

	function save() {
		applyPalette(colors, darkHero);
		try {
			localStorage.setItem(storageKey, JSON.stringify({ selected, colors, darkHero }));
			storageError = '';
		} catch {
			storageError = 'Colors applied, but this browser could not save them.';
		}
	}

	function choose(id: string) {
		const preset = palettes.find((item) => item.id === id);
		if (!preset) return;
		selected = id;
		colors = { ...preset.colors };
		save();
	}

	function edit(key: PaletteKey, value: string) {
		if (!/^#[0-9a-f]{6}$/i.test(value)) return;
		colors = { ...colors, [key]: value };
		selected = 'custom';
		save();
	}

	function close() {
		open = false;
		buttonElement?.focus();
	}

	async function toggle() {
		open = !open;
		if (open) {
			await tick();
			panel?.querySelector<HTMLButtonElement>('button')?.focus();
		}
	}

	onMount(() => {
		try {
			const stored = localStorage.getItem(storageKey);
			if (!stored) return;
			const saved = JSON.parse(stored);
			if (!isPalette(saved?.colors)) return;
			colors = saved.colors;
			darkHero = saved.darkHero !== false;
			selected = palettes.some((item) => item.id === saved.selected) ? saved.selected : 'custom';
			applyPalette(colors, darkHero);
		} catch {
			// Invalid or unavailable browser storage must not prevent the site from loading.
		}
	});
</script>

<div id="theme-change" class={className}>
	<button
		bind:this={buttonElement}
		type="button"
		class="btn btn-ghost btn-sm"
		aria-label="Edit theme palette"
		aria-expanded={open}
		aria-controls="palette-editor"
		onclick={toggle}
		title="Theme palette"
	>
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			aria-hidden="true"
			><path
				d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6h2a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"
			/><circle cx="7.5" cy="10" r=".8" /><circle cx="11" cy="6.8" r=".8" /><circle
				cx="16"
				cy="8"
				r=".8"
			/><circle cx="6.8" cy="14.5" r=".8" /></svg
		>
	</button>
	<FloatingDropdown
		{open}
		referenceElement={buttonElement}
		bind:element={panel}
		placement="bottom-end"
		minWidth={760}
		maxWidth={760}
		maxHeight={680}
		onclose={close}
	>
		<section id="palette-editor" class="p-4" aria-label="Theme palette">
			<div class="mb-1 flex items-center justify-between gap-3">
				<h2 class="font-serif text-xl">Theme palette</h2>
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					onclick={close}
					aria-label="Close palette editor">✕</button
				>
			</div>
			<p class="mb-4 text-xs opacity-70">Live across the site · saved in this browser only</p>
			<div class="palette-columns">
				<div>
					<div class="mb-3 flex items-center justify-between text-xs opacity-70">
						<span>{palettes.length} palettes</span><span>Scroll to explore</span>
					</div>
					<div
						class="preset-scroll grid grid-cols-2 content-start gap-2"
						role="region"
						tabindex="0"
						aria-label="Palette presets"
					>
						{#each palettes as preset (preset.id)}
							<button
								type="button"
								class="preset"
								style:background={preset.colors.background}
								style:color={preset.colors.text}
								aria-pressed={selected === preset.id}
								onclick={() => choose(preset.id)}
							>
								<span class="flex items-center justify-between gap-1"
									><span>{preset.name}</span><span aria-hidden="true"
										>{selected === preset.id ? '✓' : ''}</span
									></span
								>
								<span class="mt-2 flex gap-1" aria-hidden="true"
									>{#each ['primary', 'secondary', 'accent', 'surfaceAlt'] as key}<span
											class="h-2 flex-1 rounded-sm"
											style:background={preset.colors[key as PaletteKey]}
										></span>{/each}</span
								>
							</button>
						{/each}
					</div>
				</div>
				<div>
					<div class="mb-2 flex items-center justify-between">
						<h3 class="text-sm font-semibold">
							{selected === 'custom' ? 'Custom palette' : 'Edit palette'}
						</h3>
						<button type="button" class="btn btn-ghost btn-xs" onclick={() => choose('pure3d')}
							>Reset original</button
						>
					</div>
					<div class="mt-2 grid gap-1">
						{#each paletteFields as [key, label] (key)}
							<div class="flex items-center gap-2">
								<label for={`palette-${key}`} class="flex-1 text-sm">{label}</label>
								<input
									id={`palette-${key}`}
									type="color"
									value={colors[key]}
									oninput={(event) => edit(key, event.currentTarget.value)}
									class="h-8 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
								/>
								<input
									aria-label={`${label} hex color`}
									class="input input-sm w-24 font-mono text-xs"
									value={colors[key]}
									maxlength="7"
									pattern="#[0-9a-fA-F]{6}"
									onchange={(event) => {
										edit(key, event.currentTarget.value);
										event.currentTarget.value = colors[key];
									}}
								/>
							</div>
						{/each}
					</div>
					<label class="mt-4 flex cursor-pointer items-center justify-between gap-3 text-sm">
						<span
							>Keep hero dark<span class="mt-1 block text-xs opacity-70"
								>Light text and particles, regardless of palette.</span
							></span
						>
						<input
							type="checkbox"
							class="toggle toggle-primary toggle-sm"
							checked={darkHero}
							onchange={(event) => {
								darkHero = event.currentTarget.checked;
								save();
							}}
						/>
					</label>
					<p class="mt-3 text-xs opacity-70">
						Text and button colors adjust automatically when needed for readable contrast.
					</p>
					{#if storageError}<p role="status" class="mt-2 text-xs">{storageError}</p>{/if}
					<button type="button" class="btn mt-4 w-full btn-sm btn-primary" onclick={close}
						>Done</button
					>
				</div>
			</div>
		</section>
	</FloatingDropdown>
</div>

<style>
	.preset-scroll {
		max-height: min(500px, calc(100dvh - 200px));
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
		padding: 4px;
		margin: -4px;
	}
	.palette-columns {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 24px;
	}
	@media (max-width: 799px) {
		.preset-scroll {
			max-height: 280px;
		}
		.palette-columns {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.preset {
		padding: 10px 12px;
		border-radius: var(--radius-control);
		text-align: left;
		font-size: 12px;
		font-weight: 600;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 15%, transparent);
	}
	.preset[aria-pressed='true'] {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}
	.preset:focus-visible {
		outline: 2px solid var(--color-base-content);
		outline-offset: 2px;
	}
</style>
