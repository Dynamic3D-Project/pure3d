import { safeContentUrl } from './content-components';

/** Links from records need URL validation as well as the deployment base path. */
export function safeLinkHref(
	value?: string | null,
	base = '',
	textDownload = false
): string | undefined {
	if (
		!value ||
		value.includes('\\') ||
		[...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
	)
		return undefined;
	const href = value.trim();
	if (href.startsWith('#')) return href;
	if (textDownload && /^data:text\/plain(?:;charset=utf-8)?,/i.test(href)) return href;
	const safe = safeContentUrl(href);
	if (!safe) return undefined;
	if (!safe.startsWith('/') || !base || safe === base || safe.startsWith(`${base}/`)) return safe;
	return `${base}${safe}`;
}
