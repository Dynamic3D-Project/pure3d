<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base, resolveRoute } from '$app/paths';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { GlobalRole } from '$lib/types/roles';

	let { children } = $props();

	let sidebarOpen = $state(false);

	const navItems = [
		{
			label: 'Users',
			href: `${base}/admin/users`,
			icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H9m6 0a5.972 5.972 0 0 0-.786-3.07M9 19.128A9.38 9.38 0 0 1 6.375 18.75a9.337 9.337 0 0 1-4.121-.952 4.125 4.125 0 0 1 7.533-2.493M9 19.128v-.003c0-1.113.285-2.16.786-3.07M9 19.128H3m12-3.07a5.972 5.972 0 0 1 .786-3.07M3 15.128V5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v9.628'
		},
		{
			label: 'Collections',
			href: `${base}/admin/collections`,
			icon: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z'
		},
		{
			label: 'Editions',
			href: `${base}/admin/editions`,
			icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25'
		},
		{
			label: 'Audit Log',
			href: `${base}/admin/audit`,
			icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z'
		}
	];

	function isNavActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}

	onMount(() => {
		if (!authStore.isAuthenticated) {
			goto(resolveRoute('/', {}));
			return;
		}
		if (
			authStore.globalRole !== GlobalRole.SuperAdmin &&
			authStore.globalRole !== GlobalRole.Admin
		) {
			goto(resolveRoute('/', {}));
			return;
		}
	});
</script>

<div id="admin-layout" class="flex min-h-[calc(100vh-80px)]">
	<!-- Mobile sidebar toggle -->
	<button
		class="btn fixed bottom-4 left-4 z-50 btn-ghost lg:hidden"
		onclick={() => (sidebarOpen = !sidebarOpen)}
		aria-label="Toggle sidebar"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="size-6"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
			/>
		</svg>
	</button>

	<!-- Sidebar -->
	<aside
		class="fixed inset-y-0 left-0 z-40 w-64 transform border-r border-base-300 bg-base-200 pt-20 transition-transform duration-200 lg:sticky lg:top-[60px] lg:h-[calc(100vh-60px)] lg:translate-x-0 lg:pt-0"
		class:translate-x-0={sidebarOpen}
		class:-translate-x-full={!sidebarOpen}
	>
		<div class="p-4">
			<h2 class="mb-4 text-lg font-bold">Admin</h2>
			<ul class="menu w-full gap-1">
				{#each navItems as item (item.href)}
					<li>
						<a
							href={item.href}
							class="flex items-center gap-3"
							class:active={isNavActive(item.href)}
							onclick={() => (sidebarOpen = false)}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="size-5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
							</svg>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</aside>

	<!-- Backdrop for mobile -->
	{#if sidebarOpen}
		<button
			class="fixed inset-0 z-30 cursor-default border-none bg-black/50 lg:hidden"
			onclick={() => (sidebarOpen = false)}
			aria-label="Close sidebar"
		></button>
	{/if}

	<!-- Main content -->
	<main class="flex-1 p-4 lg:p-8">
		{@render children?.()}
	</main>
</div>
