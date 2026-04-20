import { pb } from '$lib/database/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import {
	getEditionThumbnailUrl,
	getCollectionThumbnailUrl,
	getEditionRoot
} from '$lib/utils/asset-urls';

export const load: PageLoad = async ({ params }) => {
	try {
		const collectionRecord = await pb.collection('collections').getOne(params.slug);

		const thumbnail =
			collectionRecord.pubNum > 0 ? getCollectionThumbnailUrl(collectionRecord.pubNum) : '';

		const collection = {
			id: collectionRecord.id,
			slug: params.slug,
			title: collectionRecord.title,
			description: collectionRecord.dcAbstract || '',
			thumbnail,
			isVisible: collectionRecord.isVisible !== false,
			pubNum: collectionRecord.pubNum || 0,
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
				collectionPubNum > 0 ? getEditionRoot(collectionPubNum, editionPubNum) : '';

			const editionThumbnail =
				collectionPubNum > 0 ? getEditionThumbnailUrl(collectionPubNum, editionPubNum) : '';

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
