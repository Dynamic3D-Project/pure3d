export const HOME_EDITION_FIELDS =
	'id,title,dcTitle,credits,thumbnail,coverImage,pubNum,collection,collectionId,collectionName,expand.collection.pubNum';
export const HOME_COLLECTION_FIELDS =
	'id,title,dcAbstract,pubNum,coverImage,thumbnail,isVisible,collectionId,collectionName';
export const EDITION_CARD_FIELDS =
	'id,title,dcTitle,dcAbstract,credits,thumbnail,coverImage,modelSize,collectionId,collectionName,pubNum,collection,isPublished,status,created,dcSubtitle,dcDescription,dcInstitution,dcContact,dcSubject,dcKeyword,dcAudience,dcLanguage,dcSource,dcCoveragePeriod,dcCoveragePlace,dcCoverageCountry,dcCoverageTemporal,dcCoverageGeo,dcRightsHolder,dcRightsLicense,dcDatePublished,dcDateUnPublished,dcDateCreated,dcDateModified,dcFunder,dcProvenance,dcDoi,peerReviewKind,hasPeerReview,expand.collection.pubNum';
export const COLLECTION_CARD_FIELDS =
	'id,mongoId,title,dcAbstract,coverImage,thumbnail,created,site,isVisible,lastPublished,pubNum,dcTitle,dcSubtitle,dcDescription,credits,dcInstitution,dcSubject,dcLanguage,dcCoveragePeriod,dcCoveragePlace,dcDateCreated,dcDateModified,collectionId,collectionName';

export function countEditionsByCollection(editions: object[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const edition of editions) {
		const collection = (edition as { collection?: unknown }).collection;
		if (typeof collection === 'string' && collection) {
			counts[collection] = (counts[collection] || 0) + 1;
		}
	}
	return counts;
}

export function selectDailyItems<T>(items: T[], count: number, now = new Date()): T[] {
	if (items.length <= count) return items;
	const day = Math.floor(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000
	);
	const start = day % items.length;
	return Array.from({ length: count }, (_, index) => items[(start + index) % items.length]);
}
