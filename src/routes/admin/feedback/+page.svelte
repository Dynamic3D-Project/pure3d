<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { pb } from '$lib/database/client';
	import FloatingSelect from '$lib/components/ui/FloatingSelect.svelte';
	import toast from 'svelte-french-toast';
	import type { RecordModel } from 'pocketbase';

	interface WorkshopFeedback {
		id: string;
		participantName: string;
		participantEmail: string;
		editionId: string;
		editionTitle: string;
		editionUrl: string;
		category: string;
		severity: string;
		feedbackHtml: string;
		images: string[];
		pageUrl: string;
		browserInfo: Record<string, unknown>;
		status: string;
		created: string;
		record: RecordModel;
	}

	const categoryLabels: Record<string, string> = {
		bug: 'Bug',
		confusing: 'Confusing',
		upload_issue: 'Upload issue',
		viewer_issue: '3D viewer issue',
		metadata_workflow: 'Metadata/workflow',
		missing_feature: 'Missing feature',
		other: 'Other'
	};

	const severityLabels: Record<string, string> = {
		minor: 'Minor',
		important: 'Important',
		blocking: 'Blocking',
		suggestion: 'Suggestion'
	};

	const statusLabels: Record<string, string> = {
		draft: 'Draft',
		submitted: 'Submitted',
		reviewed: 'Reviewed',
		resolved: 'Resolved'
	};

	const statusOptions = [
		{ value: '', label: 'All statuses' },
		{ value: 'submitted', label: 'Submitted' },
		{ value: 'reviewed', label: 'Reviewed' },
		{ value: 'resolved', label: 'Resolved' },
		{ value: 'draft', label: 'Draft' }
	];

	const categoryOptions = [
		{ value: '', label: 'All categories' },
		...Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))
	];

	const severityOptions = [
		{ value: '', label: 'All severities' },
		...Object.entries(severityLabels).map(([value, label]) => ({ value, label }))
	];

	let feedback = $state<WorkshopFeedback[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state('submitted');
	let categoryFilter = $state('');
	let severityFilter = $state('');
	let expandedId = $state<string | null>(null);
	let currentPage = $state(1);
	let totalPages = $state(1);
	const perPage = 50;

	let hasActiveFilters = $derived(Boolean(searchQuery || statusFilter || categoryFilter || severityFilter));

	onMount(() => {
		loadFeedback();
	});

	async function loadFeedback() {
		isLoading = true;
		try {
			const filters = [];
			if (statusFilter) filters.push(`status = "${statusFilter}"`);
			if (categoryFilter) filters.push(`category = "${categoryFilter}"`);
			if (severityFilter) filters.push(`severity = "${severityFilter}"`);

			const result = await pb.collection('workshopFeedback').getList(currentPage, perPage, {
				sort: '-created',
				filter: filters.join(' && '),
				expand: 'edition'
			});

			feedback = result.items.map(mapFeedback);
			totalPages = result.totalPages;
		} catch (error) {
			console.error('Failed to load workshop feedback:', error);
			toast.error('Failed to load workshop feedback');
		} finally {
			isLoading = false;
		}
	}

	function mapFeedback(record: RecordModel): WorkshopFeedback {
		const edition = record.expand?.edition as RecordModel | undefined;
		return {
			id: record.id,
			participantName: record.participantName || 'Anonymous',
			participantEmail: record.participantEmail || '',
			editionId: record.edition || '',
			editionTitle: edition?.title || '',
			editionUrl: record.editionUrl || '',
			category: record.category || 'other',
			severity: record.severity || 'minor',
			feedbackHtml: record.feedbackHtml || '',
			images: Array.isArray(record.images) ? record.images : [],
			pageUrl: record.pageUrl || '',
			browserInfo: (record.browserInfo as Record<string, unknown>) || {},
			status: record.status || 'submitted',
			created: record.created,
			record
		};
	}

	let visibleFeedback = $derived(
		feedback.filter((item) => {
			const query = searchQuery.trim().toLowerCase();
			if (!query) return true;
			return [
				item.participantName,
				item.participantEmail,
				item.editionTitle,
				item.editionUrl,
				item.feedbackHtml,
				categoryLabels[item.category],
				severityLabels[item.severity]
			]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(query));
		})
	);

	function applyFilters() {
		currentPage = 1;
		loadFeedback();
	}

	function clearFilters() {
		searchQuery = '';
		statusFilter = '';
		categoryFilter = '';
		severityFilter = '';
		applyFilters();
	}

	async function updateStatus(item: WorkshopFeedback, status: string) {
		try {
			const updated = await pb.collection('workshopFeedback').update(item.id, { status });
			feedback = feedback.map((entry) => (entry.id === item.id ? mapFeedback(updated) : entry));
			toast.success(`Marked ${statusLabels[status].toLowerCase()}`);
		} catch (error) {
			console.error('Failed to update feedback status:', error);
			toast.error('Failed to update feedback status');
		}
	}

	function formatDate(dateStr: string) {
		const date = new Date(dateStr);
		return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
	}

	function imageUrl(item: WorkshopFeedback, filename: string) {
		return pb.files.getURL(item.record, filename, { thumb: '400x300' });
	}

	function fullImageUrl(item: WorkshopFeedback, filename: string) {
		return pb.files.getURL(item.record, filename);
	}
