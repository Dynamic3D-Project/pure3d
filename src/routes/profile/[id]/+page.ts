import { pb } from '$lib/database/client';
import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getCollectionThumbnailUrl,
	getEditionRoot,
	getEditionThumbnailUrl
} from '$lib/utils/asset-urls';

function escapeFilterValue(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const toArray = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function mapEdition(record: any) {
	const collection = record.expand?.collection;
	const collectionPubNum = collection?.pubNum || 0;
	const editionPubNum = record.pubNum || 1;

	return {
		id: record.id,
		slug: record.id,
		title: record.dcTitle || record.title,
		description: record.dcAbstract || '',
		authors: toArray(record.dcCreator).join(', '),
		thumbnail: collectionPubNum > 0 ? getEditionThumbnailUrl(collectionPubNum, editionPubNum) : '',
		voyagerUrl: collectionPubNum > 0 ? getEditionRoot(collectionPubNum, editionPubNum) : '',
		usageConditions: record.dcRightsLicense || '',
		alternativeVersion: null,
		tags: toArray(record.dcKeyword),
		created: record.created,
		isPublished: record.isPublished,
		pubNum: record.pubNum,
		collectionId: record.collection,
		collection,
		dcTitle: record.dcTitle || null,
		dcSubtitle: record.dcSubtitle || null,
		dcAbstract: record.dcAbstract || null,
		dcDescription: record.dcDescription || null,
		dcCreator: toArray(record.dcCreator),
		dcContributor: toArray(record.dcContributor),
		dcInstitution: toArray(record.dcInstitution),
		dcContact: record.dcContact || null,
		dcSubject: toArray(record.dcSubject),
		dcKeyword: toArray(record.dcKeyword),
		dcAudience: toArray(record.dcAudience),
		dcLanguage: toArray(record.dcLanguage),
		dcSource: toArray(record.dcSource),
		dcCoveragePeriod: toArray(record.dcCoveragePeriod),
		dcCoveragePlace: record.dcCoveragePlace || null,
		dcCoverageCountry: toArray(record.dcCoverageCountry),
		dcCoverageTemporal: record.dcCoverageTemporal || null,
		dcCoverageGeo: record.dcCoverageGeo || null,
		dcRightsHolder: record.dcRightsHolder || null,
		dcRightsLicense: record.dcRightsLicense || null,
		dcDatePublished: record.dcDatePublished || null,
		dcDateUnPublished: record.dcDateUnPublished || null,
		dcDateCreated: record.dcDateCreated || null,
		dcDateModified: record.dcDateModified || null,
		dcFunder: toArray(record.dcFunder),
		dcProvenance: record.dcProvenance || null,
		dcDoi: toArray(record.dcDoi),
		peerReviewKind: record.peerReviewKind || null,
		peerReviewContent: record.peerReviewContent || null,
		hasPeerReview: !!record.peerReviewKind && record.peerReviewKind !== 'No peer review',
		peerReviewRequested: record.peerReviewRequested || false,
		reviewStage: record.reviewStage ?? null,
		peerReviewStamp: record.peerReviewStamp || false,
		publishedAt: record.publishedAt || null,
		publishedBy: record.publishedBy || null,
		settingsAuthorToolName: record.settingsAuthorToolName || null,
		settingsAuthorToolVersion: record.settingsAuthorToolVersion || null,
		settingsSceneFile: record.settingsSceneFile || null
	};
}

function mapCollection(record: any, editionCount = 0) {
	return {
		id: record.id,
		slug: record.id,
		title: record.dcTitle || record.title,
		description: record.dcAbstract || '',
		thumbnail: record.pubNum > 0 ? getCollectionThumbnailUrl(record.pubNum) : '',
		editionIds: [],
		editionCount,
		isVisible: record.isVisible
	};
}

export const load: PageLoad = async ({ params }) => {
	const userId = escapeFilterValue(params.id);

	try {
		const user = await pb.collection('users').getOne(params.id);
		const [editionUsers, collectionUsers] = await Promise.all([
			pb.collection('editionUsers').getList(1, 100, {
				filter: `userId = "${userId}" && role = "author"`,
				expand: 'editionId,editionId.collection'
			}),
			pb.collection('collectionUsers').getList(1, 100, {
				filter: `userId = "${userId}"`,
				expand: 'collection'
			})
		]);

		const editions = editionUsers.items
			.map((item) => item.expand?.editionId)
			.filter((record) => record?.isPublished)
			.map(mapEdition);

		const editionCounts = new Map<string, number>();
		for (const edition of editions) {
			editionCounts.set(edition.collectionId, (editionCounts.get(edition.collectionId) || 0) + 1);
		}

		const collections = collectionUsers.items
			.map((item) => item.expand?.collection)
			.filter((record) => record?.isVisible)
			.map((record) => mapCollection(record, editionCounts.get(record.id) || 0));

		return {
			profile: {
				id: user.id,
				name: user.nickname || user.username || 'User',
				role: user.role || null,
				verified: !!user.verified,
				created: user.created
			},
			editions,
			collections
		};
	} catch {
		throw error(404, 'Profile not found');
	}
};
