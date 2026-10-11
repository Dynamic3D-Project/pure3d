/** Imported records may contain a legacy scalar where the current schema expects a list. */
export function metadataValues(value: unknown): string[] {
	const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
	return values.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

/** Keep legacy values selectable even when they are not in the controlled vocabulary. */
export function metadataOptions(values: string[], vocabulary: string[]): string[] {
	return [...new Set([...values, ...vocabulary].filter((value) => value.trim()))].sort((a, b) =>
		a.localeCompare(b)
	);
}

export function vocabularyValues(
	records: Array<{ category?: string; name?: string; value?: string }>,
	category: string
): string[] {
	return records
		.filter(
			(record) =>
				(record.category || record.name || '').toLowerCase() === category &&
				typeof record.value === 'string' &&
				record.value.trim() !== ''
		)
		.map((record) => record.value as string);
}
