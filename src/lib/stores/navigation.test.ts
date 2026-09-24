import { expect, test } from 'bun:test';
import { mock } from 'bun:test';

const queried: string[] = [];
mock.module('$lib/database/client', () => ({
	pb: {
		collection: (name: string) => ({
			getFullList: async () => {
				queried.push(name);
				return [];
			}
		})
	}
}));

const { menuDirectory, referencedMenuTypes, resolvedItems } = await import('./navigation');

test('public menu includes destinations nested in groups and featured links', () => {
	const types = referencedMenuTypes([
		{
			items: [
				{
					id: 'explore',
					label: 'Explore',
					visible: true,
					groups: [
						{
							id: 'links',
							label: 'Links',
							prominent: false,
							links: [
								{
									id: 'edition',
									label: 'Edition',
									visible: true,
									target: { type: 'edition', value: 'one' }
								}
							]
						}
					],
					featured: {
						kicker: '',
						title: '',
						description: '',
						artwork: '',
						link: {
							id: 'collection',
							label: 'Collection',
							visible: true,
							target: { type: 'collection', value: 'two' }
						}
					}
				}
			],
			primary: null,
			helpText: '',
			helpLink: null
		}
	]);
	expect([...types].sort()).toEqual(['collection', 'edition']);
});

test('public menu directory skips unused collections and editions', async () => {
	queried.length = 0;
	await menuDirectory(false, [
		{
			items: [
				{
					id: 'news',
					label: 'News',
					visible: true,
					groups: [],
					direct: {
						id: 'link',
						label: 'News',
						visible: true,
						target: { type: 'category', value: 'news' }
					}
				}
			],
			primary: null,
			helpText: '',
			helpLink: null
		}
	]);
	expect(queried).toEqual(['cms_categories']);
	queried.length = 0;
	await menuDirectory(true);
	expect(queried).toEqual(['content', 'cms_categories', 'collections', 'editions']);
});

test('resolved expanded menus retain landing links and introductions', () => {
	const items = resolvedItems(
		{
			items: [
				{
					id: 'publish',
					label: 'Publish with us',
					visible: true,
					introduction: { heading: 'Publish research', description: 'A short introduction.' },
					landing: {
						id: 'landing',
						label: 'Publish with us',
						visible: true,
						target: { type: 'route', value: '/resources' }
					},
					groups: []
				}
			],
			primary: null,
			helpText: '',
			helpLink: null
		},
		{ content: [], categories: [], collections: [], editions: [] }
	);
	expect(items[0].landing?.href).toBe('/resources');
	expect(items[0].introduction?.description).toBe('A short introduction.');
});
