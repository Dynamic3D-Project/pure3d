const actorKey = 'pure3d.actor';
const actorField = '__pure3dActor';
const eventKey = 'pure3d.event';
const notificationRule = "@request.auth.id != '' && recipientId = @request.auth.id";
const notificationTypes = [
	'status_changed',
	'concept_submitted',
	'concept_accepted',
	'concept_rejected',
	'alpha_review_started',
	'alpha_revisions_requested',
	'alpha_accepted',
	'alpha_rejected',
	'final_review_started',
	'final_revisions_requested',
	'published',
	'reviewer_assigned',
	'reviewer_removed',
	'review_submitted',
	'collaborator_added',
	'collaborator_removed',
	'feedback_received',
	'membership_added',
	'membership_removed',
	'membership_role_changed',
	'review_updated',
	'review_assignment_updated',
	'feedback_resolved',
	'feedback_reopened'
];

function actor(auth) {
	return auth ? auth.collection().name + '/' + auth.id : 'anonymous';
}

function request(e) {
	// This marker is always overwritten after body loading, never accepted from JSON or headers.
	e.record.set(actorField, actor(e.auth));
	return e.next();
}

function audit(app, performedBy, action, targetType, targetId, details) {
	const record = new Record(app.findCollectionByNameOrId('auditLog'), {
		action,
		targetType,
		targetId,
		performedBy,
		details
	});
	app.saveWithContext(new Context(null, eventKey, true), record);
}

function admins(app) {
	return app
		.findRecordsByFilter('users', 'role = "admin" || role = "editorial_board"', '', 0, 0)
		.map((user) => user.id);
}

function authors(app, editionId) {
	return app
		.findRecordsByFilter('editionUsers', 'editionId = {:id} && role = "author"', '', 0, 0, {
			id: editionId
		})
		.map((row) => row.getString('userId'));
}

function owners(app, collectionId) {
	if (!collectionId) return [];
	return app
		.findRecordsByFilter('collectionUsers', 'collection = {:id} && role = "owner"', '', 0, 0, {
			id: collectionId
		})
		.map((row) => row.getString('userId'));
}

