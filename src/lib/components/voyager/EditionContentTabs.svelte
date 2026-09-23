<script lang="ts">
	import {
		filterAnnotations,
		normalizeEditionContent,
		type EditionContentItem
	} from './edition-content';
	import MapPinIcon from '~icons/lucide/map-pin';
	import BookOpenIcon from '~icons/lucide/book-open';
	import MapIcon from '~icons/lucide/map';

	type Tab = 'annotations' | 'stories' | 'tours';

	interface Props {
		annotations: unknown[];
		articles: unknown[];
		tours: unknown[];
		language: string;
		activeCategories: string[];
		onCategories: (categories: string[]) => void;
		onAnnotation: (id: string) => void;
		onArticle: (id: string) => void;
		onTour: (index: number) => void;
	}

	let {
		annotations,
		articles,
		tours,
		language,
		activeCategories,
		onCategories,
		onAnnotation,
		onArticle,
		onTour
	}: Props = $props();
	let activeTab = $state<Tab>(
		annotations.length ? 'annotations' : articles.length ? 'stories' : 'tours'
	);
	let expanded = $state(false);

	const annotationItems = $derived(normalizeEditionContent(annotations, language, 'annotation'));
	const storyItems = $derived(normalizeEditionContent(articles, language, 'story'));
	const tourItems = $derived(normalizeEditionContent(tours, language, 'tour'));
	const tabs = $derived(
		(
			[
				{ id: 'annotations' as const, label: 'Annotations', count: annotationItems.length },
				{ id: 'stories' as const, label: 'Stories', count: storyItems.length },
				{ id: 'tours' as const, label: 'Tours', count: tourItems.length }
			] as const
		).filter((tab) => tab.count > 0)
	);
	const labels = $derived([...new Set(annotationItems.flatMap((annotation) => annotation.tags))]);
	const allCategoriesSelected = $derived(
		labels.length > 0 && labels.every((label) => activeCategories.includes(label))
	);
	const currentItems = $derived.by(() => {
		if (activeTab === 'stories') return storyItems;
		if (activeTab === 'tours') return tourItems;
		return filterAnnotations(annotationItems, activeCategories);
	});
	const visibleItems = $derived(expanded ? currentItems : currentItems.slice(0, 4));
	$effect(() => {
		if (!tabs.some((tab) => tab.id === activeTab)) activeTab = tabs[0]?.id ?? 'annotations';
	});
	$effect(() => {
		void activeCategories;
		expanded = false;
	});

	function selectTab(tab: Tab) {
		activeTab = tab;
		expanded = false;
	}

	function handleTabKeydown(event: KeyboardEvent, index: number) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const nextIndex =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? tabs.length - 1
					: (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
		const nextTab = tabs[nextIndex];
		selectTab(nextTab.id);
		(event.currentTarget as HTMLElement)
			.closest('[role="tablist"]')
			?.querySelector<HTMLElement>(`#edition-content-tab-${nextTab.id}`)
			?.focus();
	}

	function openItem(item: EditionContentItem, index: number) {
		if (activeTab === 'annotations') onAnnotation(item.id);
		else if (activeTab === 'stories') onArticle(item.id);
		else onTour(index);
	}
</script>

