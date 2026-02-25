<script lang="ts">
	import PhKeyBold from '~icons/ph/key-bold';
	import { dev } from '$app/environment';
	import { authStore } from '$lib/database';
	import { closeLoginModal, getAuthErrorMessage, validateEmail } from './utils';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let isLoading = $state(false);

	const demoAccounts = [
		{ label: 'Super Admin', email: 'superadmin@pure3d.eu', role: 'superadmin' },
		{ label: 'Admin', email: 'admin@pure3d.eu', role: 'admin' },
		{ label: 'Editorial Board', email: 'editor@pure3d.eu', role: 'editorial_board' },
		{ label: 'Viewer', email: 'viewer@pure3d.eu', role: 'viewer' }
	];

	function fillDemo(account: (typeof demoAccounts)[0]) {
		email = account.email;
		password = '1234567890';
	}

	async function handleEmailSignIn() {
		error = '';
		isLoading = true;

		// Validate email
		const emailError = validateEmail(email);
		if (emailError) {
			error = emailError;
			isLoading = false;
			return;
		}

		try {
			await authStore.login(email, password);

			// Close modal after successful login
			closeLoginModal();

			// Clear form
			email = '';
			password = '';
		} catch (e) {
			error = getAuthErrorMessage(e);
			console.error('Sign in error:', e);
		} finally {
			isLoading = false;
		}
	}
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleEmailSignIn();
	}}
	aria-label="Email login form"
>
	<div class="space-y-3">
		<div class="form-control-float">
			<input
				id="email"
				bind:value={email}
				type="email"
				placeholder=" "
				required
				autocomplete="email"
				disabled={isLoading}
				aria-invalid={error && !validateEmail(email) ? 'true' : undefined}
			/>
			<label for="email">Email</label>
		</div>

		<div class="form-control-float">
			<input
				id="password"
				bind:value={password}
				type="password"
				placeholder=" "
				required
				autocomplete="current-password"
				disabled={isLoading}
			/>
			<label for="password">Password</label>
		</div>

		{#if error}
			<div class="alert alert-error" role="alert">{error}</div>
		{/if}

		<button
			type="submit"
			class="btn btn-outline btn-secondary w-full"
			disabled={isLoading}
			aria-busy={isLoading}
		>
			<PhKeyBold class="size-5" />
			{isLoading ? 'Signing in...' : 'Sign in with Email'}
		</button>

		{#if dev}
			<div id="demo-accounts" class="mt-4 rounded-lg border border-dashed border-base-300 p-3">
				<p class="mb-2 text-xs font-medium text-base-content/50">Demo Accounts</p>
				<div class="flex flex-wrap gap-1.5">
					{#each demoAccounts as account (account.email)}
						<button
							type="button"
							class="badge badge-outline badge-sm cursor-pointer gap-1 transition-colors hover:badge-neutral"
							onclick={() => fillDemo(account)}
						>
							{account.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</form>
