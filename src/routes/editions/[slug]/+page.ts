import { pb } from '$lib/database/client';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import {
	getEditionRoot,
	getEditionThumbnailUrl,
	getVoyagerResourceRoot,
	DEFAULT_VOYAGER_VERSION,
	MIN_DERIVATIVES_VERSION
} from '$lib/utils/asset-urls';

function getFileUrl(record: any, filename: string): string {
	const baseUrl = PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
	return `${baseUrl}/api/files/${record.collectionId}/${record.id}/${filename}`;
}

/**
 * Compare semver versions (simple comparison for our use case)
 */
function compareVersions(a: string, b: string): number {
	const partsA = a.split('.').map(Number);
	const partsB = b.split('.').map(Number);
	for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
		const numA = partsA[i] || 0;
		const numB = partsB[i] || 0;
		if (numA !== numB) return numA - numB;
	}
	return 0;
}

/**
 * Get effective Voyager version, upgrading old versions that don't support
 * the 'derivatives' schema feature to the minimum compatible version
 */
function getEffectiveVoyagerVersion(requestedVersion: string | null): string {
	if (!requestedVersion) return DEFAULT_VOYAGER_VERSION;
	// If requested version is older than minimum derivatives support, upgrade it
	if (compareVersions(requestedVersion, MIN_DERIVATIVES_VERSION) < 0) {
		return MIN_DERIVATIVES_VERSION;
	}
	return requestedVersion;
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

		// Voyager configuration - auto-upgrade old versions that don't support derivatives schema
		const voyagerVersion = getEffectiveVoyagerVersion(record.settingsAuthorToolVersion);
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
