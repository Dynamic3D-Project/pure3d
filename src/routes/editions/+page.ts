import { pb } from '$lib/database/client';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import type { PageLoad } from './$types';

function getFileUrl(record: any, filename: string): string {
	const baseUrl = PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
	return `${baseUrl}/api/files/${record.collectionId}/${record.id}/${filename}`;
}

export const load: PageLoad = async () => {
	const result = await pb.collection('editions').getList(1, 500, {
		filter: 'isPublished = true',
		expand: 'collection'
	});

	const editions = result.items.map((record) => {
		const collection = record.expand?.collection;
		const collectionPubNum = collection?.pubNum || 0;
		const editionPubNum = record.pubNum || 1;

		const voyagerUrl =
			collectionPubNum > 0
				? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/voyager`
				: '';

		const thumbnail = record.thumbnailFile
			? getFileUrl(record, record.thumbnailFile)
			: record.thumbnail || '';

		return {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
			thumbnail,
			voyagerUrl,
			usageConditions: record.dcRightsLicense || '',
			alternativeVersion: null,
			tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
			created: record.created,
			isPublished: record.isPublished,
			pubNum: record.pubNum,
			collectionId: record.collection,
			dcSubject: Array.isArray(record.dcSubject) ? record.dcSubject : [],
			dcAudience: Array.isArray(record.dcAudience) ? record.dcAudience : [],
			dcLanguage: Array.isArray(record.dcLanguage) ? record.dcLanguage : [],
			dcCoverageCountry: Array.isArray(record.dcCoverageCountry) ? record.dcCoverageCountry : [],
			dcCoveragePeriod: Array.isArray(record.dcCoveragePeriod) ? record.dcCoveragePeriod : [],
			hasPeerReview: !!record.peerReviewKind && record.peerReviewKind !== 'No peer review'
		};
	});

	return { editions };
};
