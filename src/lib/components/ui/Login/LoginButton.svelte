<script lang="ts">
	import { resolve } from '$app/paths';
	import { authStore, pb } from '$lib/database';
	import { GlobalRole } from '$lib/types/roles';
	import FloatingDropdown from '$lib/components/ui/FloatingDropdown.svelte';
	import LoginForm from './LoginForm.svelte';
	import LoginArtwork from './LoginArtwork.svelte';

	let loginOpen = $state(false);
	let accountMenuOpen = $state(false);
	let accountButtonElement: HTMLButtonElement | undefined = $state();
	let avatarUrl = $derived.by(() => {
		const user = authStore.user;
		const image = user?.profilePicture || user?.avatar;
		return user && image ? pb.files.getURL(user, image, { thumb: '80x80' }) : '';
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
						class="flex size-8 items-center justify-center rounded-full bg-base-200 text-sm font-semibold text-base-content"
					>
						{authStore.user?.nickname?.charAt(0).toUpperCase() || 'U'}
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
				<div class="truncate px-4 py-2 text-xs font-semibold text-base-content/70">
					{authStore.user?.nickname || 'ORCID account'}
				</div>
				<ul class="menu w-full p-0">
					{#if authStore.globalRole === GlobalRole.Admin}
						<li>
							<a
								href={resolve('/admin/workflow')}
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
							href={resolve('/profile')}
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
							My Work
						</a>
					</li>
				</ul>
			</FloatingDropdown>
		</div>
	{:else}
		<div>
			<label
				for="login-modal"
				class="modal-button btn border-base-content/25 bg-transparent px-5 font-normal shadow-none btn-sm hover:border-base-content/40 hover:bg-base-200"
				>Login</label
			>
			<input id="login-modal" type="checkbox" class="modal-toggle" bind:checked={loginOpen} />
			<div class="modal modal-middle">
				<div
					class="modal-box max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg rounded-box border border-base-300 p-0 md:max-w-[872px]"
				>
					<label
						for="login-modal"
						aria-label="Close sign-in"
						class="btn absolute top-3 right-3 z-20 btn-circle btn-ghost btn-sm">✕</label
					>

					<div class="grid md:min-h-[680px] md:grid-cols-[minmax(0,360px)_minmax(0,512px)]">
						<div class="relative hidden overflow-hidden rounded-l-box md:block">
							{#if loginOpen}<LoginArtwork />{/if}
						</div>
						<LoginForm />
					</div>
				</div>
				<label class="modal-backdrop" for="login-modal">Close</label>
			</div>
		</div>
	{/if}
</div>
