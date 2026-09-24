import { expect, test } from 'bun:test';
import {
	ViewerResources,
	captureViewerErrors,
	retainCanvasCapture,
	ensureViewerScript
} from './viewer-resources';

test('viewer disposal removes listeners, cancels timers and runs cleanup only once', async () => {
	const scope = new ViewerResources();
	const target = new EventTarget();
	let events = 0;
	let timers = 0;
	let cleanups = 0;
	scope.listen(target, 'model-load', () => events++);
	scope.timeout(() => timers++, 1);
	scope.defer(() => cleanups++);
	target.dispatchEvent(new Event('model-load'));
	scope.dispose();
	scope.dispose();
	target.dispatchEvent(new Event('model-load'));
	await new Promise((resolve) => setTimeout(resolve, 5));
	expect({ events, timers, cleanups }).toEqual({ events: 1, timers: 0, cleanups: 1 });
});

test('overlapping console observers are removed independently', () => {
	const original: Console['error'] = () => {};
	const host = { error: original };
	const messages: string[] = [];
	const first = captureViewerErrors((message) => messages.push(`first:${message}`), host);
	const second = captureViewerErrors((message) => messages.push(`second:${message}`), host);
	first();
	host.error('schema validation');
	second();
	expect(messages).toEqual(['second:schema validation']);
	expect(host.error).toBe(original);
});

test('canvas capture restores the original method after the last viewer disposes', () => {
	let received: unknown;
	const original = function (_type: string, options: unknown) {
		received = options;
		return null;
	} as HTMLCanvasElement['getContext'];
	const prototype = { getContext: original };
	const first = retainCanvasCapture(prototype);
	const second = retainCanvasCapture(prototype);
	first();
	prototype.getContext('webgl', { alpha: false });
	expect(received).toEqual({ alpha: false, preserveDrawingBuffer: true });
	second();
	expect(prototype.getContext).toBe(original);
});

test('concurrent viewers share one pending runtime script', async () => {
	const scripts: EventTarget[] = [];
	const document = {
		createElement: () => new EventTarget(),
		head: { appendChild: (script: EventTarget) => scripts.push(script) }
	} as unknown as Document;
	const registry = { get: () => undefined };
	const first = ensureViewerScript(document, registry, '/voyager.js');
	const second = ensureViewerScript(document, registry, '/voyager.js');
	expect(scripts).toHaveLength(1);
	scripts[0].dispatchEvent(new Event('load'));
	await Promise.all([first, second]);
});
