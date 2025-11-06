import { getCollections, getEditionsByCollection, createPocketBaseClient } from '$lib/server/pocketbase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const collections = await getCollections();

	// Get edition counts for each collection
	const pb = createPocketBaseClient();
	const editionCounts = await Promise.all(
		collections.map(async (collection) => {
			try {
				const count = await pb.collection('editions').getList(1, 1, {
					filter: `collection = "${collection.id}" && isPublished = true`
				});
				return { collectionId: collection.id, count: count.totalItems };
			} catch {
				return { collectionId: collection.id, count: 0 };
			}
		})
	);

	const countMap = Object.fromEntries(editionCounts.map(e => [e.collectionId, e.count]));

	// Map collections to frontend format
	const mappedCollections = collections.map((collection) => ({
		id: collection.id,
		slug: collection.id, // Use PocketBase ID as slug for now
		title: collection.title,
		description: collection.dcAbstract || '',
		thumbnail: collection.thumbnail,
		editionIds: [], // We'll use the count instead
		editionCount: countMap[collection.id] || 0,
		created: new Date().toISOString()
	}));

	return {
		collections: mappedCollections
	};
};
