import type { RecordModel } from 'pocketbase';

export type TargetType = 'content' | 'category' | 'collection' | 'edition' | 'route' | 'external';
export interface MenuTarget {
	type: TargetType;
	value: string;
}
export interface MenuLink {
	id: string;
	label: string;
	target: MenuTarget;
	visible: boolean;
}
export interface MenuGroup {
	id: string;
	label: string;
	prominent: boolean;
	links: MenuLink[];
}
export interface MenuItem {
	id: string;
	label: string;
	visible: boolean;
	groups: MenuGroup[];
	direct?: MenuLink | null;
	landing?: MenuLink | null;
	introduction?: {
		heading: string;
		description: string;
	} | null;
	featured?: {
		kicker: string;
		title: string;
		description: string;
		artwork: string;
		link: MenuLink;
	} | null;
}
export interface MenuConfig {
	items: MenuItem[];
	primary: MenuLink | null;
	helpText: string;
	helpLink: MenuLink | null;
}
export interface MenuDirectory {
	content: RecordModel[];
	categories: RecordModel[];
	collections: RecordModel[];
	editions: RecordModel[];
}
export const applicationRoutes = [
	{ value: '/', label: 'Home' },
	{ value: '/collections', label: 'Collections' },
	{ value: '/editions', label: 'Editions' },
	{ value: '/resources', label: 'All posts' },
	{ value: '/demo', label: 'Demo' },
	{ value: '/profile', label: 'My profile' },
	{ value: '/reviews', label: 'My work' }
];
export const emptyMenu = (): MenuConfig => ({
	items: [],
	primary: null,
	helpText: '',
	helpLink: null
});
export function menuSignature(config: MenuConfig): string {
	return JSON.stringify(config, (_key, value) =>
		value && typeof value === 'object' && !Array.isArray(value)
			? Object.fromEntries(
					Object.keys(value)
						.sort()
						.map((key) => [key, value[key]])
				)
			: value
	);
}
export const newMenuLink = (): MenuLink => ({
	id: crypto.randomUUID(),
	label: 'New link',
	visible: true,
	target: { type: 'route', value: '' }
});
export function contentPath(item: Record<string, unknown>): string {
	return item.layout === 'guide'
		? item.slug === 'documentation'
			? '/documentation'
			: `/documentation/${item.slug}`
		: `/resources/${item.slug}`;
}
export function safeMenuUrl(value: string): boolean {
	if (value.startsWith('/') && !value.startsWith('//') && !/[\\\s]/.test(value)) return true;
	try {
		return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}
export function targetPath(target: MenuTarget, directory: MenuDirectory): string | null {
	if (target.type === 'external') return safeMenuUrl(target.value) ? target.value : null;
	if (target.type === 'route')
		return applicationRoutes.some((r) => r.value === target.value) ? target.value : null;
	const records =
		target.type === 'content'
			? directory.content
			: target.type === 'category'
				? directory.categories
				: target.type === 'collection'
					? directory.collections
					: directory.editions;
	const record = records.find((r) => r.id === target.value);
	if (!record) return null;
	return target.type === 'content'
		? contentPath(record)
		: target.type === 'category'
			? `/resources?category=${record.slug}`
			: target.type === 'collection'
				? `/collections/${record.id}`
				: `/editions/${record.id}`;
}
export function validateMenu(config: MenuConfig, directory: MenuDirectory): string[] {
	const errors: string[] = [];
	const ids = new Set<string>();
	function identity(id: string, label: string) {
		if (!id || ids.has(id)) errors.push('Menu item IDs must be unique.');
		ids.add(id);
		if (!label.trim()) errors.push('Every menu, group and link needs a label.');
	}
	function link(item: MenuLink) {
		identity(item.id, item.label);
		if (!targetPath(item.target, directory))
			errors.push(`“${item.label}” needs a valid destination.`);
	}
	for (const item of config.items) {
		identity(item.id, item.label);
		if (
			item.introduction &&
			(!item.introduction.heading.trim() || !item.introduction.description.trim())
		)
			errors.push('Menu introductions need a heading and description.');
		if (item.direct && item.landing) errors.push('A direct menu cannot also have a landing link.');
		if (item.direct) link(item.direct);
		if (item.landing) link(item.landing);
		for (const group of item.groups) {
			identity(group.id, group.label);
			group.links.forEach(link);
		}
		if (item.featured) link(item.featured.link);
	}
	if (config.primary) link(config.primary);
	if (config.helpLink) link(config.helpLink);
	return [...new Set(errors)];
}

// Keep unpublished destinations (including their custom labels) out of the public snapshot.
export function publishableMenu(config: MenuConfig, directory: MenuDirectory): MenuConfig {
	const published = {
		...directory,
		content: directory.content.filter((r) => r.isPublished),
		collections: directory.collections.filter((r) => r.isVisible),
		editions: directory.editions.filter((r) => r.isPublished)
	};
	const visible = (link: MenuLink | null | undefined) =>
		link?.visible && targetPath(link.target, published) ? link : null;
	const items = config.items
		.filter((item) => item.visible)
		.flatMap((item) => {
			if (item.direct) {
				const direct = visible(item.direct);
				return direct ? [{ ...item, direct, landing: null, groups: [], featured: null }] : [];
			}
			const landing = visible(item.landing);
			const groups = item.groups
				.map((group) => ({ ...group, links: group.links.filter((link) => !!visible(link)) }))
				.filter((group) => group.links.length);
			const featured = item.featured && visible(item.featured.link) ? item.featured : null;
			return groups.length || featured || landing ? [{ ...item, landing, groups, featured }] : [];
		});
	return { ...config, items, primary: visible(config.primary), helpLink: visible(config.helpLink) };
}
export function move<T>(items: T[], from: number, to: number): T[] {
	if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
	const next = [...items];
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
}
export function moveMenuLink(
	config: MenuConfig,
	id: string,
	groupId: string,
	index: number
): MenuConfig {
	const next = structuredClone(config);
	const groups = next.items.flatMap((item) => item.groups);
	const source = groups.find((g) => g.links.some((link) => link.id === id)),
		target = groups.find((g) => g.id === groupId);
	if (!source || !target) return config;
	const [link] = source.links.splice(
		source.links.findIndex((link) => link.id === id),
		1
	);
	target.links.splice(Math.max(0, Math.min(index, target.links.length)), 0, link);
	return next;
}
export function validParent(
	items: RecordModel[],
	id: string,
	parent: string,
	layout: string
): boolean {
	const seen = new Set([id]);
	let current = parent;
	while (current) {
		if (seen.has(current)) return false;
		seen.add(current);
		const record = items.find((r) => r.id === current);
		if (!record || record.kind !== 'page' || record.layout !== layout) return false;
		current = record.parent || '';
	}
	return true;
}
export function orderedPages(
	items: RecordModel[],
	parent = '',
	depth = 0,
	seen = new Set<string>()
): { item: RecordModel; depth: number }[] {
	return items
		.filter((r) => (r.parent || '') === parent && !seen.has(r.id))
		.sort((a, b) => (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title))
		.flatMap((item) => {
			seen.add(item.id);
			return [{ item, depth }, ...orderedPages(items, item.id, depth + 1, seen)];
		});
}
