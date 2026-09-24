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
