import PocketBase, { LocalAuthStore } from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { dev } from '$app/environment';

const backendUrl = (PUBLIC_POCKETBASE_URL || 'https://main.57-129-98-223.sslip.io').replace(
	/\/+$/,
	''
);
export const cachePrefix = dev ? `pure3d:dev:${backendUrl}` : 'pure3d';

// Dev modes share a browser origin, but must not share their backend sessions.
export const pb = new PocketBase(
	backendUrl,
	dev ? new LocalAuthStore(`${cachePrefix}:auth`) : undefined
);

pb.autoCancellation(false);

// Types for the posts collection
export interface Post {
	id: string;
	title: string;
	content: string;
	created: string;
	updated: string;
}
