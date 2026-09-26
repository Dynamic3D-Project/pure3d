/* eslint-disable @typescript-eslint/no-require-imports -- PocketBase uses CommonJS. */
const transitions = {
	draft: ['concept_submitted'],
	concept_submitted: ['editorial_review'],
	editorial_review: ['concept_accepted', 'concept_rejected'],
	concept_accepted: ['alpha_review'],
	concept_rejected: ['draft'],
	alpha_review: ['alpha_accepted', 'alpha_rejected', 'alpha_revisions'],
	alpha_revisions: ['alpha_review'],
	alpha_accepted: ['final_review', 'alpha_review'],
	alpha_rejected: ['draft', 'alpha_review'],
	final_review: ['final_accepted', 'final_revisions'],
	final_revisions: ['final_review'],
	final_accepted: ['publication_requested', 'final_review'],
	publication_requested: ['final_accepted', 'final_review']
};
const overrideContext = 'pure3d.adminWorkflowOverride';

function words(value) {
	return String(value || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean).length;
}

function error(from, to, reason) {
	if (!transitions[from]) return 'Published editions cannot be changed by an override.';
	if (!transitions[from].includes(to)) return 'This administrative transition is not supported.';
	if (typeof reason !== 'string' || !reason.trim() || reason.length > 5000 || words(reason) > 500)
		return 'Provide an override reason of no more than 500 words or 5,000 characters.';
	return '';
}

function reviewStage(status) {
	if (
		['concept_submitted', 'editorial_review', 'concept_accepted', 'concept_rejected'].includes(
			status
		)
	)
		return 1;
	if (status.startsWith('alpha_')) return 2;
	if (status.startsWith('final_') || status === 'publication_requested') return 3;
	return 0;
}

function override(e) {
	if (!require('./orcid-service.cjs').admin(e))
		throw new ForbiddenError('Administrator access is required.');
	const body = e.requestInfo().body || {};
	const to = body.status;
	const expectedStatus = body.expectedStatus;
	const reason = typeof body.reason === 'string' ? body.reason.trim() : body.reason;
	const id = e.request.pathValue('editionId');
	let result;
	e.app.runInTransaction((tx) => {
		const edition = tx.findRecordById('editions', id);
		const from = edition.getString('status') || 'draft';
		if (expectedStatus !== from)
			throw new BadRequestError('The workflow changed. Reload before applying an intervention.');
		const message = error(from, to, reason);
		if (message) throw new BadRequestError(message);
		const now = new Date().toISOString();
		const context = new Context(
			new Context(null, overrideContext, true),
			'pure3d.actor',
			require('./activity-service.cjs').actor(e.auth)
		);

		edition.set('status', to);
		edition.set('isPublished', false);
		edition.set('reviewStage', reviewStage(to));
		if (to === 'alpha_review') {
			edition.set('alphaReviewRound', edition.getInt('alphaReviewRound') + 1);
			edition.set('alphaSubmittedAt', now);
			edition.set('alphaFeedbackReleasedAt', '');
		}
		if (to === 'final_review') {
			edition.set('finalReviewRound', edition.getInt('finalReviewRound') + 1);
			edition.set('finalSubmittedAt', now);
			edition.set('finalFeedbackReleasedAt', '');
		}
		// An override only changes workflow state. It never manufactures reviews, releases feedback,
		// confirms rights, or applies a peer-review/publication claim.
		tx.saveWithContext(context, edition);
		require('./activity-service.cjs').audit(
			tx,
			require('./activity-service.cjs').actor(e.auth),
			'workflow_override',
			'edition',
			edition.id,
			{ from, to, reason }
		);
		result = {
			status: to,
			alphaReviewRound: edition.getInt('alphaReviewRound'),
			finalReviewRound: edition.getInt('finalReviewRound')
		};
	});
	return e.json(200, result);
}

module.exports = { transitions, error, reviewStage, override, overrideContext };
