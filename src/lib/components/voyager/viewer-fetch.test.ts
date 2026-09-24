import { expect, test } from 'bun:test';
import { installViewerFetch } from './viewer-fetch';

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
