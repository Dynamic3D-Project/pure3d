import { rewriteSceneJson } from '$lib/utils/svx-uri-rewriter';
import { PUBLIC_ASSET_BASE_URL } from '$env/static/public';
import { base } from '$app/paths';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject =>
	value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const MAX_JSON_BYTES = 4 * 1024 * 1024;

/** Reject credentials, signed URLs, local hostnames, literal IPs and non-HTTPS resources. */
function publicUrl(value: string, base?: string): URL {
	const url = new URL(value, base);
	const host = url.hostname.toLowerCase().replace(/\.$/, '');
	if (
		url.protocol !== 'https:' ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		!host.includes('.') ||
		host.endsWith('.localhost') ||
		host.endsWith('.local') ||
		host.endsWith('.internal') ||
		/^\d+\.\d+\.\d+\.\d+$/.test(host) ||
		host.includes(':')
	) {
		throw new Error('Kompakkt requires public HTTPS assets without credentials or URL tokens.');
	}
	return url;
}

async function request(url: URL, signal: AbortSignal, range?: string): Promise<Response> {
	const response = await fetch(url.href, {
		signal,
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
		redirect: 'error',
		headers: range ? { Range: range } : undefined
	});
	if (!response.ok) throw new Error(`A public asset could not load (${response.status}).`);
	return response;
}

/** Cancel the model download after its JSON header, rather than downloading large binaries twice. */
async function bytes(response: Response, limit: number, prefix = false): Promise<Uint8Array> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error('The public asset response could not be read.');
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!prefix && size + value.length > limit)
				throw new Error('The scene or model metadata is too large for this preview.');
			const chunk = value.subarray(0, limit - size);
			chunks.push(chunk);
			size += chunk.length;
			if (prefix && size === limit) break;
		}
	} finally {
		await reader.cancel();
	}
	const result = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

async function json(url: URL, signal: AbortSignal): Promise<unknown> {
	return JSON.parse(
		new TextDecoder().decode(await bytes(await request(url, signal), MAX_JSON_BYTES))
	);
}

function modelUri(source: unknown): string {
	const document = object(source);
	const scenes = array(document.scenes);
	const active = object(scenes[Number.isInteger(document.scene) ? Number(document.scene) : 0]);
	const nodes = array(document.nodes);
	const models = array(document.models);
	const pending = [...array(active.nodes)];
	const seen = new Set<number>();
	const selected = new Set<number>();
	for (let cursor = 0; cursor < pending.length; cursor++) {
		const index = pending[cursor];
		if (typeof index !== 'number' || !Number.isInteger(index) || seen.has(index)) continue;
		seen.add(index);
		const node = object(nodes[index]);
		if (typeof node.model === 'number' && Number.isInteger(node.model)) selected.add(node.model);
		pending.push(...array(node.children));
	}
	if (selected.size !== 1)
		throw new Error('This preview supports a scene with one model. Use Voyager for this scene.');
	const model = object(models[[...selected][0]]);
	const assets = array(model.derivatives)
		.filter((value) => object(value).usage === 'Web3D')
		.flatMap((value) => array(object(value).assets))
		.map(object)
		.filter((asset) => asset.type === 'Model' && typeof asset.uri === 'string');
	const uri =
		assets.find((asset) => /\.glb$/i.test(String(asset.uri)))?.uri ??
		assets.find((asset) => /\.gltf$/i.test(String(asset.uri)))?.uri;
	if (typeof uri !== 'string')
		throw new Error('No compatible GLB or glTF Web3D model was found. Voyager remains available.');
	return uri;
}

async function modelDocument(url: URL, signal: AbortSignal): Promise<unknown> {
	if (/\.gltf$/i.test(url.pathname)) return json(url, signal);
	const header = await bytes(await request(url, signal, 'bytes=0-19'), 20, true);
	if (header.length !== 20) throw new Error('The GLB header is incomplete.');
	const view = new DataView(header.buffer);
	const length = view.getUint32(12, true);
	if (
		view.getUint32(0, true) !== 0x46546c67 ||
		view.getUint32(4, true) !== 2 ||
		view.getUint32(16, true) !== 0x4e4f534a ||
		length > MAX_JSON_BYTES
	)
		throw new Error('This preview requires a valid glTF 2 model with readable metadata.');
	// Request the prefix again so servers that ignore Range behave identically.
	const prefix = await bytes(
		await request(url, signal, `bytes=0-${19 + length}`),
		20 + length,
		true
	);
	if (prefix.length !== 20 + length) throw new Error('The GLB metadata is incomplete.');
	return JSON.parse(new TextDecoder().decode(prefix.subarray(20)));
}

function resourceUris(value: unknown): unknown[] {
	if (Array.isArray(value)) return value.flatMap(resourceUris);
	return Object.entries(object(value)).flatMap(([key, child]) =>
		key === 'uri' ? [child] : resourceUris(child)
	);
}

export async function resolveKompakktResource(
	root: string,
	sceneFile: string,
	assetMap: Record<string, string>,
	signal: AbortSignal
): Promise<string> {
	// The development proxy is an application implementation detail, not a shareable asset URL.
	const proxyPrefix = `${base}/asset-proxy/`;
	if (root.startsWith(proxyPrefix)) {
		root = `${(PUBLIC_ASSET_BASE_URL || 'https://api.pure3d.eu/assets').replace(/\/$/, '')}/${root.slice(proxyPrefix.length)}`;
	}
	const directory = publicUrl(root);
	if (!directory.pathname.endsWith('/')) directory.pathname += '/';
	const sceneUrl = publicUrl(sceneFile || 'scene.svx.json', directory.href);
	if (!sceneUrl.href.startsWith(directory.href))
		throw new Error('The scene is outside its asset directory.');
	const source = rewriteSceneJson(object(await json(sceneUrl, signal)), assetMap);
	const modelUrl = publicUrl(modelUri(source), directory.href);
	if (!modelUrl.href.startsWith(directory.href))
		throw new Error('The model is outside the public edition asset directory.');
	const document = object(await modelDocument(modelUrl, signal));
	if (object(document.asset).version !== '2.0')
		throw new Error('Only glTF 2 models are supported.');
	// glTF companions cannot be rewritten inside the external viewer. Reject relocated uploads,
	// tokenised dependencies and external hosts rather than leaking them or rendering broken assets.
	for (const uri of resourceUris(document)) {
		if (typeof uri !== 'string')
			throw new Error('The model contains an invalid resource reference.');
		if (
			/^data:(application\/octet-stream|application\/gltf-buffer|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/=\s]+$/.test(
				uri
			)
		)
			continue;
		const companion = publicUrl(uri, modelUrl.href);
		if (!companion.href.startsWith(directory.href))
			throw new Error('The model has dependencies outside its public edition directory.');
		const rewritten = rewriteSceneJson({ uri }, assetMap).uri;
		if (publicUrl(rewritten, modelUrl.href).href !== companion.href)
			throw new Error(
				'This uploaded model needs relocated companion files. Use a self-contained GLB or Voyager.'
			);
		// Probe anonymously; do not pass the application session or file tokens to Kompakkt.
		const response = await request(companion, signal, 'bytes=0-0');
		await response.body?.cancel();
	}
	return modelUrl.href;
}

export function kompakktViewerUrl(resource: string): string {
	const url = new URL('https://kompakkt.de/viewer/');
	url.searchParams.set('standalone', 'true');
	url.searchParams.set('resource', publicUrl(resource).href);
	url.searchParams.set('minimal', 'true');
	return url.href;
}
