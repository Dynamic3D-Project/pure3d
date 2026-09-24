export const calloutStyles = ['info', 'success', 'warning'] as const;
export type CalloutStyle = (typeof calloutStyles)[number];

const editionIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;
export const maxEditionReferences = 24;

export function safeContentUrl(value: string): string | null {
	const url = value.trim();
	if (/^\/(?!\/|\\)/.test(url)) return url;
	if (!/^(https?:|mailto:)/i.test(url)) return null;
	try {
		const parsed = new URL(url);
		return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? url : null;
	} catch {
		return null;
	}
}

export function parseEditionIds(value: string): string[] {
	return Array.from(
		new Set(
			value
				.split(',')
				.map((id) => id.trim())
				.filter((id) => editionIdPattern.test(id))
		)
	).slice(0, maxEditionReferences);
}

export function serialiseEditionIds(ids: string[]): string {
	const validIds = Array.from(
		new Set(ids.map((id) => id.trim()).filter((id) => editionIdPattern.test(id)))
	);
	if (validIds.length > maxEditionReferences)
		throw new RangeError(`Select at most ${maxEditionReferences} editions.`);
	return validIds.join(',');
}

export function isCalloutStyle(value: string | null): value is CalloutStyle {
	return calloutStyles.includes(value as CalloutStyle);
}
