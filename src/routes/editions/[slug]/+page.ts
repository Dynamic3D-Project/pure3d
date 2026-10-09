import { pb } from '$lib/database/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import {
	getEditionRoot,
	getEditionThumbnailUrl,
	getVoyagerResourceRoot,
	DEFAULT_VOYAGER_VERSION,
	MIN_DERIVATIVES_VERSION
} from '$lib/utils/asset-urls';
import { creatorNames, readCredits } from '$lib/utils/credits';
import type { EditionViewData } from '$lib/components/editions/edition-view';
import { mapEditionVersions } from '$lib/utils/edition-version-history';

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

function originalFilename(filename: string): string {
	let name = filename;
	let previous: string;
	do {
		previous = name;
		name = name.replace(/_[a-z0-9]{10}(\.[^.]+)$/i, '$1');
	} while (name !== previous);
	return name;
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

export const load: PageLoad = async ({ params, fetch }) => {
	if (params.slug === 'demo') {
		throw error(404, 'Demo moved to /demo');
	}

	try {
		const [record, siteResult] = await Promise.all([
			pb.collection('editions').getOne(params.slug, { expand: 'collection', fetch }),
			pb.collection('site').getList(1, 1, { fetch })
		]);

		const site = siteResult.items[0];
		const collection = record.expand?.collection;
		const collectionId = record.collection;
		const collectionPubNum = collection?.pubNum || 0;
		const editionPubNum = record.pubNum || 1;

		// Voyager configuration - auto-upgrade old versions that don't support derivatives schema
		const voyagerVersion = getEffectiveVoyagerVersion(record.settingsAuthorToolVersion);
		let sceneFile = record.settingsSceneFile || 'scene.svx.json';
		let voyagerRoot = collectionPubNum > 0 ? getEditionRoot(collectionPubNum, editionPubNum) : '';
		const uploadedAssetMap: Record<string, string> = {};
		if (record.sceneDocument) {
			const token = record.isPublished ? '' : await pb.files.getToken({ fetch });
			const sceneUrl = pb.files.getURL(record, record.sceneDocument, { token });
			voyagerRoot = sceneUrl.slice(0, sceneUrl.lastIndexOf('/') + 1);
			sceneFile = sceneUrl.slice(sceneUrl.lastIndexOf('/') + 1);
			for (const filename of [
				record.modelFile,
				record.sceneDocument,
				...(record.modelAssets || [])
			].filter(Boolean) as string[]) {
				const url = pb.files.getURL(record, filename, { token });
				uploadedAssetMap[filename] = url;
				uploadedAssetMap[originalFilename(filename)] = url;
			}
		}
		const voyagerResourceRoot = getVoyagerResourceRoot(voyagerVersion);

		// Thumbnail from asset URL (respects PUBLIC_ASSET_BASE_URL / R2)
		const thumbnail =
			record.thumbnail && collectionPubNum > 0
				? getEditionThumbnailUrl(collectionPubNum, editionPubNum)
				: '';

		const toArray = (v: unknown): string[] =>
			Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : [];

		const edition: EditionViewData['edition'] = {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			authors: creatorNames(record.credits),
			thumbnail,
			coverImage: record.coverImage || '',
			fileCollectionId: record.collectionId || '',
			fileCollectionName: record.collectionName || '',
			voyagerUrl: '',
			// Voyager direct mode configuration
			voyagerRoot,
			uploadedAssetMap,
			voyagerResourceRoot,
			voyagerVersion,
			sceneFile,
			usageConditions: record.dcRightsLicense || 'CC BY-NC 4.0',
			alternativeVersion: null,
			tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
			created: record.created,
			hasPeerReview: !!record.peerReviewKind && record.peerReviewKind !== 'No peer review',
			peerReviewRequested: !!record.peerReviewRequested,
			peerReviewKind: record.peerReviewKind || null,
			peerReviewContent: record.peerReviewContent || null,
			modelSize: record.modelSize || null,
			// Edition version metadata
			pubNum: editionPubNum,
			dcDoi: toArray(record.dcDoi),
			dcInstitution: toArray(record.dcInstitution),
			credits: readCredits(record.credits),
			dcCoveragePeriod: record.dcCoveragePeriod || null,
			dcCoveragePlace: record.dcCoveragePlace || null,
			settingsAuthorToolVersion: record.settingsAuthorToolVersion || null,
			settingsAuthorToolName: record.settingsAuthorToolName || null,
			dcProvenance: record.dcProvenance || null,
			// Fields used by the Manage panel
			status: record.status || null,
			isPublished: !!record.isPublished,
			collectionId: collectionId || null,
			collectionTitle: collection?.title || ''
		};

		const siblingEditions = collectionId
			? pb
					.collection('editions')
					.getList(1, 100, {
						sort: '-pubNum',
						filter: `collection = "${collectionId}" && isPublished = true`,
						fields:
							'id,title,dcTitle,pubNum,status,dcDoi,modelSize,dcAbstract,created,peerReviewKind,thumbnail',
						skipTotal: true,
						fetch
					})
					.then((result) =>
						mapEditionVersions(result.items, record.id, collectionPubNum, getEditionThumbnailUrl)
					)
					.catch(() => [])
			: Promise.resolve([]);

		return {
			edition,
			siblingEditions,
			viewerHelp: site?.viewerHelp || null,
			viewerHelpVideoUrl: site?.viewerHelpVideoUrl || null
		};
	} catch {
		throw error(404, 'Edition not found');
	}
};
