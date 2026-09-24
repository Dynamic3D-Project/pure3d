import { Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import {
	isCalloutStyle,
	parseEditionIds,
	safeContentUrl,
	serialiseEditionIds,
	type CalloutStyle
} from './content-components';

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
