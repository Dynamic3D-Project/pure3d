import { pb } from '$lib/database/client';
import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getCollectionThumbnailUrl,
	getEditionRoot,
	getEditionThumbnailUrl
} from '$lib/utils/asset-urls';
import { creatorNames, normalizeOrcid, readCredits } from '$lib/utils/credits';
import type { RecordModel } from 'pocketbase';

const toArray = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function mapEdition(record: RecordModel) {
	const collection = record.expand?.collection;
	const collectionPubNum = collection?.pubNum || 0;
	const editionPubNum = record.pubNum || 1;

	return {
		id: record.id,
		slug: record.id,
		title: record.dcTitle || record.title,
		description: record.dcAbstract || '',
		authors: creatorNames(record.credits),
		thumbnail:
			record.thumbnail && collectionPubNum > 0
				? getEditionThumbnailUrl(collectionPubNum, editionPubNum)
				: '',
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
		credits: readCredits(record.credits),
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

function mapCollection(record: RecordModel, editionCount = 0) {
	return {
		id: record.id,
		slug: record.id,
		title: record.dcTitle || record.title,
		description: record.dcAbstract || '',
		thumbnail:
			record.thumbnail && record.pubNum > 0 ? getCollectionThumbnailUrl(record.pubNum) : '',
		editionIds: [],
		editionCount,
		isVisible: record.isVisible
	};
}

export const load: PageLoad = async ({ params }) => {
	try {
		const user = await pb.collection('users').getOne(params.id);
		const [editionRecords, collectionRecords] = await Promise.all([
			pb.collection('editions').getFullList({
				filter: 'isPublished = true',
				expand: 'collection'
			}),
			pb.collection('collections').getFullList({
				filter: 'isVisible = true'
			})
		]);

		const editions = editionRecords
			.filter((record) => readCredits(record.credits).some((credit) => credit.userId === user.id))
			.map(mapEdition);

		const editionCounts = new Map<string, number>();
		for (const edition of editions) {
			editionCounts.set(edition.collectionId, (editionCounts.get(edition.collectionId) || 0) + 1);
		}

		const collections = collectionRecords
			.filter((record) => readCredits(record.credits).some((credit) => credit.userId === user.id))
			.map((record) => mapCollection(record, editionCounts.get(record.id) || 0));

		const profilePicture = user.profilePicture || user.avatar || '';

		return {
			profile: {
				id: user.id,
				name: user.nickname || 'Unnamed user',
				profilePictureUrl: profilePicture
					? pb.files.getURL(user, profilePicture, { thumb: '200x200' })
					: '',
				orcid: normalizeOrcid(user.orcid) || '',
				affiliation: user.affiliation || '',
				titleRole: user.titleRole || '',
				bio: user.bio || '',
				socials: user.socials || '',
				role: user.role || null,
				orcidVerifiedAt: user.orcidVerifiedAt || null,
				created: user.created
			},
			editions,
			collections
		};
	} catch {
		throw error(404, 'Profile not found');
	}
};
