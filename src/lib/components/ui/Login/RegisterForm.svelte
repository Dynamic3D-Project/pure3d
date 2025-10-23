<script lang="ts">
	import PhKeyBold from '~icons/ph/key-bold';
	import { createEventDispatcher } from 'svelte';
	import { authStore } from '$lib/database';
	import { validateEmail, validatePassword, getAuthErrorMessage, closeLoginModal } from './utils';

	const dispatch = createEventDispatcher<{
		registrationSuccess: void;
	}>();

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let success = $state('');
	let isLoading = $state(false);

	function validateForm(): string | null {
		const emailError = validateEmail(email);
		if (emailError) return emailError;

		const passwordError = validatePassword(password);
		if (passwordError) return passwordError;

		if (password !== confirmPassword) {
			return 'Passwords do not match';
		}

		return null;
	}

	async function handleRegister() {
		error = '';
		success = '';
		isLoading = true;

		const validationError = validateForm();
		if (validationError) {
			error = validationError;
			isLoading = false;
			return;
		}

		try {
			await authStore.register(email, password, confirmPassword);

			success = 'Registration successful! You are now logged in.';

			// Clear form
			email = '';
			password = '';
			confirmPassword = '';

			dispatch('registrationSuccess');

			// Close modal after 1.5 seconds
			setTimeout(() => {
				closeLoginModal();
			}, 1500);
		} catch (e) {
			error = getAuthErrorMessage(e);
			console.error('Registration error:', e);
		} finally {
			isLoading = false;
		}
	}
</script>

<form
	class="rounded-box border-base-300 border p-3"
	onsubmit={(e) => {
		e.preventDefault();
		handleRegister();
	}}
	aria-label="Registration form"
>
	<div class="space-y-3">
		<div class="form-control-float">
			<input
				id="register-email"
				bind:value={email}
				type="email"
				placeholder=" "
				required
				autocomplete="email"
				disabled={isLoading}
				aria-invalid={error && !validateEmail(email) ? 'true' : undefined}
			/>
			<label for="register-email">Email</label>
		</div>

		<div class="form-control-float">
			<input
				id="register-password"
				bind:value={password}
				type="password"
				placeholder=" "
				required
				autocomplete="new-password"
				minlength="8"
				disabled={isLoading}
				aria-invalid={error && !validatePassword(password) ? 'true' : undefined}
			/>
			<label for="register-password">Password (min. 8 characters)</label>
		</div>

		<div class="form-control-float">
			<input
				id="register-confirm-password"
				bind:value={confirmPassword}
				type="password"
				placeholder=" "
				required
				autocomplete="new-password"
				minlength="8"
				disabled={isLoading}
				aria-invalid={error && password !== confirmPassword ? 'true' : undefined}
			/>
			<label for="register-confirm-password">Confirm Password</label>
		</div>

		{#if error}
			<div class="alert alert-error" role="alert">{error}</div>
		{/if}

		{#if success}
			<div class="alert alert-success" role="alert">{success}</div>
		{/if}

		<button
			type="submit"
			class="btn btn-outline btn-secondary w-full"
			disabled={isLoading}
			aria-busy={isLoading}
		>
			<PhKeyBold class="size-5" />
			{isLoading ? 'Creating Account...' : 'Create Account'}
		</button>
	</div>
</form>
