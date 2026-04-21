/**
 * Resolve a UserRoleContext for a given user in the scope of an optional
 * collection and/or edition, by querying the collectionUsers / editionUsers
 * tables.
 *
 * This is intentionally client-safe: it is called from page components
 * (after authStore is populated) rather than from +page.ts loaders so that
 * auth state is guaranteed to be resolved.
 */
import { pb } from '$lib/database/client';
import {
	CollectionRole,
	EditionRole,
	GlobalRole,
	type UserRoleContext
} from '$lib/types/roles';

interface ResolveArgs {
	globalRole: GlobalRole;
	userProfileId: string | null;
	collectionId?: string | null;
	editionId?: string | null;
}

export async function resolvePageContext({
	globalRole,
	userProfileId,
	collectionId,
	editionId
}: ResolveArgs): Promise<UserRoleContext> {
	const ctx: UserRoleContext = { globalRole };

	if (!userProfileId) return ctx;

	const tasks: Promise<void>[] = [];

	if (collectionId) {
		tasks.push(
			pb
				.collection('collectionUsers')
				.getList(1, 1, {
					filter: `collection = "${collectionId}" && userId = "${userProfileId}"`
				})
				.then((res) => {
					const role = res.items[0]?.role as CollectionRole | undefined;
					if (role) ctx.collectionRole = role;
				})
				.catch(() => {
					/* ignore */
				})
		);
	}

	if (editionId) {
		tasks.push(
			pb
				.collection('editionUsers')
				.getList(1, 1, {
					filter: `editionId = "${editionId}" && userId = "${userProfileId}"`
				})
				.then((res) => {
					const role = res.items[0]?.role as EditionRole | undefined;
					if (role) ctx.editionRole = role;
				})
				.catch(() => {
					/* ignore */
				})
		);
	}

	await Promise.all(tasks);
	return ctx;
}
