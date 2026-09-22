import { pb } from '$lib/database/client';
import { error } from '@sveltejs/kit';
import { ClientResponseError } from 'pocketbase';
import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, fetch }) => {
	try {
		return {
			doc: await pb
				.collection('content')
				.getFirstListItem(pb.filter('layout = "guide" && slug = {:slug}', { slug: params.slug }), {
					fetch
				})
		};
	} catch (e) {
		if (e instanceof ClientResponseError && e.status === 404)
			error(404, 'Guide not found or not published.');
		throw e;
	}
};
