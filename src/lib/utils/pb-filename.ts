/**
 * Helpers for PocketBase's file-naming normalization.
 *
 * PB lowercases, splits camelCase, replaces non-alphanumeric with underscore,
 * and appends a 10-char random suffix before the extension. Original:
 * "DamagedHelmet.bin" → stored: "damaged_helmet_abc1234567.bin".
 */

/** Canonicalize an original filename to the form PB uses (without random suffix). */
export function pbNormalize(name: string): string {
	const dot = name.lastIndexOf('.');
	const stem = dot >= 0 ? name.slice(0, dot) : name;
	const ext = dot >= 0 ? name.slice(dot) : '';
	return (
		stem
			.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
			.replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, '_')
			.replace(/_+/g, '_')
			.replace(/^_|_$/g, '') + ext.toLowerCase()
	);
}

/** Strip PB's trailing "_<10 alphanumerics>" suffix from a stored filename. */
export function pbStrippedBasename(stored: string): string {
	return stored.replace(/_[a-z0-9]{10}(\.[^.]+)$/i, '$1').toLowerCase();
}
