import { parseAnnotationCategories, resolveVoyagerAssetUrl } from './edition-content';

type RecordValue = Record<string, unknown>;

export interface EditionSceneItem {
	id: string;
	title: string;
	titles: Record<string, string>;
	tags: string[];
	taglist: Record<string, string[]>;
}

export interface EditionSceneAnnotation extends EditionSceneItem {
	articleId: string | null;
}

export interface EditionSceneArticle extends EditionSceneItem {
	uri: string;
	lead: string;
	uris: Record<string, string>;
	leads: Record<string, string>;
}

export interface EditionSceneStep {
	id: string;
	sourceIndex: number;
	title: string;
	titles: Record<string, string>;
	articleId: string | null;
	categories: string[];
}

export interface EditionSceneTour extends EditionSceneItem {
	sourceIndex: number;
	steps: EditionSceneStep[];
}

export interface EditionScene {
	annotations: EditionSceneAnnotation[];
	articles: EditionSceneArticle[];
	tours: EditionSceneTour[];
	initialCategories: string[];
	languages: string[];
	defaultLanguage: string;
}

export interface LoadedEditionScene {
	scene: EditionScene;
	source: unknown;
	url: string;
}

function record(value: unknown): RecordValue {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null ? (value as RecordValue) : {};
}

function strings(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string' && !!item.trim());
	}
	return typeof value === 'string' && value.trim() ? [value] : [];
}

