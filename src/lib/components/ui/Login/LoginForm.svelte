<script lang="ts">
	import EmailLoginForm from './EmailLoginForm.svelte';
	import RegisterForm from './RegisterForm.svelte';

	type Tab = 'signin' | 'register';
	let activeTab = $state<Tab>('signin');

	function handleRegistrationSuccess() {
		activeTab = 'signin';
	}
</script>

<div id="login-form" class="flex h-full flex-col p-6 sm:p-8">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-base-content">
			{activeTab === 'signin' ? 'Welcome back' : 'Create your account'}
		</h1>
		<p class="mt-1 text-sm text-base-content/60">
			{activeTab === 'signin'
				? 'Sign in to access your Pure3D projects'
				: 'Get started with Pure3D today'}
		</p>
	</div>

	<div role="tablist" class="tabs tabs-bordered mb-6">
		<button
			type="button"
			role="tab"
			class="tab {activeTab === 'signin' ? 'tab-active' : ''}"
			onclick={() => (activeTab = 'signin')}
		>
			Sign In
		</button>
		<button
			type="button"
			role="tab"
			class="tab {activeTab === 'register' ? 'tab-active' : ''}"
			onclick={() => (activeTab = 'register')}
		>
			Create Account
		</button>
	</div>

	<div class="flex-1 overflow-y-auto">
		<div class="flex flex-col gap-4">
			{#if activeTab === 'signin'}
				<EmailLoginForm />
			{:else}
				<RegisterForm onRegistrationSuccess={handleRegistrationSuccess} />
			{/if}
		</div>
	</div>

	<div class="mt-6 border-t border-base-300 pt-4 text-center text-xs text-base-content/40">
		By continuing, you agree to Pure3D's Terms of Service and Privacy Policy.
	</div>
</div>
