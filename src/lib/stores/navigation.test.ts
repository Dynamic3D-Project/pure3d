import { expect, test } from 'bun:test';
import { mock } from 'bun:test';

mock.module('$lib/database/client', () => ({ pb: {} }));

const { resolvedItems } = await import('./navigation');

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
