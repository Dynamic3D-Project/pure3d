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
 * Default bundled Voyager version to use when not specified.
 * Updated to the latest upstream release we support locally.
 */
export const DEFAULT_VOYAGER_VERSION = '0.59.0';

/**
 * List of bundled Voyager versions we intentionally support.
 * Keep this narrow so local clones do not accumulate historical Voyager payloads.
 */
export const VOYAGER_VERSIONS = ['0.59.0'] as const;

/**
 * Minimum Voyager version that supports the 'derivatives' schema feature
 * Scene files created with older Voyager versions are upgraded to the
 * currently bundled runtime for compatibility.
 */
export const MIN_DERIVATIVES_VERSION = '0.59.0';

export type VoyagerVersion = (typeof VOYAGER_VERSIONS)[number];
