import { pb } from '$lib/database/client';
import type { PageLoad } from './$types';
export const load: PageLoad = async ({ url, fetch }) => {
	const category = url.searchParams.get('category') || '';
	const categories = await pb.collection('cms_categories').getFullList({ sort: 'name', fetch });
	const active = categories.find((c) => c.slug === category);
	const filter =
		'kind = "post"' +
		(active ? pb.filter(' && categoryIds ?= {:category}', { category: active.id }) : '');
	const result = await pb.collection('content').getFullList({
		filter,
		sort: '-publishedAt,title',
		fields: 'id,title,slug,summary,kind,layout,categoryIds,coverUrl,author,publishedAt,isPublished',
		fetch
	});
	return {
		items: result,
		categories,
		category: active?.id || '',
		categoryName: active?.name || '',
		description: active?.description || ''
	};
};
