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
	role?: GlobalRole;
	created: string;
	updated: string;
}

class AuthStore {
	user = $state<User | null>(null);
	isAuthenticated = $derived(!!this.user);
	appUserId = $derived(this.user?.id ?? null);
	globalRole = $derived<GlobalRole>(this.user?.role ?? GlobalRole.Viewer);

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

	async login(email: string, password: string) {
		const authData = await pb.collection('users').authWithPassword(email, password);
		this.user = authData.record as unknown as User;
		return authData;
	}

	async register(email: string, password: string, passwordConfirm: string) {
		await pb.collection('users').create({
			email,
			password,
			passwordConfirm,
			nickname: email.split('@')[0],
			role: GlobalRole.Viewer
		});
		await this.login(email, password);
	}

	logout() {
		pb.authStore.clear();
		this.user = null;
		notificationStore.unsubscribeAll();
	}
}

export const authStore = new AuthStore();
