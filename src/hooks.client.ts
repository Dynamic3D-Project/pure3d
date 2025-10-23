import { pb } from '$lib/database';

// Sync PocketBase auth state with cookies
pb.authStore.onChange(() => {
	if (pb.authStore.isValid) {
		// Save auth state as cookie
		document.cookie = pb.authStore.exportToCookie({
			httpOnly: false,
			secure: false,
			sameSite: 'lax'
		});
	} else {
		// Clear cookie on logout
		document.cookie = 'pb_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
	}
});
