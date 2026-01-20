import { pb } from '$lib/database/client';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import {
	getEditionRoot,
	getEditionThumbnailUrl,
	getVoyagerResourceRoot,
	DEFAULT_VOYAGER_VERSION
} from '$lib/utils/asset-urls';

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

		// Voyager configuration
		const voyagerVersion = record.settingsAuthorToolVersion || DEFAULT_VOYAGER_VERSION;
		const sceneFile = record.settingsSceneFile || 'scene.svx.json';
		const voyagerRoot = collectionPubNum > 0 ? getEditionRoot(collectionPubNum, editionPubNum) : '';
		const voyagerResourceRoot = getVoyagerResourceRoot(voyagerVersion);

		// Legacy iframe URL (kept for backward compatibility)
		const voyagerUrl =
			collectionPubNum > 0
				? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/voyager`
				: '';

		// Thumbnail priority: PocketBase file > legacy URL > local static asset
		const thumbnail = record.thumbnailFile
			? getFileUrl(record, record.thumbnailFile)
			: record.thumbnail || (collectionPubNum > 0 ? getEditionThumbnailUrl(collectionPubNum, editionPubNum) : '');

		const edition = {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
			thumbnail,
			voyagerUrl,
			// Voyager direct mode configuration
			voyagerRoot,
			voyagerResourceRoot,
			voyagerVersion,
			sceneFile,
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
