import { getCollection, getEditionsByCollection } from '$lib/server/pocketbase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const collection = await getCollection(params.slug);

	if (!collection) {
		throw error(404, 'Collection not found');
	}

	const editions = await getEditionsByCollection(params.slug);

	return {
		collection: {
			...collection,
			description: collection.dcAbstract || '',
			slug: params.slug,
			editionIds: editions.map(e => e.id)
		},
		editions
	};
};
