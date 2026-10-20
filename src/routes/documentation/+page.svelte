<script lang="ts">
	import { resolve } from '$app/paths';
	import { authStore } from '$lib/database';
</script>

<svelte:head>
	<title>Publish with us | PURE3D</title>
	<meta
		name="description"
		content="Create and publish a peer-reviewed 3D scholarly edition with PURE3D."
	/>
</svelte:head>

<div id="documentation-page" class="space-y-16 pb-8">
	<section
		class="relative overflow-hidden rounded-box bg-ink px-6 py-12 text-paper sm:px-10 sm:py-16"
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
				publication. PURE3D guides your edition from proposal through review to publication.
			</p>
			<div class="mt-8 flex flex-wrap gap-3">
				{#if authStore.isAuthenticated}
					<a
						href={resolve('/reviews')}
						class="btn border-paper bg-paper text-ink hover:bg-paper/90"
					>
						Go to my work <span aria-hidden="true">→</span>
					</a>
				{:else}
					<a
						href={resolve('/register')}
						class="btn border-paper bg-paper text-ink hover:bg-paper/90"
					>
						Create an author account <span aria-hidden="true">→</span>
					</a>
				{/if}
				<a
					href={resolve('/learning-materials')}
					class="btn border-paper/30 bg-transparent text-paper hover:border-paper hover:bg-paper/10"
				>
					Access Learning Resources
				</a>
			</div>
		</div>
	</section>

	<section class="grid gap-8 rounded-box bg-base-200 p-6 sm:p-10 lg:grid-cols-[1fr_1.15fr]">
		<div>
			<p class="mb-3 text-xs font-bold tracking-[0.18em] text-vermillion uppercase">
				Before you begin
			</p>
			<h2 class="text-3xl font-bold tracking-tight">
				Getting started with a 3D scholarly edition means submitting a concept proposal
			</h2>
		</div>
		<ul class="space-y-4 text-base-content/75">
			<li class="flex gap-3 border-b border-base-300 pb-4">
				<span class="font-bold text-vermillion" aria-hidden="true">✓</span>
				<span>
					Every user needs an <a href="https://orcid.org/register" class="underline">ORCID iD</a>. You
					can create one when you log in to PURE3D for the first time.
				</span>
			</li>
			<li class="flex gap-3 border-b border-base-300 pb-4">
				<span class="font-bold text-vermillion" aria-hidden="true">✓</span>
				<span>
					One or more 3D object(s) that are central to your narrative goals and intended audience.
				</span>
			</li>
			<li class="flex gap-3 border-b border-base-300 pb-4">
				<span class="font-bold text-vermillion" aria-hidden="true">✓</span>
				<span>
					References, multimedia and any other information that can be repurposed to provide
					context, sources and interpretive materials.
				</span>
			</li>
			<li class="flex gap-3">
				<span class="font-bold text-vermillion" aria-hidden="true">✓</span>
				<span>
					Rights or permission to publish the materials used in your 3D scholarly edition.
				</span>
			</li>
		</ul>
	</section>
</div>
