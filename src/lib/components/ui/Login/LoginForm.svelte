<script lang="ts">
	import { authStore, isLocalBackend, pb } from '$lib/database';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { dev } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';

	let loading = $state(false);
	let error = $state('');
	let checkingProvider = $state(true);
	let providerReady = $state(false);
	let demoRole = $state('');
	const showDemoLogin = dev && isLocalBackend && env.PUBLIC_DEMO_LOGIN === '1';
	const demoAccounts = [
		{ label: 'Admin', email: 'admin@pure3d.eu' },
		{ label: 'User', email: 'user@pure3d.eu' }
	];

	onMount(() => {
		void pb
			.collection('users')
			.listAuthMethods()
			.then((methods) => {
				providerReady =
					!!methods.oauth2?.enabled &&
					methods.oauth2.providers.some((provider) => provider.name === 'oidc');
				if (!providerReady) {
					error = dev
						? 'ORCID is not configured for this database. Configure the local PocketBase provider and register its local HTTPS callback. Use make dev-prod only if you intend to access live data. Reload this page after configuration.'
						: 'ORCID sign-in is currently unavailable. Please contact an administrator.';
				}
			})
			.catch(() => {
				error =
					'Cannot reach the sign-in service. Check the backend connection and reload this page.';
			})
			.finally(() => {
				checkingProvider = false;
			});
	});

	async function signIn() {
		if (!providerReady) return;
		loading = true;
		error = '';
		try {
			await authStore.loginWithOrcid();
			await goto(resolve('/profile'));
		} catch {
			error =
				'Sign-in was not completed. Allow the ORCID popup and try again. If you already have a PURE3D account, ask an administrator to link your ORCID before signing in.';
		} finally {
			loading = false;
		}
	}

	async function signInAs(account: (typeof demoAccounts)[number]) {
		loading = true;
		demoRole = account.label;
		error = '';
		try {
			await authStore.loginWithPassword(account.email, '1234567890');
			await goto(resolve('/profile'));
		} catch {
			error = `Could not sign in as ${account.label}. Rerun make install to provision local demo accounts.`;
		} finally {
			loading = false;
			demoRole = '';
		}
	}
</script>

<div id="login-form" class="flex flex-col justify-center gap-5 p-6 sm:p-8 md:h-full">
	<div>
		<h1 class="text-2xl font-bold tracking-tight text-base-content">One identity for your work</h1>
		<p class="mt-3 text-sm leading-relaxed text-base-content/70">
			Sign in with ORCID to keep your research profile and author credits connected across PURE3D.
			Your first sign-in creates your account.
		</p>
	</div>
	{#if error}
		<p role="alert" class="rounded-lg border border-error/30 bg-error/10 p-4 text-sm">{error}</p>
	{/if}
	<button
		type="button"
		class="btn w-full btn-primary"
		disabled={loading || checkingProvider || !providerReady}
		aria-busy={loading || checkingProvider}
		onclick={signIn}
	>
		{#if loading}<span class="loading loading-sm loading-spinner" aria-hidden="true"></span>{/if}
		{checkingProvider
			? 'Checking ORCID...'
			: loading
				? 'Connecting to ORCID...'
				: 'Sign in with ORCID'}
	</button>
	{#if showDemoLogin}
		<div class="rounded-lg border border-info/30 bg-info/10 p-4">
			<p class="mb-3 text-xs font-semibold tracking-wide text-base-content/60 uppercase">
				Local demo login
			</p>
			<div class="grid grid-cols-2 gap-2">
				{#each demoAccounts as account (account.email)}
					<button
						type="button"
						class="btn btn-outline btn-info"
						disabled={loading}
						onclick={() => signInAs(account)}
					>
						{loading && demoRole === account.label ? `Signing in...` : account.label}
					</button>
				{/each}
			</div>
		</div>
	{/if}
	<div class="space-y-3 text-sm leading-relaxed text-base-content/70">
		<p class="flex flex-col items-start gap-2">
			<span>No ORCID yet?</span>
			<a
				class="btn w-fit border border-base-content/50 bg-transparent text-base-content btn-sm hover:border-base-content hover:bg-transparent"
				style="text-decoration: none"
				href="https://orcid.org/register"
				target="_blank"
				rel="noopener noreferrer"
			>
				Create your free ORCID iD
			</a>
		</p>
	</div>
	<p class="border-t border-base-300 pt-4 text-xs leading-relaxed text-base-content/60">
		PURE3D imports public profile information from ORCID. Private or unavailable details are not
		required to sign in. You can refresh your profile after signing in.
	</p>
</div>
