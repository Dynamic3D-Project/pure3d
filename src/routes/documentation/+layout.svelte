<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	let pages = $derived(data.pages);
	let currentSlug = $derived($page.params.slug || '');
</script>

<div id="documentation-layout" class="container mx-auto max-w-7xl px-4 py-8">
	<div class="flex flex-col gap-8 lg:flex-row">
		<!-- Sidebar -->
		<nav class="shrink-0 lg:sticky lg:top-16 lg:w-64 lg:self-start">
			<!-- Mobile: horizontal scrollable tabs -->
			<div class="flex gap-2 overflow-x-auto border-b border-base-300 pb-3 lg:hidden">
				<a
					href="{base}/documentation"
					class="rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition hover:border-base-content"
					class:border-ink={!currentSlug}
					class:bg-ink={!currentSlug}
					class:text-paper={!currentSlug}
					class:border-base-300={!!currentSlug}
				>
					Get started
				</a>
				{#each pages as p (p.id)}
					<a
						href="{base}/documentation/{p.slug}"
						class="rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition hover:border-base-content"
						class:border-ink={currentSlug === p.slug}
						class:bg-ink={currentSlug === p.slug}
						class:text-paper={currentSlug === p.slug}
						class:border-base-300={currentSlug !== p.slug}
					>
						{p.title}
					</a>
				{/each}
			</div>

			<!-- Desktop: vertical sidebar -->
			<div class="hidden lg:block">
				<p class="text-xs font-bold tracking-[0.18em] text-vermillion uppercase">Publish with us</p>
				<h2 class="mt-2 mb-5 text-2xl font-bold tracking-tight">Guide contents</h2>
				<ul class="w-full border-t border-base-300">
					<li class="border-b border-base-300">
						<a
							href="{base}/documentation"
							class="block border-l-2 border-transparent px-3 py-3 text-sm transition hover:bg-base-200/60"
							class:border-l-vermillion={!currentSlug}
							class:bg-base-200={!currentSlug}
						>
							<span class:font-bold={!currentSlug}>Get started</span>
						</a>
					</li>
					{#each pages as p (p.id)}
						<li class="border-b border-base-300">
							<a
								href="{base}/documentation/{p.slug}"
								class="block border-l-2 border-transparent px-3 py-3 text-sm transition hover:bg-base-200/60"
								class:border-l-vermillion={currentSlug === p.slug}
								class:bg-base-200={currentSlug === p.slug}
							>
								<span class:font-bold={currentSlug === p.slug}>{p.title}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</nav>

		<!-- Content -->
		<main class="min-w-0 flex-1">
			{@render children?.()}
		</main>
	</div>
</div>
