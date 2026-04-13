<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	let pages = $derived(data.pages);
	let currentSlug = $derived($page.params.slug || '');
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<div class="flex flex-col gap-8 lg:flex-row">
		<!-- Sidebar -->
		<nav class="shrink-0 lg:w-64">
			<!-- Mobile: horizontal scrollable tabs -->
			<div class="flex gap-2 overflow-x-auto pb-2 lg:hidden">
				<a
					href="{base}/documentation"
					class="btn btn-sm whitespace-nowrap"
					class:btn-active={!currentSlug}
				>
					Overview
				</a>
				{#each pages as p (p.id)}
					<a
						href="{base}/documentation/{p.slug}"
						class="btn btn-sm whitespace-nowrap"
						class:btn-active={currentSlug === p.slug}
					>
						{p.title}
					</a>
				{/each}
			</div>

			<!-- Desktop: vertical sidebar -->
			<div class="hidden lg:block">
				<h2 class="mb-4 text-lg font-bold">Documentation</h2>
				<ul class="menu w-full gap-1 rounded-box bg-base-200 p-2">
					<li>
						<a
							href="{base}/documentation"
							class:bg-base-300={!currentSlug}
							class:font-semibold={!currentSlug}
						>
							Overview
						</a>
					</li>
					{#each pages as p (p.id)}
						<li>
							<a
								href="{base}/documentation/{p.slug}"
								class:bg-base-300={currentSlug === p.slug}
								class:font-semibold={currentSlug === p.slug}
							>
								{p.title}
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
