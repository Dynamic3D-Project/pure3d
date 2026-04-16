<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { hasPermission } from '$lib/utils/permissions';
	import { Permission, CollectionRole, EditionStatus, type UserRoleContext } from '$lib/types/roles';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import toast from 'svelte-french-toast';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let collection = $derived(data.collection);

	let title = $state('');
	let dcTitle = $state('');
	let dcSubtitle = $state('');
	let dcAbstract = $state('');
	let dcCreator = $state('');
	let dcContributor = $state('');
	let dcInstitution = $state('');
	let dcSubject = $state('');
	let dcKeyword = $state('');
	let dcLanguage = $state('');
	let dcCoveragePlace = $state('');
	let dcRightsHolder = $state('');
	let dcRightsLicense = $state('');
	let isSaving = $state(false);

	let collectionRole = $state<CollectionRole | undefined>(undefined);
	let roleContext = $derived<UserRoleContext>({
		globalRole: authStore.globalRole,
		collectionRole
	});
	let canCreate = $derived(hasPermission(roleContext, Permission.EditionCreate));
	let authorized = $state<boolean | null>(null);

	function stringToJsonArray(val: string): string[] {
		return val
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	onMount(async () => {
		if (authStore.appUserId && collection.id) {
			try {
				const result = await pb.collection('collectionUsers').getList(1, 1, {
					filter: `collection = "${collection.id}" && userId = "${authStore.appUserId}"`
				});
				if (result.items.length > 0) {
					collectionRole = result.items[0].role as CollectionRole;
				}
			} catch {
				// No collection role
			}
		}
		authorized = canCreate;
	});

	$effect(() => {
		if (authorized === null && collectionRole !== undefined) {
			authorized = canCreate;
		}
	});

	async function save() {
		if (!title.trim()) {
			toast.error('Title is required');
			return;
		}

		isSaving = true;
		try {
			const record = await pb.collection('editions').create({
				title: title.trim(),
				dcTitle: dcTitle.trim() || title.trim(),
				dcSubtitle: dcSubtitle.trim(),
				dcAbstract,
				dcCreator: stringToJsonArray(dcCreator),
				dcContributor: stringToJsonArray(dcContributor),
				dcInstitution: stringToJsonArray(dcInstitution),
				dcSubject: stringToJsonArray(dcSubject),
				dcKeyword: stringToJsonArray(dcKeyword),
				dcLanguage: stringToJsonArray(dcLanguage),
				dcCoveragePlace: dcCoveragePlace.trim(),
				dcRightsHolder: dcRightsHolder.trim(),
				dcRightsLicense: dcRightsLicense.trim(),
				collection: collection.id,
				status: EditionStatus.Draft,
				isPublished: false
			});

			// Add the creator as author on this edition
			if (authStore.appUserId) {
				try {
					await pb.collection('editionUsers').create({
						edition: record.id,
						editionId: record.id,
						user: authStore.appUserId,
						userId: authStore.appUserId,
						role: 'author'
					});
				} catch {
					// Non-critical — edition was created, author link is a convenience
				}
			}

			toast.success('Edition created — you can find it under My Work');
			goto(`${base}/reviews`);
		} catch (e: any) {
			toast.error(e?.message || 'Failed to create edition');
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>New Edition | {collection.title} | Pure 3D</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
	<nav class="breadcrumbs mb-4 text-sm">
		<ul>
			<li><a href="{base}/" class="link link-hover">Home</a></li>
			<li><a href="{base}/collections" class="link link-hover">Collections</a></li>
			<li>
				<a href="{base}/collections/{collection.id}" class="link link-hover">{collection.title}</a>
			</li>
			<li class="text-base-content/70">New Edition</li>
		</ul>
	</nav>

	{#if authorized === null}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if !authorized}
		<div class="alert alert-error">
			<span>You don't have permission to create editions in this collection.</span>
		</div>
	{:else}
		<div class="mb-6">
			<h1 class="text-2xl font-bold">New Edition</h1>
			<p class="text-sm text-base-content/60">
				in <strong>{collection.title}</strong>
			</p>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); save(); }}>
			<!-- Basic Information -->
			<section class="mb-6">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">Basic Information</h2>
				<div class="grid gap-5 md:grid-cols-2">
					<!-- Cover image (left column) -->
					<div class="opacity-50">
						<div class="flex aspect-[4/3] items-center justify-center rounded-lg border-2 border-dashed border-base-300 bg-base-200">
							<div class="text-center text-base-content/40">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="mx-auto mb-1 size-8">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
								</svg>
								<p class="text-xs">Cover Image</p>
							</div>
						</div>
						<button type="button" class="btn btn-outline btn-xs mt-2 w-full" disabled>Upload Image</button>
						<p class="mt-1 text-center text-xs text-base-content/40">JPG, PNG, WebP</p>
					</div>
					<!-- Title fields (right column) -->
					<div class="space-y-3">
						<div class="form-control">
							<label class="label py-0.5" for="title">
								<span class="label-text text-sm font-medium">Title *</span>
							</label>
							<input id="title" type="text" class="input-bordered input input-sm" bind:value={title} required placeholder="Edition title" />
						</div>
						<div class="form-control">
							<label class="label py-0.5" for="dcTitle">
								<span class="label-text text-sm">DC Title</span>
							</label>
							<input id="dcTitle" type="text" class="input-bordered input input-sm" bind:value={dcTitle} placeholder="Defaults to title" />
						</div>
						<div class="form-control">
							<label class="label py-0.5" for="dcSubtitle">
								<span class="label-text text-sm">Subtitle</span>
							</label>
							<input id="dcSubtitle" type="text" class="input-bordered input input-sm" bind:value={dcSubtitle} />
						</div>
					</div>
				</div>
			</section>

			<div class="divider my-2"></div>

			<!-- People -->
			<section class="mb-6">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">People</h2>
				<div class="grid gap-x-4 gap-y-3 md:grid-cols-2">
					<div class="form-control">
						<label class="label py-0.5" for="dcCreator">
							<span class="label-text text-sm">Creators</span>
							<span class="label-text-alt text-xs">comma-separated</span>
						</label>
						<input id="dcCreator" type="text" class="input-bordered input input-sm" bind:value={dcCreator} placeholder="Author A, Author B" />
					</div>
					<div class="form-control">
						<label class="label py-0.5" for="dcContributor">
							<span class="label-text text-sm">Contributors</span>
							<span class="label-text-alt text-xs">comma-separated</span>
						</label>
						<input id="dcContributor" type="text" class="input-bordered input input-sm" bind:value={dcContributor} />
					</div>
					<div class="form-control">
						<label class="label py-0.5" for="dcInstitution">
							<span class="label-text text-sm">Institutions</span>
							<span class="label-text-alt text-xs">comma-separated</span>
						</label>
						<input id="dcInstitution" type="text" class="input-bordered input input-sm" bind:value={dcInstitution} />
					</div>
				</div>
			</section>

			<div class="divider my-2"></div>

			<!-- Classification -->
			<section class="mb-6">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">Classification</h2>
				<div class="grid gap-x-4 gap-y-3 md:grid-cols-2">
					<div class="form-control">
						<label class="label py-0.5" for="dcSubject">
							<span class="label-text text-sm">Subjects</span>
							<span class="label-text-alt text-xs">comma-separated</span>
						</label>
						<input id="dcSubject" type="text" class="input-bordered input input-sm" bind:value={dcSubject} placeholder="archaeology, 3D modeling" />
					</div>
					<div class="form-control">
						<label class="label py-0.5" for="dcKeyword">
							<span class="label-text text-sm">Keywords</span>
							<span class="label-text-alt text-xs">comma-separated</span>
						</label>
						<input id="dcKeyword" type="text" class="input-bordered input input-sm" bind:value={dcKeyword} />
					</div>
					<div class="form-control">
						<label class="label py-0.5" for="dcCoveragePlace">
							<span class="label-text text-sm">Coverage Place</span>
						</label>
						<input id="dcCoveragePlace" type="text" class="input-bordered input input-sm" bind:value={dcCoveragePlace} placeholder="Rome, Italy" />
					</div>
					<div class="form-control">
						<label class="label py-0.5" for="dcLanguage">
							<span class="label-text text-sm">Languages</span>
							<span class="label-text-alt text-xs">comma-separated</span>
						</label>
						<input id="dcLanguage" type="text" class="input-bordered input input-sm" bind:value={dcLanguage} placeholder="en, nl" />
					</div>
					<div class="form-control">
						<label class="label py-0.5" for="dcRightsHolder">
							<span class="label-text text-sm">Rights Holder</span>
						</label>
						<input id="dcRightsHolder" type="text" class="input-bordered input input-sm" bind:value={dcRightsHolder} />
					</div>
					<div class="form-control">
						<label class="label py-0.5" for="dcRightsLicense">
							<span class="label-text text-sm">License</span>
						</label>
						<input id="dcRightsLicense" type="text" class="input-bordered input input-sm" bind:value={dcRightsLicense} placeholder="CC BY 4.0" />
					</div>
				</div>
			</section>

			<div class="divider my-2"></div>

			<!-- 3D Model Files -->
			<section class="mb-6">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">3D Model Files</h2>
				<div class="rounded-xl border border-base-300 bg-base-100 p-5 opacity-50">
						<div class="mb-3 space-y-2">
							<div class="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 px-3 py-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4 shrink-0 text-base-content/40">
									<path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
								</svg>
								<span class="truncate text-xs text-base-content/40">No model file selected</span>
							</div>
							<div class="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 px-3 py-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4 shrink-0 text-base-content/40">
									<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
								</svg>
								<span class="truncate text-xs text-base-content/40">No scene file selected</span>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<button type="button" class="btn btn-outline btn-sm" disabled>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
								</svg>
								Upload Model
							</button>
							<button type="button" class="btn btn-outline btn-sm" disabled>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
								</svg>
								Upload Scene
							</button>
						</div>
						<p class="mt-2 text-center text-xs text-base-content/40">GLB, GLTF, OBJ, PLY + SVX scene file</p>
				</div>
			</section>

			<div class="divider my-2"></div>

			<!-- Abstract -->
			<section class="mb-6">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">Abstract</h2>
				<RichTextEditor content={dcAbstract} onchange={(html) => (dcAbstract = html)} minHeight="120px" />
			</section>

			<!-- Actions -->
			<div class="flex justify-end gap-3 border-t border-base-300 pt-4">
				<a href="{base}/collections/{collection.id}" class="btn btn-ghost btn-sm">Cancel</a>
				<button type="submit" class="btn btn-primary btn-sm" disabled={isSaving}>
					{#if isSaving}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Create Edition
				</button>
			</div>
		</form>
	{/if}
</div>
