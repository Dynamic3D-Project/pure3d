import { writable, get } from 'svelte/store';
import { pb } from '$lib/database/client';
import {
	emptyMenu,
	targetPath,
	type MenuConfig,
	type MenuDirectory,
	type MenuLink
} from '$lib/cms';

export const menus = writable({
	main: emptyMenu(),
	footer: emptyMenu(),
	directory: { content: [], categories: [], collections: [], editions: [] } as MenuDirectory,
	preview: false,
	error: ''
});
let request = 0;
export function referencedMenuTypes(configs: MenuConfig[]): Set<string> {
	const types = new Set<string>();
	const include = (link: MenuLink | null | undefined) => {
		if (link?.visible) types.add(link.target.type);
	};
	for (const config of configs) {
		include(config.primary);
		include(config.helpLink);
		for (const item of config.items) {
			if (!item.visible) continue;
			include(item.direct);
			include(item.landing);
			include(item.featured?.link);
			for (const group of item.groups) group.links.forEach(include);
		}
	}
	return types;
}
export async function menuDirectory(
	preview = false,
	configs?: MenuConfig[]
): Promise<MenuDirectory> {
	const needed = configs ? referencedMenuTypes(configs) : null;
	const [content, categories, collections, editions] = await Promise.all([
		!needed || needed.has('content')
			? pb.collection('content').getFullList({
					filter: preview ? '' : 'isPublished = true',
					fields: 'id,title,slug,layout,kind,isPublished'
				})
			: [],
		!needed || needed.has('category')
			? pb.collection('cms_categories').getFullList({ sort: 'name' })
			: [],
		!needed || needed.has('collection')
			? pb
					.collection('collections')
					.getFullList({ filter: preview ? '' : 'isVisible = true', fields: 'id,title,isVisible' })
			: [],
		!needed || needed.has('edition')
			? pb.collection('editions').getFullList({
					filter: preview ? '' : 'isPublished = true',
					fields: 'id,title,dcTitle,isPublished'
				})
			: []
	]);
	return { content, categories, collections, editions };
}
export async function refreshMenus(force = false) {
	if (get(menus).preview && !force) {
		const current = ++request;
		try {
			const directory = await menuDirectory(true);
			if (current === request && pb.authStore.record?.role === 'admin')
				menus.update((value) => ({ ...value, directory }));
		} catch {
			if (current === request)
				menus.update((value) => ({ ...value, error: 'Navigation could not load.' }));
		}
		return;
	}
	const current = ++request;
	try {
		const records = await pb.collection('cms_menus').getFullList();
		const directory = await menuDirectory(
			false,
			records.map((record) => record.config)
		);
		if (current !== request) return;
		menus.set({
			main: records.find((r) => r.slot === 'main')?.config || emptyMenu(),
			footer: records.find((r) => r.slot === 'footer')?.config || emptyMenu(),
			directory,
			preview: false,
			error: ''
		});
	} catch {
		if (current === request)
			menus.update((value) => ({ ...value, error: 'Navigation could not load.' }));
	}
}
export async function previewMenu(slot: 'main' | 'footer', config: MenuConfig) {
	if (pb.authStore.record?.role !== 'admin') throw new Error('Admin access required');
	const directory = await menuDirectory(true);
	setMenuPreview(slot, config, directory);
}
export function setMenuPreview(
	slot: 'main' | 'footer',
	config: MenuConfig,
	directory: MenuDirectory
) {
	if (pb.authStore.record?.role !== 'admin') return;
	++request;
	menus.update((value) => ({
		...value,
		[slot]: structuredClone(config),
		directory,
		preview: true,
		error: ''
	}));
}
export function restoreLiveMenu(slot: 'main' | 'footer', config: MenuConfig) {
	++request;
	menus.update((value) => ({
		...value,
		[slot]: structuredClone(config),
		preview: false,
		error: ''
	}));
}
export function resolvedLink(link: MenuLink | null | undefined, directory: MenuDirectory) {
	if (!link?.visible) return null;
	const href = targetPath(link.target, directory);
	return href ? { ...link, href } : null;
}
export function resolvedItems(config: MenuConfig, directory: MenuDirectory) {
	return config.items
		.filter((item) => item.visible && (!item.direct || resolvedLink(item.direct, directory)))
		.map((item) => ({
			...item,
			direct: resolvedLink(item.direct, directory),
			landing: item.direct ? null : resolvedLink(item.landing, directory),
			featured:
				!item.direct && item.featured && resolvedLink(item.featured.link, directory)
					? { ...item.featured, link: resolvedLink(item.featured.link, directory)! }
					: null,
			groups: (item.direct ? [] : item.groups)
				.map((group) => ({
					...group,
					links: group.links
						.map((link) => resolvedLink(link, directory))
						.filter((link): link is NonNullable<typeof link> => !!link)
				}))
				.filter((group) => group.links.length)
		}))
		.filter((item) => item.direct || item.landing || item.groups.length || item.featured);
}
