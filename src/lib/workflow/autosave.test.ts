import { expect, test } from 'bun:test';
import { DraftAutosave } from './autosave';

test('autosave serializes overlapping edits and retries failures without losing the latest draft', async () => {
	let finish!: () => void;
	const writes: string[] = [];
	let fail = false;
	const save = new DraftAutosave(
		{ text: '' },
		async ({ text }) => {
			writes.push(text);
			if (fail) throw new Error('offline');
			if (writes.length === 1)
				await new Promise<void>((resolve) => {
					finish = resolve;
				});
		},
		() => {},
		60000
	);
	save.set({ text: 'First' });
	const pending = save.flush();
	save.set({ text: 'Latest' });
	expect(save.dirty).toBe(true);
	finish();
	await pending;
	expect(writes).toEqual(['First', 'Latest']);
	expect(save.dirty).toBe(false);
	fail = true;
	save.set({ text: 'Offline edit' });
	await expect(save.flush()).rejects.toThrow('offline');
	expect(save.dirty).toBe(true);
	fail = false;
	await save.flush();
	expect(save.dirty).toBe(false);
	save.dispose();
});

test('reverting a value while a save is in flight still warns and persists the revert', async () => {
	let finish!: () => void;
	const writes: string[] = [];
	const save = new DraftAutosave(
		'',
		async (text) => {
			writes.push(text);
			if (writes.length === 1)
				await new Promise<void>((resolve) => {
					finish = resolve;
				});
		},
		() => {},
		60000
	);
	save.set('Changed');
	const pending = save.flush();
	save.set('');
	expect(save.dirty).toBe(true);
	finish();
	await pending;
	expect(writes).toEqual(['Changed', '']);
	expect(save.dirty).toBe(false);
	save.dispose();
});

test('upload locks retain dirty state and resume the latest draft without writing during uploads', async () => {
	let busy = true;
	const writes: string[] = [];
	const save = new DraftAutosave(
		'',
		async (text) => {
			writes.push(text);
		},
		() => {},
		60000,
		() => !busy
	);
	save.set('During upload');
	await save.flush();
	expect(writes).toEqual([]);
	expect(save.dirty).toBe(true);
	busy = false;
	save.set('Latest');
	await save.flush();
	expect(writes).toEqual(['Latest']);
	expect(save.dirty).toBe(false);
	save.dispose();
});

test('disposed draft responses cannot notify a new edition workspace', async () => {
	let fail!: (error: Error) => void;
	const states: string[] = [];
	const save = new DraftAutosave(
		'',
		() =>
			new Promise<void>((_resolve, reject) => {
				fail = reject;
			}),
		(state) => states.push(state),
		60000
	);
	save.set('Old edition');
	const pending = save.flush();
	save.dispose();
	fail(new Error('late failure'));
	await expect(pending).rejects.toThrow('late failure');
	expect(states).toEqual(['unsaved', 'saving']);
});

test('navigation checks the latest form value even before the reactive autosave effect runs', () => {
	const save = new DraftAutosave(
		'saved',
		async () => {},
		() => {},
		60000
	);
	expect(save.hasChanges('new edit')).toBe(true);
	expect(save.hasChanges('saved')).toBe(false);
	save.dispose();
});

test('submission waits for the active write without draining another draft after the lock', async () => {
	let release!: () => void;
	let submitting = false;
	const writes: string[] = [];
	const save = new DraftAutosave(
		'',
		async (text) => {
			writes.push(text);
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		},
		() => {},
		60000,
		() => !submitting
	);
	save.set('First');
	const active = save.flush();
	submitting = true;
	save.set('Submission snapshot');
	save.cancelPending();
	release();
	await save.waitForIdle();
	await active;
	expect(writes).toEqual(['First']);
	expect(save.dirty).toBe(true);
	save.dispose();
});
