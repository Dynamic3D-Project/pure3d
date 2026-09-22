import { Node, mergeAttributes } from '@tiptap/core';

export function embedUrl(value: string): string | null {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:') return null;
		if (url.hostname === 'w.soundcloud.com' && url.pathname === '/player/') return url.href;
		if (url.hostname === 'youtu.be' && /^\/[\w-]+$/.test(url.pathname))
			return `https://www.youtube-nocookie.com/embed${url.pathname}`;
		if (['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
			const id = url.pathname.startsWith('/embed/')
				? url.pathname.split('/')[2]
				: url.searchParams.get('v');
			return id && /^[\w-]+$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
		}
		if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
			const id = url.pathname.split('/').pop();
			return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
		}
		return null;
	} catch {
		return null;
	}
}
export const VideoEmbed = Node.create({
	name: 'videoEmbed',
	group: 'block',
	atom: true,
	addAttributes() {
		return { src: { default: '' }, title: { default: 'Embedded video' } };
	},
	parseHTML() {
		return [
			{
				tag: 'iframe[src]',
				getAttrs: (element) => {
					const src = embedUrl((element as HTMLElement).getAttribute('src') || '');
					return src
						? { src, title: (element as HTMLElement).getAttribute('title') || 'Embedded video' }
						: false;
				}
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			'iframe',
			mergeAttributes(HTMLAttributes, {
				allowfullscreen: 'true',
				loading: 'lazy',
				referrerpolicy: 'strict-origin-when-cross-origin'
			})
		];
	}
});
