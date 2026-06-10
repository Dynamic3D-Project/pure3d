import { PUBLIC_ASSET_BASE_URL } from '$env/static/public';
import { error, type RequestHandler } from '@sveltejs/kit';

const DEFAULT_ASSET_BASE_URL = 'https://pure3d-assets.ctwhome.com';

function getUpstreamBaseUrl() {
	const baseUrl = PUBLIC_ASSET_BASE_URL || DEFAULT_ASSET_BASE_URL;
	if (!/^https?:\/\//.test(baseUrl)) {
		throw error(400, 'Asset proxy requires an absolute PUBLIC_ASSET_BASE_URL.');
	}
	return baseUrl.replace(/\/$/, '');
}

export const GET: RequestHandler = async ({ params, fetch }) => {
	const assetPath = params.path;
	if (!assetPath || assetPath.includes('..')) throw error(400, 'Invalid asset path.');

	const upstreamUrl = `${getUpstreamBaseUrl()}/${assetPath}`;
	const upstream = await fetch(upstreamUrl);

	if (!upstream.ok || !upstream.body) {
		throw error(upstream.status, `Asset not found: ${assetPath}`);
	}

	const headers = new Headers();
	const contentType = upstream.headers.get('content-type');
	const contentLength = upstream.headers.get('content-length');
	const etag = upstream.headers.get('etag');
	const lastModified = upstream.headers.get('last-modified');

	if (contentType) headers.set('content-type', contentType);
	if (contentLength) headers.set('content-length', contentLength);
	if (etag) headers.set('etag', etag);
	if (lastModified) headers.set('last-modified', lastModified);
	headers.set('access-control-allow-origin', '*');
	headers.set('cache-control', 'public, max-age=3600');

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers
	});
};
