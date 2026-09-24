import { describe, expect, test } from 'bun:test';
import {
	assertMenuTargets,
	assertTargetSeed,
	allowedAssetMime,
	mapUnique,
	menuFingerprint,
	publicationState,
	remapMenu,
	rewriteLocalAssetUrls,
	sourceSnapshot,
	TARGET_ORIGIN
} from './migrate-local-cms-to-production';
import { emptyMenu, type MenuConfig } from '../src/lib/cms';

const category = { id: 'category-local', slug: 'news' } as never;
const published = { id: 'content-remote', slug: 'post', isPublished: true } as never;
const directory = {
	content: [published],
	categories: [{ id: 'category-remote', slug: 'news' }],
	collections: [],
	editions: []
};
const seededConfig = (label: string): MenuConfig => ({
	...emptyMenu(),
	items: Array.from({ length: 4 }, (_, index) => ({
		id: `${label}-item-${index}`,
		label: `${label} ${index}`,
		visible: true,
		groups: []
	}))
});
const seededMenus = [
	{
		collection: 'cms_menus' as const,
		id: 'live-main',
		slot: 'main' as const,
		config: seededConfig('main')
	},
	{
		collection: 'cms_menus' as const,
		id: 'live-footer',
		slot: 'footer' as const,
		config: seededConfig('footer')
	},
	{
		collection: 'cms_menu_drafts' as const,
		id: 'draft-main',
		slot: 'main' as const,
		config: seededConfig('main draft')
	},
	{
		collection: 'cms_menu_drafts' as const,
		id: 'draft-footer',
		slot: 'footer' as const,
		config: seededConfig('footer draft')
	}
];
const seedManifest = {
	version: 1 as const,
	target: TARGET_ORIGIN,
	menus: seededMenus.map(({ collection, id, slot, config }) => ({
		collection,
		id,
		slot,
		configHash: menuFingerprint(config)
	}))
};

