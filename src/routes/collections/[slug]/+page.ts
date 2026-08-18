import { pb } from '$lib/database/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import {
	getEditionThumbnailUrl,
	getCollectionCoverUrl,
	getEditionRoot
} from '$lib/utils/asset-urls';
import { profileNames } from '$lib/utils/profile-matching';

export const load: PageLoad = async ({ params }) => {
	try {
		const canRequestHidden = pb.authStore.isValid;
		const collectionRecord = await pb.collection('collections').getOne(params.slug);

		const thumbnail = getCollectionCoverUrl(collectionRecord, collectionRecord.pubNum) || '';

		const toArray = (v: unknown): string[] =>
			Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : [];

		const collection = {
			id: collectionRecord.id,
			slug: params.slug,
			title: collectionRecord.title,
			description: collectionRecord.dcAbstract || '',
			thumbnail,
			isVisible: collectionRecord.isVisible !== false,
			pubNum: collectionRecord.pubNum || 0,
			editionIds: [],
			dcCreator: toArray(collectionRecord.dcCreator),
			dcInstitution: toArray(collectionRecord.dcInstitution),
			dcSubject: toArray(collectionRecord.dcSubject),
			dcLanguage: toArray(collectionRecord.dcLanguage),
			dcCoveragePeriod: (collectionRecord.dcCoveragePeriod as string | undefined) || '',
			dcCoveragePlace: (collectionRecord.dcCoveragePlace as string | undefined) || ''
		};

		// Get editions for this collection
		const editionsResult = await pb.collection('editions').getList(1, 500, {
			sort: 'pubNum',
			filter: canRequestHidden
				? `collection = "${params.slug}"`
				: `collection = "${params.slug}" && isPublished = true`,
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
				hasPeerReview: !!record.peerReviewKind && record.peerReviewKind !== 'No peer review',
				pubNum: editionPubNum,
				modelSize: record.modelSize || null,
				status: record.status || null,
				isPublished: !!record.isPublished,
				dcDoi: Array.isArray(record.dcDoi) ? record.dcDoi : []
			};
		});

		const collectionUsers = await pb.collection('collectionUsers').getList(1, 100, {
			filter: `collection = "${collectionRecord.id}"`,
			expand: 'userId'
		});
		const creatorProfiles = collectionUsers.items
			.map((item) => item.expand?.userId)
			.filter(Boolean)
			.map((user) => ({ id: user.id, names: profileNames(user) }));

		return { collection, editions, creatorProfiles };
	} catch (e) {
		throw error(404, 'Collection not found');
	}
};
