export interface SubscriptionToken {
	recipientId: string;
	generation: number;
}

/** Owns one realtime subscription and invalidates async work from previous recipients. */
export class SubscriptionOwner {
	private recipientId: string | null = null;
	private generation = 0;
	private unsubscribe: (() => void) | null = null;

	begin(recipientId: string): SubscriptionToken | null {
		if (this.recipientId === recipientId) return null;
		this.clear();
		this.recipientId = recipientId;
		return { recipientId, generation: ++this.generation };
	}

	isCurrent(token: SubscriptionToken) {
		return this.recipientId === token.recipientId && this.generation === token.generation;
	}

	adopt(token: SubscriptionToken, unsubscribe: () => void) {
		if (this.isCurrent(token)) this.unsubscribe = unsubscribe;
		else unsubscribe();
	}

	abandon(token: SubscriptionToken) {
		if (this.isCurrent(token)) this.clear();
	}

	clear() {
		this.generation++;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.recipientId = null;
	}
}
