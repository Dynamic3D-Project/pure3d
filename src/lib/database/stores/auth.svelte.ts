import { pb } from '../client';
import { browser } from '$app/environment';
import { GlobalRole } from '$lib/types/roles';
import { notificationStore } from './notifications.svelte';

interface User {
	id: string;
	email: string;
	username?: string;
	verified: boolean;
	nickname?: string;
	avatar?: string;
	profilePicture?: string;
	orcid?: string;
	orcidVerifiedAt?: string;
	affiliation?: string;
	titleRole?: string;
	bio?: string;
	socials?: string;
	role?: GlobalRole;
	created: string;
	updated: string;
}

class AuthStore {
	user = $state<User | null>(null);
	isAuthenticated = $derived(!!this.user);
	appUserId = $derived(this.user?.id ?? null);
	globalRole = $derived<GlobalRole>(this.user?.role ?? GlobalRole.User);

	constructor() {
		if (browser) {
			this.user = pb.authStore.model as User | null;

			pb.authStore.onChange(() => {
				this.user = pb.authStore.model as User | null;
				if (this.user) {
					notificationStore.subscribe(this.user.id);
				} else {
					notificationStore.unsubscribeAll();
				}
			});

			if (this.user) {
				notificationStore.subscribe(this.user.id);
			}
		}
	}

	async loginWithOrcid() {
		const authData = await pb.collection('users').authWithOAuth2({
			provider: 'oidc',
			scopes: ['openid']
		});
		if (!authData.record.orcid || !authData.record.orcidVerifiedAt) {
			this.logout();
			throw new Error('ORCID verification was not completed. Please contact an administrator.');
		}
		this.user = authData.record as unknown as User;
		try {
			await pb.send('/api/pure3d/orcid/profile-refresh', { method: 'POST' });
			const record = await pb.collection('users').getOne(authData.record.id);
			pb.authStore.save(pb.authStore.token, record);
		} catch {
			// A public-profile outage must not undo a verified sign-in; users can retry in Profile.
		}
		return authData;
	}

	async loginWithPassword(email: string, password: string) {
		return await pb.collection('users').authWithPassword(email, password);
	}

	logout() {
		pb.authStore.clear();
		this.user = null;
		notificationStore.unsubscribeAll();
	}
}

export const authStore = new AuthStore();
