import { pb } from '$lib/database/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { Documentation } from '$lib/types/documentation';

export const load: PageLoad = async ({ params }) => {
	try {
		const slug = params.slug.replace(/[^a-z0-9-]/gi, '');
		const result = await pb.collection('documentation').getList(1, 1, {
			filter: `slug = "${slug}" && isPublished = true`
		});

		if (result.items.length === 0) {
			throw error(404, 'Page not found');
		}

		const record = result.items[0];
		const doc: Documentation = {
			id: record.id,
			title: record.title,
			slug: record.slug,
			content: record.content,
			summary: record.summary || '',
			order: record.order,
			isPublished: record.isPublished,
			created: record.created,
			updated: record.updated
		};

		return { doc };
	} catch (e: any) {
		if (e?.status === 404) throw e;
		throw error(404, 'Page not found');
	}
};
