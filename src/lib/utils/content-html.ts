import createDOMPurify from 'dompurify';
import { contentTags, embedHosts, normaliseContentHtml } from '$lib/content';
import {
	isCalloutStyle,
	parseEditionIds,
	safeContentUrl,
	serialiseEditionIds
} from './content-components';

const purifier = typeof window !== 'undefined' ? createDOMPurify(window) : null;
purifier?.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName === 'A') node.setAttribute('rel', 'noopener noreferrer');
	for (const attribute of Array.from(node.attributes)) {
		if (!attribute.name.startsWith('data-cms-')) continue;
		const allowed =
			(attribute.name === 'data-cms-callout' && node.tagName === 'ASIDE') ||
			(attribute.name === 'data-cms-actions' && node.tagName === 'DIV') ||
			(attribute.name === 'data-cms-editions' && node.tagName === 'DIV') ||
			(attribute.name === 'data-cms-action' && node.tagName === 'A') ||
			(attribute.name === 'data-cms-expandable' && node.tagName === 'DETAILS');
		if (!allowed) node.removeAttribute(attribute.name);
	}
	if (node.tagName === 'ASIDE' && node.hasAttribute('data-cms-callout')) {
		if (!isCalloutStyle(node.getAttribute('data-cms-callout')))
			node.removeAttribute('data-cms-callout');
	}
	if (node.tagName === 'DIV' && node.hasAttribute('data-cms-actions')) {
		if (node.getAttribute('data-cms-actions') !== 'true') node.removeAttribute('data-cms-actions');
	}
	if (node.tagName === 'A' && node.hasAttribute('data-cms-action')) {
		const action = node.getAttribute('data-cms-action');
		if (
			!['primary', 'secondary'].includes(action || '') ||
			node.parentElement?.getAttribute('data-cms-actions') !== 'true' ||
			!safeContentUrl(node.getAttribute('href') || '')
		)
			node.removeAttribute('data-cms-action');
	}
	if (node.tagName === 'DIV' && node.hasAttribute('data-cms-editions')) {
		const ids = serialiseEditionIds(parseEditionIds(node.getAttribute('data-cms-editions') || ''));
		if (ids) node.setAttribute('data-cms-editions', ids);
		else node.remove();
	}
	if (node.tagName === 'DETAILS' && node.hasAttribute('data-cms-expandable')) {
		if (node.getAttribute('data-cms-expandable') !== 'true')
			node.removeAttribute('data-cms-expandable');
	}
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
			'rowspan',
			'data-cms-callout',
			'data-cms-actions',
			'data-cms-action',
			'data-cms-editions',
			'data-cms-expandable'
		],
		ALLOW_DATA_ATTR: false
	});
}
