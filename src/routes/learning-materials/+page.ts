import { pb } from '$lib/database/client';
import { error } from '@sveltejs/kit';
import { ClientResponseError } from 'pocketbase';
import type { PageLoad } from './$types';

const materialSlugs = [
	'voyager-video-tutorials',
	'voyager-tutorial-on-25-northumberland-road',
	'3d-model-faq-troubleshooting',
	'platform-guide',
	'tutorials'
];

export const load: PageLoad = async ({ fetch }) => {
	try {
		const slugs = materialSlugs.map((slug) => pb.filter('slug = {:slug}', { slug })).join(' || ');
		const records = await pb.collection('content').getFullList({
			filter: `(${slugs}) && isPublished = true`,
			fields: 'id,title,slug,summary,layout',
			fetch
		});
		const bySlug = new Map(records.map((item) => [item.slug, item]));

		return { materials: materialSlugs.flatMap((slug) => bySlug.get(slug) ?? []) };
	} catch (e) {
		if (e instanceof ClientResponseError)
			error(e.status === 404 ? 404 : 503, 'Learning materials could not be loaded.');
		throw e;
	}
};
