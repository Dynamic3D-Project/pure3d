import { pb } from '$lib/database/client';
import { orderedPages } from '$lib/cms';
import type { LayoutLoad } from './$types';
export const ssr = false;
export const load: LayoutLoad = async ({ fetch }) => {
	const records = await pb
		.collection('content')
		.getFullList({ filter: 'kind = "page" && layout = "guide"', sort: 'order,title', fetch });
	const root = records.find((r) => r.slug === 'documentation');
	const chapters = records.filter((r) => r.id !== root?.id);
	const pages = [...(root ? orderedPages(chapters, root.id) : []), ...orderedPages(chapters)].map(
		({ item, depth }) => ({
			id: item.id,
			title: item.title,
			slug: item.slug,
			summary: item.summary || '',
			order: item.order,
			depth,
			isPublished: item.isPublished
		})
	);
	return { pages, root };
};