function applicationURL(app) {
	const url = app.settings().meta.appURL;
	if (!/^https?:\/\/[^/@\s?#]+(?:\/[^?\s#]*)?$/.test(url))
		throw new BadRequestError('Configure a valid application URL before sending notifications');
	return url.replace(/\/+$/, '');
}

function notify(app, performedBy, recipients, type, title, editionId, path) {
	const sent = {};
	for (const recipient of recipients) {
		if (!recipient || sent[recipient] || performedBy === 'users/' + recipient) continue;
		sent[recipient] = true;
		if (!app.findRecordsByFilter('users', 'id = {:id}', '', 1, 0, { id: recipient }).length)
			continue;
		const record = new Record(app.findCollectionByNameOrId('notifications'), {
			recipientId: recipient,
			type,
			title,
			message: 'Open the linked workspace to view this change.',
			editionId: editionId || '',
			read: false,
			emailEligible: $os.getenv('PURE3D_WORKFLOW_EMAIL_ENABLED') === 'true',
			// appURL is an administrator-controlled PB setting, never a request Host or client URL.
			actionUrl: applicationURL(app) + path
		});
		app.saveWithContext(new Context(null, eventKey, true), record);
	}
}

const fields = {
	users: ['role', 'orcid', 'orcidVerifiedAt', 'pendingOrcid'],
	collections: ['title', 'isVisible'],
	editions: ['title', 'status', 'isPublished', 'collection', 'reviewStage'],
	collectionUsers: ['collection', 'userId', 'role'],
	editionUsers: ['editionId', 'userId', 'role'],
	reviewAssignments: ['editionId', 'reviewerId', 'reviewStage', 'assignedBy', 'status'],
	editionReviews: ['editionId', 'reviewerId', 'reviewStage', 'decision'],
	reviewFeedback: ['editionId', 'reviewerId', 'reviewStage', 'category', 'resolved'],
	content: ['title', 'slug', 'kind', 'layout', 'parent', 'isPublished']
};

function snapshot(record, name) {
	const result = {};
	for (const field of fields[name]) result[field] = record.getString(field) || null;
	return result;
}

function model(e) {
	const record = e.record;
	const name = record.collection().name;
	let performedBy = e.context.value(actorKey) || record.getString(actorField);
	record.set(actorField, null);
	// Internal imports/cascades without an attributed request do not impersonate the initiating user.
	if (!performedBy) return e.next();
	const operation = e.type;
	const id = record.id;
	const before = operation === 'create' ? null : snapshot(record.original(), name);
	const changed = record
		.collection()
		.fields.filter(
			(field) =>
				![
					'password',
					'tokenKey',
					'email',
					'emailVisibility',
					'verified',
					'created',
					'updated'
				].includes(field.name) &&
				record.getString(field.name) !== record.original().getString(field.name)
		)
		.map((field) => field.name);
	e.app.runInTransaction((tx) => {
		e.app = tx;
		e.next();
		if (performedBy === 'oauth') performedBy = 'users/' + record.id;
		const after = operation === 'delete' ? null : snapshot(record, name);
		const state = after || before;
		const details = {
			sourceCollection: name,
			recordId: id || record.id,
			before,
			after,
			changedFields: changed
		};
		let action,
			targetType,
			targetId,
			recipients = [],
			type,
			title,
			editionId = '',
			path = '';
		if (name === 'users') {
			targetType = 'user';
			targetId = id || record.id;
			if (operation === 'create') action = 'user_created';
			else if (operation === 'delete') action = 'user_deleted';
			else if (!before.orcidVerifiedAt && after.orcidVerifiedAt) action = 'orcid_verified';
			else if (before.pendingOrcid !== after.pendingOrcid)
				action = after.pendingOrcid ? 'orcid_mapping_approved' : 'orcid_mapping_cleared';
			else if (before.role !== after.role) action = 'role_change';
			else if (changed.length) action = 'user_updated';
		} else if (name === 'content') {
			targetType = 'content';
			targetId = id || record.id;
			if (operation !== 'update' || changed.length)
				action = { create: 'doc_created', update: 'doc_updated', delete: 'doc_deleted' }[operation];
		} else if (name === 'collectionUsers' || name === 'editionUsers') {
			editionId = name === 'editionUsers' ? state.editionId : '';
			targetType = editionId ? 'edition' : 'collection';
			targetId = editionId || state.collection;
			path = editionId ? '/editions/' + editionId + '/workflow' : '/collections/' + targetId;
			if (operation === 'create') {
				action = 'user_assigned';
				type = state.role === 'collaborator' ? 'collaborator_added' : 'membership_added';
				title = 'You have access to a workspace';
			} else if (operation === 'delete') {
				action = 'user_removed';
				type = state.role === 'collaborator' ? 'collaborator_removed' : 'membership_removed';
				title = 'Your workspace access was removed';
			} else if (before.role !== after.role) {
				action = 'role_change';
				type = 'membership_role_changed';
				title = 'Your workspace role changed';
			}
			// The assignment is the reviewer notification source, not its redundant membership row.
			if (!editionId || state.role !== 'reviewer') recipients = [state.userId];
		} else if (
			name === 'reviewAssignments' ||
			name === 'editionReviews' ||
			name === 'reviewFeedback'
		) {
			editionId = state.editionId;
			targetType = 'edition';
			targetId = editionId;
			path = '/editions/' + editionId + '/workflow';
			if (name === 'reviewAssignments') {
				if (operation === 'create') {
					action = 'reviewer_assigned';
					type = 'reviewer_assigned';
					title = 'You have a review assignment';
					recipients = [state.reviewerId];
				} else if (operation === 'delete') {
					action = 'reviewer_removed';
					type = 'reviewer_removed';
					title = 'Your review assignment was removed';
					recipients = [state.reviewerId];
				} else if (before.status !== after.status) {
					action = 'review_assignment_updated';
					type = 'review_assignment_updated';
					title = 'A review assignment changed';
					recipients = admins(tx);
				}
			} else if (name === 'editionReviews') {
				const alphaDraft =
					[2, 3].includes(record.getInt('reviewStage')) &&
					record.getString('reviewStatus') === 'draft';
				const alphaSubmission =
					[2, 3].includes(record.getInt('reviewStage')) &&
					record.getString('reviewStatus') === 'submitted' &&
					record.original().getString('reviewStatus') !== 'submitted';
				if (!alphaDraft && (operation !== 'update' || changed.length || alphaSubmission)) {
					action = {
						create: 'review_submitted',
						update: 'review_updated',
						delete: 'review_deleted'
					}[operation];
					type = operation === 'create' ? 'review_submitted' : 'review_updated';
					if (alphaSubmission) {
						action = 'review_submitted';
						type = 'review_submitted';
					}
					title = 'A review is ready for your attention';
					recipients = admins(tx);
				}
			} else if (operation === 'update' && before.resolved !== after.resolved) {
				action = record.getBool('resolved') ? 'feedback_resolved' : 'feedback_reopened';
				type = action;
				title = record.getBool('resolved')
					? 'Your feedback was marked resolved'
					: 'Your feedback was reopened';
				recipients = [state.reviewerId];
			} else if (operation !== 'update' || changed.length) {
				action = {
					create: 'feedback_created',
					update: 'feedback_updated',
					delete: 'feedback_deleted'
				}[operation];
				type = 'feedback_received';
				title = 'Review feedback is ready for your attention';
				const edition = tx.findRecordById('editions', editionId);
				recipients = authors(tx, editionId).concat(owners(tx, edition.getString('collection')));
			}
		} else {
			targetType = name === 'editions' ? 'edition' : 'collection';
			targetId = id || record.id;
			if (operation === 'create' || operation === 'delete')
				action = targetType + (operation === 'create' ? '_created' : '_deleted');
			else if (name === 'editions' && before.status !== after.status) {
				action = 'status_transition';
				editionId = record.id;
				path = '/editions/' + editionId + '/workflow';
				type =
					{
						concept_submitted: 'concept_submitted',
						concept_accepted: 'concept_accepted',
						concept_rejected: 'concept_rejected',
						alpha_review: 'alpha_review_started',
						alpha_revisions: 'alpha_revisions_requested',
						alpha_accepted: 'alpha_accepted',
						alpha_rejected: 'alpha_rejected',
						final_review: 'final_review_started',
						final_revisions: 'final_revisions_requested',
						published: 'published'
					}[after.status] || 'status_changed';
				const submission =
					['final_review', 'publication_requested'].includes(after.status) ||
					after.status === 'concept_submitted' ||
					(before.status === 'concept_accepted' && after.status === 'alpha_review') ||
					(['alpha_revisions', 'final_revisions'].includes(before.status) &&
						['alpha_review', 'final_review'].includes(after.status));
				title = submission ? 'An edition is ready for review' : 'Your edition workflow changed';
				recipients = (submission ? admins(tx) : authors(tx, editionId)).concat(
					owners(tx, record.getString('collection'))
				);
				if (after.status === 'published') {
					path = '/editions/' + editionId;
					recipients = recipients.concat(
						tx
							.findRecordsByFilter(
								'reviewAssignments',
								'editionId = {:id} && reviewStage = 3 && status = "completed"',
								'',
								0,
								0,
								{ id: editionId }
							)
							.map((r) => r.getString('reviewerId'))
					);
				}
			}
		}
		if (!action) return;
		audit(tx, performedBy, action, targetType, targetId, details);
		if (type && recipients.length)
			notify(tx, performedBy, recipients, type, title, editionId, path);
	});
}

function denyWrite() {
	throw new ForbiddenError('Activity records are written only by trusted server events');
}
function createEvent(e) {
	if (!e.context.value(eventKey)) denyWrite();
	return e.next();
}
function markRead(e) {
	if (
		!e.auth ||
		e.auth.collection().name !== 'users' ||
		e.record.getString('recipientId') !== e.auth.id
	)
		denyWrite();
	for (const field of e.collection.fields)
		if (
			field.name !== 'read' &&
			e.record.getString(field.name) !== e.record.original().getString(field.name)
		)
			denyWrite();
	return e.next();
}

module.exports = {
	actor,
	actorKey,
	request,
	model,
	createEvent,
	denyWrite,
	markRead,
	notificationRule,
	notificationTypes,
	applicationURL
};
