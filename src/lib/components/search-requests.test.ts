import { expect, test } from 'bun:test';
import { SearchRequests } from './search-requests';

test('aborts an obsolete search before starting its replacement', () => {
	const requests = new SearchRequests();
	const first = requests.start();
	const second = requests.start();

	expect(first.aborted).toBe(true);
	expect(second.aborted).toBe(false);
});

test('aborts the active search when results close', () => {
	const requests = new SearchRequests();
	const active = requests.start();

	requests.cancel();

	expect(active.aborted).toBe(true);
});

test('cancels a deferred search before it can start after results close', async () => {
	const requests = new SearchRequests();
	let calls = 0;

	requests.schedule(() => calls++, 10);
	requests.cancel();
	await Bun.sleep(25);

	expect(calls).toBe(0);
});
