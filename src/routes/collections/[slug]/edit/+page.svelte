<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { hasPermission } from '$lib/utils/permissions';
	import { Permission, CollectionRole, type UserRoleContext } from '$lib/types/roles';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import toast from 'svelte-french-toast';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let record = $derived(data.record);

	let title = $state('');
	let dcTitle = $state('');
	let dcSubtitle = $state('');
	let dcAbstract = $state('');
	let dcDescription = $state('');
	let dcCreator = $state('');
	let dcContributor = $state('');
	let dcInstitution = $state('');
	let dcSubject = $state('');
	let dcCoveragePeriod = $state('');
	let dcCoveragePlace = $state('');
	let dcLanguage = $state('');
	let isVisible = $state(false);
	let isSaving = $state(false);

	let collectionRole = $state<CollectionRole | undefined>(undefined);
	let roleContext = $derived<UserRoleContext>({
		globalRole: authStore.globalRole,
		collectionRole
	});
	let canEdit = $derived(hasPermission(roleContext, Permission.CollectionEdit));
	let authorized = $state<boolean | null>(null);

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
		dcDescription = record.dcDescription || '';
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
				dcDescription,
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
		<h1 class="mb-8 text-3xl font-bold">Edit Collection</h1>

		<form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-6">
			<!-- Basic Info -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6">
				<h2 class="mb-4 text-lg font-semibold">Basic Information</h2>

				<div class="form-control mb-4">
					<label class="label" for="title">
						<span class="label-text font-medium">Title *</span>
					</label>
					<input
						id="title"
						type="text"
						class="input-bordered input"
						bind:value={title}
						required
					/>
				</div>

				<div class="form-control mb-4">
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

			<!-- Dublin Core Metadata -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6">
				<h2 class="mb-4 text-lg font-semibold">Dublin Core Metadata</h2>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="form-control">
						<label class="label" for="dcTitle">
							<span class="label-text">DC Title</span>
						</label>
						<input id="dcTitle" type="text" class="input-bordered input" bind:value={dcTitle} />
					</div>

					<div class="form-control">
						<label class="label" for="dcSubtitle">
							<span class="label-text">DC Subtitle</span>
						</label>
						<input
							id="dcSubtitle"
							type="text"
							class="input-bordered input"
							bind:value={dcSubtitle}
						/>
					</div>

					<div class="form-control">
						<label class="label" for="dcCreator">
							<span class="label-text">Creators</span>
							<span class="label-text-alt">Comma-separated</span>
						</label>
						<input
							id="dcCreator"
							type="text"
							class="input-bordered input"
							bind:value={dcCreator}
							placeholder="Author A, Author B"
						/>
					</div>

					<div class="form-control">
						<label class="label" for="dcContributor">
							<span class="label-text">Contributors</span>
							<span class="label-text-alt">Comma-separated</span>
						</label>
						<input
							id="dcContributor"
							type="text"
							class="input-bordered input"
							bind:value={dcContributor}
							placeholder="Contributor A, Contributor B"
						/>
					</div>

					<div class="form-control">
						<label class="label" for="dcInstitution">
							<span class="label-text">Institutions</span>
							<span class="label-text-alt">Comma-separated</span>
						</label>
						<input
							id="dcInstitution"
							type="text"
							class="input-bordered input"
							bind:value={dcInstitution}
							placeholder="University A, Museum B"
						/>
					</div>

					<div class="form-control">
						<label class="label" for="dcSubject">
							<span class="label-text">Subjects</span>
							<span class="label-text-alt">Comma-separated</span>
						</label>
						<input
							id="dcSubject"
							type="text"
							class="input-bordered input"
							bind:value={dcSubject}
							placeholder="archaeology, 3D modeling"
						/>
					</div>

					<div class="form-control">
						<label class="label" for="dcCoveragePeriod">
							<span class="label-text">Coverage Period</span>
						</label>
						<input
							id="dcCoveragePeriod"
							type="text"
							class="input-bordered input"
							bind:value={dcCoveragePeriod}
							placeholder="e.g. 1500-1600 CE"
						/>
					</div>

					<div class="form-control">
						<label class="label" for="dcCoveragePlace">
							<span class="label-text">Coverage Place</span>
						</label>
						<input
							id="dcCoveragePlace"
							type="text"
							class="input-bordered input"
							bind:value={dcCoveragePlace}
							placeholder="e.g. Rome, Italy"
						/>
					</div>

					<div class="form-control md:col-span-2">
						<label class="label" for="dcLanguage">
							<span class="label-text">Languages</span>
							<span class="label-text-alt">Comma-separated</span>
						</label>
						<input
							id="dcLanguage"
							type="text"
							class="input-bordered input"
							bind:value={dcLanguage}
							placeholder="en, nl, de"
						/>
					</div>
				</div>
			</div>

			<!-- Rich Text Fields -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6">
				<h2 class="mb-4 text-lg font-semibold">Description</h2>

				<div class="form-control mb-4">
					<span class="label-text font-medium mb-2">Abstract</span>
					<RichTextEditor content={dcAbstract} onchange={(html) => (dcAbstract = html)} />
				</div>

				<div class="form-control">
					<span class="label-text font-medium mb-2">Description</span>
					<RichTextEditor
						content={dcDescription}
						onchange={(html) => (dcDescription = html)}
					/>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3">
				<a href="{base}/collections/{record.id}" class="btn btn-ghost">Cancel</a>
				<button type="submit" class="btn btn-primary" disabled={isSaving}>
					{#if isSaving}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Save Changes
				</button>
			</div>
		</form>
	{/if}
</div>
