/* eslint-disable @typescript-eslint/no-require-imports -- PocketBase Goja supports CommonJS, not ESM. */
const access = require('./orcid-service.cjs');
const { reviewStage } = require('./orcid-validation.cjs');
const alpha = require('./alpha-review-service.cjs');

function deny() {
	throw new ForbiddenError('Review access requires the matching assignment or edition authorship');
}
function changed(record, field) {
	return JSON.stringify(record.get(field)) !== JSON.stringify(record.original().get(field));
}
function onlyFields(e, allowed) {
	for (const field of e.collection.fields)
		if (!allowed.includes(field.name) && changed(e.record, field.name)) deny();
}

function request(e, action) {
	const r = e.record;
	const name = e.collection.name;
	const admin = alpha.isEditor(e);
	if (action === 'delete') {
		if (!admin) deny();
		return e.next();
	}
	if (action === 'update') {
		for (const field of [
			'editionId',
			'reviewerId',
			'reviewStage',
			'reviewRound',
			...(name === 'reviewAssignments' ? ['assignedBy'] : [])
		]) {
			if (changed(r, field))
				throw new BadRequestError(
					'Review ownership and stage are immutable; remove and recreate the record'
				);
		}
	}
	const edition = e.app.findRecordById('editions', r.getString('editionId'));
	if (name === 'editionReviews' && action === 'create' && r.getInt('reviewStage') === 1) {
		r.set('reviewRound', 0);
		r.set('reviewStatus', 'submitted');
		r.set('submittedAt', new Date().toISOString());
	}
	if (name === 'reviewAssignments') {
		if (action === 'create') {
			r.set(
				'reviewRound',
				r.getInt('reviewStage') >= 2
					? edition.getInt(r.getInt('reviewStage') === 3 ? 'finalReviewRound' : 'alphaReviewRound')
					: 0
			);
			r.set('editionTitle', edition.getString('title'));
			if ([2, 3].includes(r.getInt('reviewStage'))) {
				if (
					edition.getString('status') !==
					(r.getInt('reviewStage') === 3 ? 'final_review' : 'alpha_review')
				)
					throw new BadRequestError(
						'The author must request Alpha Review before reviewers are assigned.'
					);
				const reviewer = e.app.findRecordById('users', r.getString('reviewerId'));
				const relationship = access.roles({ app: e.app, auth: reviewer }, edition);
				if (
					relationship.author ||
					relationship.collaborator ||
					relationship.owner ||
					relationship.editor
				)
					throw new BadRequestError(
						'Authors and the edition team cannot review their own edition.'
					);
			}
		} else if (changed(r, 'editionTitle'))
			throw new ForbiddenError('The assignment title is server-owned.');
		if (admin) {
			if (action === 'create' && !e.auth.isSuperuser()) r.set('assignedBy', e.auth.id);
			return e.next();
		}
		if (
			action !== 'update' ||
			!e.auth ||
			e.auth.collection().name !== 'users' ||
			r.getString('reviewerId') !== e.auth.id
		)
			deny();
		onlyFields(e, ['status']);
		const from = r.original().getString('status');
		const to = r.getString('status');
		if (
			from !== to &&
			!(
				(from === 'pending' && ['accepted', 'declined'].includes(to)) ||
				(from === 'accepted' && to === 'declined')
			)
		)
			deny();
		return e.next();
	}
	if (name === 'editionReviews' && [2, 3].includes(r.getInt('reviewStage'))) {
		if (action === 'update')
			onlyFields(e, [
				...(r.getInt('reviewStage') === 3 ? ['finalAnswers'] : alpha.answerFields),
				'reviewStatus'
			]);
		return alpha.reviewRequest(e, action, edition);
	}
	if (name === 'reviewFeedback' && [2, 3].includes(r.getInt('reviewStage')))
		throw new BadRequestError('Use the Alpha questionnaire for moderated feedback.');
	if (
		name === 'editionReviews' &&
		!['approve', 'reject', 'request_revisions'].includes(r.getString('decision'))
	)
		throw new BadRequestError('Select a review decision.');
	if (admin) return e.next();
	if (!e.auth || e.auth.collection().name !== 'users') deny();
	const stage = r.getInt('reviewStage');
	const currentStage = reviewStage(edition.getString('status'));
	if (name === 'reviewFeedback' && action === 'update') {
		const roles = access.roles(e, edition);
		if (roles.author || roles.owner) {
			onlyFields(e, ['resolved']);
			if (
				!['alpha_revisions', 'final_revisions'].includes(edition.getString('status')) ||
				stage > currentStage
			)
				deny();
			return e.next();
		}
	}
	if (r.getString('reviewerId') !== e.auth.id || stage !== currentStage) deny();
	const assignments = e.app.findRecordsByFilter(
		'reviewAssignments',
		'editionId = {:edition} && reviewerId = {:user} && reviewStage = {:stage} && status != "declined"',
		'',
		1,
		0,
		{ edition: edition.id, user: e.auth.id, stage }
	);
	if (!assignments.length) deny();
	if (action === 'update')
		onlyFields(
			e,
			name === 'editionReviews' ? ['decision', 'comment'] : ['category', 'targetLabel', 'comment']
		);
	if (name === 'reviewFeedback' && action === 'create' && r.getBool('resolved')) deny();
	return e.next();
}

function validate(e) {
	const r = e.record;
	const stage = r.getFloat('reviewStage');
	if (![1, 2, 3].includes(stage)) throw new BadRequestError('Review stage must be 1, 2 or 3');
	if (!r.isNew()) {
		for (const field of [
			'editionId',
			'reviewerId',
			'reviewStage',
			'reviewRound',
			...(r.collection().name === 'reviewAssignments' ? ['assignedBy'] : [])
		]) {
			if (changed(r, field)) throw new BadRequestError('Review ownership and stage are immutable');
		}
	}
	if (
		r.collection().name === 'editionReviews' &&
		stage === 3 &&
		r.getString('decision') === 'reject'
	)
		throw new BadRequestError('Final review supports approval or revisions, not rejection');
	if (r.collection().name === 'reviewFeedback' && !r.getString('comment').trim())
		throw new BadRequestError('Feedback comment is required');
	return e.next();
}

module.exports = { request, validate };
