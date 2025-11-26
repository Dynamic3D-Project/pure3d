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

	// Track collapsed state for each category (all collapsed by default)
	let collapsedCategories = $state<Record<string, boolean>>({
		dcSubject: true,
		dcCoveragePeriod: true,
		dcAudience: true,
		dcLanguage: true,
		dcCoverageCountry: true
	});

	// Normalize a filter value (capitalize first letter of each word, merge duplicates)
	function normalizeValue(value: string): string {
		// Remove language codes like (nld), (eng), (deu) etc.
		let normalized = value.replace(/\s*\([a-z]{2,3}\)\s*$/i, '').trim();
		// Capitalize first letter of each word
		normalized = normalized
			.toLowerCase()
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
		return normalized;
	}

	// Extract unique values for each category with counts (normalized)
	const categoryOptions = $derived.by(() => {
		const options: Record<keyof FilterState, Map<string, { count: number; originalValues: Set<string> }>> = {
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
							const normalized = normalizeValue(value);
							const existing = options[key].get(normalized);
							if (existing) {
								existing.count++;
								existing.originalValues.add(value);
							} else {
								options[key].set(normalized, { count: 1, originalValues: new Set([value]) });
							}
						}
					});
				}
			}
		});

		// Sort each category by count (descending), then alphabetically
		const sorted: Record<keyof FilterState, Array<{ value: string; count: number; originalValues: string[] }>> = {
			dcSubject: [],
			dcAudience: [],
			dcLanguage: [],
			dcCoverageCountry: [],
			dcCoveragePeriod: []
		};

		for (const key of Object.keys(options) as (keyof FilterState)[]) {
			sorted[key] = Array.from(options[key].entries())
				.map(([value, data]) => ({ value, count: data.count, originalValues: Array.from(data.originalValues) }))
				.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
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

	// Check if a normalized value is selected (any of its original values)
	function isValueSelected(category: keyof FilterState, originalValues: string[]): boolean {
		return originalValues.some((v) => filters[category].includes(v));
	}

	function toggleFilter(category: keyof FilterState, originalValues: string[]) {
		const currentValues = filters[category];
		const isSelected = originalValues.some((v) => currentValues.includes(v));

		let newValues: string[];
		if (isSelected) {
			// Remove all original values
			newValues = currentValues.filter((v) => !originalValues.includes(v));
		} else {
			// Add the first original value (they all map to the same normalized value)
			newValues = [...currentValues, originalValues[0]];
		}

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

						<!-- Options list - no fixed height -->
						{#if !isCollapsed}
							<div class="px-3 pb-3 space-y-1">
								{#each options as option (option.value)}
									{@const isSelected = isValueSelected(category.key, option.originalValues)}
									<label
										class="flex items-center gap-2 cursor-pointer hover:bg-base-200 rounded px-2 py-1.5 transition-colors"
									>
										<input
											type="checkbox"
											class="checkbox checkbox-sm checkbox-primary"
											checked={isSelected}
											onchange={() => toggleFilter(category.key, option.originalValues)}
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
