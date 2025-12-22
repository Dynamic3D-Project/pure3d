import { pb } from '$lib/database/client';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

function getFileUrl(record: any, filename: string): string {
	const baseUrl = PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
	return `${baseUrl}/api/files/${record.collectionId}/${record.id}/${filename}`;
}

export const load: PageLoad = async ({ params }) => {
	try {
		const collectionRecord = await pb.collection('collections').getOne(params.slug);

		const thumbnail = collectionRecord.thumbnailFile
			? getFileUrl(collectionRecord, collectionRecord.thumbnailFile)
			: collectionRecord.thumbnail || '';

		const collection = {
			id: collectionRecord.id,
			slug: params.slug,
			title: collectionRecord.title,
			description: collectionRecord.dcAbstract || '',
			thumbnail,
			editionIds: []
		};

		// Get editions for this collection
		const editionsResult = await pb.collection('editions').getList(1, 500, {
			sort: 'pubNum',
			filter: `collection = "${params.slug}" && isPublished = true`,
			expand: 'collection'
		});

		const editions = editionsResult.items.map((record) => {
			const col = record.expand?.collection;
			const collectionPubNum = col?.pubNum || 0;
			const editionPubNum = record.pubNum || 1;

			const voyagerUrl =
				collectionPubNum > 0
					? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/voyager`
					: '';

			const editionThumbnail = record.thumbnailFile
				? getFileUrl(record, record.thumbnailFile)
				: record.thumbnail || '';

			return {
				id: record.id,
				slug: record.id,
				title: record.dcTitle || record.title,
				description: record.dcAbstract || '',
				authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
				thumbnail: editionThumbnail,
				voyagerUrl,
				usageConditions: record.dcRightsLicense || '',
				alternativeVersion: null,
				tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
				created: record.created,
				hasPeerReview: !!record.peerReviewKind && record.peerReviewKind !== 'No peer review'
			};
		});

		return { collection, editions };
	} catch (e) {
		throw error(404, 'Collection not found');
	}
};
