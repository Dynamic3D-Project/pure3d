import { pb } from '../client';
import { browser } from '$app/environment';
import type { Notification } from '$lib/types/notifications';
import type { NotificationType } from '$lib/types/notifications';
import { SubscriptionOwner, type SubscriptionToken } from './subscription-owner';

class NotificationStore {
	notifications = $state<Notification[]>([]);
	unreadCount = $derived(this.notifications.filter((n) => !n.read).length);

	private recipientId: string | null = null;
	private subscriptionOwner = new SubscriptionOwner();

	async subscribe(recipientId: string) {
		if (!browser) return;

		const owner = this.subscriptionOwner.begin(recipientId);
		if (!owner) return;
		this.recipientId = recipientId;
		// Never show the previous account's notices while this account's initial query is pending.
		this.notifications = [];

		// Load initial unread notifications
		try {
			const result = await pb.collection('notifications').getList(1, 50, {
				filter: `recipientId = "${recipientId}" && read = false`,
				sort: '-created'
			});
			if (!this.isCurrent(owner)) return;
			this.notifications = result.items.map((r) => this.mapRecord(r));
		} catch {
			if (!this.isCurrent(owner)) return;
			this.notifications = [];
		}

		// Subscribe to realtime updates for this recipient
		try {
			const unsub = await pb.collection('notifications').subscribe('*', (e) => {
				if (!this.isCurrent(owner)) return;
				const record = e.record;
				if (record.recipientId !== recipientId) return;

				if (e.action === 'create') {
					this.notifications = [this.mapRecord(record), ...this.notifications];
				} else if (e.action === 'update') {
					this.notifications = this.notifications.map((n) =>
						n.id === record.id ? this.mapRecord(record) : n
					);
				} else if (e.action === 'delete') {
					this.notifications = this.notifications.filter((n) => n.id !== record.id);
				}
			});
			this.subscriptionOwner.adopt(owner, unsub);
		} catch {
			// Realtime subscription failed; store still works with initial data
			if (!this.isCurrent(owner)) return;
			this.subscriptionOwner.abandon(owner);
			this.recipientId = null;
		}
	}

	unsubscribeAll() {
		this.subscriptionOwner.clear();
		this.recipientId = null;
		this.notifications = [];
	}

	private isCurrent(owner: SubscriptionToken) {
		return this.subscriptionOwner.isCurrent(owner) && this.recipientId === owner.recipientId;
	}

	async markRead(id: string) {
		try {
			await pb.collection('notifications').update(id, { read: true });
			this.notifications = this.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
		} catch {
			// silent fail
		}
	}

	async markAllRead() {
		if (!this.recipientId) return;
		const unread = this.notifications.filter((n) => !n.read);
		await Promise.allSettled(
			unread.map((n) => pb.collection('notifications').update(n.id, { read: true }))
		);
		this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
	}

	private mapRecord(record: Record<string, unknown>): Notification {
		return {
			id: record.id as string,
			recipientId: record.recipientId as string,
			type: record.type as NotificationType,
			title: record.title as string,
			message: (record.message as string) || null,
			editionId: (record.editionId as string) || null,
			actionUrl: (record.actionUrl as string) || null,
			read: (record.read as boolean) || false,
			created: record.created as string
		};
	}
}

export const notificationStore = new NotificationStore();
