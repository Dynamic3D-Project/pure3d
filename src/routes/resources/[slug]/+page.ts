import { pb } from '$lib/database/client';
import { ClientResponseError } from 'pocketbase';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, fetch }) => {
	try {
		const item = await pb
			.collection('content')
			.getFirstListItem(pb.filter('layout != "guide" && slug = {:slug}', { slug: params.slug }), {
				fetch,
				expand: 'parent,categoryIds'
			});
		return {
			item,
			children: await pb
				.collection('content')
				.getFullList({
					filter: pb.filter('parent = {:id}', { id: item.id }),
					sort: 'order,title',
					fields: 'id,title,slug,layout,isPublished',
					fetch
				})
		};
	} catch (e) {
		if (e instanceof ClientResponseError && e.status === 404)
			error(404, 'This page is not published yet or could not be found.');
		throw e;
	}
};
