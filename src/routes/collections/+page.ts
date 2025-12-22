import { pb } from '$lib/database/client';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import type { PageLoad } from './$types';

function getFileUrl(record: any, filename: string): string {
	const baseUrl = PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
	return `${baseUrl}/api/files/${record.collectionId}/${record.id}/${filename}`;
}

export const load: PageLoad = async () => {
	const result = await pb.collection('collections').getList(1, 500, {
		sort: 'pubNum',
		filter: 'isVisible = true'
	});

	// Get edition counts for each collection
	const editionCounts = await Promise.all(
		result.items.map(async (collection) => {
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

	const countMap = Object.fromEntries(editionCounts.map((e) => [e.collectionId, e.count]));

	const collections = result.items.map((record) => {
		const thumbnail = record.thumbnailFile
			? getFileUrl(record, record.thumbnailFile)
			: record.thumbnail || '';

		return {
			id: record.id,
			slug: record.id,
			title: record.title,
			description: record.dcAbstract || '',
			thumbnail,
			editionIds: [],
			editionCount: countMap[record.id] || 0,
			created: record.created
		};
	});

	return { collections };
};