<section id="edition-content-tabs" aria-label="Explore this edition">
	<div class="explore-toolbar">
		<div class="explore-tabs" role="tablist" aria-label="Edition content">
			{#each tabs as tab, index (tab.id)}
				<button
					type="button"
					id="edition-content-tab-{tab.id}"
					role="tab"
					aria-selected={activeTab === tab.id}
					aria-controls="edition-content-panel"
					tabindex={activeTab === tab.id ? 0 : -1}
					onclick={() => selectTab(tab.id)}
					onkeydown={(event) => handleTabKeydown(event, index)}
				>
					{tab.label}<span class="explore-count">{tab.count}</span>
				</button>
			{/each}
		</div>
	</div>

	<div
		id="edition-content-panel"
		class="explore-panel"
		role="tabpanel"
		aria-labelledby="edition-content-tab-{activeTab}"
	>
		{#if activeTab === 'annotations' && labels.length}
			<div class="explore-categories" role="group" aria-label="Annotation categories">
				{#each labels as label (label)}
					<button
						type="button"
						aria-pressed={activeCategories.includes(label)}
						onclick={() =>
							onCategories(
								activeCategories.length === 1 && activeCategories[0] === label ? [] : [label]
							)}>{label}</button
					>
				{/each}
				<button
					type="button"
					class="all-categories"
					aria-pressed={allCategoriesSelected}
					onclick={() => onCategories(allCategoriesSelected ? [] : labels)}>All annotations</button
				>
			</div>
		{/if}
		<div class="explore-grid">
			{#each visibleItems as item, index (item.id || `${activeTab}-${index}`)}
				<button type="button" class="explore-item" onclick={() => openItem(item, index)}>
					<span class="explore-icon" aria-hidden="true">
						{#if activeTab === 'annotations'}<MapPinIcon
							/>{:else if activeTab === 'stories'}<BookOpenIcon />{:else}<MapIcon />{/if}
					</span>
					<span>{item.title}</span>
					{#if activeTab === 'tours'}
						<small>{item.steps} {item.steps === 1 ? 'stop' : 'stops'}</small>
					{/if}
				</button>
			{/each}
		</div>

		{#if currentItems.length > 4}
			<button
				type="button"
				class="explore-more"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				{expanded ? 'Show less' : `Show all (${currentItems.length})`}
			</button>
		{/if}
	</div>
</section>

<style>
	#edition-content-tabs {
		margin-top: 0.5rem;
		color: var(--color-base-content);
	}

	button {
		cursor: pointer;
	}

	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}

	.explore-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0 1rem;
		border-bottom: 1px solid var(--color-base-300);
		padding: 0 0.5rem;
	}

	.explore-tabs {
		display: flex;
		gap: 1.25rem;
		min-width: 0;
		overflow-x: auto;
	}

	.explore-tabs button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-height: 44px;
		padding: 0.5rem 0;
		border-bottom: 2px solid transparent;
		font-size: 0.8125rem;
		white-space: nowrap;
		color: color-mix(in oklch, var(--color-base-content) 60%, transparent);
	}

	.explore-tabs button[aria-selected='true'] {
		border-color: var(--color-accent);
		color: var(--color-base-content);
	}

	.explore-count {
		padding: 0.0625rem 0.3125rem;
		border-radius: 0.25rem;
		background: var(--color-base-200);
		color: color-mix(in oklch, var(--color-base-content) 55%, transparent);
		font-size: 0.6875rem;
	}

	.explore-categories {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.625rem;
	}

	.explore-categories button {
		min-height: 36px;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--color-base-300);
		border-radius: 0.375rem;
		background: var(--color-base-200);
		font-size: 0.75rem;
		text-align: left;
		overflow-wrap: anywhere;
	}

	.explore-categories .all-categories {
		background: transparent;
	}

	.explore-categories button[aria-pressed='true'] {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-primary-content);
	}

	.explore-panel {
		padding: 0.75rem 0.25rem 0.125rem;
	}

	.explore-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.explore-item {
		display: flex;
		min-width: 0;
		min-height: 48px;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-base-300);
		border-radius: 0.5rem;
		background: color-mix(in oklch, var(--color-base-200) 25%, transparent);
		font-size: 0.8125rem;
		text-align: left;
		overflow-wrap: anywhere;
	}

	.explore-item:hover {
		background: var(--color-base-200);
		border-color: color-mix(in oklch, var(--color-base-content) 25%, var(--color-base-300));
	}

	.explore-icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 0.375rem;
		background: var(--color-base-200);
		color: color-mix(in oklch, var(--color-base-content) 60%, transparent);
		font-size: 0.875rem;
	}

	.explore-item small {
		margin-left: auto;
		flex-shrink: 0;
		font-size: 0.6875rem;
		color: color-mix(in oklch, var(--color-base-content) 60%, transparent);
	}

	.explore-more {
		display: block;
		margin: 0.25rem 0 0 auto;
		min-height: 36px;
		padding: 0.375rem 0.5rem;
		font-size: 0.75rem;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	@media (max-width: 600px) {
		.explore-tabs {
			gap: 0.5rem;
		}

		.explore-tabs button {
			font-size: 0.75rem;
		}

		.explore-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
