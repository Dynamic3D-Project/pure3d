import { pb } from '$lib/database/client';
import type { NotificationType } from '$lib/types/notifications';

export async function notify(
	recipientId: string,
	type: NotificationType,
	title: string,
	message?: string,
	editionId?: string,
	actionUrl?: string
): Promise<void> {
	try {
		await pb.collection('notifications').create({
			recipientId,
			type,
			title,
			message: message || '',
			editionId: editionId || null,
			actionUrl: actionUrl || null,
			read: false
		});
	} catch (error) {
		console.error('Failed to create notification:', error);
	}
}

export async function notifyMany(
	recipientIds: string[],
	type: NotificationType,
	title: string,
	message?: string,
	editionId?: string,
	actionUrl?: string
): Promise<void> {
	await Promise.allSettled(
		recipientIds.map((id) => notify(id, type, title, message, editionId, actionUrl))
	);
}

export async function getUnreadNotifications(recipientId: string) {
	const result = await pb.collection('notifications').getList(1, 50, {
		filter: `recipientId = "${recipientId}" && read = false`,
		sort: '-created'
	});
	return result.items.map(mapNotification);
}

export async function getNotifications(recipientId: string, page = 1, perPage = 20) {
	const result = await pb.collection('notifications').getList(page, perPage, {
		filter: `recipientId = "${recipientId}"`,
		sort: '-created'
	});
	return {
		items: result.items.map(mapNotification),
		totalItems: result.totalItems,
		totalPages: result.totalPages
	};
}

export async function markAsRead(id: string): Promise<void> {
	await pb.collection('notifications').update(id, { read: true });
}

export async function markAllAsRead(recipientId: string): Promise<void> {
	const unread = await pb.collection('notifications').getList(1, 500, {
		filter: `recipientId = "${recipientId}" && read = false`,
		fields: 'id'
	});
	await Promise.allSettled(
		unread.items.map((item) => pb.collection('notifications').update(item.id, { read: true }))
	);
}

function mapNotification(record: Record<string, unknown>) {
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
