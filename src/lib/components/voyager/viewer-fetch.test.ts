import { expect, test } from 'bun:test';
import { installViewerFetch, type ViewerAssetRequestEvent } from './viewer-fetch';

const root = 'https://assets.test/project/1/edition/1/';
const scene = `${root}scene.svx.json?token=private`;

test('scene overrides survive overlapping viewers and out-of-order disposal', async () => {
	const native = async () => new Response('native');
	const host: Parameters<typeof installViewerFetch>[0] = { fetch: native };
	const first = installViewerFetch(host, {
		root: () => root,
		overrides: () => [{ url: scene, content: 'first' }]
	});
	const second = installViewerFetch(host, {
		root: () => root,
		overrides: () => [{ url: scene, content: 'second' }]
	});
	expect(await (await host.fetch(scene)).text()).toBe('second');
	first();
	expect(await (await host.fetch(scene)).text()).toBe('second');
	second();
	expect(host.fetch).toBe(native);
	expect(await (await host.fetch(scene)).text()).toBe('native');
});

test('companion mapping preserves protected URLs and cannot escape its directory', async () => {
	const requests: string[] = [];
	const host: Parameters<typeof installViewerFetch>[0] = {
		fetch: async (input: RequestInfo | URL) => {
			requests.push(input instanceof Request ? input.url : String(input));
			return new Response('model');
		}
	};
	const mapped = `${root}damaged_helmet_1234567890.glb?token=protected`;
	const dispose = installViewerFetch(host, {
		root: () => root,
		companions: () => ({ baseDir: root, byBasename: { 'damaged_helmet.glb': mapped } })
	});
	await host.fetch(`${root}DamagedHelmet.glb`);
	await host.fetch(`${root}DamagedHelmet.glb?token=already-protected`);
	await host.fetch('https://other.test/DamagedHelmet.glb');
	await host.fetch(`${root}%ZZ.glb`);
	expect(requests).toEqual([
		mapped,
		`${root}DamagedHelmet.glb?token=already-protected`,
		'https://other.test/DamagedHelmet.glb',
		`${root}%ZZ.glb`
	]);
	dispose();
});

test('disposal stops progress notifications without corrupting an in-flight response', async () => {
	const progress: number[] = [];
	let release!: (response: Response) => void;
	const host: Parameters<typeof installViewerFetch>[0] = {
		fetch: () =>
			new Promise<Response>((resolve) => {
				release = resolve;
			})
	};
	const dispose = installViewerFetch(host, {
		root: () => root,
		progress: (_total, loaded) => progress.push(loaded)
	});
	const pending = host.fetch(`${root}model.glb`);
	dispose();
	release(new Response('abc', { headers: { 'content-length': '3' } }));
	expect(await (await pending).text()).toBe('abc');
	expect(progress).toEqual([]);
});

test('progress tracks only this viewer assets and forwards request options', async () => {
	const progress: [number, number][] = [];
	const signal = new AbortController().signal;
	const host: Parameters<typeof installViewerFetch>[0] = {
		fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(init?.signal).toBe(signal);
			return new Response('abc', { headers: { 'content-length': '3' } });
		}
	};
	const dispose = installViewerFetch(host, {
		root: () => root,
		progress: (total, loaded) => progress.push([total, loaded])
	});
	await (await host.fetch('https://other.test/image.png', { signal })).text();
	expect(progress).toEqual([]);
	await (await host.fetch(`${root}model.glb?token=private`, { signal })).text();
	expect(progress).toEqual([
		[3, 0],
		[0, 3]
	]);
	dispose();
});

test('redirection preserves Request headers and abort signals', async () => {
	const controller = new AbortController();
	let forwarded: Request | undefined;
	const host: Parameters<typeof installViewerFetch>[0] = {
		fetch: async (input) => {
			forwarded = input as Request;
			return new Response('asset');
		}
	};
	const dispose = installViewerFetch(host, {
		root: () => root,
		companions: () => ({
			baseDir: root,
			byBasename: { 'mesh.bin': `${root}mesh_id.bin?token=private` }
		})
	});
	await host.fetch(
		new Request(`${root}mesh.bin`, {
			headers: { 'x-fixture': 'retained' },
			signal: controller.signal
		})
	);
	expect(forwarded?.headers.get('x-fixture')).toBe('retained');
	controller.abort();
	expect(forwarded?.signal.aborted).toBe(true);
	dispose();
});

test('stream errors reach the caller rather than leaving a hanging response', async () => {
	const host: Parameters<typeof installViewerFetch>[0] = {
		fetch: async () =>
			new Response(
				new ReadableStream({
					pull(controller) {
						controller.error(new Error('stream failed'));
					}
				}),
				{ headers: { 'content-length': '3' } }
			)
	};
	const dispose = installViewerFetch(host, { root: () => root, progress: () => {} });
	const response = await host.fetch(`${root}mesh.glb`);
	await expect(response.text()).rejects.toThrow('stream failed');
	dispose();
});

test('finishes unknown-length assets and tracks a later retry independently', async () => {
	const events: ViewerAssetRequestEvent[] = [];
	const host: Parameters<typeof installViewerFetch>[0] = {
		fetch: async () => new Response('asset')
	};
	const dispose = installViewerFetch(host, {
		root: () => root,
		assetRequest: (event) => events.push(event)
	});

	await (await host.fetch(`${root}model.glb`)).text();
	await (await host.fetch(`${root}model.glb`)).text();

	expect(events.map((event) => event.type)).toEqual([
		'start',
		'response',
		'finish',
		'start',
		'response',
		'finish'
	]);
	expect(events.map((event) => event.url)).toEqual(Array(6).fill(`${root}model.glb`));
	expect(events.map((event) => event.kind)).toEqual(Array(6).fill('model'));
	expect(events[0].id).toBe(events[1].id);
	expect(events[1].id).toBe(events[2].id);
	expect(events[3].id).toBe(events[4].id);
	expect(events[4].id).toBe(events[5].id);
	expect(events[3].id).not.toBe(events[0].id);
	expect(events[1]).toMatchObject({ type: 'response', total: null });
	expect(events[4]).toMatchObject({ type: 'response', total: null });
	dispose();
});

test('finishes failed asset requests so a retry is not left active', async () => {
	const events: string[] = [];
	let attempts = 0;
	const host: Parameters<typeof installViewerFetch>[0] = {
		fetch: async () => {
			if (!attempts++) throw new Error('network failed');
			return new Response('asset');
		}
	};
	const dispose = installViewerFetch(host, {
		root: () => root,
		assetRequest: (event) => events.push(event.type)
	});

	await expect(host.fetch(`${root}model.glb`)).rejects.toThrow('network failed');
	await (await host.fetch(`${root}model.glb`)).text();

	expect(events).toEqual(['start', 'finish', 'start', 'response', 'finish']);
	dispose();
});
test('observes scene JSON without a second download or consuming the response', async () => {
	let requests = 0;
	const source = { scenes: [{ nodes: [] }], nodes: [] };
	const host: { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } = {
		fetch: async () => {
			requests++;
			return Response.json(source);
		}
	};
	const observed: unknown[] = [];
	const dispose = installViewerFetch(host, {
		root: () => 'https://example.test/',
		sceneDocument: () => 'https://example.test/scene.svx.json',
		documentLoaded: (document) => observed.push(document)
	});
	const response = await host.fetch('https://example.test/scene.svx.json');
	expect(await response.json()).toEqual(source);
	expect(observed).toEqual([source]);
	expect(requests).toBe(1);
	dispose();
});
