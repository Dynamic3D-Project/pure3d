import type { EditionVersion } from '$lib/components/editions/edition-view';

interface EditionVersionRecord {
	id: string;
	title?: string;
	dcTitle?: string;
	pubNum?: number;
	status?: string | null;
	dcDoi?: unknown;
	modelSize?: string | null;
	dcAbstract?: string;
	created?: string;
	peerReviewKind?: string | null;
	thumbnail?: string;
}

export function mapEditionVersions(
	records: EditionVersionRecord[],
	currentEditionId: string,
	collectionPubNum: number,
	thumbnailUrl: (collectionPubNum: number, editionPubNum: number) => string
): EditionVersion[] {
	return records
		.filter((record) => record.id !== currentEditionId)
		.map((record) => ({
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title || '',
			pubNum: record.pubNum || 0,
			status: record.status || null,
			dcDoi: Array.isArray(record.dcDoi)
				? record.dcDoi.filter((value): value is string => typeof value === 'string' && !!value)
				: [],
			modelSize: record.modelSize || null,
			dcAbstract: record.dcAbstract || '',
			created: record.created || '',
			hasPeerReview: !!record.peerReviewKind && record.peerReviewKind !== 'No peer review',
			thumbnail:
				record.thumbnail && collectionPubNum > 0
					? thumbnailUrl(collectionPubNum, record.pubNum || 1)
					: ''
		}));
}