describe('local CMS migration guards', () => {
	test('rewrites only registered local asset URLs and preserves legacy and external URLs', () => {
		const local = 'http://127.0.0.1:60021/api/files/assets/a/photo.png';
		const alias = 'http://localhost:60020/api/files/assets/a/photo.png';
		expect(
			rewriteLocalAssetUrls(
				`<img src="${local}"><img src="${alias}"><a href="https://archive.example/item">x</a>project/foo/bar.glb`,
				new Map([
					[local, 'https://main.example/api/files/assets/b/photo.png'],
					[alias, 'https://main.example/api/files/assets/b/photo.png']
				])
			)
		).toBe(
			'<img src="https://main.example/api/files/assets/b/photo.png"><img src="https://main.example/api/files/assets/b/photo.png"><a href="https://archive.example/item">x</a>project/foo/bar.glb'
		);
		expect(() => rewriteLocalAssetUrls('http://localhost:60021/unknown.png', new Map())).toThrow(
			'known content asset'
		);
	});

	test('dry-run accepts only the exact reviewed seeded menu shape and IDs', () => {
		expect(() =>
			mapUnique([{ slug: 'same' }, { slug: 'same' }], (item) => item.slug, 'slug')
		).toThrow('Ambiguous');
		expect(() =>
			assertTargetSeed({
				guides: [],
				content: [],
				categories: [category],
				assets: [],
				menus: [],
				drafts: []
			})
		).toThrow('unexpected CMS categories');
		expect(() =>
			assertTargetSeed({
				guides: [],
				content: [{ id: 'unapproved-content', layout: 'article' } as never],
				categories: [],
				assets: [],
				menus: [],
				drafts: []
			})
		).toThrow('unexpected non-guide CMS content');
		expect(() =>
			assertTargetSeed({
				guides: [],
				content: [],
				categories: [],
				assets: [],
				menus: seededMenus
					.filter((menu) => menu.collection === 'cms_menus')
					.map((menu) => ({ ...menu, collectionName: menu.collection })),
				drafts: seededMenus
					.filter((menu) => menu.collection === 'cms_menu_drafts')
					.map((menu) => ({ ...menu, collectionName: menu.collection }))
			})
		).toThrow('reviewed seed manifest');
		expect(
			sourceSnapshot({
				content: [{ id: 'row', updated: 'same', title: 'before', body: '<p>before</p>' }] as never,
				cms_menus: [{ id: 'menu', updated: 'same', config: seededConfig('before') }] as never
			})
		).not.toBe(
			sourceSnapshot({
				content: [{ id: 'row', updated: 'same', title: 'after', body: '<p>after</p>' }] as never,
				cms_menus: [{ id: 'menu', updated: 'same', config: seededConfig('after') }] as never
			})
		);
		expect(() =>
			assertTargetSeed(
				{
					guides: [],
					content: [],
					categories: [],
					assets: [],
					menus: seededMenus
						.filter((menu) => menu.collection === 'cms_menus')
						.map((menu) => ({ ...menu, collectionName: menu.collection })),
					drafts: seededMenus
						.filter((menu) => menu.collection === 'cms_menu_drafts')
						.map((menu) => ({ ...menu, collectionName: menu.collection }))
				},
				{ entries: [] },
				seedManifest
			)
		).not.toThrow();
		expect(() =>
			assertTargetSeed(
				{
					guides: [],
					content: [],
					categories: [],
					assets: [],
					menus: [
						{
							...seededMenus[0],
							collectionName: 'cms_menus',
							config: { ...seededMenus[0].config, helpText: 'changed' }
						},
						...seededMenus
							.filter((menu) => menu.collection === 'cms_menus')
							.slice(1)
							.map((menu) => ({ ...menu, collectionName: menu.collection }))
					],
					drafts: seededMenus
						.filter((menu) => menu.collection === 'cms_menu_drafts')
						.map((menu) => ({ ...menu, collectionName: menu.collection }))
				},
				{ entries: [] },
				seedManifest
			)
		).toThrow('reviewed seed manifest');
	});

	test('remaps every menu target recursively and rejects hidden live destinations', () => {
		const config: MenuConfig = {
			items: [
				{
					id: 'item',
					label: 'Item',
					visible: true,
					groups: [],
					landing: {
						id: 'landing',
						label: 'Landing',
						visible: true,
						target: { type: 'content', value: 'local-content' }
					},
					featured: {
						kicker: 'K',
						title: 'T',
						description: 'D',
						artwork: 'A',
						link: {
							id: 'featured',
							label: 'Featured',
							visible: true,
							target: { type: 'category', value: 'local-category' }
						}
					}
				}
			],
			primary: {
				id: 'primary',
				label: 'Primary',
				visible: true,
				target: { type: 'content', value: 'local-content' }
			},
			helpText: '',
			helpLink: null
		};
		const mapped = remapMenu(config, {
			content: new Map([['local-content', 'content-remote']]),
			categories: new Map([['local-category', 'category-remote']])
		});
		expect(mapped.items[0].landing?.target.value).toBe('content-remote');
		expect(mapped.items[0].featured?.link.target.value).toBe('category-remote');
		assertMenuTargets(mapped, directory, true);
		expect(() =>
			assertMenuTargets(
				mapped,
				{ ...directory, content: [{ ...published, isPublished: false }] },
				true
			)
		).toThrow('hidden destination');
	});

	test('publishes approved draft posts but leaves unpublished pages as drafts', () => {
		expect(allowedAssetMime('image/webp')).toBe(true);
		expect(allowedAssetMime('application/octet-stream')).toBe(false);
		expect(publicationState({ kind: 'post', isPublished: false })).toBe(true);
		expect(publicationState({ kind: 'page', isPublished: false })).toBe(false);
		expect(publicationState({ kind: 'page', isPublished: true })).toBe(true);
	});
});
