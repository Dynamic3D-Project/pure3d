import { pb } from '$lib/database/client';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import type { PageLoad } from './$types';

function getFileUrl(record: any, filename: string): string {
	const baseUrl = PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
	return `${baseUrl}/api/files/${record.collectionId}/${record.id}/${filename}`;
}

export const load: PageLoad = async () => {
	// Fetch collections and all published editions in parallel
	const [collectionsResult, editionsResult] = await Promise.all([
		pb.collection('collections').getList(1, 500, {
			sort: 'pubNum',
			filter: 'isVisible = true'
		}),
		pb.collection('editions').getList(1, 500, {
			filter: 'isPublished = true',
			fields: 'id,collection'
		})
	]);

	// Count editions per collection
	const countMap: Record<string, number> = {};
	for (const edition of editionsResult.items) {
		const collectionId = edition.collection;
		if (collectionId) {
			countMap[collectionId] = (countMap[collectionId] || 0) + 1;
		}
	}

	const result = collectionsResult;

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
