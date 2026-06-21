<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { hasPermission } from '$lib/utils/permissions';
	import { Permission, CollectionRole, type UserRoleContext } from '$lib/types/roles';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import CoverImageUpload from '$lib/components/uploads/CoverImageUpload.svelte';
	import { getCollectionCoverUrl } from '$lib/utils/asset-urls';
	import toast from 'svelte-french-toast';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let record = $state(data.record);

	let title = $state('');
	let dcTitle = $state('');
	let dcSubtitle = $state('');
	let dcAbstract = $state('');
	let dcCreator = $state('');
	let dcContributor = $state('');
	let dcInstitution = $state('');
	let dcSubject = $state('');
	let dcCoveragePeriod = $state('');
	let dcCoveragePlace = $state('');
	let dcLanguage = $state('');
	let isVisible = $state(false);
	let isSaving = $state(false);
	let isCancelling = $state(false);

	let collectionRole = $state<CollectionRole | undefined>(undefined);
	let roleContext = $derived<UserRoleContext>({
		globalRole: authStore.globalRole,
		collectionRole
	});
	let canEdit = $derived(hasPermission(roleContext, Permission.CollectionEdit));
	let authorized = $state<boolean | null>(null);
	let isNewCollection = $derived($page.url.searchParams.get('new') === '1');
	let fallbackCoverUrl = $derived(getCollectionCoverUrl(record, record.pubNum));
	const inputClass =
		'input-bordered input w-full bg-white shadow-sm focus:border-primary focus:bg-white focus:outline-none';

	function jsonArrayToString(val: unknown): string {
		if (Array.isArray(val)) return val.join(', ');
		return '';
	}

	function stringToJsonArray(val: string): string[] {
		return val
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	onMount(async () => {
		// Load form values from record
		title = record.title || '';
		dcTitle = record.dcTitle || '';
		dcSubtitle = record.dcSubtitle || '';
		dcAbstract = record.dcAbstract || '';
		dcCreator = jsonArrayToString(record.dcCreator);
		dcContributor = jsonArrayToString(record.dcContributor);
		dcInstitution = jsonArrayToString(record.dcInstitution);
		dcSubject = jsonArrayToString(record.dcSubject);
		dcCoveragePeriod = record.dcCoveragePeriod || '';
		dcCoveragePlace = record.dcCoveragePlace || '';
		dcLanguage = jsonArrayToString(record.dcLanguage);
		isVisible = record.isVisible || false;

		// Check permission
		if (authStore.appUserId && record.id) {
			try {
				const result = await pb.collection('collectionUsers').getList(1, 1, {
					filter: `collection = "${record.id}" && userId = "${authStore.appUserId}"`
				});
				if (result.items.length > 0) {
					collectionRole = result.items[0].role as CollectionRole;
				}
			} catch {
				// No collection role
			}
		}
		authorized = canEdit;
	});

	// Re-check permission when role resolves
	$effect(() => {
		if (authorized === null && collectionRole !== undefined) {
			authorized = canEdit;
		}
	});

	async function save() {
		if (!title.trim()) {
			toast.error('Title is required');
			return;
		}

		isSaving = true;
		try {
			await pb.collection('collections').update(record.id, {
				title: title.trim(),
				dcTitle: dcTitle.trim(),
				dcSubtitle: dcSubtitle.trim(),
				dcAbstract,
				dcCreator: stringToJsonArray(dcCreator),
				dcContributor: stringToJsonArray(dcContributor),
				dcInstitution: stringToJsonArray(dcInstitution),
				dcSubject: stringToJsonArray(dcSubject),
				dcCoveragePeriod: dcCoveragePeriod.trim(),
				dcCoveragePlace: dcCoveragePlace.trim(),
				dcLanguage: stringToJsonArray(dcLanguage),
				isVisible
			});
			toast.success('Collection updated');
			goto(`${base}/collections/${record.id}`);
		} catch (e: any) {
			toast.error(e?.message || 'Failed to save collection');
		} finally {
			isSaving = false;
		}
	}

	async function cancel() {
		if (!isNewCollection) {
			goto(`${base}/collections/${record.id}`);
			return;
		}

		isCancelling = true;
		try {
			try {
				const memberships = await pb.collection('collectionUsers').getList(1, 500, {
					filter: `collection = "${record.id}"`,
					$autoCancel: false
				});

				await Promise.all(
					memberships.items.map((membership) =>
						pb.collection('collectionUsers').delete(membership.id, { $autoCancel: false })
					)
				);
			} catch {
				// Collection deletion is the source of truth for this cleanup.
			}

			await pb.collection('collections').delete(record.id, { $autoCancel: false });
			goto(`${base}/collections`);
		} catch (e: any) {
			toast.error(e?.message || 'Failed to remove empty collection');
		} finally {
			isCancelling = false;
		}
	}

	function onCoverChanged(updatedRecord: typeof record) {
		record = updatedRecord;
	}
</script>

<svelte:head>
	<title>Edit {title || 'Collection'} | Pure 3D</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-12">
	<nav class="breadcrumbs mb-6 text-sm">
		<ul>
			<li><a href="{base}/" class="link link-hover">Home</a></li>
			<li><a href="{base}/collections" class="link link-hover">Collections</a></li>
			<li>
				<a href="{base}/collections/{record.id}" class="link link-hover">{record.title}</a>
			</li>
			<li class="text-base-content/70">Edit</li>
		</ul>
	</nav>

	{#if authorized === null}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if !authorized}
		<div class="alert alert-error">
			<span>You don't have permission to edit this collection.</span>
		</div>
	{:else}
		<div
			class="sticky top-20 z-40 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100/95 px-5 py-3 shadow-sm backdrop-blur"
		>
			<h1 class="text-2xl font-bold">Edit Collection</h1>
			<div class="flex items-center gap-3">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					disabled={isSaving || isCancelling}
					onclick={cancel}
				>
					{#if isCancelling}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Cancel
				</button>
				<button
					type="submit"
					form="collection-edit-form"
					class="btn btn-sm btn-primary"
					disabled={isSaving || isCancelling}
				>
					{#if isSaving}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Save Changes
				</button>
			</div>
		</div>

		<form
			id="collection-edit-form"
			onsubmit={(e) => {
				e.preventDefault();
				save();
			}}
			class="space-y-6"
		>
			<!-- Basic Info -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6">
				<h2 class="mb-4 text-lg font-semibold">Basic Information</h2>

				<div class="grid gap-6 md:grid-cols-[minmax(14rem,22rem)_1fr] md:items-start">
					<div class="form-control">
						<span class="label-text mb-2 block font-medium">Collection Image</span>
						<CoverImageUpload
							bind:record
							collectionName="collections"
							fallbackUrl={fallbackCoverUrl}
							disabled={isSaving}
							onuploaded={onCoverChanged}
							onremoved={onCoverChanged}
						/>
					</div>

					<div class="space-y-4">
						<div class="form-control">
							<label class="label" for="title">
								<span class="label-text font-medium">Title *</span>
							</label>
							<input id="title" type="text" class={inputClass} bind:value={title} required />
						</div>

						<div class="form-control">
							<label class="label" for="visible">
								<span class="label-text font-medium">Visibility</span>
							</label>
							<label class="label cursor-pointer justify-start gap-3">
								<input
									id="visible"
									type="checkbox"
									class="toggle toggle-primary"
									bind:checked={isVisible}
								/>
								<span class="label-text">{isVisible ? 'Visible to public' : 'Hidden'}</span>
							</label>
						</div>
					</div>
				</div>
			</div>

			<!-- Dublin Core Metadata -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6">
				<h2 class="mb-4 text-lg font-semibold">Dublin Core Metadata</h2>

				<div class="space-y-6">
					<div class="grid gap-4 md:grid-cols-2">
						<div class="form-control">
							<label class="label pb-1" for="dcTitle">
								<span class="label-text font-medium">Title</span>
							</label>
							<input id="dcTitle" type="text" class={inputClass} bind:value={dcTitle} />
						</div>

						<div class="form-control">
							<label class="label pb-1" for="dcSubtitle">
								<span class="label-text font-medium">Subtitle</span>
							</label>
							<input id="dcSubtitle" type="text" class={inputClass} bind:value={dcSubtitle} />
						</div>
					</div>

					<div>
						<h3 class="mb-3 text-sm font-semibold text-base-content/60 uppercase">People</h3>
						<div class="grid gap-4 md:grid-cols-2">
							<div class="form-control">
								<label class="label pb-1" for="dcCreator">
									<span class="label-text font-medium">Creators</span>
								</label>
								<input
									id="dcCreator"
									type="text"
									class={inputClass}
									bind:value={dcCreator}
									placeholder="Author A, Author B"
								/>
								<p class="mt-1 text-xs text-base-content/50">
									Separate multiple names with commas.
								</p>
							</div>

							<div class="form-control">
								<label class="label pb-1" for="dcContributor">
									<span class="label-text font-medium">Contributors</span>
								</label>
								<input
									id="dcContributor"
									type="text"
									class={inputClass}
									bind:value={dcContributor}
									placeholder="Contributor A, Contributor B"
								/>
								<p class="mt-1 text-xs text-base-content/50">
									Separate multiple names with commas.
								</p>
							</div>
						</div>
					</div>

					<div>
						<h3 class="mb-3 text-sm font-semibold text-base-content/60 uppercase">
							Classification
						</h3>
						<div class="grid gap-4 md:grid-cols-2">
							<div class="form-control">
								<label class="label pb-1" for="dcInstitution">
									<span class="label-text font-medium">Institutions</span>
								</label>
								<input
									id="dcInstitution"
									type="text"
									class={inputClass}
									bind:value={dcInstitution}
									placeholder="University A, Museum B"
								/>
								<p class="mt-1 text-xs text-base-content/50">
									Separate multiple institutions with commas.
								</p>
							</div>

							<div class="form-control">
								<label class="label pb-1" for="dcSubject">
									<span class="label-text font-medium">Subjects</span>
								</label>
								<input
									id="dcSubject"
									type="text"
									class={inputClass}
									bind:value={dcSubject}
									placeholder="archaeology, 3D modeling"
								/>
								<p class="mt-1 text-xs text-base-content/50">
									Separate tags or subjects with commas.
								</p>
							</div>
						</div>
					</div>

					<div>
						<h3 class="mb-3 text-sm font-semibold text-base-content/60 uppercase">Coverage</h3>
						<div class="grid gap-4 md:grid-cols-2">
							<div class="form-control">
								<label class="label pb-1" for="dcCoveragePeriod">
									<span class="label-text font-medium">Period</span>
								</label>
								<input
									id="dcCoveragePeriod"
									type="text"
									class={inputClass}
									bind:value={dcCoveragePeriod}
									placeholder="e.g. 1500-1600 CE"
								/>
							</div>

							<div class="form-control">
								<label class="label pb-1" for="dcCoveragePlace">
									<span class="label-text font-medium">Place</span>
								</label>
								<input
									id="dcCoveragePlace"
									type="text"
									class={inputClass}
									bind:value={dcCoveragePlace}
									placeholder="e.g. Rome, Italy"
								/>
							</div>

							<div class="form-control md:col-span-2">
								<label class="label pb-1" for="dcLanguage">
									<span class="label-text font-medium">Languages</span>
								</label>
								<input
									id="dcLanguage"
									type="text"
									class={inputClass}
									bind:value={dcLanguage}
									placeholder="en, nl, de"
								/>
								<p class="mt-1 text-xs text-base-content/50">
									Separate multiple languages with commas.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Rich Text Fields -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6">
				<h2 class="mb-4 text-lg font-semibold">Description</h2>

				<div class="form-control">
					<RichTextEditor content={dcAbstract} onchange={(html) => (dcAbstract = html)} />
				</div>
			</div>
		</form>
	{/if}
</div>
