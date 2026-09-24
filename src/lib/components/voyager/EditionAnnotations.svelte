<script lang="ts">
	import MapPinIcon from '~icons/lucide/map-pin';
	import MessageCircleIcon from '~icons/lucide/message-circle';
	import { filterAnnotations, normalizeEditionContent } from './edition-content';

	interface Props {
		annotations: unknown[];
		language: string;
		activeCategories: string[];
		onCategories: (categories: string[]) => void;
		onAnnotation: (id: string) => void;
	}

	let { annotations, language, activeCategories, onCategories, onAnnotation }: Props = $props();
	let expanded = $state(false);
	const items = $derived(normalizeEditionContent(annotations, language, 'annotation'));
	const categories = $derived([...new Set(items.flatMap((item) => item.tags))]);
	const allSelected = $derived(
		categories.length > 0 && categories.every((category) => activeCategories.includes(category))
	);
	const filtered = $derived(filterAnnotations(items, activeCategories));
	const visibleItems = $derived(expanded ? filtered : filtered.slice(0, 4));

	$effect(() => {
		void activeCategories;
		expanded = false;
	});

	function toggleCategory(category: string) {
		const selected = activeCategories.includes(category);
		onCategories(
			selected
				? activeCategories.filter((item) => item !== category)
				: [...activeCategories, category]
		);
	}
</script>

<section id="edition-annotations" aria-label="Explore edition details">
	<header>
		<strong
			><MessageCircleIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Explore details</strong
		>
		{#if items.length}<span>{items.length} {items.length === 1 ? 'annotation' : 'annotations'}</span
			>{/if}
	</header>

	{#if categories.length}
		<div class="categories" role="group" aria-label="Annotation categories">
			{#each categories as category (category)}
				<button
					type="button"
					aria-pressed={activeCategories.includes(category)}
					onclick={() => toggleCategory(category)}
				>
					{category}
				</button>
			{/each}
			<button
				type="button"
				aria-pressed={allSelected}
				onclick={() => onCategories(allSelected ? [] : categories)}
			>
				All annotations
			</button>
		</div>
	{/if}

	<div class="annotations">
		{#each visibleItems as item (item.id)}
			<button type="button" onclick={() => onAnnotation(item.id)}>
				<MapPinIcon aria-hidden="true" />
				<span>{item.title}</span>
			</button>
		{/each}
	</div>

	{#if filtered.length > 4}
		<button
			type="button"
			class="more"
			aria-expanded={expanded}
			onclick={() => (expanded = !expanded)}
		>
			{expanded ? 'Show less' : `Show all (${filtered.length})`}
		</button>
	{/if}
</section>

<style>
	#edition-annotations {
		padding: 0.25rem 0.25rem 0;
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
		font-size: 0.8125rem;
	}
	header span {
		color: color-mix(in oklch, var(--color-base-content) 55%, transparent);
		font-size: 0.6875rem;
	}
	header strong {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
	.categories {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	button {
		cursor: pointer;
	}
	.categories button {
		min-height: 2.25rem;
		border: 1px solid var(--color-base-300);
		border-radius: 0.375rem;
		padding: 0.375rem 0.625rem;
		font-size: 0.75rem;
		text-align: left;
		overflow-wrap: anywhere;
	}
	.categories button[aria-pressed='true'] {
		border-color: var(--color-primary);
		background: var(--color-primary);
		color: var(--color-primary-content);
	}
	.annotations {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.annotations button {
		display: flex;
		min-width: 0;
		min-height: 3rem;
		align-items: center;
		gap: 0.625rem;
		border: 1px solid var(--color-base-300);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		text-align: left;
		font-size: 0.8125rem;
	}
	.annotations button:hover {
		border-color: color-mix(in oklch, var(--color-base-content) 25%, var(--color-base-300));
		background: var(--color-base-200);
	}
	.annotations :global(svg) {
		flex: none;
		width: 1rem;
		color: color-mix(in oklch, var(--color-base-content) 55%, transparent);
	}
	.annotations span {
		overflow-wrap: anywhere;
	}
	.more {
		display: block;
		min-height: 2.25rem;
		margin: 0.25rem 0 0 auto;
		font-size: 0.75rem;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}
	@media (max-width: 600px) {
		.annotations {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
