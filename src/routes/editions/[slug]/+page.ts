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
import { profileNameKey, profileNames } from '$lib/utils/profile-matching';

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
	if (params.slug === 'demo') {
		throw error(404, 'Demo moved to /demo');
	}

	try {
		const [record, siteResult] = await Promise.all([
			pb.collection('editions').getOne(params.slug, { expand: 'collection' }),
			pb.collection('site').getList(1, 1)
		]);

		const site = siteResult.items[0];
		const collection = record.expand?.collection;
		const collectionId = record.collection;
		const collectionPubNum = collection?.pubNum || 0;
		const editionPubNum = record.pubNum || 1;

		// Voyager configuration - auto-upgrade old versions that don't support derivatives schema
		const voyagerVersion = getEffectiveVoyagerVersion(record.settingsAuthorToolVersion);
		const sceneFile = record.settingsSceneFile || 'scene.svx.json';
		const voyagerRoot = collectionPubNum > 0 ? getEditionRoot(collectionPubNum, editionPubNum) : '';
		const voyagerResourceRoot = getVoyagerResourceRoot(voyagerVersion);

		// Thumbnail from asset URL (respects PUBLIC_ASSET_BASE_URL / R2)
		const thumbnail =
			collectionPubNum > 0 ? getEditionThumbnailUrl(collectionPubNum, editionPubNum) : '';

		const toArray = (v: unknown): string[] =>
			Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : [];

		const edition = {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
			thumbnail,
			voyagerUrl: '',
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
			peerReviewRequested: !!record.peerReviewRequested,
			peerReviewKind: record.peerReviewKind || null,
			peerReviewContent: record.peerReviewContent || null,
			modelSize: record.modelSize || null,
			// Edition version metadata
			pubNum: editionPubNum,
			dcDoi: toArray(record.dcDoi),
			dcInstitution: toArray(record.dcInstitution),
			dcCreator: toArray(record.dcCreator),
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

		let creatorProfiles: Array<{ id: string; names: string[] }> = [];
		try {
			const [authorResult, userResult] = await Promise.all([
				pb.collection('editionUsers').getList(1, 50, {
					filter: `editionId = "${record.id}" && role = "author"`,
					expand: 'userId'
				}),
				pb.collection('users').getList(1, 500)
			]);
			creatorProfiles = authorResult.items
				.map((author) => author.expand?.userId)
				.filter(Boolean)
				.map((user) => ({
					id: user.id,
					names: profileNames(user)
				}));

			const creatorKeys = new Set(toArray(record.dcCreator).map(profileNameKey));
			for (const user of userResult.items) {
				const hasDetails = !!(
					user.profilePicture ||
					user.avatar ||
					user.titleRole ||
					user.affiliation ||
					user.orcid ||
					user.bio
				);
				const names = profileNames(user);
				if (
					hasDetails &&
					!creatorProfiles.some((profile) => profile.id === user.id) &&
					names.some((name) => creatorKeys.has(profileNameKey(name)))
				) {
					creatorProfiles.push({ id: user.id, names });
				}
			}
		} catch {
			creatorProfiles = [];
		}

		// Fetch sibling editions (version history) for the same collection
		let siblingEditions: Array<Record<string, unknown>> = [];
		if (collectionId) {
			try {
				const siblingsResult = await pb.collection('editions').getList(1, 100, {
					sort: '-pubNum',
					filter: `collection = "${collectionId}" && isPublished = true`
				});
				siblingEditions = siblingsResult.items
					.filter((r) => r.id !== record.id)
					.map((r) => ({
						id: r.id,
						slug: r.id,
						title: r.dcTitle || r.title,
						pubNum: r.pubNum || 0,
						status: r.status || null,
						dcDoi: toArray(r.dcDoi),
						modelSize: r.modelSize || null,
						dcAbstract: r.dcAbstract || '',
						created: r.created,
						hasPeerReview: !!r.peerReviewKind && r.peerReviewKind !== 'No peer review',
						thumbnail:
							collectionPubNum > 0 ? getEditionThumbnailUrl(collectionPubNum, r.pubNum || 1) : ''
					}));
			} catch {
				// Non-critical — sibling editions are bonus data
			}
		}

		return {
			edition,
			creatorProfiles,
			siblingEditions,
			viewerHelp: site?.viewerHelp || null,
			viewerHelpVideoUrl: site?.viewerHelpVideoUrl || null
		};
	} catch (e) {
		throw error(404, 'Edition not found');
	}
};
