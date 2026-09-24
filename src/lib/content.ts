export const contentKinds = ['page', 'post'] as const;
export const contentSections = ['explore', 'publish', 'resources', 'about'] as const;
export const kindLabels: Record<string, string> = {
	page: 'Pages',
	post: 'Posts'
};
export const contentTags = [
	'p',
	'br',
	'h2',
	'h3',
	'h4',
	'blockquote',
	'strong',
	'em',
	'u',
	's',
	'ul',
	'ol',
	'li',
	'a',
	'img',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'hr',
	'pre',
	'code',
	'iframe',
	'aside',
	'div',
	'details',
	'summary'
];
export const embedHosts = [
	'www.youtube.com',
	'www.youtube-nocookie.com',
	'player.vimeo.com',
	'w.soundcloud.com'
];

// Avada can produce paragraphs nested in headings. Normalise before the browser parses it.
export function normaliseContentHtml(html: string) {
	return html
		.replace(/<(h[2-4])>\s*<p>([\s\S]*?)<\/p>\s*<\/\1>/g, '<$1>$2</$1>')
		.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/g, '');
}

export function classifyContent(slug: string, type: string, categories: string[]) {
	const labels = categories.join(' ').toLowerCase();
	const section =
		type === '3d_registry'
			? 'explore'
			: /submission|publication-process|evaluation|editorial-board/.test(slug)
				? 'publish'
				: /^(about|team|contact|governance|testimonials|pilot-projects|4d-research-lab|clariah|dans|erfgoed|gemeente|museum|nederlands)/.test(
							slug
					  )
					? 'about'
					: /^(current-editions|forthcoming-editions|3d-registry)$/.test(slug)
						? 'explore'
						: 'resources';
	const kind =
		type === 'page'
			? 'page'
			: type === '3d_registry'
				? 'edition'
				: /publication/.test(labels)
					? 'publication'
					: /presentation/.test(labels)
						? 'presentation'
						: /articles|blog/.test(labels)
							? 'article'
							: /forthcoming editions/.test(labels)
								? 'edition'
								: 'news';
	return { section, kind };
}
