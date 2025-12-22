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
		const [record, siteResult] = await Promise.all([
			pb.collection('editions').getOne(params.slug, { expand: 'collection' }),
			pb.collection('site').getList(1, 1)
		]);

		const site = siteResult.items[0];
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

		const edition = {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
			thumbnail,
			voyagerUrl,
			usageConditions: record.dcRightsLicense || 'CC BY-NC 4.0',
			alternativeVersion: null,
			tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
			created: record.created,
			hasPeerReview: !!record.peerReviewKind && record.peerReviewKind !== 'No peer review',
			peerReviewKind: record.peerReviewKind || null,
			peerReviewContent: record.peerReviewContent || null
		};

		return {
			edition,
			viewerHelp: site?.viewerHelp || null,
			viewerHelpVideoUrl: site?.viewerHelpVideoUrl || null
		};
	} catch (e) {
		throw error(404, 'Edition not found');
	}
};
