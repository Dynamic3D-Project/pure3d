import sanitizeHtml from 'sanitize-html';
import { contentTags, embedHosts, normaliseContentHtml } from '../src/lib/content';

// Node-only import sanitisation. The SPA uses DOMPurify instead of Node/PostCSS dependencies.
export function cleanContent(html: string): string {
	return normaliseContentHtml(
		sanitizeHtml(html, {
			allowedTags: contentTags,
			allowedAttributes: {
				a: ['href', 'title', 'target', 'rel'],
				img: ['src', 'alt', 'title'],
				iframe: ['src', 'title', 'allowfullscreen'],
				td: ['colspan', 'rowspan'],
				th: ['colspan', 'rowspan']
			},
			allowedSchemes: ['http', 'https', 'mailto'],
			allowedIframeHostnames: embedHosts,
			transformTags: {
				h1: 'h2',
				b: 'strong',
				i: 'em',
				figcaption: 'p',
				a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
				iframe: (tagName, attribs) => {
					try {
						const url = new URL(attribs.src);
						if (!['https:', 'http:'].includes(url.protocol))
							return { tagName: 'span', attribs: {} };
						if (embedHosts.includes(url.hostname)) return { tagName, attribs };
						return {
							tagName: 'a',
							attribs: { href: url.href, rel: 'noopener noreferrer' },
							text: 'Open embedded resource ↗'
						};
					} catch {
						return { tagName: 'span', attribs: {} };
					}
				}
			}
		})
	);
}
