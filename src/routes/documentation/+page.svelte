<script lang="ts">
	import { base } from '$app/paths';
	import { authStore } from '$lib/database';
	import type { LayoutData } from './$types';

	let { data }: { data: LayoutData } = $props();
	let pages = $derived(data.pages);
</script>

<svelte:head>
	<title>Publish with us | Pure 3D</title>
	<meta
		name="description"
		content="Create and publish a peer-reviewed 3D scholarly edition with Pure 3D."
	/>
</svelte:head>

<div id="documentation-page" class="space-y-16 pb-8">
	<section
		class="relative overflow-hidden rounded-3xl bg-ink px-6 py-12 text-paper sm:px-10 sm:py-16"
	>
		<div
			class="absolute -top-24 -right-20 size-72 rounded-full border border-paper/15"
			aria-hidden="true"
		></div>
		<div
			class="absolute -right-8 -bottom-28 size-56 rounded-full bg-vermillion/80 blur-3xl"
			aria-hidden="true"
		></div>
		<div class="relative max-w-3xl">
			<p class="mb-5 text-xs font-bold tracking-[0.2em] text-paper/65 uppercase">
				For researchers, educators and cultural heritage professionals
			</p>
			<h1 class="max-w-2xl text-4xl leading-[1.05] font-bold tracking-tight text-paper sm:text-6xl">
				Turn your 3D research into a scholarly edition.
			</h1>
			<p class="mt-6 max-w-2xl text-lg leading-relaxed text-paper/75">
				Bring your model, interpretation and supporting material together in a citable, interactive
				publication. Pure 3D guides your edition from proposal through review to publication.
			</p>
			<div class="mt-8 flex flex-wrap gap-3">
				{#if authStore.isAuthenticated}
					<a href="{base}/reviews" class="btn border-paper bg-paper text-ink hover:bg-paper/90">
						Go to my work <span aria-hidden="true">→</span>
					</a>
				{:else}
					<a href="{base}/register" class="btn border-paper bg-paper text-ink hover:bg-paper/90">
						Create an author account <span aria-hidden="true">→</span>
					</a>
				{/if}
				<a
					href="{base}/documentation/submission"
					class="btn border-paper/30 bg-transparent text-paper hover:border-paper hover:bg-paper/10"
				>
					Read submission guidelines
				</a>
			</div>
		</div>
	</section>

	{#if pages.length > 0}
		<section aria-labelledby="author-guides">
			<div class="mb-7 flex flex-wrap items-end justify-between gap-4">
				<div>
					<p class="mb-3 text-xs font-bold tracking-[0.18em] text-vermillion uppercase">
						Start here
					</p>
					<h2 id="author-guides" class="text-3xl font-bold tracking-tight">Publishing guides</h2>
				</div>
				<p class="max-w-md text-sm text-base-content/60">
					Follow the publishing guidance in the sequence shown here.
				</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				{#each pages as p (p.id)}
					<a
						href="{base}/documentation/{p.slug}"
						class="group rounded-2xl border border-base-300 bg-base-100 p-6 transition hover:-translate-y-0.5 hover:border-base-content/30 hover:shadow-lg"
					>
						<div class="mb-8 flex justify-end">
							<span class="transition-transform group-hover:translate-x-1" aria-hidden="true"
								>→</span
							>
						</div>
						<h3 class="text-xl font-bold">{p.title}</h3>
						{#if p.summary}
							<p class="mt-2 text-sm leading-relaxed text-base-content/65">{p.summary}</p>
						{/if}
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<section class="grid gap-8 rounded-3xl bg-base-200 p-6 sm:p-10 lg:grid-cols-[1fr_1.15fr]">
		<div>
			<p class="mb-3 text-xs font-bold tracking-[0.18em] text-vermillion uppercase">
				Before you begin
			</p>
			<h2 class="text-3xl font-bold tracking-tight">
				Bring the research. We’ll show you the workflow.
			</h2>
		</div>
		<ul class="space-y-4 text-base-content/75">
			<li class="flex gap-3 border-b border-base-300 pb-4">
				<span class="font-bold text-vermillion" aria-hidden="true">✓</span>
				<span>A 3D object or dataset that is central to your scholarly argument</span>
			</li>
			<li class="flex gap-3 border-b border-base-300 pb-4">
				<span class="font-bold text-vermillion" aria-hidden="true">✓</span>
				<span>Context, metadata and interpretive material for the edition</span>
			</li>
			<li class="flex gap-3">
				<span class="font-bold text-vermillion" aria-hidden="true">✓</span>
				<span>Rights or permission to publish the assets you submit</span>
			</li>
		</ul>
	</section>

	<section class="border-t border-base-300 pt-10 text-center">
		<h2 class="text-3xl font-bold tracking-tight">Ready to shape your edition?</h2>
		<p class="mx-auto mt-3 max-w-xl text-base-content/65">
			Start with the submission guidelines, then create an account to begin working with Pure 3D.
		</p>
		<div class="mt-6 flex flex-wrap justify-center gap-3">
			<a href="{base}/documentation/submission" class="btn btn-primary">Review the guidelines</a>
			{#if !authStore.isAuthenticated}
				<a href="{base}/register" class="btn btn-ghost">Create an account</a>
			{/if}
		</div>
	</section>
</div>
