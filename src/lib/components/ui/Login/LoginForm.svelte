<script lang="ts">
	import { authStore } from '$lib/database';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	let loading = $state(false);
	let error = $state('');

	async function signIn() {
		loading = true;
		error = '';
		try {
			await authStore.loginWithOrcid();
			await goto(`${base}/profile`);
		} catch {
			error =
				'Sign-in was not completed. Allow the ORCID popup and try again. If you already have a PURE3D account, ask an administrator to link your ORCID before signing in.';
		} finally {
			loading = false;
		}
	}
</script>

<div id="login-form" class="flex h-full flex-col justify-center gap-6 p-6 sm:p-8">
	<div>
		<p class="mb-3 text-sm font-semibold text-primary">Your research, connected</p>
		<h1 class="text-3xl font-bold text-base-content">One identity for your work</h1>
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
		disabled={loading}
		aria-busy={loading}
		onclick={signIn}
	>
		{#if loading}<span class="loading loading-sm loading-spinner" aria-hidden="true"></span>{/if}
		{loading ? 'Connecting to ORCID...' : 'Sign in with ORCID'}
	</button>
	<div class="space-y-3 text-sm leading-relaxed text-base-content/70">
		<p>
			ORCID verifies your identity. Your PURE3D permissions remain managed by your project team.
		</p>
		<p>
			Already have a PURE3D account? Ask an administrator to link your existing account to your
			ORCID so you keep your projects and access.
		</p>
		<p>
			No ORCID yet?
			<a class="link" href="https://orcid.org/register" target="_blank" rel="noopener noreferrer">
				Create your free ORCID iD
			</a>.
		</p>
	</div>
	<p class="border-t border-base-300 pt-4 text-xs leading-relaxed text-base-content/60">
		PURE3D imports public profile information from ORCID. Private or unavailable details are not
		required to sign in. You can refresh your profile after signing in.
	</p>
</div>
