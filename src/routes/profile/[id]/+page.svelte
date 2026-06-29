<script lang="ts">
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import { ROLE_LABELS } from '$lib/types/roles';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const joinDate = $derived(
		new Date(data.profile.created).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long'
		})
	);

	function socialHref(value: string) {
		return /^https?:\/\//i.test(value) ? value : `https://${value}`;
	}

	function socialLabel(value: string) {
		return value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
	}

	function socialLinks(value: string) {
		return value
			.split(/\n+/)
			.map((item) => item.trim())
			.filter(Boolean);
	}
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<section class="mb-8 overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
		<div class="h-24 bg-gradient-to-r from-base-300 via-base-200 to-base-100"></div>
		<div class="flex flex-col gap-6 p-6 pt-0 sm:flex-row sm:items-end">
			<div class="avatar placeholder -mt-14 shrink-0">
				{#if data.profile.profilePictureUrl}
					<div class="w-32 rounded-full ring-4 ring-base-100">
						<img src={data.profile.profilePictureUrl} alt="{data.profile.name} profile" />
					</div>
				{:else}
					<div class="w-32 rounded-full bg-neutral text-neutral-content ring-4 ring-base-100">
						<span class="text-5xl">{data.profile.name.charAt(0).toUpperCase()}</span>
					</div>
				{/if}
			</div>

			<div class="flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-3xl font-bold">{data.profile.name}</h1>
					{#if data.profile.verified}
						<span class="badge badge-sm badge-success">Verified</span>
					{/if}
				</div>
				<div class="mt-3 flex flex-wrap gap-2 text-sm text-base-content/70">
					{#if data.profile.role}
						<span class="badge badge-neutral"
							>{ROLE_LABELS[data.profile.role] || data.profile.role}</span
						>
					{/if}
					<span>Member since {joinDate}</span>
				</div>
				{#if data.profile.titleRole || data.profile.affiliation}
					<p class="mt-3 text-base-content/80">
						{#if data.profile.titleRole}{data.profile.titleRole}{/if}{#if data.profile.titleRole && data.profile.affiliation}, {/if}{#if data.profile.affiliation}{data.profile.affiliation}{/if}
					</p>
				{/if}
			</div>
		</div>
	</section>

	<section class="mb-10 rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
		<div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
			<div>
				<h2 class="text-2xl font-semibold">Profile</h2>
				{#if data.profile.bio}
					<div class="prose mt-4 max-w-none text-base-content/80">{@html data.profile.bio}</div>
				{:else}
					<p class="mt-4 text-base-content/50">No biography added yet.</p>
				{/if}

				{#if data.profile.socials}
					<div class="mt-6 flex flex-wrap gap-2">
						{#each socialLinks(data.profile.socials) as social}
							<a class="btn btn-outline btn-sm" href={socialHref(social)} target="_blank" rel="noreferrer">
								{socialLabel(social)}
							</a>
						{/each}
					</div>
				{/if}
			</div>

			<aside class="space-y-3">
				{#if data.profile.orcid}
					<div class="rounded-xl bg-base-200 p-4">
						<div class="text-xs font-semibold uppercase tracking-wide text-base-content/50">ORCID</div>
						<a class="link mt-1 block break-all" href={data.profile.orcid} target="_blank" rel="noreferrer">
							{socialLabel(data.profile.orcid)}
						</a>
					</div>
				{/if}
				<div class="rounded-xl bg-base-200 p-4">
					<div class="text-xs font-semibold uppercase tracking-wide text-base-content/50">Member since</div>
					<p class="mt-1 font-medium">{joinDate}</p>
				</div>
			</aside>
		</div>
	</section>

	<section class="mb-10">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-2xl font-semibold">Editions</h2>
			<span class="text-sm text-base-content/60">{data.editions.length} public</span>
		</div>
		{#if data.editions.length}
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each data.editions as edition (edition.id)}
					<EditionCard {edition} />
				{/each}
			</div>
		{:else}
			<p class="rounded-lg border border-base-300 bg-base-100 p-6 text-base-content/60">
				No public editions yet.
			</p>
		{/if}
	</section>

	<section>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-2xl font-semibold">Collections</h2>
			<span class="text-sm text-base-content/60">{data.collections.length} public</span>
		</div>
		{#if data.collections.length}
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.collections as collection (collection.id)}
					<CollectionCard {collection} />
				{/each}
			</div>
		{:else}
			<p class="rounded-lg border border-base-300 bg-base-100 p-6 text-base-content/60">
				No public collections yet.
			</p>
		{/if}
	</section>
</div>
