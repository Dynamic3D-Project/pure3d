import { expect, test } from 'bun:test';
import { createRequire } from 'node:module';

class BadRequestError extends Error {}

(globalThis as typeof globalThis & { BadRequestError: typeof BadRequestError }).BadRequestError =
	BadRequestError;

const { enforceMenuVersion, validateComponentHtml, validateMenu } = createRequire(import.meta.url)(
	'./cms-service.cjs'
) as {
	enforceMenuVersion: (event: ReturnType<typeof requestEvent>) => void;
	validateComponentHtml: (html: string) => string | null;
	validateMenu: (event: ReturnType<typeof validateEvent>) => void;
};

function record(config: unknown, collection = 'cms_menu_drafts') {
	return {
		id: 'menu',
		collection: () => ({ name: collection }),
		getString: (field: string) => (field === 'config' ? JSON.stringify(config) : '')
	};
}

function requestEvent(version: string | null, current = 'current') {
	let called = false,
		transacted = false;
	const tx = { findRecordById: () => ({ getString: () => current }) };
	return {
		record: record({}),
		requestInfo: () => ({ headers: { x_pure3d_menu_version: version } }),
		app: {
			runInTransaction: (callback: (transaction: typeof tx) => void) => {
				transacted = true;
				callback(tx);
			}
		},
		next: () => (called = true),
		get called() {
			return called;
		},
		get transacted() {
			return transacted;
		}
	};
}

function validateEvent(config: unknown, collection = 'cms_menu_drafts', published = false) {
	let called = false;
	return {
		record: record(config, collection),
		app: { findRecordById: () => ({ getBool: () => published }) },
		next: () => (called = true),
		get called() {
			return called;
		}
	};
}

test('menu API updates compare the supplied version against a fresh record', () => {
	expect(() => enforceMenuVersion(requestEvent(null))).toThrow(
		'This menu changed. Reload before saving.'
	);
	expect(() => enforceMenuVersion(requestEvent('stale'))).toThrow(
		'This menu changed. Reload before saving.'
	);
	const event = requestEvent('current');
	enforceMenuVersion(event);
	expect(event.called).toBe(true);
	expect(event.transacted).toBe(true);
});

test('model validation has no request dependency and live menus reject private targets', () => {
	const draft = validateEvent({ items: [], primary: null, helpLink: null });
	validateMenu(draft);
	expect(draft.called).toBe(true);
	const config = {
		items: [
			{
				id: 'menu',
				label: 'Menu',
				groups: [],
				direct: { id: 'link', label: 'Draft page', target: { type: 'content', value: 'page' } }
			}
		],
		primary: null,
		helpLink: null
	};
	expect(() => validateMenu(validateEvent(config, 'cms_menus', false))).toThrow(
		'Publish the link destination before publishing this menu.'
	);
	const live = validateEvent(config, 'cms_menus', true);
	validateMenu(live);
	expect(live.called).toBe(true);
});

test('menu validation accepts introductions and checks landing links', () => {
	const config = {
		items: [
			{
				id: 'publish',
				label: 'Publish with us',
				groups: [],
				introduction: { heading: 'Publish your research', description: 'A short introduction.' },
				landing: {
					id: 'landing',
					label: 'Publish with us',
					target: { type: 'route', value: '/resources' }
				}
			}
		],
		primary: null,
		helpLink: null
	};
	const event = validateEvent(config);
	validateMenu(event);
	expect(event.called).toBe(true);
	expect(() =>
		validateMenu(
			validateEvent({
				...config,
				items: [{ ...config.items[0], introduction: { heading: '', description: 'Missing' } }]
			})
		)
	).toThrow('Menu introductions need a heading and description.');
	expect(() =>
		validateMenu(
			validateEvent({
				...config,
				items: [
					{
						...config.items[0],
						landing: { ...config.items[0].landing, target: { type: 'route', value: '/missing' } }
					}
				]
			})
		)
	).toThrow('Unknown application route.');
});

test('content components only accept constrained attributes and safe action URLs', () => {
	expect(
		validateComponentHtml(
			'<aside data-cms-callout="info"><p>Text</p></aside><div data-cms-editions="edition-a,edition-b"></div><details data-cms-expandable="true"><summary>More</summary></details>'
		)
	).toBeNull();
	expect(validateComponentHtml('<div data-cms-editions="edition-a,<script>"></div>')).toBe(
		'Invalid content component.'
	);
	expect(validateComponentHtml('<p data-cms-editions="edition-a">Wrong element</p>')).toBe(
		'Invalid content component.'
	);
	expect(
		validateComponentHtml(
			'<div data-cms-actions="true"><a data-cms-action="primary" href="javascript:alert(1)">Read</a></div>'
		)
	).toBe('Unsafe content component link.');
});
