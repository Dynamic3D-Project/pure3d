export interface PocketBaseFileRecord {
	id: string;
	collectionId?: string;
	collectionName?: string;
	fileCollectionId?: string;
	fileCollectionName?: string;
}

type FileUrlBuilder = (
	record: { id: string; collectionId: string; collectionName?: string },
	filename: string
) => string;

export function getPocketBaseFileUrl(
	record: PocketBaseFileRecord,
	filename: string,
	buildUrl: FileUrlBuilder
): string {
	const collectionId = record.fileCollectionId || record.collectionId;
	if (!collectionId) return '';
	return buildUrl(
		{
			id: record.id,
			collectionId,
			collectionName: record.fileCollectionName || record.collectionName
		},
		filename
	);
}
