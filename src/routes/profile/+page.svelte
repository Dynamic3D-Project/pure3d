<script lang="ts">
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	interface ProfileData {
		displayName: string;
		username: string;
		email: string;
		role: string;
		verified: boolean;
		joinDate: string;
	}

	let profileData = $state<ProfileData | null>(null);
	let isEditing = $state(false);
	let saveMessage = $state('');
	let errorMessage = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);

	let tempData = $state({
		displayName: '',
		username: ''
	});

	// Load user profile data
	onMount(async () => {
		if (!authStore.isAuthenticated) {
			goto('/');
			return;
		}

		await loadProfile();
	});

	async function loadProfile() {
		try {
			isLoading = true;
			const user = authStore.user;

			if (!user) {
				goto('/');
				return;
			}

			profileData = {
				displayName: user.username || user.email || 'User',
				username: user.username || '',
				email: user.email,
				role: 'user',
				verified: user.verified,
				joinDate: new Date(user.created).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long'
				})
			};
		} catch (error) {
			console.error('Error loading profile:', error);
			errorMessage = 'Failed to load profile data';
		} finally {
			isLoading = false;
		}
	}

	function startEdit() {
		if (!profileData) return;

		isEditing = true;
		tempData = {
			displayName: profileData.displayName,
			username: profileData.username
		};
		saveMessage = '';
		errorMessage = '';
	}

	function cancelEdit() {
		isEditing = false;
		tempData = {
			displayName: profileData?.displayName || '',
			username: profileData?.username || ''
		};
		errorMessage = '';
	}

	async function saveProfile() {
		if (!authStore.user?.id) return;

		try {
			isSaving = true;
			errorMessage = '';

			await pb.collection('users').update(authStore.user.id, {
				username: tempData.username || undefined
			});

			if (profileData) {
				profileData.displayName = tempData.username || tempData.displayName;
				profileData.username = tempData.username;
			}

			isEditing = false;
			saveMessage = '✓ Profile updated successfully!';
			setTimeout(() => {
				saveMessage = '';
			}, 3000);
		} catch (error: any) {
			console.error('Error updating profile:', error);
			errorMessage = error?.message || 'Failed to update profile. Please try again.';
		} finally {
			isSaving = false;
		}
	}
</script>

{#if isLoading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<span class="loading loading-spinner loading-lg"></span>
			<p class="mt-4 text-base-content/60">Loading profile...</p>
		</div>
	</div>
{:else if authStore.isAuthenticated && profileData}
	<div class="container mx-auto max-w-4xl px-4 py-8">
		<!-- Profile Header -->
		<div class="mb-8 rounded-lg border border-base-300 bg-base-100 p-6 shadow-md">
			<div class="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
				<!-- Avatar -->
				<div class="avatar placeholder">
					<div class="w-24 rounded-full bg-primary text-primary-content">
						<span class="text-3xl">{profileData.displayName.charAt(0).toUpperCase()}</span>
					</div>
				</div>

				<!-- User Info -->
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<h1 class="text-3xl font-bold">{profileData.displayName}</h1>
						{#if profileData.verified}
							<span class="badge badge-success badge-sm">Verified</span>
						{/if}
					</div>
					<p class="text-base-content/70">{profileData.email}</p>
					<p class="mt-2 text-sm text-base-content/60">Member since {profileData.joinDate}</p>
				</div>

				<!-- Edit Button -->
				{#if !isEditing}
					<button onclick={startEdit} class="btn btn-primary btn-sm">
						Edit Profile
					</button>
				{/if}
			</div>
		</div>

		<!-- Profile Details / Edit Form -->
		<div class="rounded-lg border border-base-300 bg-base-100 p-6 shadow-md">
			<h2 class="mb-4 text-2xl font-semibold">Profile Details</h2>

			{#if saveMessage}
				<div class="alert alert-success mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{saveMessage}</span>
				</div>
			{/if}

			{#if errorMessage}
				<div class="alert alert-error mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{errorMessage}</span>
				</div>
			{/if}

			{#if isEditing}
				<!-- Edit Form -->
				<form
					onsubmit={(e) => {
						e.preventDefault();
						saveProfile();
					}}
					class="space-y-4"
				>
					<div>
						<label for="username" class="mb-1 block text-sm font-medium">
							Username
						</label>
						<input
							id="username"
							type="text"
							bind:value={tempData.username}
							class="input input-bordered w-full"
							placeholder="Choose a username"
						/>
						<p class="mt-1 text-xs text-base-content/60">
							This will be your display name throughout the site
						</p>
					</div>

					<div>
						<label for="email-readonly" class="mb-1 block text-sm font-medium">
							Email (Read-only)
						</label>
						<input
							id="email-readonly"
							type="email"
							value={profileData.email}
							class="input input-bordered w-full"
							disabled
						/>
						<p class="mt-1 text-xs text-base-content/60">
							Email cannot be changed here. Contact support if needed.
						</p>
					</div>

					<div class="flex gap-3">
						<button type="submit" class="btn btn-primary" disabled={isSaving}>
							{#if isSaving}
								<span class="loading loading-spinner loading-sm"></span>
								Saving...
							{:else}
								Save Changes
							{/if}
						</button>
						<button type="button" onclick={cancelEdit} class="btn btn-ghost" disabled={isSaving}>
							Cancel
						</button>
					</div>
				</form>
			{:else}
				<!-- View Mode -->
				<div class="space-y-4">
					<div>
						<div class="text-sm font-medium text-base-content/60">Username</div>
						<p class="mt-1">{profileData.username || 'Not set'}</p>
					</div>

					<div>
						<div class="text-sm font-medium text-base-content/60">Email</div>
						<p class="mt-1">{profileData.email}</p>
					</div>

					<div>
						<div class="text-sm font-medium text-base-content/60">Account Status</div>
						<p class="mt-1">
							{#if profileData.verified}
								<span class="badge badge-success">Verified</span>
							{:else}
								<span class="badge badge-warning">Not Verified</span>
							{/if}
						</p>
					</div>

					<div>
						<div class="text-sm font-medium text-base-content/60">Member Since</div>
						<p class="mt-1">{profileData.joinDate}</p>
					</div>
				</div>
			{/if}
		</div>

	</div>
{:else}
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<h1 class="mb-4 text-2xl font-bold">Please log in to view your profile</h1>
			<a href="/" class="btn btn-primary">Go to Home</a>
		</div>
	</div>
{/if}
