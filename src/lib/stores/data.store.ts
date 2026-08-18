/**
 * Persisted data stores for editions and collections.
 *
 * These stores cache data in localStorage, providing instant display on page load
 * while fresh data is fetched in the background. This eliminates loading spinners
 * on repeat visits and creates a smoother browsing experience.
 *
 * Pattern: "stale-while-revalidate"
 * - Show cached data immediately
 * - Fetch fresh data in background
 * - Update store (and cache) when fresh data arrives
 */

import { persisted } from 'svelte-persisted-store';
import { pb } from '$lib/database/client';
import type { Edition, Collection } from '$lib/types/collection';
import { EditionStatus } from '$lib/types/roles';
import {
	getEditionThumbnailUrl,
	getCollectionCoverUrl,
	getEditionRoot
} from '$lib/utils/asset-urls';

// Store types
interface EditionsData {
	items: Edition[];
	total: number;
	lastFetched: number | null;
}

interface CollectionsData {
	items: (Collection & { editionCount?: number })[];
	total: number;
	lastFetched: number | null;
}

// Persisted stores with localStorage
export const editionsStore = persisted<EditionsData>('pure3d:editions', {
	items: [],
	total: 0,
	lastFetched: null
});

export const collectionsStore = persisted<CollectionsData>('pure3d:collections', {
	items: [],
	total: 0,
	lastFetched: null
});

/**
 * Fetches all published editions from Pocketbase and updates the store.
 * Returns the mapped editions array.
 */
export async function fetchEditions(): Promise<Edition[]> {
	const canRequestHidden = pb.authStore.isValid;
	const result = await pb.collection('editions').getList(1, 500, {
		filter: canRequestHidden ? undefined : 'isPublished = true',
		expand: 'collection',
		$autoCancel: false // Prevent auto-cancellation when fetching in parallel with other requests
	});

	const mappedEditions = result.items.map((record) => {
		const collection = record.expand?.collection;
		const collectionPubNum = collection?.pubNum || 0;
		const editionPubNum = record.pubNum || 1;

		// Build voyager URL - use local assets when pubNum is available
		const voyagerUrl = collectionPubNum > 0 ? getEditionRoot(collectionPubNum, editionPubNum) : '';

		// Thumbnail: use asset URL built from pubNums (respects PUBLIC_ASSET_BASE_URL / R2)
		const thumbnail =
			collectionPubNum > 0 ? getEditionThumbnailUrl(collectionPubNum, editionPubNum) : '';

		return {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
			thumbnail,
			coverImage: (record.coverImage as string | undefined) || '',
			collectionName: record.collectionName || 'editions',
			voyagerUrl,
			usageConditions: '',
			alternativeVersion: null,
			tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
			created: record.created,
			// Include Dublin Core fields for filtering
			isPublished: record.isPublished,
			status: (record.status as EditionStatus) || EditionStatus.Published,
			pubNum: record.pubNum,
			collectionId: record.collection,
			dcTitle: record.dcTitle,
			dcSubtitle: record.dcSubtitle,
			dcAbstract: record.dcAbstract,
			dcDescription: record.dcDescription,
			dcCreator: record.dcCreator || [],
			dcContributor: record.dcContributor || [],
			dcInstitution: record.dcInstitution || [],
			dcContact: record.dcContact,
			dcSubject: record.dcSubject || [],
			dcKeyword: record.dcKeyword || [],
			dcAudience: record.dcAudience || [],
			dcLanguage: record.dcLanguage || [],
			dcSource: record.dcSource || [],
			dcCoveragePeriod: record.dcCoveragePeriod || [],
			dcCoveragePlace: record.dcCoveragePlace,
			dcCoverageCountry: record.dcCoverageCountry || [],
			dcCoverageTemporal: record.dcCoverageTemporal,
			dcCoverageGeo: record.dcCoverageGeo,
			dcRightsHolder: record.dcRightsHolder,
			dcRightsLicense: record.dcRightsLicense,
			dcDatePublished: record.dcDatePublished,
			dcDateUnPublished: record.dcDateUnPublished,
			dcDateCreated: record.dcDateCreated,
			dcDateModified: record.dcDateModified,
			dcFunder: record.dcFunder || [],
			dcProvenance: record.dcProvenance,
			dcDoi: record.dcDoi || [],
			peerReviewKind: record.peerReviewKind,
			peerReviewContent: record.peerReviewContent,
			hasPeerReview: record.hasPeerReview || false,
			peerReviewRequested: record.peerReviewRequested || false,
			reviewStage: record.reviewStage ?? null,
			peerReviewStamp: record.peerReviewStamp || false,
			publishedAt: record.publishedAt || null,
			publishedBy: record.publishedBy || null,
			settingsAuthorToolName: record.settingsAuthorToolName,
			settingsAuthorToolVersion: record.settingsAuthorToolVersion,
			settingsSceneFile: record.settingsSceneFile
		} as Edition;
	});

	editionsStore.set({
		items: mappedEditions,
		total: result.totalItems,
		lastFetched: Date.now()
	});

	return mappedEditions;
}