function array(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function localizedStrings(value: unknown): Record<string, string[]> {
	return Object.fromEntries(
		Object.entries(record(value)).flatMap(([language, content]) => {
			const values = strings(content);
			return values.length ? [[language, values]] : [];
		})
	);
}

function localizedValues(value: unknown): Record<string, string> {
	return Object.fromEntries(
		Object.entries(record(value)).flatMap(([language, content]) => {
			const text = strings(content)[0]?.trim();
			return text ? [[language, text]] : [];
		})
	);
}

function item(value: unknown, fallback: string): EditionSceneItem {
	const source = record(value);
	const id = typeof source.id === 'string' ? source.id : '';
	const title = typeof source.title === 'string' ? source.title : fallback;
	return {
		id,
		title,
		titles: localizedValues(source.titles),
		tags: strings(source.tags),
		taglist: localizedStrings(source.taglist)
	};
}

function referencedIndex(value: unknown, length: number): number | null {
	return Number.isInteger(value) && Number(value) >= 0 && Number(value) < length
		? Number(value)
		: null;
}

function addLanguages(languages: Set<string>, value: unknown) {
	for (const field of ['titles', 'leads', 'uris', 'taglist', 'intros']) {
		for (const language of Object.keys(record(record(value)[field])))
			languages.add(language.toUpperCase());
	}
}

function readerState(
	setup: RecordValue,
	targets: unknown[],
	values: unknown[],
	sceneIndex: number,
	previous?: { enabled: boolean; articleId: string; categories: string[] }
) {
	const reader = record(setup.reader);
	const viewer = record(setup.viewer);
	const enabled = previous?.enabled ?? reader.enabled === true;
	const articleId =
		previous?.articleId ?? (typeof reader.articleId === 'string' ? reader.articleId : '');
	const categories = previous?.categories ?? parseAnnotationCategories(viewer.activeTags);
	const target = (suffix: string) =>
		targets.findIndex((entry) => entry === `scenes/${sceneIndex}/setup/${suffix}`);
	const enabledValue = values[target('reader/enabled')];
	const articleValue = values[target('reader/articleId')];
	const categoryValue = values[target('viewer/activeTags')];

	return {
		enabled: typeof enabledValue === 'boolean' ? enabledValue : enabled,
		articleId: typeof articleValue === 'string' ? articleValue : articleId,
		categories:
			typeof categoryValue === 'string' ? parseAnnotationCategories(categoryValue) : categories
	};
}

export function parseEditionScene(value: unknown): EditionScene {
	const source = record(value);
	const scenes = array(source.scenes);
	const nodes = array(source.nodes);
	const models = array(source.models);
	const metas = array(source.metas);
	const setups = array(source.setups);
	if (!scenes.length) throw new Error('The scene has no scenes.');

	const sceneIndex = referencedIndex(source.scene, scenes.length) ?? 0;
	const activeScene = record(scenes[sceneIndex]);
	const setup = record(
		setups[referencedIndex(activeScene.setup, setups.length) ?? Number.POSITIVE_INFINITY]
	);
	const metadataIndexes: number[] = [];
	const metadataSeen = new Set<number>();
	const addMetadata = (reference: unknown) => {
		const metaIndex = referencedIndex(reference, metas.length);
		if (metaIndex !== null && !metadataSeen.has(metaIndex)) {
			metadataSeen.add(metaIndex);
			metadataIndexes.push(metaIndex);
		}
	};
	addMetadata(activeScene.meta);
	const modelIndexes = new Set<number>();
	const nodeIndexes = new Set<number>();
	const pendingNodes = [...array(activeScene.nodes)];
	for (let cursor = 0; cursor < pendingNodes.length; cursor += 1) {
		const nodeIndex = referencedIndex(pendingNodes[cursor], nodes.length);
		if (nodeIndex === null || nodeIndexes.has(nodeIndex)) continue;
		nodeIndexes.add(nodeIndex);
		const node = record(nodes[nodeIndex]);
		addMetadata(node.meta);
		const modelIndex = referencedIndex(node.model, models.length);
		if (modelIndex !== null) modelIndexes.add(modelIndex);
		pendingNodes.push(...array(node.children));
	}
	for (const modelIndex of modelIndexes) addMetadata(record(models[modelIndex]).meta);

	const annotationIds = new Set<string>();
	const annotations = [...modelIndexes].flatMap((modelIndex) =>
		array(record(models[modelIndex]).annotations).flatMap((annotation, annotationIndex) => {
			const normalized = item(annotation, `Annotation ${modelIndex + annotationIndex + 1}`);
			const articleReference = record(annotation).articleId;
			if (!normalized.id || annotationIds.has(normalized.id)) return [];
			annotationIds.add(normalized.id);
			return [
				{
					...normalized,
					articleId: typeof articleReference === 'string' ? articleReference : null
				}
			];
		})
	);
	const articleIds = new Set<string>();
	const articles: EditionSceneArticle[] = [];
	for (const metaIndex of metadataIndexes) {
		const meta = record(metas[metaIndex]);
		for (const [articleIndex, article] of array(meta.articles).entries()) {
			const normalized = item(article, `Story ${articleIndex + 1}`);
			if (!normalized.id || articleIds.has(normalized.id)) continue;
			articleIds.add(normalized.id);
			const articleRecord = record(article);
			articles.push({
				...normalized,
				uri: typeof articleRecord.uri === 'string' ? articleRecord.uri : '',
				lead: typeof articleRecord.lead === 'string' ? articleRecord.lead : '',
				uris: localizedValues(articleRecord.uris),
				leads: localizedValues(articleRecord.leads)
			});
		}
	}
	const snapshots = record(setup.snapshots);
	const targets = array(snapshots.targets);
	const states = new Map<string, unknown[]>();
	for (const state of array(snapshots.states)) {
		const stateRecord = record(state);
		if (typeof stateRecord.id !== 'string') continue;
		states.set(stateRecord.id, array(stateRecord.values));
	}
	const tourIds = new Set<string>();
	const tours: EditionSceneTour[] = [];
	for (const [tourIndex, tour] of array(setup.tours).entries()) {
		if (
			!tour ||
			typeof tour !== 'object' ||
			Array.isArray(tour) ||
			!Array.isArray(record(tour).steps)
		)
			continue;
		const normalized = item(tour, `Guided tour ${tourIndex + 1}`);
		if (normalized.id && tourIds.has(normalized.id)) continue;
		if (normalized.id) tourIds.add(normalized.id);
		const stepIds = new Set<string>();
		let state = readerState(setup, targets, [], sceneIndex);
		const steps = array(record(tour).steps).flatMap((step, stepIndex) => {
			const stepRecord = record(step);
			const id = typeof stepRecord.id === 'string' ? stepRecord.id : '';
			if (!id || stepIds.has(id)) return [];
			stepIds.add(id);
			// Null snapshot values keep the preceding state; resolve the tour's reading sequence without Voyager.
			state = readerState(setup, targets, states.get(id) ?? [], sceneIndex, state);
			const articleId = state.enabled && articleIds.has(state.articleId) ? state.articleId : null;
			return [
				{
					id,
					sourceIndex: stepIndex,
					title: typeof stepRecord.title === 'string' ? stepRecord.title : `Step ${stepIndex + 1}`,
					titles: localizedValues(stepRecord.titles),
					articleId,
					categories: state.categories
				}
			];
		});
		if (steps.length) tours.push({ ...normalized, sourceIndex: tourIndex, steps });
	}

	const setupLanguage = record(setup.language).language;
	const defaultLanguage = typeof setupLanguage === 'string' ? setupLanguage.toUpperCase() : 'EN';
	const languages = new Set([defaultLanguage]);
	for (const metaIndex of metadataIndexes) {
		const meta = record(metas[metaIndex]);
		addLanguages(languages, meta.collection);
		addLanguages(languages, meta);
	}
	for (const annotation of annotations) addLanguages(languages, annotation);
	for (const article of articles) addLanguages(languages, article);
	for (const tour of tours) {
		addLanguages(languages, tour);
		for (const step of tour.steps) addLanguages(languages, step);
	}

	return {
		annotations,
		articles,
		tours,
		initialCategories: parseAnnotationCategories(record(setup.viewer).activeTags),
		languages: [...languages],
		defaultLanguage
	};
}

export function createRuntimeScene(source: unknown): unknown {
	const clone = structuredClone(source);
	const document = record(clone);
	const scenes = array(document.scenes);
	const setups = array(document.setups);
	if (!scenes.length) return clone;
	const sceneIndex = referencedIndex(document.scene, scenes.length) ?? 0;
	const setupIndex = referencedIndex(record(scenes[sceneIndex]).setup, setups.length);
	if (setupIndex === null) return clone;
	const setup = record(setups[setupIndex]);
	const reader = record(setup.reader);
	if (Object.keys(reader).length) {
		reader.enabled = false;
		if ('articleId' in reader) reader.articleId = '';
	} else {
		setup.reader = { enabled: false };
	}
	const snapshots = record(setup.snapshots);
	const controlledTargets: Array<[number, boolean | string]> = [];
	const categoryTargets = new Set<number>();
	for (const [targetIndex, target] of array(snapshots.targets).entries()) {
		if (target === `scenes/${sceneIndex}/setup/reader/enabled`)
			controlledTargets.push([targetIndex, false]);
		if (target === `scenes/${sceneIndex}/setup/reader/articleId`)
			controlledTargets.push([targetIndex, '']);
		if (target === `scenes/${sceneIndex}/setup/viewer/activeTags`) categoryTargets.add(targetIndex);
	}
	for (const state of array(snapshots.states)) {
		const values = record(state).values;
		if (!Array.isArray(values)) continue;
		for (const [targetIndex, replacement] of controlledTargets) {
			if (targetIndex < values.length) values[targetIndex] = replacement;
		}
		if (categoryTargets.size)
			record(state).values = values.filter((_, index) => !categoryTargets.has(index));
	}
	// Pure3D owns category changes. Remove targets rather than using null: Voyager's non-animated
	// snapshot recall treats null as a value instead of retaining the current selection.
	if (categoryTargets.size)
		snapshots.targets = array(snapshots.targets).filter((_, index) => !categoryTargets.has(index));
	return clone;
}

export async function loadEditionScene(
	root: string,
	document: string,
	baseUrl: string,
	signal: AbortSignal
): Promise<LoadedEditionScene> {
	const url = resolveVoyagerAssetUrl(root, document, baseUrl);
	if (!url) throw new Error('The scene URL is invalid.');
	const response = await fetch(url, { signal });
	if (!response.ok) throw new Error(`The scene could not load (${response.status}).`);
	const source = (await response.json()) as unknown;
	return { scene: parseEditionScene(source), source, url };
}
