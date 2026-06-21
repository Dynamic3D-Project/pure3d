import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';

export const pb = new PocketBase(
	PUBLIC_POCKETBASE_URL || 'https://pure3d-database.ctwhome.com'
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
