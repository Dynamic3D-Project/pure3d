<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
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
	let filterAction = $state('');
	let currentPage = $state(1);
	let totalPages = $state(1);
	const perPage = 50;

	const actionLabels: Record<string, string> = {
		role_change: 'Role Change',
		status_transition: 'Status Transition',
		user_assigned: 'User Assigned',
		user_removed: 'User Removed'
	};

	const actionBadgeClass: Record<string, string> = {
		role_change: 'badge-info',
		status_transition: 'badge-warning',
		user_assigned: 'badge-success',
		user_removed: 'badge-error'
	};

	const actionOptions = ['role_change', 'status_transition', 'user_assigned', 'user_removed'];

	onMount(() => {
		loadEntries();
	});

	async function loadEntries() {
		isLoading = true;
		try {
			const filter = filterAction ? `action = "${filterAction}"` : '';
			const result = await pb.collection('auditLog').getList(currentPage, perPage, {
				sort: '-created',
				filter
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
		return new Date(dateStr).toLocaleString();
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

	<!-- Filter -->
	<div class="mb-6 flex items-end gap-3">
		<div class="form-control">
			<label class="label" for="filter-action">
				<span class="label-text">Filter by action</span>
			</label>
			<select
				id="filter-action"
				class="select-bordered select w-48 select-sm"
				bind:value={filterAction}
				onchange={applyFilter}
			>
				<option value="">All actions</option>
				{#each actionOptions as action (action)}
					<option value={action}>{actionLabels[action]}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100 shadow-md">
			<table class="table">
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
					{#each entries as entry (entry.id)}
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

			{#if entries.length === 0}
				<div class="py-8 text-center text-base-content/60">
					{#if filterAction}
						No entries for "{actionLabels[filterAction]}".
					{:else}
						No audit entries yet.
					{/if}
				</div>
			{/if}
		</div>

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
