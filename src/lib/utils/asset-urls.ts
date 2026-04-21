/**
 * Asset URL utilities for serving 3D edition data.
 *
 * Defaults to the R2 CDN when PUBLIC_ASSET_BASE_URL is not set.
 * Set to empty string to serve from local static/project/ instead.
 */

import type { RecordModel } from 'pocketbase';
import { PUBLIC_ASSET_BASE_URL } from '$env/static/public';
import { base } from '$app/paths';
import { pb } from '$lib/database/client';

const DEFAULT_ASSET_BASE_URL = 'https://pure3d-assets.ctwhome.com';

/**
 * Returns the base URL for assets.
 * Defaults to R2 CDN. Set PUBLIC_ASSET_BASE_URL="" to use local files.
 */
export function getAssetBaseUrl(): string {
	return PUBLIC_ASSET_BASE_URL || DEFAULT_ASSET_BASE_URL;
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
	return `${base}/voyager/${version}/`;
}

/**
 * Get URL for Voyager Explorer script
 */
export function getVoyagerScriptUrl(version: string): string {
	return `${base}/voyager/${version}/js/voyager-explorer.min.js`;
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

export function getEditionCoverUrl(
	edition: RecordModel,
	collectionPubNum?: number | null,
	editionPubNum?: number | null
): string | null {
	const coverImage = (edition.coverImage as string | undefined) ?? '';
	if (coverImage) return pb.files.getURL(edition, coverImage, { thumb: '400x300' });
	const thumbnail = (edition.thumbnail as string | undefined) ?? '';
	if (thumbnail) return thumbnail;
	if (collectionPubNum && editionPubNum) {
		return getEditionThumbnailUrl(collectionPubNum, editionPubNum);
	}
	return null;
}
