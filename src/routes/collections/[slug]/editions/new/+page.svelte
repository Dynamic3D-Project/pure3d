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

<div class="container mx-auto max-w-4xl px-4 py-12">
	<nav class="breadcrumbs mb-6 text-sm">
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
		<h1 class="mb-2 text-3xl font-bold">New Edition</h1>
		<p class="mb-8 text-base-content/60">
			Creating a new edition in <strong>{collection.title}</strong>
		</p>

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
						placeholder="Edition title"
					/>
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="form-control">
						<label class="label" for="dcTitle">
							<span class="label-text">DC Title</span>
						</label>
						<input
							id="dcTitle"
							type="text"
							class="input-bordered input"
							bind:value={dcTitle}
							placeholder="Defaults to title"
						/>
					</div>

					<div class="form-control">
						<label class="label" for="dcSubtitle">
							<span class="label-text">Subtitle</span>
						</label>
						<input
							id="dcSubtitle"
							type="text"
							class="input-bordered input"
							bind:value={dcSubtitle}
						/>
					</div>
				</div>
			</div>

			<!-- People -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6">
				<h2 class="mb-4 text-lg font-semibold">People</h2>

				<div class="grid gap-4 md:grid-cols-2">
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
						/>
					</div>

					<div class="form-control md:col-span-2">
						<label class="label" for="dcInstitution">
							<span class="label-text">Institutions</span>
							<span class="label-text-alt">Comma-separated</span>
						</label>
						<input
							id="dcInstitution"
							type="text"
							class="input-bordered input"
							bind:value={dcInstitution}
						/>
					</div>
				</div>
			</div>

			<!-- Subject & Classification -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6">
				<h2 class="mb-4 text-lg font-semibold">Subject & Classification</h2>

				<div class="grid gap-4 md:grid-cols-2">
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
						<label class="label" for="dcKeyword">
							<span class="label-text">Keywords</span>
							<span class="label-text-alt">Comma-separated</span>
						</label>
						<input
							id="dcKeyword"
							type="text"
							class="input-bordered input"
							bind:value={dcKeyword}
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

					<div class="form-control">
						<label class="label" for="dcLanguage">
							<span class="label-text">Languages</span>
							<span class="label-text-alt">Comma-separated</span>
						</label>
						<input
							id="dcLanguage"
							type="text"
							class="input-bordered input"
							bind:value={dcLanguage}
							placeholder="en, nl"
						/>
					</div>
				</div>
			</div>

			<!-- Rights -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6">
				<h2 class="mb-4 text-lg font-semibold">Rights</h2>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="form-control">
						<label class="label" for="dcRightsHolder">
							<span class="label-text">Rights Holder</span>
						</label>
						<input
							id="dcRightsHolder"
							type="text"
							class="input-bordered input"
							bind:value={dcRightsHolder}
						/>
					</div>

					<div class="form-control">
						<label class="label" for="dcRightsLicense">
							<span class="label-text">License</span>
						</label>
						<input
							id="dcRightsLicense"
							type="text"
							class="input-bordered input"
							bind:value={dcRightsLicense}
							placeholder="e.g. CC BY 4.0"
						/>
					</div>
				</div>
			</div>

			<!-- Cover Image -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6 opacity-50">
				<h2 class="mb-4 text-lg font-semibold">Cover Image</h2>
				<div class="form-control">
					<input
						type="file"
						class="file-input-bordered file-input w-full"
						accept="image/*"
						disabled
					/>
					<label class="label">
						<span class="label-text-alt">JPG, PNG, or WebP. Recommended size: 800x600px.</span>
					</label>
				</div>
			</div>

			<!-- 3D Model Files -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6 opacity-50">
				<h2 class="mb-4 text-lg font-semibold">3D Model Files</h2>
				<div class="form-control mb-3">
					<input
						type="file"
						class="file-input-bordered file-input w-full"
						accept=".glb,.gltf,.obj,.ply"
						disabled
					/>
					<label class="label">
						<span class="label-text-alt">GLB, GLTF, OBJ, or PLY format.</span>
					</label>
				</div>
				<div class="form-control">
					<label class="label" for="sceneFile">
						<span class="label-text">Scene File (SVX document)</span>
					</label>
					<input
						id="sceneFile"
						type="file"
						class="file-input-bordered file-input w-full"
						accept=".json,.svx"
						disabled
					/>
				</div>
			</div>

			<!-- Abstract -->
			<div class="rounded-box border border-base-300 bg-base-100 p-6">
				<h2 class="mb-4 text-lg font-semibold">Abstract</h2>
				<RichTextEditor content={dcAbstract} onchange={(html) => (dcAbstract = html)} />
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3">
				<a href="{base}/collections/{collection.id}" class="btn btn-ghost">Cancel</a>
				<button type="submit" class="btn btn-primary" disabled={isSaving}>
					{#if isSaving}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Create Edition
				</button>
			</div>
		</form>
	{/if}
</div>
