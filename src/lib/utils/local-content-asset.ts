import { dev } from '$app/environment';

// Imported local CMS assets use PocketBase's host-only URL. In HTTPS development,
// serve them through Vite's same-origin /api proxy so remote previews can load them.
export function localContentAssetUrl(value: string): string {
	if (!dev || typeof window === 'undefined' || window.location.protocol !== 'https:') return value;
	try {
		const url = new URL(value);
		if (
			['127.0.0.1', 'localhost'].includes(url.hostname) &&
			url.port === '60021' &&
			url.pathname.startsWith('/api/files/')
		)
			return `${window.location.origin}${url.pathname}${url.search}`;
	} catch {
		// Leave non-URL values to the content sanitizer.
	}
	return value;
}
