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

/**
 * View preset type for camera positions
 */
interface ViewPreset {
	name: string;
	yaw: number;
	pitch: number;
	offsetX?: number;
	offsetY?: number;
	offsetZ?: number;
}

/**
 * Load demo edition from static files instead of PocketBase
 */
async function loadDemoEdition() {
	const voyagerVersion = DEFAULT_VOYAGER_VERSION;
	const sceneFile = 'scene.svx.json';
	const voyagerRoot = '/project/demo/edition/1/';
	const voyagerResourceRoot = getVoyagerResourceRoot(voyagerVersion);

	// Define view presets for this edition
	const viewPresets: ViewPreset[] = [
		{ name: 'front', yaw: 0, pitch: -25 },
		{ name: 'right', yaw: 90, pitch: -25 },
		{ name: 'back', yaw: 180, pitch: -25 },
		{ name: 'left', yaw: -90, pitch: -25 },
		{ name: 'top', yaw: 0, pitch: -89 },
		{ name: 'corner', yaw: 45, pitch: -35 },
		{ name: 'street-level', yaw: 15, pitch: -5, offsetY: -1 }
	];

	return {
		edition: {
			id: 'demo',
			slug: 'demo',
			title: '[DEMO] The Battle at 25 Northumberland Road',
			description:
				'This 3D model shows 25 Northumberland Road during the Easter Rising of 1916. ' +
				'If you look at the [[view:right|right side of the building]], you can see the windows where the volunteers took position. ' +
				'From [[view:top|above]], you can see the full layout of the street and surrounding area. ' +
				'The [[view:front|front entrance]] faced the main road, while the [[view:back|rear]] provided an escape route. ' +
				'Try the [[view:corner|corner view]] for a dramatic perspective, or [[view:street-level|street level]] to see it as the soldiers did.',
			authors: 'Susan Schreibman, Kelly Gillikin Schoueri, John Kaulakis, Luca Moine, Sandra Martinez Böhme',
			thumbnail: '/project/demo/edition/1/icon.png',
			voyagerUrl: '',
			voyagerRoot,
			voyagerResourceRoot,
			voyagerVersion,
			sceneFile,
			usageConditions: 'Demo use only',
			alternativeVersion: null,
			tags: ['demo', 'testing', 'development', 'Easter Rising', 'Irish History'],
			created: '2025-01-21T00:00:00Z',
			hasPeerReview: false,
			peerReviewKind: null,
			peerReviewContent: null,
			modelSize: '~19MB',
			viewPresets,
			showVoyagerMenu: false
		},
		viewerHelp: null,
		viewerHelpVideoUrl: null
	};
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
	// Handle demo edition specially - load from static files
	if (params.slug === 'demo') {
		return loadDemoEdition();
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
						thumbnail: collectionPubNum > 0
							? getEditionThumbnailUrl(collectionPubNum, r.pubNum || 1)
							: ''
					}));
			} catch {
				// Non-critical — sibling editions are bonus data
			}
		}

		return {
			edition,
			siblingEditions,
			viewerHelp: site?.viewerHelp || null,
			viewerHelpVideoUrl: site?.viewerHelpVideoUrl || null
		};
	} catch (e) {
		throw error(404, 'Edition not found');
	}
};
