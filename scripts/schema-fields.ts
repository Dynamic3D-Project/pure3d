/** Additive schema upgrades must retain field IDs and never discard relation data. */
export function mergeSchemaFields(
	existing: Record<string, unknown>[],
	desired: Record<string, unknown>[]
): Record<string, unknown>[] {
	const merged = [...existing];
	for (const field of desired) {
		const index = merged.findIndex((old) => old.name === field.name);
		if (index < 0) {
			merged.push(field);
			continue;
		}
		const old = merged[index];
		if (
			old.type !== field.type ||
			(field.type === 'relation' && old.collectionId !== field.collectionId)
		) {
			throw new Error(
				`Field ${String(field.name)} changes type or relation target; use an explicit data migration. No fields were dropped.`
			);
		}
		merged[index] = { ...old, ...field };
	}
	return merged;
}