</script>

<svelte:head>
	<title>Workshop Feedback | Admin | Pure3D</title>
</svelte:head>

<div id="admin-feedback-page" class="mx-auto max-w-6xl">
	<div class="mb-8 flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">Workshop Feedback</h1>
			<p class="mt-2 text-base-content/60">
				Review submitted feedback from workshop participants.
			</p>
		</div>
		<button class="btn btn-outline btn-sm" onclick={loadFeedback} disabled={isLoading}>
			{#if isLoading}<span class="loading loading-spinner loading-xs"></span>{/if}
			Refresh
		</button>
	</div>

	<div class="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div>
				<h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/70">Filters</h2>
				<p class="text-xs text-base-content/50">Find feedback by category, severity, status, or text.</p>
			</div>
			{#if hasActiveFilters}
				<button type="button" class="btn btn-ghost btn-xs" onclick={clearFilters}>Clear</button>
			{/if}
		</div>
		<div class="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_12rem_12rem_12rem]">
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Search</span></span>
				<input
					type="text"
					placeholder="Participant, edition, feedback..."
					class="input input-bordered w-full bg-base-200/40"
					bind:value={searchQuery}
				/>
			</label>
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Status</span></span>
				<FloatingSelect
					id="feedback-status-filter"
					bind:value={statusFilter}
					options={statusOptions}
					class="w-full bg-base-200/40"
					onchange={applyFilters}
				/>
			</label>
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Category</span></span>
				<FloatingSelect
					id="feedback-category-filter"
					bind:value={categoryFilter}
					options={categoryOptions}
					class="w-full bg-base-200/40"
					onchange={applyFilters}
				/>
			</label>
			<label class="form-control">
				<span class="label pb-1 pt-0"><span class="label-text text-xs">Severity</span></span>
				<FloatingSelect
					id="feedback-severity-filter"
					bind:value={severityFilter}
					options={severityOptions}
					class="w-full bg-base-200/40"
					onchange={applyFilters}
				/>
			</label>
		</div>
	</div>

	{#if isLoading}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if feedback.length === 0}
		<p class="py-12 text-center text-base-content/60">No workshop feedback yet.</p>
	{:else if visibleFeedback.length === 0}
		<p class="py-12 text-center text-base-content/60">No feedback matches the current search.</p>
	{:else}
		<div class="space-y-3">
			{#each visibleFeedback as item (item.id)}
				<article class="rounded-box border border-base-300 bg-base-100 shadow-sm">
					<button
						type="button"
						class="flex w-full flex-wrap items-center gap-3 p-4 text-left"
						onclick={() => (expandedId = expandedId === item.id ? null : item.id)}
					>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="font-semibold">{item.participantName}</h2>
								<span class="badge badge-outline">{categoryLabels[item.category] || item.category}</span>
								<span class="badge badge-outline">{severityLabels[item.severity] || item.severity}</span>
								<span class="badge badge-primary badge-outline">
									{statusLabels[item.status] || item.status}
								</span>
							</div>
							<p class="mt-1 truncate text-sm text-base-content/60">
								{item.editionTitle || item.editionUrl || 'No edition linked'}
							</p>
						</div>
						<div class="text-sm text-base-content/50">{formatDate(item.created)}</div>
					</button>

					{#if expandedId === item.id}
						<div class="border-t border-base-300 p-4">
							<div class="mb-4 flex flex-wrap gap-2">
								{#if item.editionId}
									<a class="btn btn-outline btn-xs" href="{base}/editions/{item.editionId}">Open edition</a>
								{/if}
								{#if item.editionUrl}
									<a class="btn btn-outline btn-xs" href={item.editionUrl}>Open submitted URL</a>
								{/if}
								{#if item.status !== 'reviewed'}
									<button class="btn btn-xs btn-info" onclick={() => updateStatus(item, 'reviewed')}>
										Mark reviewed
									</button>
								{/if}
								{#if item.status !== 'resolved'}
									<button class="btn btn-xs btn-success" onclick={() => updateStatus(item, 'resolved')}>
										Mark resolved
									</button>
								{/if}
								{#if item.status !== 'submitted'}
									<button class="btn btn-xs btn-ghost" onclick={() => updateStatus(item, 'submitted')}>
										Reopen
									</button>
								{/if}
							</div>

							<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
								<div class="space-y-4">
									<div class="prose prose-sm max-w-none rounded-box bg-base-200 p-4">
										{@html item.feedbackHtml || '<p>No written feedback.</p>'}
									</div>

									{#if item.images.length > 0}
										<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
											{#each item.images as filename}
												<a href={fullImageUrl(item, filename)} target="_blank" rel="noreferrer">
													<img
														src={imageUrl(item, filename)}
														alt="Feedback screenshot"
														class="aspect-video w-full rounded border border-base-300 object-cover"
													/>
												</a>
											{/each}
										</div>
									{/if}
								</div>

								<dl class="space-y-3 rounded-box bg-base-200 p-4 text-sm">
									<div>
										<dt class="font-semibold">Email</dt>
										<dd class="break-words text-base-content/70">{item.participantEmail || '—'}</dd>
									</div>
									<div>
										<dt class="font-semibold">Page URL</dt>
										<dd class="break-words text-base-content/70">{item.pageUrl || '—'}</dd>
									</div>
									<div>
										<dt class="font-semibold">Browser</dt>
										<dd class="break-words text-base-content/70">
											{item.browserInfo.userAgent || '—'}
										</dd>
									</div>
									<div>
										<dt class="font-semibold">Viewport</dt>
										<dd class="text-base-content/70">{item.browserInfo.viewport || '—'}</dd>
									</div>
								</dl>
							</div>
						</div>
					{/if}
				</article>
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="mt-6 flex justify-center gap-2">
				<button
					class="btn btn-outline btn-sm"
					disabled={currentPage <= 1}
					onclick={() => {
						currentPage -= 1;
						loadFeedback();
					}}
				>
					Previous
				</button>
				<span class="flex items-center px-3 text-sm">Page {currentPage} of {totalPages}</span>
				<button
					class="btn btn-outline btn-sm"
					disabled={currentPage >= totalPages}
					onclick={() => {
						currentPage += 1;
						loadFeedback();
					}}
				>
					Next
				</button>
			</div>
		{/if}
	{/if}
</div>
