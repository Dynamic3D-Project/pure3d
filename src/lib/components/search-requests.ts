/** Component-owned cancellation keeps independent PocketBase consumers concurrent. */
export class SearchRequests {
	private controller: AbortController | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;

	start() {
		this.cancel();
		this.controller = new AbortController();
		return this.controller.signal;
	}

	schedule(callback: () => void, delay: number) {
		this.cancelPending();
		this.timer = setTimeout(() => {
			this.timer = null;
			callback();
		}, delay);
	}

	cancelPending() {
		if (!this.timer) return;
		clearTimeout(this.timer);
		this.timer = null;
	}

	cancel() {
		this.cancelPending();
		this.controller?.abort();
		this.controller = null;
	}
}
