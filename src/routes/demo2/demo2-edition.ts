import type { RecordModel } from 'pocketbase';
import { pb } from '$lib/database/client';
import {
	DEFAULT_VOYAGER_VERSION,
	MIN_DERIVATIVES_VERSION,
	getEditionRoot,
	getVoyagerResourceRoot
} from '$lib/utils/asset-urls';
import { readCredits } from '$lib/utils/credits';
import type { Credit } from '$lib/types/credits';
import type { EditionStatus } from '$lib/types/roles';
import {
	loadEditionScene,
	parseEditionScene,
	type LoadedEditionScene
} from '$lib/components/voyager/edition-scene';
import { rewriteSceneJson } from '$lib/utils/svx-uri-rewriter';

/** The public edition record, reduced to what this workspace shows. */
export interface Demo2Edition {
	id: string;
	title: string;
	abstract: string;
	credits: Credit[];
	collectionId: string | null;
	collectionTitle: string;
	institutions: string[];
	doi: string[];
	keywords: string[];
	coveragePeriod: string;
	coveragePlace: string;
	provenance: string;
	license: string;
	rightsHolder: string;
	created: string;
	pubNum: number;
	status: EditionStatus | null;
	modelSize: string | null;
	voyagerRoot: string;
	voyagerResourceRoot: string;
	voyagerVersion: string;
	sceneFile: string;
	uploadedAssetMap: Record<string, string>;
	authorToolName: string | null;
	authorToolVersion: string | null;
	peerReviewKind: string | null;
}

/** How the edition was chosen when no `?edition=` id was given. */
export interface Demo2Selection {
	checked: number;
	listed: number;
	limit: number;
}

export interface Demo2Counts {
	annotations: number;
	articles: number;
	tours: number;
	steps: number;
}

const LIST_LIMIT = 24;
const SCENE_SAMPLE_LIMIT = 12;

function text(value: unknown): string {
	if (Array.isArray(value))
		return value
			.filter((item): item is string => typeof item === 'string' && !!item.trim())
			.join(', ');
	return typeof value === 'string' ? value.trim() : '';
}

function list(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string' && !!item.trim())
		: [];
}

function compareVersions(a: string, b: string): number {
	const left = a.split('.').map(Number);
	const right = b.split('.').map(Number);
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const difference = (left[index] || 0) - (right[index] || 0);
		if (difference) return difference;
	}
	return 0;
}

/** Same upgrade rule as the edition page: scenes older than derivatives support use the minimum. */
function voyagerVersionFor(requested: unknown): string {
	if (typeof requested !== 'string' || !requested) return DEFAULT_VOYAGER_VERSION;
	return compareVersions(requested, MIN_DERIVATIVES_VERSION) < 0
		? MIN_DERIVATIVES_VERSION
		: requested;
}

/** Scene location for a published record, following the edition page's asset rules. */
function sceneLocation(record: RecordModel) {
	const collection = record.expand?.collection as RecordModel | undefined;
	const collectionPubNum = Number(collection?.pubNum) || 0;
	const editionPubNum = Number(record.pubNum) || 1;
	let root = collectionPubNum > 0 ? getEditionRoot(collectionPubNum, editionPubNum) : '';
	let sceneFile = text(record.settingsSceneFile) || 'scene.svx.json';
	const uploadedAssetMap: Record<string, string> = {};
	if (record.sceneDocument) {
		const sceneUrl = pb.files.getURL(record, record.sceneDocument);
		root = sceneUrl.slice(0, sceneUrl.lastIndexOf('/') + 1);
		sceneFile = sceneUrl.slice(sceneUrl.lastIndexOf('/') + 1);
		for (const filename of [record.modelFile, record.sceneDocument, ...list(record.modelAssets)]) {
			if (typeof filename !== 'string' || !filename) continue;
			const url = pb.files.getURL(record, filename);
			uploadedAssetMap[filename] = url;
			uploadedAssetMap[filename.replace(/_[a-z0-9]{10}(\.[^.]+)$/i, '$1')] = url;
		}
	}
	return { root, sceneFile, uploadedAssetMap, editionPubNum };
}

