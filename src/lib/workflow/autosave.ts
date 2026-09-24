export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error';

/** One in-flight save; edits made during it are written next, never acknowledged prematurely. */
export class DraftAutosave<T> {
	private current: string;
	private saved: string;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private inFlight: Promise<void> | undefined;
	private disposed = false;
	constructor(
		initial: T,
		private write: (data: T) => Promise<void>,
		private notify: (state: SaveState, error?: string) => void,
		private delay = 1000
	) {
		this.current = this.saved = JSON.stringify(initial);
	}
	get dirty() {
		return this.current !== this.saved || !!this.inFlight;
	}
	set(data: T) {
		const snapshot = JSON.stringify(data);
		if (this.disposed || snapshot === this.current) return;
		this.current = snapshot;
		clearTimeout(this.timer);
		this.notify(this.inFlight ? 'saving' : this.dirty ? 'unsaved' : 'saved');
		if (this.dirty)
			this.timer = setTimeout(() => {
				void this.flush().catch(() => {});
			}, this.delay);
	}
	flush(): Promise<void> {
		clearTimeout(this.timer);
		if (this.inFlight) return this.inFlight;
		this.inFlight = this.drain().finally(() => {
			this.inFlight = undefined;
		});
		return this.inFlight;
	}
	private async drain() {
		while (this.current !== this.saved && !this.disposed) {
			const snapshot = this.current;
			this.notify('saving');
			try {
				await this.write(JSON.parse(snapshot));
				this.saved = snapshot;
			} catch (error) {
				this.notify('error', error instanceof Error ? error.message : 'Could not save.');
				throw error;
			}
		}
		if (!this.disposed) this.notify('saved');
	}
	dispose() {
		this.disposed = true;
		clearTimeout(this.timer);
	}
}
