export interface StorageObject {
	key: string;
	size: number;
	modified: string;
}

export type StorageSort = 'modified-desc' | 'size-desc' | 'size-asc' | 'key-asc';

interface StorageFilters {
	query: string;
	minSize: number;
	maxSize: number;
	sort: StorageSort;
}

export function filterStorageObjects(
	objects: StorageObject[],
	{ query, minSize, maxSize, sort }: StorageFilters
): StorageObject[] {
	const normalizedQuery = query.trim().toLowerCase();
	return objects
		.filter(
			(object) =>
				object.key.toLowerCase().includes(normalizedQuery) &&
				object.size >= minSize &&
				object.size <= maxSize
		)
		.toSorted((a, b) => {
			if (sort === 'size-desc') return b.size - a.size;
			if (sort === 'size-asc') return a.size - b.size;
			if (sort === 'key-asc') return a.key.localeCompare(b.key);
			return Date.parse(b.modified) - Date.parse(a.modified);
		});
}

export function getStorageSummary(objects: StorageObject[]): { count: number; size: number } {
	return { count: objects.length, size: objects.reduce((total, object) => total + object.size, 0) };
}
