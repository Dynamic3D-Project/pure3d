import { describe, expect, test } from 'bun:test';
import { createRuntimeScene, parseEditionScene } from './edition-scene';

const scene = {
	scene: 0,
	scenes: [
		{ nodes: [0], meta: 0, setup: 0 },
		{ nodes: [3], meta: 3, setup: 1 }
	],
	nodes: [
		{ children: [1], meta: 1 },
		{ model: 0, children: [2] },
		{ model: 1, children: [0], meta: 2 },
		{ model: 2, meta: 3 }
	],
	models: [
		{ annotations: [{ id: 'door', titles: { EN: 'Door' } }] },
		{
			meta: 2,
			annotations: [
				{ id: 'door', titles: { EN: 'Duplicate door' } },
				{ id: 'window', titles: { FR: 'Fenêtre' } }
			]
		},
		{ annotations: [{ id: 'inactive', titles: { EN: 'Inactive' } }] }
	],
	metas: [
		{
			articles: [
				{ id: 'legacy', title: 'Legacy', uri: 'articles/legacy.html', lead: 'Legacy lead' },
				{ id: 'shared', titles: { EN: 'First shared' }, uris: { EN: 'first.html' } }
			]
		},
		{ articles: [{ id: 'node-story', titles: { FR: 'Node story' }, uris: { FR: 'node.html' } }] },
		{
			articles: [
				{ id: 'shared', titles: { EN: 'Second shared' } },
				{ id: 'model-story', leads: { DE: 'Modell' }, uris: { DE: 'model.html' } }
			]
		},
		{ articles: [{ id: 'inactive-story', uris: { EN: 'inactive.html' } }] }
	],
	setups: [
		{
			viewer: { activeTags: 'Default' },
			reader: { enabled: false, position: 'Right' },
			language: { language: 'NL' },
			tours: [
				{ id: 'tour-a', titles: { EN: 'Tour' }, steps: [{ id: 'linked' }, null, { id: 'plain' }] },
				{ id: 'tour-a', steps: [{ id: 'duplicate-tour' }] },
				null,
				{ id: 'tour-b', steps: [{ id: 'final' }] }
			],
			snapshots: {
				targets: [
					'scenes/0/setup/reader/enabled',
					null,
					'scenes/0/setup/reader/articleId',
					'scenes/0/setup/viewer/activeTags',
					'scenes/0/setup/reader/position'
				],
				states: [
					{ id: 'linked', values: [true, 'ignored', 'legacy', 'House, Detail', 1] },
					{ id: 'plain', values: [null, 'ignored', 'legacy', 'House', 0] }
				]
			}
		},
		{ reader: { enabled: true, position: 'Overlay' } }
	]
};

describe('edition scene parser', () => {
	test('traverses active nested nodes and referenced metadata without leaking inactive content', () => {
		const original = structuredClone(scene);
		const content = parseEditionScene(scene);
		expect(scene).toEqual(original);
		expect(content.annotations.map((annotation) => annotation.id)).toEqual(['door', 'window']);
		expect(content.articles.map((article) => article.id)).toEqual([
			'legacy',
			'shared',
			'node-story',
			'model-story'
		]);
		expect(content.articles[0]).toMatchObject({
			uri: 'articles/legacy.html',
			lead: 'Legacy lead',
			uris: {},
			leads: {}
		});
		expect(content.defaultLanguage).toBe('NL');
		expect(content.languages).toEqual(['NL', 'EN', 'FR', 'DE']);
	});

	test('preserves snapshot value positions and source indexes for valid tours and steps', () => {
		const content = parseEditionScene(scene);
		expect(content.tours.map(({ id, sourceIndex }) => ({ id, sourceIndex }))).toEqual([
			{ id: 'tour-a', sourceIndex: 0 },
			{ id: 'tour-b', sourceIndex: 3 }
		]);
		expect(content.tours[0].steps).toEqual([
			{
				id: 'linked',
				title: 'Step 1',
				titles: {},
				sourceIndex: 0,
				articleId: 'legacy',
				categories: ['House', 'Detail']
			},
			{
				id: 'plain',
				title: 'Step 3',
				titles: {},
				sourceIndex: 2,
				articleId: 'legacy',
				categories: ['House']
			}
		]);
	});

	test('does not use arbitrary metadata or setup when the active scene omits references', () => {
		const content = parseEditionScene({
			scenes: [{ nodes: [0] }],
			nodes: [{ model: 0 }],
			models: [{ annotations: [{ id: 'only' }] }],
			metas: [{ articles: [{ id: 'wrong', uri: 'wrong.html' }] }],
			setups: [{ viewer: { activeTags: 'wrong' } }]
		});
		expect(content.articles).toEqual([]);
		expect(content.initialCategories).toEqual([]);
	});

	test('an explicit reader-off step clears a previously linked story', () => {
		const source = structuredClone(scene);
		source.setups[0].snapshots!.states![1].values[0] = false;
		const content = parseEditionScene(source);
		expect(content.tours[0].steps[0].articleId).toBe('legacy');
		expect(content.tours[0].steps[1].articleId).toBeNull();
	});

	test('clears active reader snapshots without changing source or unrelated setup values', () => {
		const runtimeSource = {
			scene: 1,
			scenes: [{ setup: 0 }, { setup: 1 }],
			setups: [
				{ reader: { enabled: true, position: 'Right' } },
				{
					viewer: { activeTags: 'Keep' },
					snapshots: {
						targets: [
							'scenes/1/setup/reader/enabled',
							'scenes/1/setup/reader/position',
							'scenes/1/setup/reader/articleId',
							'scenes/1/setup/viewer/activeTags'
						],
						states: [{ id: 'center-reader', values: [true, 1, 'story', 'Keep'] }]
					}
				}
			]
		};
		const runtime = createRuntimeScene(runtimeSource) as typeof runtimeSource;
		expect(runtimeSource).toEqual({
			scene: 1,
			scenes: [{ setup: 0 }, { setup: 1 }],
			setups: [
				{ reader: { enabled: true, position: 'Right' } },
				{
					viewer: { activeTags: 'Keep' },
					snapshots: {
						targets: [
							'scenes/1/setup/reader/enabled',
							'scenes/1/setup/reader/position',
							'scenes/1/setup/reader/articleId',
							'scenes/1/setup/viewer/activeTags'
						],
						states: [{ id: 'center-reader', values: [true, 1, 'story', 'Keep'] }]
					}
				}
			]
		});
		expect(runtime.setups[0].reader).toEqual({ enabled: true, position: 'Right' });
		expect(runtime.setups[1]!.reader).toEqual({ enabled: false });
		expect(runtime.setups[1]!.snapshots!.states![0]!.values).toEqual([false, 1, '']);
		expect(runtime.setups[1]!.snapshots!.targets).toHaveLength(3);
	});

	test('rejects malformed scenes and ignores invalid entries', () => {
		expect(() => parseEditionScene({ scenes: [] })).toThrow('The scene has no scenes.');
		expect(
			parseEditionScene({ ...scene, models: [{ annotations: [{ id: 1 }] }] }).annotations
		).toEqual([]);
	});
});
