import { pb } from '$lib/database/client';
import { error } from '@sveltejs/kit';
import { ClientResponseError } from 'pocketbase';
import type { PageLoad } from './$types';

const fallbackMaterialSlugs = [
	'voyager-video-tutorials',
	'voyager-tutorial-on-25-northumberland-road',
	'3d-model-faq-troubleshooting',
	'platform-guide',
	'tutorials'
];

export const load: PageLoad = async ({ fetch }) => {
	try {
		const records = await pb.collection('content').getFullList({
			filter: 'kind = "page" && learningMaterial = true && isPublished = true',
			sort: 'learningMaterialOrder,title',
			fields: 'id,title,slug,summary,layout,learningMaterialOrder',
			fetch
		});
		return { materials: records };
	} catch (e) {
		let failure = e;
		// Keep the existing landing page populated while the additive CMS fields are rolled out.
		if (e instanceof ClientResponseError && e.status === 400) {
			try {
				const slugs = fallbackMaterialSlugs
					.map((slug) => pb.filter('slug = {:slug}', { slug }))
					.join(' || ');
				const records = await pb.collection('content').getFullList({
					filter: `(${slugs}) && isPublished = true`,
					fields: 'id,title,slug,summary,layout',
					fetch
				});
				const bySlug = new Map(records.map((item) => [item.slug, item]));
				return {
					materials: fallbackMaterialSlugs.flatMap((slug) => bySlug.get(slug) ?? [])
				};
			} catch (fallbackError) {
				failure = fallbackError;
			}
		}
		if (failure instanceof ClientResponseError)
			error(failure.status === 404 ? 404 : 503, 'Learning materials could not be loaded.');
		throw failure;
	}
};
