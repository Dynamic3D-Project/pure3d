import { getEditions, createPocketBaseClient } from '$lib/server/pocketbase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const pb = createPocketBaseClient();

	const records = await pb.collection('editions').getFullList({
		sort: '-created',
		filter: 'isPublished = true',
		expand: 'collection'
	});

	// Map editions to the expected format
	const editions = records.map((record) => {
		const collection = record.expand?.collection;
		const collectionPubNum = collection?.pubNum || 0;
		const editionPubNum = record.pubNum || 1;

		// Generate Voyager URL
		const voyagerUrl = collectionPubNum > 0
			? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/voyager`
			: '';

		return {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
			thumbnail: record.thumbnail,
			voyagerUrl,
			usageConditions: '',
			alternativeVersion: null,
			tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
			created: record.created
		};
	});

	return {
		editions
	};
};
