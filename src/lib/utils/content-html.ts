import createDOMPurify from 'dompurify';
import { contentTags, embedHosts, normaliseContentHtml } from '$lib/content';

const purifier = typeof window !== 'undefined' ? createDOMPurify(window) : null;
purifier?.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName === 'A') node.setAttribute('rel', 'noopener noreferrer');
	if (node.tagName !== 'IFRAME') return;
	try {
		const url = new URL(node.getAttribute('src') || '');
		if (!['https:', 'http:'].includes(url.protocol)) {
			node.remove();
			return;
		}
		if (embedHosts.includes(url.hostname)) return;
		const link = node.ownerDocument.createElement('a');
		link.href = url.href;
		link.rel = 'noopener noreferrer';
		link.textContent = 'Open embedded resource ↗';
		node.replaceWith(link);
	} catch {
		node.remove();
	}
});

export function cleanContent(html: string): string {
	// The application is an SPA; never emit unsanitised HTML during server evaluation.
	if (!purifier) return '';
	const normalised = normaliseContentHtml(html).replace(
		/<(\/?)(h1|b|i|figcaption)(?=[\s>])/g,
		(_, closing, tag) =>
			`<${closing}${({ h1: 'h2', b: 'strong', i: 'em', figcaption: 'p' } as Record<string, string>)[tag]}`
	);
	return purifier.sanitize(normalised, {
		ALLOWED_TAGS: contentTags,
		ALLOWED_ATTR: [
			'href',
			'src',
			'title',
			'alt',
			'target',
			'rel',
			'allowfullscreen',
			'colspan',
			'rowspan'
		],
		ALLOW_DATA_ATTR: false
	});
}
