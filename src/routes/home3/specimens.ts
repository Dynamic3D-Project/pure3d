import { pb } from '$lib/database/client';
import { creatorNames } from '$lib/utils/credits';
import { getEditionCoverUrl, getEditionRoot, getEditionThumbnailUrl } from '$lib/utils/asset-urls';

export interface Specimen {
	id: string;
	title: string;
	creators: string;
	collectionTitle: string;
	period: string;
	place: string;
	license: string;
	rightsHolder: string;
	cover: string;
	root: string;
	sceneFile: string;
}

export interface SceneEvidence {
	generator: string;
	units: string;
	copyright: string;
	models: number;
	annotations: number;
	articles: number;
	tours: number;
	faces: number;
	bytes: number;
}

const SPECIMEN_FIELDS =
	'id,title,dcTitle,credits,thumbnail,coverImage,pubNum,collection,collectionId,collectionName,settingsSceneFile,sceneDocument,dcCoveragePeriod,dcCoveragePlace,dcRightsLicense,dcRightsHolder,expand.collection.pubNum,expand.collection.title';

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
}

function list(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
	if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(', ');
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * Published editions whose scene is served from the legacy asset tree. Uploaded scenes need the
 * edition page's companion-asset mapping, so they are left to the full viewer.
 */
export async function fetchSpecimens(limit = 4): Promise<Specimen[]> {
	const result = await pb.collection('editions').getList(1, 24, {
		filter: 'isPublished = true',
		sort: '-created',
		fields: SPECIMEN_FIELDS,
		expand: 'collection',
		$autoCancel: false
	});

	return result.items
		.flatMap((item) => {
			const collection = record(item.expand?.collection);
			const collectionPubNum = Number(collection.pubNum) || 0;
			const editionPubNum = Number(item.pubNum) || 1;
			if (collectionPubNum <= 0 || item.sceneDocument) return [];
			const cover = getEditionCoverUrl({
				id: item.id,
				coverImage: item.coverImage,
				thumbnail: item.thumbnail ? getEditionThumbnailUrl(collectionPubNum, editionPubNum) : '',
				fileCollectionId: item.collectionId || '',
				fileCollectionName: item.collectionName || ''
			});
			if (!cover) return [];
			return [
				{
					id: item.id,
					title: text(item.dcTitle) || text(item.title),
					creators: creatorNames(item.credits),
					collectionTitle: text(collection.title),
					period: text(item.dcCoveragePeriod),
					place: text(item.dcCoveragePlace),
					license: text(item.dcRightsLicense),
					rightsHolder: text(item.dcRightsHolder),
					cover,
					root: getEditionRoot(collectionPubNum, editionPubNum),
					sceneFile: text(item.settingsSceneFile) || 'scene.svx.json'
				}
			];
		})
		.slice(0, limit);
}

const QUALITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Thumb'];

/** Reads the facts the scene document itself declares, without trusting its shape. */
export function readSceneEvidence(source: unknown): SceneEvidence {
	const document = record(source);
	const asset = record(document.asset);
	const scenes = list(document.scenes);
	const sceneIndex = Number.isInteger(document.scene) ? Number(document.scene) : 0;
	const scene = record(scenes[sceneIndex] ?? scenes[0]);
	const models = list(document.models).map(record);

	let faces = 0;
	let bytes = 0;
	for (const model of models) {
		const rank = (derivative: RecordValue) => QUALITY_ORDER.indexOf(String(derivative.quality));
		const [best] = list(model.derivatives)
			.map(record)
			.filter((derivative) => (derivative.usage ?? 'Web3D') === 'Web3D' && rank(derivative) >= 0)
			.sort((a, b) => rank(a) - rank(b));
		for (const file of list(best?.assets).map(record)) {
			faces += Number(file.numFaces) || 0;
			bytes += Number(file.byteSize) || 0;
		}
	}

	return {
		generator: [text(asset.generator), text(asset.version)].filter(Boolean).join(' · '),
		units: text(scene.units),
		copyright: text(asset.copyright),
		models: models.length,
		annotations: models.reduce((total, model) => total + list(model.annotations).length, 0),
		articles: list(document.metas).reduce<number>(
			(total, meta) => total + list(record(meta).articles).length,
			0
		),
		tours: list(document.setups).reduce<number>(
			(total, setup) => total + list(record(setup).tours).length,
			0
		),
		faces,
		bytes
	};
}

export async function fetchSceneEvidence(
	specimen: Specimen,
	signal: AbortSignal
): Promise<SceneEvidence> {
	const url = new URL(specimen.sceneFile, new URL(specimen.root, window.location.href));
	const response = await fetch(url, { signal });
	if (!response.ok) throw new Error(`Scene record unavailable (${response.status}).`);
	return readSceneEvidence(await response.json());
}

export function supportsWebGL(): boolean {
	try {
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
		context?.getExtension('WEBGL_lose_context')?.loseContext();
		return !!context;
	} catch {
		return false;
	}
}

export function formatBytes(bytes: number): string {
	if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${bytes} B`;
}

export function formatCount(value: number): string {
	return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
		value
	);
}
