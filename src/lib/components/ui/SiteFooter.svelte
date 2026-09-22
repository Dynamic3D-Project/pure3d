<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Editable links are validated and resolved before rendering. */
	import { base } from '$app/paths';
	import { menus, resolvedItems, resolvedLink } from '$lib/stores/navigation';
	let items = $derived(resolvedItems($menus.footer, $menus.directory));
	let primary = $derived(resolvedLink($menus.footer.primary, $menus.directory));
	let help = $derived(resolvedLink($menus.footer.helpLink, $menus.directory));
	const href = (value: string) => (value.startsWith('/') ? `${base}${value}` : value);
</script>

<footer id="site-footer" class="border-t border-base-300 bg-base-200 px-6 py-10">
	<div class="mx-auto max-w-7xl">
		<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
			{#each items as item (item.id)}<section>
					<h2 class="mb-4 text-sm font-semibold">{item.label}</h2>
					{#if item.direct}<a class="text-sm underline" href={href(item.direct.href)}
							>{item.direct.label}</a
						>{:else}{#each item.groups as group (group.id)}<div class="mb-5">
								<h3 class="mb-2 text-xs opacity-50">{group.label}</h3>
								<ul class="space-y-2 text-sm">
									{#each group.links as link (link.id)}<li>
											<a class="hover:underline" href={href(link.href)}>{link.label}</a>
										</li>{/each}
								</ul>
							</div>{/each}{/if}
					{#if item.featured}<aside class="mt-4 rounded-lg border border-base-300 p-4">
							<p class="text-xs opacity-60">{item.featured.kicker}</p>
							<p class="my-3 text-2xl tracking-widest">{item.featured.artwork}</p>
							<h3 class="font-semibold">{item.featured.title}</h3>
							<p class="my-2 text-sm opacity-60">{item.featured.description}</p>
							<a class="text-sm underline" href={href(item.featured.link.href)}
								>{item.featured.link.label}</a
							>
						</aside>{/if}
				</section>{/each}
		</div>
		<div
			class="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-base-300 pt-6 text-sm"
		>
			<p>
				{$menus.footer.helpText}
				{#if help}<a class="underline" href={href(help.href)}>{help.label}</a>{/if}
			</p>
			{#if primary}<a class="btn btn-sm btn-neutral" href={href(primary.href)}>{primary.label}</a
				>{/if}
		</div>
	</div>
</footer>

<style>
	a {
		overflow-wrap: anywhere;
	}
</style>
