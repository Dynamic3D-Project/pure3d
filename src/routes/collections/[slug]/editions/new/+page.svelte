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

		<form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-4">
			<!-- Title row -->
			<div class="grid gap-3 md:grid-cols-3">
				<div class="form-control md:col-span-1">
					<label class="label py-1" for="title">
						<span class="label-text text-xs font-medium">Title *</span>
					</label>
					<input
						id="title"
						type="text"
						class="input-bordered input input-sm"
						bind:value={title}
						required
						placeholder="Edition title"
					/>
				</div>
				<div class="form-control">
					<label class="label py-1" for="dcTitle">
						<span class="label-text text-xs">DC Title</span>
					</label>
					<input
						id="dcTitle"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcTitle}
						placeholder="Defaults to title"
					/>
				</div>
				<div class="form-control">
					<label class="label py-1" for="dcSubtitle">
						<span class="label-text text-xs">Subtitle</span>
					</label>
					<input
						id="dcSubtitle"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcSubtitle}
					/>
				</div>
			</div>

			<!-- People row -->
			<div class="grid gap-3 md:grid-cols-3">
				<div class="form-control">
					<label class="label py-1" for="dcCreator">
						<span class="label-text text-xs">Creators</span>
						<span class="label-text-alt text-xs">comma-sep</span>
					</label>
					<input
						id="dcCreator"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcCreator}
						placeholder="Author A, Author B"
					/>
				</div>
				<div class="form-control">
					<label class="label py-1" for="dcContributor">
						<span class="label-text text-xs">Contributors</span>
						<span class="label-text-alt text-xs">comma-sep</span>
					</label>
					<input
						id="dcContributor"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcContributor}
					/>
				</div>
				<div class="form-control">
					<label class="label py-1" for="dcInstitution">
						<span class="label-text text-xs">Institutions</span>
						<span class="label-text-alt text-xs">comma-sep</span>
					</label>
					<input
						id="dcInstitution"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcInstitution}
					/>
				</div>
			</div>

			<!-- Subject & coverage row -->
			<div class="grid gap-3 md:grid-cols-4">
				<div class="form-control">
					<label class="label py-1" for="dcSubject">
						<span class="label-text text-xs">Subjects</span>
					</label>
					<input
						id="dcSubject"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcSubject}
						placeholder="archaeology"
					/>
				</div>
				<div class="form-control">
					<label class="label py-1" for="dcKeyword">
						<span class="label-text text-xs">Keywords</span>
					</label>
					<input
						id="dcKeyword"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcKeyword}
					/>
				</div>
				<div class="form-control">
					<label class="label py-1" for="dcCoveragePlace">
						<span class="label-text text-xs">Place</span>
					</label>
					<input
						id="dcCoveragePlace"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcCoveragePlace}
						placeholder="Rome, Italy"
					/>
				</div>
				<div class="form-control">
					<label class="label py-1" for="dcLanguage">
						<span class="label-text text-xs">Languages</span>
					</label>
					<input
						id="dcLanguage"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcLanguage}
						placeholder="en, nl"
					/>
				</div>
			</div>

			<!-- Rights row -->
			<div class="grid gap-3 md:grid-cols-2">
				<div class="form-control">
					<label class="label py-1" for="dcRightsHolder">
						<span class="label-text text-xs">Rights Holder</span>
					</label>
					<input
						id="dcRightsHolder"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcRightsHolder}
					/>
				</div>
				<div class="form-control">
					<label class="label py-1" for="dcRightsLicense">
						<span class="label-text text-xs">License</span>
					</label>
					<input
						id="dcRightsLicense"
						type="text"
						class="input-bordered input input-sm"
						bind:value={dcRightsLicense}
						placeholder="CC BY 4.0"
					/>
				</div>
			</div>

			<!-- File uploads row -->
			<div class="grid gap-3 opacity-50 md:grid-cols-2">
				<div class="rounded-box border border-base-300 bg-base-100 p-4">
					<span class="mb-2 block text-xs font-semibold">Cover Image</span>
					<input
						type="file"
						class="file-input-bordered file-input w-full file-input-sm"
						accept="image/*"
						disabled
					/>
					<span class="mt-1 block text-xs text-base-content/50">JPG, PNG, WebP — 800x600px</span>
				</div>
				<div class="rounded-box border border-base-300 bg-base-100 p-4">
					<span class="mb-2 block text-xs font-semibold">3D Model Files</span>
					<input
						type="file"
						class="file-input-bordered file-input mb-2 w-full file-input-sm"
						accept=".glb,.gltf,.obj,.ply"
						disabled
					/>
					<input
						type="file"
						class="file-input-bordered file-input w-full file-input-sm"
						accept=".json,.svx"
						disabled
					/>
					<span class="mt-1 block text-xs text-base-content/50">GLB, GLTF, OBJ, PLY + scene file</span>
				</div>
			</div>

			<!-- Abstract -->
			<div>
				<span class="mb-2 block text-xs font-semibold">Abstract</span>
				<RichTextEditor content={dcAbstract} onchange={(html) => (dcAbstract = html)} />
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3 pt-2">
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
