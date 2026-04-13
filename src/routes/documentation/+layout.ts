import { pb } from '$lib/database/client';
import type { LayoutLoad } from './$types';
import type { Documentation } from '$lib/types/documentation';

export const ssr = false;

export const load: LayoutLoad = async () => {
	try {
		const result = await pb.collection('documentation').getList(1, 100, {
			filter: 'isPublished = true',
			sort: 'order',
			fields: 'id,title,slug,summary,order'
		});

		const pages: Pick<Documentation, 'id' | 'title' | 'slug' | 'summary' | 'order'>[] =
			result.items.map((r) => ({
				id: r.id,
				title: r.title,
				slug: r.slug,
				summary: r.summary || '',
				order: r.order
			}));

		return { pages };
	} catch {
		return { pages: [] };
	}
};
