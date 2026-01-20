/**
 * Asset URL utilities for serving 3D edition data.
 *
 * Supports two modes:
 * - Local development: Empty PUBLIC_ASSET_BASE_URL serves from /static
 * - Production: Set PUBLIC_ASSET_BASE_URL to R2/CDN URL (e.g., https://assets.pure3d.eu)
 */

import { env } from '$env/dynamic/public';

/**
 * Returns the base URL for assets.
 * Empty string means local (relative paths), otherwise R2/CDN URL.
 */
export function getAssetBaseUrl(): string {
	return env.PUBLIC_ASSET_BASE_URL || '';
}

/**
 * Get URL for an edition asset (scene files, models, articles, etc.)
 */
export function getEditionAssetUrl(
	collectionPubNum: number,
	editionPubNum: number,
	assetPath: string
): string {
	const base = getAssetBaseUrl();
	return `${base}/project/${collectionPubNum}/edition/${editionPubNum}/${assetPath}`;
}

/**
 * Get root path for edition assets (used as Voyager root URL)
 */
export function getEditionRoot(collectionPubNum: number, editionPubNum: number): string {
	const base = getAssetBaseUrl();
	return `${base}/project/${collectionPubNum}/edition/${editionPubNum}/`;
}

/**
 * Get root path for Voyager assets (fonts, css, images, language files)
 */
export function getVoyagerResourceRoot(version: string): string {
	const base = getAssetBaseUrl();
	return `${base}/voyager/${version}/`;
}

/**
 * Get URL for Voyager Explorer script
 */
export function getVoyagerScriptUrl(version: string): string {
	return `${getVoyagerResourceRoot(version)}js/voyager-explorer.min.js`;
}

/**
 * Get URL for edition thumbnail (icon.png in edition folder)
 */
export function getEditionThumbnailUrl(collectionPubNum: number, editionPubNum: number): string {
	return getEditionAssetUrl(collectionPubNum, editionPubNum, 'icon.png');
}

/**
 * Get URL for collection thumbnail (icon.png in project folder)
 */
export function getCollectionThumbnailUrl(collectionPubNum: number): string {
	const base = getAssetBaseUrl();
	return `${base}/project/${collectionPubNum}/icon.png`;
}

/**
 * Default Voyager version to use when not specified
 */
export const DEFAULT_VOYAGER_VERSION = '0.57.1';

/**
 * List of available Voyager versions in static/voyager/ and R2
 * Note: All scene files use the 'derivatives' schema feature which requires
 * Voyager 0.46.1+ to load correctly. Older versions will fail with schema validation errors.
 */
export const VOYAGER_VERSIONS = [
	'0.29.1',
	'0.35.1',
	'0.36.0',
	'0.38.0',
	'0.41.0',
	'0.43.0',
	'0.46.1',
	'0.51.0',
	'0.56.1',
	'0.56.2',
	'0.57.1'
] as const;

/**
 * Minimum Voyager version that supports the 'derivatives' schema feature
 * Scene files created with newer Voyager versions include this feature.
 * Using newest available version for maximum compatibility.
 */
export const MIN_DERIVATIVES_VERSION = '0.57.1';

export type VoyagerVersion = (typeof VOYAGER_VERSIONS)[number];
