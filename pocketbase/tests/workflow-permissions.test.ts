import { expect, test } from 'bun:test';
import { canUserTransitionStatus, hasPermission } from '../../src/lib/utils/permissions';
import {
	CollectionRole,
	EditionRole,
	EditionStatus,
	GlobalRole,
	Permission
} from '../../src/lib/types/roles';
import { canTransition } from '../pb_hooks/orcid-validation.cjs';

test('frontend workflow transitions match backend role decisions for every status pair', () => {
	for (const globalRole of Object.values(GlobalRole)) {
		for (const collectionRole of [undefined, ...Object.values(CollectionRole)]) {
			for (const editionRole of [undefined, ...Object.values(EditionRole)]) {
				const context = { globalRole, collectionRole, editionRole };
				const roles = {
					admin: globalRole === GlobalRole.Admin,
					board: globalRole === GlobalRole.EditorialBoard,
					owner: collectionRole === CollectionRole.Owner,
					author: editionRole === EditionRole.Author,
					reviewer: editionRole === EditionRole.Reviewer
				};
				for (const from of Object.values(EditionStatus))
					for (const to of Object.values(EditionStatus)) {
						expect({
							context,
							from,
							to,
							allowed: canUserTransitionStatus(context, from, to)
						}).toEqual({ context, from, to, allowed: !!canTransition(from, to, roles) });
					}
			}
		}
	}
});

test('publication and reviewer assignment are editorial actions, not collection-owner actions', () => {
	const board = { globalRole: GlobalRole.EditorialBoard };
	const owner = { globalRole: GlobalRole.User, collectionRole: CollectionRole.Owner };
	expect(hasPermission(board, Permission.WorkflowPublish)).toBe(true);
	expect(hasPermission(board, Permission.ReviewerAssign)).toBe(true);
	expect(hasPermission(owner, Permission.WorkflowPublish)).toBe(false);
	for (const globalRole of Object.values(GlobalRole))
		expect(hasPermission({ globalRole }, Permission.WorkflowUnpublish)).toBe(false);
});
