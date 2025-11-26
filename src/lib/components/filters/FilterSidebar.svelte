<script lang="ts">
	import type { Edition, FilterState } from '$lib/types/collection';

	interface FilterCategoryDef {
		key: keyof FilterState;
		label: string;
	}

	interface Props {
		editions: Edition[];
		filters: FilterState;
		onFilterChange: (filters: FilterState) => void;
	}

	let { editions, filters, onFilterChange }: Props = $props();

	// Category definitions
	const categories: FilterCategoryDef[] = [
		{ key: 'dcSubject', label: 'Subject' },
		{ key: 'dcCoveragePeriod', label: 'Time Period' },
		{ key: 'dcAudience', label: 'Audience' },
		{ key: 'dcLanguage', label: 'Language' },
		{ key: 'dcCoverageCountry', label: 'Country' }
	];

	// Track collapsed state for each category
	let collapsedCategories = $state<Record<string, boolean>>({});

	// Extract unique values for each category with counts
	const categoryOptions = $derived.by(() => {
		const options: Record<keyof FilterState, Map<string, number>> = {
			dcSubject: new Map(),
			dcAudience: new Map(),
			dcLanguage: new Map(),
			dcCoverageCountry: new Map(),
			dcCoveragePeriod: new Map()
		};

		editions.forEach((edition) => {
			for (const key of Object.keys(options) as (keyof FilterState)[]) {
				const values = edition[key];
				if (Array.isArray(values)) {
					values.forEach((value) => {
						if (value && typeof value === 'string' && value.trim()) {
							const current = options[key].get(value) || 0;
							options[key].set(value, current + 1);
						}
					});
				}
			}
		});

		// Sort each category alphabetically
		const sorted: Record<keyof FilterState, Array<{ value: string; count: number }>> = {
			dcSubject: [],
			dcAudience: [],
			dcLanguage: [],
			dcCoverageCountry: [],
			dcCoveragePeriod: []
		};

		for (const key of Object.keys(options) as (keyof FilterState)[]) {
			sorted[key] = Array.from(options[key].entries())
				.map(([value, count]) => ({ value, count }))
				.sort((a, b) => a.value.localeCompare(b.value));
		}

		return sorted;
	});

	// Count total active filters
	const activeFilterCount = $derived(
		Object.values(filters).reduce((sum, arr) => sum + arr.length, 0)
	);

	// Check if any category has options
	const hasAnyFilters = $derived(
		Object.values(categoryOptions).some((options) => options.length > 0)
	);

	function toggleFilter(category: keyof FilterState, value: string) {
		const currentValues = filters[category];
		const newValues = currentValues.includes(value)
			? currentValues.filter((v) => v !== value)
			: [...currentValues, value];

		onFilterChange({
			...filters,
			[category]: newValues
		});
	}

	function clearCategory(category: keyof FilterState) {
		onFilterChange({
			...filters,
			[category]: []
		});
	}

	function clearAllFilters() {
		onFilterChange({
			dcSubject: [],
			dcAudience: [],
			dcLanguage: [],
			dcCoverageCountry: [],
			dcCoveragePeriod: []
		});
	}

	function toggleCategory(category: string) {
		collapsedCategories[category] = !collapsedCategories[category];
	}
</script>

<aside class="w-full">
	<!-- Header with clear all -->
	<div class="flex items-center justify-between mb-4 pb-2 border-b border-base-300">
		<h2 class="font-semibold text-lg">Filters</h2>
		{#if activeFilterCount > 0}
			<button class="btn btn-ghost btn-xs text-error" onclick={clearAllFilters}>
				Clear all ({activeFilterCount})
			</button>
		{/if}
	</div>

	{#if !hasAnyFilters}
		<p class="text-sm text-base-content/60 italic">No filter options available</p>
	{:else}
		<div class="space-y-2">
			{#each categories as category (category.key)}
				{@const options = categoryOptions[category.key]}
				{@const selectedCount = filters[category.key].length}
				{@const isCollapsed = collapsedCategories[category.key]}

				{#if options.length > 0}
					<div class="border border-base-300 rounded-lg overflow-hidden">
						<!-- Category header -->
						<div class="flex items-center justify-between p-3 hover:bg-base-200 transition-colors">
							<button
								class="flex items-center gap-2 flex-1 text-left"
								onclick={() => toggleCategory(category.key)}
							>
								<svg
									class="w-4 h-4 transition-transform {isCollapsed ? '' : 'rotate-90'}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 5l7 7-7 7"
									/>
								</svg>
								<span class="font-medium">{category.label}</span>
								{#if selectedCount > 0}
									<span class="badge badge-primary badge-sm">{selectedCount}</span>
								{/if}
							</button>
							{#if selectedCount > 0}
								<button
									class="btn btn-ghost btn-xs"
									onclick={() => clearCategory(category.key)}
								>
									Clear
								</button>
							{/if}
						</div>

						<!-- Options list -->
						{#if !isCollapsed}
							<div class="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
								{#each options as option (option.value)}
									{@const isSelected = filters[category.key].includes(option.value)}
									<label
										class="flex items-center gap-2 cursor-pointer hover:bg-base-200 rounded px-2 py-1.5 transition-colors"
									>
										<input
											type="checkbox"
											class="checkbox checkbox-sm checkbox-primary"
											checked={isSelected}
											onchange={() => toggleFilter(category.key, option.value)}
										/>
										<span class="flex-1 text-sm truncate" title={option.value}>
											{option.value}
										</span>
										<span class="text-xs text-base-content/50">({option.count})</span>
									</label>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</aside>