/**
 * Fetches all visible collections from Pocketbase with edition counts and updates the store.
 * Returns the mapped collections array.
 */
export async function fetchCollections(): Promise<(Collection & { editionCount?: number })[]> {
	const canRequestHidden = pb.authStore.isValid;
	const [collectionsResult, editionsResult] = await Promise.all([
		pb.collection('collections').getList(1, 500, {
			sort: 'pubNum',
			filter: canRequestHidden ? undefined : 'isVisible = true',
			$autoCancel: false
		}),
		pb.collection('editions').getList(1, 500, {
			filter: 'isPublished = true',
			fields: 'id,collection',
			$autoCancel: false
		})
	]);

	// Count editions per collection
	const countMap: Record<string, number> = {};
	for (const edition of editionsResult.items) {
		const colId = edition.collection;
		if (colId) {
			countMap[colId] = (countMap[colId] || 0) + 1;
		}
	}

	const mappedCollections = collectionsResult.items.map((record) => {
		// Cover image: uploaded coverImage file → legacy thumbnail URL → asset URL from pubNum
		const thumbnail = getCollectionCoverUrl(record, record.pubNum) || '';

		return {
			id: record.id,
			mongoId: record.mongoId || '',
			slug: record.id,
			title: record.title,
			description: record.dcAbstract || '',
			thumbnail,
			editionIds: [],
			editionCount: countMap[record.id] || 0,
			created: record.created || new Date().toISOString(),
			site: record.site,
			isVisible: record.isVisible,
			lastPublished: record.lastPublished,
			pubNum: record.pubNum,
			dcTitle: record.dcTitle,
			dcSubtitle: record.dcSubtitle,
			dcAbstract: record.dcAbstract,
			dcDescription: record.dcDescription,
			dcCreator: record.dcCreator || [],
			dcContributor: record.dcContributor || [],
			dcInstitution: record.dcInstitution || [],
			dcSubject: record.dcSubject || [],
			dcLanguage: record.dcLanguage || [],
			dcCoveragePeriod: record.dcCoveragePeriod,
			dcCoveragePlace: record.dcCoveragePlace,
			dcDateCreated: record.dcDateCreated,
			dcDateModified: record.dcDateModified
		} as Collection & { editionCount?: number };
	});

	collectionsStore.set({
		items: mappedCollections,
		total: collectionsResult.totalItems,
		lastFetched: Date.now()
	});

	return mappedCollections;
}

/**
 * Fetches both editions and collections in parallel.
 * Use this on the home page to refresh all data at once.
 */
export async function fetchAllData(): Promise<{
	editions: Edition[];
	collections: (Collection & { editionCount?: number })[];
}> {
	const [editions, collections] = await Promise.all([fetchEditions(), fetchCollections()]);
	return { editions, collections };
}

/**
 * Check if cached data is stale (older than maxAge in milliseconds).
 * Default maxAge is 5 minutes.
 */
export function isStale(lastFetched: number | null, maxAge = 5 * 60 * 1000): boolean {
	if (!lastFetched) return true;
	return Date.now() - lastFetched > maxAge;
}
