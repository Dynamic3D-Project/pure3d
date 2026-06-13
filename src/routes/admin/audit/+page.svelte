<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import FloatingSelect from '$lib/components/ui/FloatingSelect.svelte';
	import toast from 'svelte-french-toast';

	interface AuditEntry {
		id: string;
		action: string;
		targetType: string;
		targetId: string;
		performedBy: string;
		details: Record<string, unknown>;
		created: string;
	}

	let entries = $state<AuditEntry[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let filterAction = $state('');
	let filterTargetType = $state('');
	let currentPage = $state(1);
	let totalPages = $state(1);
	const perPage = 50;
	let filteredEntries = $derived(
		entries.filter((entry) => {
			const query = searchQuery.toLowerCase();
			return (
				!query ||
				entry.performedBy.toLowerCase().includes(query) ||
				entry.targetId.toLowerCase().includes(query) ||
				formatDetails(entry.details).toLowerCase().includes(query)
			);
		})
	);
	let hasActiveFilters = $derived(Boolean(searchQuery || filterAction || filterTargetType));

	const actionLabels: Record<string, string> = {
		role_change: 'Role Change',
		status_transition: 'Status Transition',
		user_assigned: 'User Assigned',
		user_removed: 'User Removed',
		user_deleted: 'User Deleted',
		doc_created: 'Doc Created',
		doc_updated: 'Doc Updated',
		doc_deleted: 'Doc Deleted'
	};

	const actionBadgeClass: Record<string, string> = {
		role_change: 'badge-info',
		status_transition: 'badge-warning',
		user_assigned: 'badge-success',
		user_removed: 'badge-error',
		user_deleted: 'badge-error',
		doc_created: 'badge-success',
		doc_updated: 'badge-info',
		doc_deleted: 'badge-error'
	};

	const actionOptions = [
		'role_change',
		'status_transition',
		'user_assigned',
		'user_removed',
		'user_deleted',
		'doc_created',
		'doc_updated',
		'doc_deleted'
	];

	const filterActionOptions = [
		{ value: '', label: 'All actions' },
		...actionOptions.map((action) => ({ value: action, label: actionLabels[action] }))
	];
	const targetTypeOptions = [
		{ value: '', label: 'All targets' },
		{ value: 'collection', label: 'Collections' },
		{ value: 'edition', label: 'Editions' },
		{ value: 'documentation', label: 'Documentation' },
		{ value: 'user', label: 'Users' }
	];

	onMount(() => {
		loadEntries();
	});

	async function loadEntries() {
		isLoading = true;
		try {
			const filters = [];
			if (filterAction) filters.push(`action = "${filterAction}"`);
			if (filterTargetType) filters.push(`targetType = "${filterTargetType}"`);
			const result = await pb.collection('auditLog').getList(currentPage, perPage, {
				sort: '-created',
				filter: filters.join(' && ')
			});
			entries = result.items.map((r) => ({
				id: r.id,
				action: r.action,
				targetType: r.targetType,
				targetId: r.targetId,
				performedBy: r.performedBy,
				details: (r.details as Record<string, unknown>) || {},
				created: r.created
			}));
			totalPages = result.totalPages;
		} catch (error) {
			console.error('Error loading audit log:', error);
			toast.error('Failed to load audit log');
		} finally {
			isLoading = false;
		}
	}

	function applyFilter() {
		currentPage = 1;
		loadEntries();
	}

	function goToPage(page: number) {
		currentPage = page;
		loadEntries();
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '—';
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleString();
	}

	function formatDetails(details: Record<string, unknown>): string {
		if (!details || Object.keys(details).length === 0) return '—';
		return Object.entries(details)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');
	}
</script>

<div id="admin-audit-page" class="mx-auto max-w-6xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Audit Log</h1>
		<p class="mt-2 text-base-content/60">Track all administrative actions.</p>
	</div>

	<div class="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div>
				<h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/70">Filters</h2>
				<p class="text-xs text-base-content/50">Inspect activity by action, target, or performer.</p>
			</div>
			{#if hasActiveFilters}
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					onclick={() => {
						searchQuery = '';
						filterAction = '';
						filterTargetType = '';
						applyFilter();
					}}
				>
					Clear
				</button>
			{/if}
		</div>
		<div class="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_13rem_13rem]">
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Search</span></span>
				<input
					type="text"
					placeholder="Performer, target ID, or details..."
					class="input input-bordered w-full bg-base-200/40"
					bind:value={searchQuery}
				/>
			</label>
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Action</span></span>
				<FloatingSelect
					id="filter-action"
					value={filterAction}
					options={filterActionOptions}
					class="w-full bg-base-200/40"
					onchange={(action) => {
						filterAction = action;
						applyFilter();
					}}
				/>
			</label>
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Target</span></span>
				<FloatingSelect
					id="filter-target"
					value={filterTargetType}
					options={targetTypeOptions}
					class="w-full bg-base-200/40"
					onchange={(targetType) => {
						filterTargetType = targetType;
						applyFilter();
					}}
				/>
			</label>
		</div>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else}
		<!-- Desktop table -->
		<div
			class="hidden overflow-x-auto rounded-lg border border-base-300 bg-base-100 shadow-md md:block"
		>
			<table class="table table-sm">
				<thead>
					<tr>
						<th>Timestamp</th>
						<th>Action</th>
						<th>Target</th>
						<th>Performed By</th>
						<th>Details</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredEntries as entry (entry.id)}
						<tr>
							<td class="text-sm whitespace-nowrap">{formatDate(entry.created)}</td>
							<td>
								<span class="badge badge-sm {actionBadgeClass[entry.action] || 'badge-ghost'}">
									{actionLabels[entry.action] || entry.action}
								</span>
							</td>
							<td>
								<span class="text-sm">
									{entry.targetType}
									<span class="font-mono text-xs text-base-content/50">
										{entry.targetId.slice(0, 8)}...
									</span>
								</span>
							</td>
							<td class="text-sm">{entry.performedBy}</td>
							<td class="max-w-xs truncate text-sm text-base-content/70">
								{formatDetails(entry.details)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile cards -->
		<div class="flex flex-col gap-3 md:hidden">
			{#each filteredEntries as entry (entry.id)}
				<div class="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
					<div class="mb-2 flex items-center justify-between">
						<span class="badge badge-sm {actionBadgeClass[entry.action] || 'badge-ghost'}">
							{actionLabels[entry.action] || entry.action}
						</span>
						<span class="text-xs text-base-content/50">{formatDate(entry.created)}</span>
					</div>
					<div class="text-sm">
						<span class="font-medium">{entry.targetType}</span>
						<span class="font-mono text-xs text-base-content/50"
							>{entry.targetId.slice(0, 8)}...</span
						>
					</div>
					<div class="mt-1 text-sm text-base-content/70">{entry.performedBy}</div>
					{#if formatDetails(entry.details) !== '—'}
						<div class="mt-1 text-xs text-base-content/50">{formatDetails(entry.details)}</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if filteredEntries.length === 0}
			<div class="py-8 text-center text-base-content/60">
				{#if hasActiveFilters}
					No entries match the selected filters.
				{:else}
					No audit entries yet.
				{/if}
			</div>
		{/if}

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="mt-4 flex justify-center">
				<div class="join">
					<button
						class="btn join-item btn-sm"
						disabled={currentPage <= 1}
						onclick={() => goToPage(currentPage - 1)}
					>
						Previous
					</button>
					<button class="btn join-item btn-sm">
						Page {currentPage} of {totalPages}
					</button>
					<button
						class="btn join-item btn-sm"
						disabled={currentPage >= totalPages}
						onclick={() => goToPage(currentPage + 1)}
					>
						Next
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>
