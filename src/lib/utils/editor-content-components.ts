import { Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import {
	isCalloutStyle,
	isCmsColumnCount,
	normaliseContentImage,
	normaliseLogoItems,
	normaliseProfileCards,
	normaliseProjectFacts,
	parseEditionIds,
	safeContentUrl,
	serialiseEditionIds,
	type CalloutStyle,
	type ContentImage,
	type CmsColumnCount,
	type LogoItem,
	type ProfileCard,
	type ProjectFact
} from './content-components';

function profileCards(element: HTMLElement) {
	return normaliseProfileCards(
		Array.from(
			element.querySelectorAll<HTMLElement>(':scope > article[data-cms-profile="true"]')
		).map((card) => {
			const links = Array.from(
				card.querySelectorAll<HTMLAnchorElement>(
					':scope > [data-cms-profile-links="true"] > a[data-cms-profile-link="true"]'
				)
			).map((link) => ({ label: link.textContent || '', href: link.getAttribute('href') || '' }));
			const legacyLink = card.querySelector<HTMLAnchorElement>('a[href]');
			return {
				name: card.dataset.name,
				role: card.dataset.role,
				bio: card.dataset.bio,
				image: card.dataset.image,
				alt: card.dataset.alt,
				...(links.length ? { links } : {}),
				href: card.dataset.href || legacyLink?.getAttribute('href'),
				linkLabel: card.dataset.linkLabel || legacyLink?.textContent
			};
		})
	);
}

function logoItems(element: HTMLElement) {
	return normaliseLogoItems(
		Array.from(element.querySelectorAll<HTMLElement>(':scope > figure[data-cms-logo="true"]')).map(
			(logo) => ({
				name: logo.dataset.name,
				image: logo.dataset.image,
				alt: logo.dataset.alt,
				href: logo.dataset.href
			})
		)
	);
}

function projectFacts(element: HTMLElement) {
	return normaliseProjectFacts(
		Array.from(
			element.querySelectorAll<HTMLElement>(':scope > div[data-cms-project-fact="true"]')
		).map((fact) => ({ label: fact.dataset.label, value: fact.dataset.value }))
	);
}

function dataAttributes(values: Record<string, string>) {
	return Object.fromEntries(Object.entries(values).filter(([, value]) => value));
}

function contentImage(element: HTMLElement) {
	const image = element.querySelector(':scope > img');
	return normaliseContentImage({
		src: image?.getAttribute('src'),
		alt: image?.getAttribute('alt'),
		caption: element.querySelector(':scope > figcaption')?.textContent || ''
	});
}

function actionAttrs(element: HTMLElement) {
	const links = Array.from(element.querySelectorAll('a[data-cms-action]'));
	const primary = links.find((link) => link.getAttribute('data-cms-action') === 'primary');
	const secondary = links.find((link) => link.getAttribute('data-cms-action') === 'secondary');
	const primaryHref = primary && safeContentUrl(primary.getAttribute('href') || '');
	const secondaryHref = secondary && safeContentUrl(secondary.getAttribute('href') || '');
	if (!primary?.textContent?.trim() || !primaryHref) return false;
	return {
		primaryLabel: primary.textContent.trim(),
		primaryHref,
		secondaryLabel: secondary?.textContent?.trim() || '',
		secondaryHref: secondaryHref || ''
	};
}

export const CmsCallout = Node.create({
	name: 'cmsCallout',
	group: 'block',
	content: 'block+',
	defining: true,
	addAttributes() {
		return { style: { default: 'info' } };
	},
	parseHTML() {
		return [
			{
				tag: 'aside[data-cms-callout]',
				getAttrs: (element) => {
					const style = (element as HTMLElement).getAttribute('data-cms-callout');
					return isCalloutStyle(style) ? { style } : false;
				}
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		return ['aside', { 'data-cms-callout': HTMLAttributes.style }, 0];
	}
});

export const CmsActions = Node.create({
	name: 'cmsActions',
	group: 'block',
	atom: true,
	selectable: true,
	addAttributes() {
		return {
			primaryLabel: { default: '' },
			primaryHref: { default: '' },
			secondaryLabel: { default: '' },
			secondaryHref: { default: '' }
		};
	},
	parseHTML() {
		return [
			{
				tag: 'div[data-cms-actions="true"]',
				getAttrs: (element) => actionAttrs(element as HTMLElement)
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		const { primaryLabel, primaryHref, secondaryLabel, secondaryHref } = HTMLAttributes;
		return [
			'div',
			{ 'data-cms-actions': 'true' },
			['a', { href: primaryHref, 'data-cms-action': 'primary' }, primaryLabel],
			...(secondaryLabel && secondaryHref
				? [['a', { href: secondaryHref, 'data-cms-action': 'secondary' }, secondaryLabel]]
				: [])
		];
	},
	addNodeView() {
		return ({ node }) => {
			const dom = document.createElement('div');
			dom.className = 'cms-editor-actions';
			dom.contentEditable = 'false';
			dom.dataset.cmsActions = 'true';
			dom.textContent = `Action links · ${node.attrs.primaryLabel}${node.attrs.secondaryLabel ? ` / ${node.attrs.secondaryLabel}` : ''}`;
			dom.addEventListener('click', (event) => event.preventDefault());
			return { dom };
		};
	}
});

export const ContentImageFigure = Node.create({
	name: 'contentImageFigure',
	group: 'block',
	atom: true,
	selectable: true,
	addAttributes() {
		return {
			src: { default: '' },
			alt: { default: '' },
			caption: { default: '' }
		};
	},
	parseHTML() {
		return [
			{
				tag: 'figure[data-content-image="true"]',
				getAttrs: (element) => contentImage(element as HTMLElement) || false
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		const image = normaliseContentImage(HTMLAttributes);
		if (!image) return ['figure', { 'data-content-image': 'invalid' }];
		return [
			'figure',
			{ 'data-content-image': 'true' },
			['img', { src: image.src, alt: image.alt }],
			...(image.caption ? [['figcaption', {}, image.caption]] : [])
		];
	}
});

export const CmsColumn = Node.create({
	name: 'cmsColumn',
	content:
		'(paragraph | heading | bulletList | orderedList | blockquote | codeBlock | horizontalRule | image | contentImageFigure | videoEmbed | table)+',
	defining: true,
	parseHTML() {
		return [{ tag: 'div[data-cms-column="true"]' }];
	},
	renderHTML() {
		return ['div', { 'data-cms-column': 'true' }, 0];
	}
});

export const CmsColumns = Node.create({
	name: 'cmsColumns',
	group: 'block',
	content: 'cmsColumn{2,4}',
	defining: true,
	isolating: true,
	addAttributes() {
		return { count: { default: 2 } };
	},
	parseHTML() {
		return [
			{
				tag: 'section[data-cms-columns]',
				getAttrs: (element) => {
					const container = element as HTMLElement;
					const count = Number(container.getAttribute('data-cms-columns'));
					return isCmsColumnCount(count) && container.children.length === count ? { count } : false;
				}
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		return ['section', { 'data-cms-columns': HTMLAttributes.count }, 0];
	},
	addKeyboardShortcuts() {
		return {
			Escape: () =>
				this.editor.commands.command(({ state, tr, dispatch }) => {
					for (let depth = state.selection.$from.depth; depth > 0; depth--) {
						if (state.selection.$from.node(depth).type.name !== 'cmsColumns') continue;
						const insertAt = state.selection.$from.after(depth);
						if (dispatch) {
							const paragraph = state.schema.nodes.paragraph.create();
							dispatch(
								tr
									.insert(insertAt, paragraph)
									.setSelection(TextSelection.create(tr.doc, insertAt + 1))
									.scrollIntoView()
							);
						}
						return true;
					}
					return false;
				})
		};
	}
});

export const CmsProfileCards = Node.create({
	name: 'cmsProfileCards',
	group: 'block',
	atom: true,
	selectable: true,
	addAttributes() {
		return { items: { default: [] as ProfileCard[] } };
	},
	parseHTML() {
		return [
			{
				tag: 'section[data-cms-profiles="true"]',
				getAttrs: (element) => {
					const items = profileCards(element as HTMLElement);
					return items.length ? { items } : false;
				}
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		const items = normaliseProfileCards(HTMLAttributes.items);
		return [
			'section',
			{ 'data-cms-profiles': 'true' },
			...items.map((item) => [
				'article',
				dataAttributes({
					'data-cms-profile': 'true',
					'data-name': item.name,
					'data-role': item.role,
					'data-bio': item.bio,
					'data-image': item.image,
					'data-alt': item.alt
				}),
				...(item.image ? [['img', { src: item.image, alt: item.alt }]] : []),
				[
					'div',
					{},
					['h3', {}, item.name],
					...(item.role ? [['p', {}, item.role]] : []),
					...(item.bio ? [['p', {}, item.bio]] : [])
				],
				...(item.links.length
					? [
							[
								'div',
								{ 'data-cms-profile-links': 'true' },
								...item.links.map((link) => [
									'a',
									{ href: link.href, 'data-cms-profile-link': 'true' },
									link.label
								])
							]
						]
					: [])
			])
		];
	}
});

export const CmsLogoGrid = Node.create({
	name: 'cmsLogoGrid',
	group: 'block',
	atom: true,
	selectable: true,
	addAttributes() {
		return { items: { default: [] as LogoItem[] } };
	},
	parseHTML() {
		return [
			{
				tag: 'div[data-cms-logo-grid="true"]',
				getAttrs: (element) => {
					const items = logoItems(element as HTMLElement);
					return items.length ? { items } : false;
				}
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		const items = normaliseLogoItems(HTMLAttributes.items);
		return [
			'div',
			{ 'data-cms-logo-grid': 'true' },
			...items.map((item) => [
				'figure',
				dataAttributes({
					'data-cms-logo': 'true',
					'data-name': item.name,
					'data-image': item.image,
					'data-alt': item.alt,
					'data-href': item.href
				}),
				...(item.href
					? [['a', { href: item.href }, ['img', { src: item.image, alt: item.alt || item.name }]]]
					: [['img', { src: item.image, alt: item.alt || item.name }]]),
				['figcaption', {}, item.name]
			])
		];
	}
});

export const CmsProjectFacts = Node.create({
	name: 'cmsProjectFacts',
	group: 'block',
	atom: true,
	selectable: true,
	addAttributes() {
		return { items: { default: [] as ProjectFact[] } };
	},
	parseHTML() {
		return [
			{
				tag: 'dl[data-cms-project-facts="true"]',
				getAttrs: (element) => {
					const items = projectFacts(element as HTMLElement);
					return items.length ? { items } : false;
				}
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		const items = normaliseProjectFacts(HTMLAttributes.items);
		return [
			'dl',
			{ 'data-cms-project-facts': 'true' },
			...items.map((item) => [
				'div',
				{ 'data-cms-project-fact': 'true', 'data-label': item.label, 'data-value': item.value },
				['dt', {}, item.label],
				['dd', {}, item.value]
			])
		];
	}
});

export const CmsEditionGrid = Node.create({
	name: 'cmsEditionGrid',
	group: 'block',
	atom: true,
	selectable: true,
	addOptions() {
		return { editionTitle: (id: string) => id };
	},
	addAttributes() {
		return { ids: { default: '' } };
	},
	parseHTML() {
		return [
			{
				tag: 'div[data-cms-editions]',
				getAttrs: (element) => {
					const ids = serialiseEditionIds(
						parseEditionIds((element as HTMLElement).getAttribute('data-cms-editions') || '')
					);
					return ids ? { ids } : false;
				}
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		return ['div', { 'data-cms-editions': HTMLAttributes.ids }];
	},
	addNodeView() {
		return ({ node }) => {
			const ids = parseEditionIds(node.attrs.ids);
			const dom = document.createElement('div');
			dom.className = 'cms-editor-edition-grid';
			dom.contentEditable = 'false';
			dom.dataset.cmsEditions = node.attrs.ids;
			const title = document.createElement('strong');
			title.textContent = `Edition grid · ${ids.length}`;
			const editions = document.createElement('span');
			editions.textContent = ids.map((id) => this.options.editionTitle(id)).join(' · ');
			dom.append(title, editions);
			return { dom };
		};
	}
});

export const CmsSummary = Node.create({
	name: 'cmsSummary',
	content: 'inline*',
	defining: true,
	parseHTML() {
		return [{ tag: 'summary' }];
	},
	renderHTML() {
		return ['summary', 0];
	}
});

export const CmsExpandable = Node.create({
	name: 'cmsExpandable',
	group: 'block',
	content: 'cmsSummary block+',
	defining: true,
	isolating: true,
	parseHTML() {
		return [{ tag: 'details[data-cms-expandable="true"]' }];
	},
	renderHTML() {
		return ['details', { 'data-cms-expandable': 'true' }, 0];
	},
	addNodeView() {
		return () => {
			const dom = document.createElement('details');
			dom.open = true;
			dom.dataset.cmsExpandable = 'true';
			const contentDOM = document.createElement('div');
			contentDOM.className = 'cms-editor-expandable-content';
			dom.append(contentDOM);
			return { dom, contentDOM };
		};
	},
	addKeyboardShortcuts() {
		return {
			Escape: () =>
				this.editor.commands.command(({ state, tr, dispatch }) => {
					for (let depth = state.selection.$from.depth; depth > 0; depth--) {
						if (state.selection.$from.node(depth).type.name !== 'cmsExpandable') continue;
						const insertAt = state.selection.$from.after(depth);
						if (dispatch) {
							const paragraph = state.schema.nodes.paragraph.create();
							dispatch(
								tr
									.insert(insertAt, paragraph)
									.setSelection(TextSelection.create(tr.doc, insertAt + 1))
									.scrollIntoView()
							);
						}
						return true;
					}
					return false;
				})
		};
	}
});

export function calloutContent(style: CalloutStyle) {
	return {
		type: 'cmsCallout',
		attrs: { style },
		content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Callout text' }] }]
	};
}

export function expandableContent() {
	return {
		type: 'cmsExpandable',
		content: [
			{ type: 'cmsSummary', content: [{ type: 'text', text: 'Section title' }] },
			{ type: 'paragraph', content: [{ type: 'text', text: 'Section content' }] }
		]
	};
}

export function columnsContent(count: CmsColumnCount) {
	return {
		type: 'cmsColumns',
		attrs: { count },
		content: Array.from({ length: count }, (_, index) => ({
			type: 'cmsColumn',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: `Column ${index + 1}` }]
				}
			]
		}))
	};
}

export function profileCardsContent(items: ProfileCard[]) {
	return { type: 'cmsProfileCards', attrs: { items: normaliseProfileCards(items) } };
}

export function logoGridContent(items: LogoItem[]) {
	return { type: 'cmsLogoGrid', attrs: { items: normaliseLogoItems(items) } };
}

export function projectFactsContent(items: ProjectFact[]) {
	return { type: 'cmsProjectFacts', attrs: { items: normaliseProjectFacts(items) } };
}

export function contentImageFigure(image: ContentImage) {
	return { type: 'contentImageFigure', attrs: normaliseContentImage(image) };
}
