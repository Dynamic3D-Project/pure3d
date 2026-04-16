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
			toast.success('Edition created');
			goto(`${base}/collections/${collection.id}`);
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
				<div class="grid gap-x-4 gap-y-3 md:grid-cols-2">
					<div class="form-control md:col-span-2">
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
					<div class="form-control md:col-span-2">
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

			<!-- Files -->
			<section class="mb-6">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">Files</h2>
				<div class="grid gap-4 opacity-50 md:grid-cols-2">
					<div class="form-control">
						<label class="label py-0.5">
							<span class="label-text text-sm">Cover Image</span>
							<span class="label-text-alt text-xs">JPG, PNG, WebP</span>
						</label>
						<input type="file" class="file-input-bordered file-input w-full file-input-sm" accept="image/*" disabled />
					</div>
					<div class="space-y-2">
						<div class="form-control">
							<label class="label py-0.5">
								<span class="label-text text-sm">3D Model</span>
								<span class="label-text-alt text-xs">GLB, GLTF, OBJ, PLY</span>
							</label>
							<input type="file" class="file-input-bordered file-input w-full file-input-sm" accept=".glb,.gltf,.obj,.ply" disabled />
						</div>
						<div class="form-control">
							<label class="label py-0.5">
								<span class="label-text text-sm">Scene File</span>
								<span class="label-text-alt text-xs">SVX / JSON</span>
							</label>
							<input type="file" class="file-input-bordered file-input w-full file-input-sm" accept=".json,.svx" disabled />
						</div>
					</div>
				</div>
			</section>

			<div class="divider my-2"></div>

			<!-- Abstract -->
			<section class="mb-6">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-base-content/50">Abstract</h2>
				<RichTextEditor content={dcAbstract} onchange={(html) => (dcAbstract = html)} />
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
