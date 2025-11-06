import { getEdition, createPocketBaseClient } from '$lib/server/pocketbase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const pb = createPocketBaseClient();

	try {
		const record = await pb.collection('editions').getOne(params.slug, {
			expand: 'collection'
		});

		const collection = record.expand?.collection;
		const collectionPubNum = collection?.pubNum || 0;
		const editionPubNum = record.pubNum || 1;

		// Generate Voyager URL
		const voyagerUrl = collectionPubNum > 0
			? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/voyager`
			: '';

		const edition = {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
			thumbnail: record.thumbnail,
			voyagerUrl,
			usageConditions: 'CC BY-NC 4.0',
			alternativeVersion: null,
			tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
			created: record.created
		};

		return {
			edition
		};
	} catch (e) {
		throw error(404, 'Edition not found');
	}
};
