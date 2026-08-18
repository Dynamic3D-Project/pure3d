<script lang="ts">
	import { base } from '$app/paths';
	import { authStore, pb } from '$lib/database';
	import { GlobalRole } from '$lib/types/roles';
	import FloatingDropdown from '$lib/components/ui/FloatingDropdown.svelte';
	import LoginForm from './LoginForm.svelte';
	import LoginMarketingPanel from './LoginMarketingPanel.svelte';

	let accountMenuOpen = $state(false);
	let accountButtonElement: HTMLButtonElement | undefined = $state();
	let avatarUrl = $derived.by(() => {
		const user = authStore.user;
		const image = user?.profilePicture || user?.avatar;
		return user && image ? pb.files.getURL(user as any, image, { thumb: '80x80' }) : '';
	});
</script>

<div id="login-button">
	{#if authStore.isAuthenticated}
		<div>
			<button
				bind:this={accountButtonElement}
				type="button"
				aria-haspopup="true"
				aria-expanded={accountMenuOpen}
				class="flex h-12 w-12 items-center justify-center rounded-full transition hover:bg-base-200 active:scale-95"
				onclick={() => (accountMenuOpen = !accountMenuOpen)}
			>
				{#if avatarUrl}
					<img src={avatarUrl} alt="Account" class="size-8 rounded-full object-cover" />
				{:else}
					<div
						class="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white ring-primary ring-offset-2 ring-offset-base-100"
					>
						{authStore.user?.email?.charAt(0).toUpperCase() || 'U'}
					</div>
				{/if}
			</button>
			<FloatingDropdown
				open={accountMenuOpen}
				referenceElement={accountButtonElement}
				placement="bottom-end"
				minWidth={208}
				maxWidth={208}
				role="menu"
				class="p-2"
				onclose={() => (accountMenuOpen = false)}
			>
				<ul class="menu w-full p-0">
					<li class="menu-title px-4 py-2">
						<span class="truncate text-xs text-base-content/70">{authStore.user?.email}</span>
					</li>
					{#if authStore.globalRole === GlobalRole.Admin}
						<li>
							<a
								href="{base}/admin"
								class="flex w-full items-center gap-2"
								onclick={() => (accountMenuOpen = false)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="size-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									/>
								</svg>
								Admin
							</a>
						</li>
					{/if}
					<li>
						<a
							href="{base}/profile"
							class="flex w-full items-center gap-2"
							onclick={() => (accountMenuOpen = false)}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="size-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
								/>
							</svg>
							Profile
						</a>
					</li>
					<li>
						<a
							href="{base}/reviews"
							class="flex w-full items-center gap-2"
							onclick={() => (accountMenuOpen = false)}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="size-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
								/>
							</svg>
							My Work
						</a>
					</li>
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-2 text-error"
							onclick={() => {
								accountMenuOpen = false;
								authStore.logout();
							}}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="size-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
								/>
							</svg>
							Logout
						</button>
					</li>
				</ul>
			</FloatingDropdown>
		</div>
	{:else}
		<div>
			<label for="login-modal" class="modal-button btn btn-md btn-primary">Login</label>
			<input id="login-modal" type="checkbox" class="modal-toggle" />
			<div class="modal h-screen">
				<div class="modal-box h-[90vh] w-[95vw] max-w-5xl overflow-hidden p-0">
					<label for="login-modal" class="btn absolute top-3 right-3 z-20 btn-circle btn-ghost"
						>✕</label
					>

					<div class="grid h-full grid-cols-1 lg:grid-cols-2">
						<div class="hidden lg:block">
							<LoginMarketingPanel />
						</div>
						<div class="overflow-y-auto">
							<LoginForm />
						</div>
					</div>
				</div>
				<label class="modal-backdrop" for="login-modal">Close</label>
			</div>
		</div>
	{/if}
</div>
