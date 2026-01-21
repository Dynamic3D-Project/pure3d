import type { PageLoad } from './$types';
import {
	getEditionRoot,
	getVoyagerResourceRoot,
	DEFAULT_VOYAGER_VERSION
} from '$lib/utils/asset-urls';

export const ssr = false;

export const load: PageLoad = async () => {
	// Use static project/13/edition/1 (Baby Doll) as demo
	const collectionPubNum = 13;
	const editionPubNum = 1;

	const voyagerVersion = DEFAULT_VOYAGER_VERSION;
	const sceneFile = 'scene.svx.json';
	const voyagerRoot = getEditionRoot(collectionPubNum, editionPubNum);
	const voyagerResourceRoot = getVoyagerResourceRoot(voyagerVersion);

	const edition = {
		id: 'demo',
		slug: 'demo',
		title: 'Demo Edition - The Baby Doll',
		description:
			'This is a demo edition for testing Voyager features. Use the controls panel on the right to experiment with camera controls, annotations, articles, tours, background colors, and more.',
		authors: 'Nina Steuermann, Lena Reichel',
		thumbnail: '',
		voyagerUrl: '',
		voyagerRoot,
		voyagerResourceRoot,
		voyagerVersion,
		sceneFile,
		usageConditions: 'CC BY: Attribution required.',
		alternativeVersion: null,
		tags: ['demo', 'testing', 'voyager', 'api'],
		created: new Date().toISOString(),
		hasPeerReview: false,
		peerReviewKind: null,
		peerReviewContent: null,
		modelSize: null
	};

	return {
		edition
	};
};
