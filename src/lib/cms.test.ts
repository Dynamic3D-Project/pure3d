import { expect, test } from 'bun:test';
import {
	emptyMenu,
	newMenuLink,
	move,
	moveMenuLink,
	targetPath,
	validParent,
	validateMenu,
	publishableMenu,
	menuSignature
} from './cms';
import type { RecordModel } from 'pocketbase';
test('menu references survive page slug changes and never allow executable URLs', () => {
	const directory = {
		content: [
			{
				id: 'page',
				collectionId: 'content',
				collectionName: 'content',
				slug: 'new-name',
				layout: 'standard'
			} as RecordModel
		],
		categories: [],
		collections: [],
		editions: []
	};
	expect(targetPath({ type: 'content', value: 'page' }, directory)).toBe('/resources/new-name');
	expect(targetPath({ type: 'external', value: 'javascript:alert(1)' }, directory)).toBeNull();
	expect(targetPath({ type: 'external', value: '//evil.example' }, directory)).toBeNull();
	const config = emptyMenu();
	config.primary = { ...newMenuLink(), target: { type: 'content', value: 'missing' } };
	expect(validateMenu(config, directory).length).toBe(1);
});
test('published menu comparison is independent of database JSON key ordering', () => {
	expect(menuSignature(emptyMenu())).toBe(
		menuSignature({ helpText: '', helpLink: null, primary: null, items: [] })
	);
});
test('public menu snapshots omit draft and hidden destinations without altering the editor draft', () => {
	const directory = {
		content: [
			{
				id: 'draft',
				collectionId: 'content',
				collectionName: 'content',
				slug: 'private',
				layout: 'standard',
				isPublished: false
			}
		],
		categories: [],
		collections: [],
		editions: []
	};
	const config = emptyMenu();
	config.primary = {
		...newMenuLink(),
		label: 'Private draft title',
		target: { type: 'content', value: 'draft' }
	};
	expect(publishableMenu(config, directory).primary).toBeNull();
	expect(config.primary.label).toBe('Private draft title');
	directory.content[0].isPublished = true;
	expect(publishableMenu(config, directory).primary?.label).toBe('Private draft title');
});
test('expanded menus keep an optional introduction and eligible landing link', () => {
	const directory = {
		content: [
			{
				id: 'landing',
				collectionId: 'content',
				collectionName: 'content',
				slug: 'publish',
				layout: 'guide',
				isPublished: true
			} as RecordModel
		],
		categories: [],
		collections: [],
		editions: []
	};
	const config = emptyMenu();
	config.items = [
		{
			id: 'publish',
			label: 'Publish with us',
			visible: true,
			introduction: {
				heading: 'Turn 3D research into an edition.',
				description: 'Start with the overview, then explore the practical detail.'
			},
			landing: {
				id: 'landing-link',
				label: 'Publish with us',
				visible: true,
				target: { type: 'content', value: 'landing' }
			},
			groups: [
				{
					id: 'guides',
					label: 'Guides',
					prominent: false,
					links: [
						{
							id: 'overview',
							label: 'Overview',
							visible: true,
							target: { type: 'route', value: '/resources' }
						}
					]
				}
			]
		}
	];
	expect(validateMenu(config, directory)).toEqual([]);
	expect(targetPath(config.items[0].landing!.target, directory)).toBe('/documentation/publish');
	directory.content[0].isPublished = false;
	const published = publishableMenu(config, directory);
	expect(published.items[0].landing).toBeNull();
	expect(published.items[0].introduction).toEqual(config.items[0].introduction);
	expect(config.items[0].landing?.target.value).toBe('landing');
	config.items[0].introduction = { heading: '', description: 'Missing heading' };
	expect(validateMenu(config, directory)).toContain(
		'Menu introductions need a heading and description.'
	);
});
test('reorder and cross-group movement preserve every item exactly once', () => {
	expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
	expect(move(['a'], 0, -1)).toEqual(['a']);
	const config = emptyMenu();
	const link = newMenuLink();
	config.items = [
		{
			id: 'a',
			label: 'A',
			visible: true,
			groups: [
				{ id: 'one', label: 'One', prominent: true, links: [link] },
				{ id: 'two', label: 'Two', prominent: false, links: [] }
			]
		}
	];
	const next = moveMenuLink(config, link.id, 'two', 0);
	expect(next.items[0].groups.map((g) => g.links.length)).toEqual([0, 1]);
	expect(config.items[0].groups[0].links).toHaveLength(1);
});
test('page parents cannot create cycles or cross into posts', () => {
	const rows = [
		{ id: 'a', kind: 'page', layout: 'guide', parent: '' },
		{ id: 'b', kind: 'page', layout: 'guide', parent: 'a' },
		{ id: 'c', kind: 'post', layout: 'article', parent: '' }
	].map((r) => ({ ...r, collectionId: 'content', collectionName: 'content' }));
	expect(validParent(rows, 'a', 'b', 'guide')).toBe(false);
	expect(validParent(rows, 'b', 'a', 'guide')).toBe(true);
	expect(validParent(rows, 'a', 'c', 'guide')).toBe(false);
});
