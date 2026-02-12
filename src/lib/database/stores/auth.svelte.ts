import { pb } from '../client';
import { browser } from '$app/environment';
import { GlobalRole } from '$lib/types/roles';

interface User {
	id: string;
	email: string;
	username?: string;
	verified: boolean;
	created: string;
	updated: string;
}

class AuthStore {
	user = $state<User | null>(null);
	isAuthenticated = $derived(!!this.user);

	// App-level user data (from `users` collection, not PB auth)
	appUserId = $state<string | null>(null);
	globalRole = $state<GlobalRole>(GlobalRole.Viewer);

	constructor() {
		if (browser) {
			this.user = pb.authStore.model as User | null;

			pb.authStore.onChange(() => {
				this.user = pb.authStore.model as User | null;
				if (this.user) {
					this.fetchAppUser(this.user.email);
				} else {
					this.appUserId = null;
					this.globalRole = GlobalRole.Viewer;
				}
			});

			// Resolve role on init if already authenticated
			if (this.user) {
				this.fetchAppUser(this.user.email);
			}
		}
	}

	private async fetchAppUser(email: string) {
		try {
			const result = await pb.collection('users').getList(1, 1, {
				filter: `email = "${email}"`
			});
			if (result.items.length > 0) {
				const record = result.items[0];
				this.appUserId = record.id;
				this.globalRole = (record.role as GlobalRole) || GlobalRole.Viewer;
			} else {
				this.appUserId = null;
				this.globalRole = GlobalRole.Viewer;
			}
		} catch {
			this.appUserId = null;
			this.globalRole = GlobalRole.Viewer;
		}
	}

	async login(email: string, password: string) {
		const authData = await pb.collection('users').authWithPassword(email, password);
		this.user = authData.record as unknown as User;
		await this.fetchAppUser(email);
		return authData;
	}

	async register(email: string, password: string, passwordConfirm: string) {
		const data = {
			email,
			password,
			passwordConfirm
		};
		const record = await pb.collection('users').create(data);
		// Auto-login after registration
		await this.login(email, password);
		return record;
	}

	logout() {
		pb.authStore.clear();
		this.user = null;
		this.appUserId = null;
		this.globalRole = GlobalRole.Viewer;
	}
}

export const authStore = new AuthStore();