function toEdition(record: RecordModel): Demo2Edition {
	const collection = record.expand?.collection as RecordModel | undefined;
	const location = sceneLocation(record);
	const voyagerVersion = voyagerVersionFor(record.settingsAuthorToolVersion);
	return {
		id: record.id,
		title: text(record.dcTitle) || text(record.title) || 'Untitled edition',
		abstract: typeof record.dcAbstract === 'string' ? record.dcAbstract : '',
		credits: readCredits(record.credits),
		collectionId: text(record.collection) || null,
		collectionTitle: text(collection?.title),
		institutions: list(record.dcInstitution),
		doi: list(record.dcDoi),
		keywords: list(record.dcKeyword),
		coveragePeriod: text(record.dcCoveragePeriod),
		coveragePlace: text(record.dcCoveragePlace),
		provenance: text(record.dcProvenance),
		license: text(record.dcRightsLicense),
		rightsHolder: text(record.dcRightsHolder),
		created: text(record.created),
		pubNum: location.editionPubNum,
		status: (record.status as EditionStatus | undefined) || null,
		modelSize: text(record.modelSize) || null,
		voyagerRoot: location.root,
		voyagerResourceRoot: getVoyagerResourceRoot(voyagerVersion),
		voyagerVersion,
		sceneFile: location.sceneFile,
		uploadedAssetMap: location.uploadedAssetMap,
		authorToolName: text(record.settingsAuthorToolName) || null,
		authorToolVersion: text(record.settingsAuthorToolVersion) || null,
		peerReviewKind:
			record.peerReviewKind && record.peerReviewKind !== 'No peer review'
				? text(record.peerReviewKind)
				: null
	};
}

export class Demo2Unavailable extends Error {}

/** Loads one edition, refusing anything that is not publicly published. */
export async function loadPublicEdition(id: string, signal: AbortSignal): Promise<Demo2Edition> {
	let record: RecordModel;
	try {
		record = await pb
			.collection('editions')
			.getOne(id, { expand: 'collection', requestKey: null, signal });
	} catch (reason) {
		if (signal.aborted) throw reason;
		throw new Demo2Unavailable('This edition is not available.');
	}
	if (record.isPublished !== true)
		throw new Demo2Unavailable('This edition is not publicly published.');
	const edition = toEdition(record);
	if (!edition.voyagerRoot) throw new Demo2Unavailable('This edition has no public 3D scene.');
	return edition;
}

/** Fetches the scene document and applies the uploaded-asset mapping used by the edition page. */
export async function loadDemo2Scene(
	edition: Demo2Edition,
	signal: AbortSignal
): Promise<LoadedEditionScene> {
	const scene = await loadEditionScene(
		edition.voyagerRoot,
		edition.sceneFile,
		window.location.href,
		signal
	);
	if (!Object.keys(edition.uploadedAssetMap).length) return scene;
	const source = rewriteSceneJson(scene.source as object, edition.uploadedAssetMap);
	return { ...scene, source, scene: parseEditionScene(source) };
}

export function countScene(scene: LoadedEditionScene['scene']): Demo2Counts {
	return {
		annotations: scene.annotations.length,
		articles: scene.articles.length,
		tours: scene.tours.length,
		steps: scene.tours.reduce((total, tour) => total + tour.steps.length, 0)
	};
}

/**
 * Picks the richest public edition among the most recently published ones: the scenes of up to
 * SCENE_SAMPLE_LIMIT records are read and ranked by annotations, stories and tour steps.
 */
export async function discoverRichestEdition(
	signal: AbortSignal
): Promise<{ id: string; selection: Demo2Selection } | null> {
	const result = await pb.collection('editions').getList(1, LIST_LIMIT, {
		filter: 'isPublished = true',
		sort: '-created',
		expand: 'collection',
		skipTotal: true,
		requestKey: null,
		signal
	});
	const candidates = result.items
		.filter((record) => record.isPublished === true)
		.map(toEdition)
		.filter((edition) => edition.voyagerRoot)
		.slice(0, SCENE_SAMPLE_LIMIT);
	type Scored = { id: string; score: number };
	const scored = await Promise.all(
		candidates.map(async (edition): Promise<Scored | null> => {
			try {
				const counts = countScene((await loadDemo2Scene(edition, signal)).scene);
				return { id: edition.id, score: counts.annotations + counts.articles + counts.steps };
			} catch {
				return null;
			}
		})
	);
	if (signal.aborted) return null;
	const ranked = scored
		.filter((entry): entry is Scored => !!entry && entry.score > 0)
		.sort((a, b) => b.score - a.score);
	if (!ranked.length) return null;
	return {
		id: ranked[0].id,
		selection: {
			checked: scored.filter(Boolean).length,
			listed: result.items.length,
			limit: SCENE_SAMPLE_LIMIT
		}
	};
}
