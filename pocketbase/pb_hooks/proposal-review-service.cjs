/* eslint-disable @typescript-eslint/no-require-imports -- PocketBase uses CommonJS. */
function field(record, name) {
	return record.getString ? record.getString(name) : String(record[name] || '');
}

function integer(record, name) {
	return record.getInt ? record.getInt(name) : Number(record[name] || 0);
}

function json(record, name) {
	try {
		const value = record.getString ? record.getString(name) : record[name];
		return typeof value === 'string' ? JSON.parse(value || 'null') : value;
	} catch {
		return null;
	}
}

function files(record, name) {
	const value = record.get(name);
	return (Array.isArray(value) ? value : value ? [value] : [])
		.map((file) => (typeof file === 'string' ? file : file?.name))
		.filter(Boolean);
}

function originalName(filename) {
	let name = filename;
	let previous;
	do {
		previous = name;
		name = name.replace(/_[a-z0-9]{10}(\.[^.]+)$/i, '$1');
	} while (name !== previous);
	return name;
}

function proposalScene(models, title) {
	const modelNodes = models.map((_, index) => 6 + index);
	return {
		asset: { type: 'application/si-dpo-3d.document+json', version: '1.0' },
		scene: 0,
		scenes: [
			{ name: 'Proposal models', units: 'cm', nodes: [0, 1, ...modelNodes], setup: 0, meta: 0 }
		],
		nodes: [
			{ name: 'Camera', camera: 0 },
			{ name: 'Lights', children: [2, 3, 4, 5] },
			{ name: 'Ambient', light: 0 },
			{ name: 'Key', light: 1, translation: [1, 1, 1] },
			{ name: 'Fill', light: 2, translation: [-1, 0.5, 1] },
			{ name: 'Back', light: 3, translation: [0, 1, -1] },
			...models.map((model, index) => ({ name: originalName(model.label), model: index }))
		],
		cameras: [
			{
				type: 'perspective',
				perspective: { yfov: 52, znear: 0.1, zfar: 100000 },
				autoNearFar: true
			}
		],
		lights: [
			{ type: 'ambient', color: [1, 1, 1], intensity: 0.8 },
			{ type: 'directional', color: [1, 0.95, 0.9], intensity: 1 },
			{ type: 'directional', color: [0.9, 0.95, 1], intensity: 0.7 },
			{ type: 'directional', color: [0.85, 0.9, 1], intensity: 0.5 }
		],
		models: models.map((model) => ({
			units: 'cm',
			derivatives: [
				{
					usage: 'Web3D',
					quality: 'High',
					assets: [
						{
							uri: model.file,
							type: /\.(glb|gltf)$/i.test(model.file) ? 'Model' : 'Geometry'
						}
					]
				}
			]
		})),
		setups: [{}],
		metas: [{ collection: { titles: { EN: title } } }]
	};
}

// Proposal files are immutable after submission. Reuploading them creates independent
// storage objects, so later draft replacement/removal cannot alter the submitted snapshot.
function initializeDraftAssets(app, edition) {
	if (
		edition.getString('modelFile') ||
		files(edition, 'modelAssets').length ||
		edition.getString('sceneDocument')
	)
		return null;
	const proposalFiles = new Set(files(edition, 'proposalModelFiles'));
	const proposalAssets = new Set(files(edition, 'proposalModelAssets'));
	const proposalScenes = new Set(files(edition, 'proposalModelScenes'));
	const models = (json(edition, 'proposalModels') || []).filter(
		(model) =>
			model &&
			typeof model.file === 'string' &&
			proposalFiles.has(model.file) &&
			Array.isArray(model.assets) &&
			model.assets.every((asset) => proposalAssets.has(asset)) &&
			(!model.scene || proposalScenes.has(model.scene))
	);
	if (!models.length) return null;

	const filesystem = app.newFilesystem();
	try {
		const copy = (filename) =>
			filesystem.getReuploadableFile(
				edition.baseFilesPath() + '/' + filename,
				false
			);
		const drafts = models.map((model) => ({
			label: model.file,
			file: copy(model.file),
			assets: model.assets.map(copy),
			scene: model.scene ? copy(model.scene) : null
		}));
		edition.set('modelFile', drafts[0].file);
		edition.set(
			'modelAssets',
			drafts.flatMap((model, index) => [
				...(index ? [model.file] : []),
				...model.assets,
				...(model.scene ? [model.scene] : [])
			])
		);
		edition.set(
			'sceneDocument',
			$filesystem.fileFromBytes(
				JSON.stringify(
					proposalScene(
						drafts.map((model) => ({ label: model.label, file: model.file.name })),
						edition.getString('title')
					)
				),
				'proposal-models.svx.json'
			)
		);
		// Reuploadable files stream from this filesystem. The caller must keep it open
		// through save and then invoke the returned cleanup function.
		return () => filesystem.close();
	} catch (error) {
		filesystem.close();
		throw error;
	}
}

function timestamp(value) {
	const time = Date.parse(String(value || '').replace(' ', 'T'));
	return Number.isFinite(time) ? time : 0;
}

function currentAssignments(assignments, proposalSubmittedAt) {
	const submitted = timestamp(proposalSubmittedAt);
	if (!submitted) return [];
	return assignments.filter(
		(assignment) =>
			integer(assignment, 'reviewStage') === 1 &&
			integer(assignment, 'reviewRound') === 0 &&
			field(assignment, 'status') !== 'declined' &&
			timestamp(field(assignment, 'created')) >= submitted
	);
}

function hasUnanimousApproval(assignments, reviews, proposalSubmittedAt) {
	const active = currentAssignments(assignments, proposalSubmittedAt);
	const latestAssignmentByReviewer = new Map();
	for (const assignment of active) {
		const reviewerId = field(assignment, 'reviewerId');
		if (!reviewerId) continue;
		const assignedAt = timestamp(field(assignment, 'created'));
		if (assignedAt > (latestAssignmentByReviewer.get(reviewerId) || 0))
			latestAssignmentByReviewer.set(reviewerId, assignedAt);
	}
	if (!latestAssignmentByReviewer.size) return false;

	for (const [reviewerId, assignedAt] of latestAssignmentByReviewer) {
		const submitted = reviews.filter(
			(review) =>
				integer(review, 'reviewStage') === 1 &&
				integer(review, 'reviewRound') === 0 &&
				field(review, 'reviewerId') === reviewerId &&
				field(review, 'reviewStatus') === 'submitted' &&
				field(review, 'submittedAt') &&
				timestamp(field(review, 'submittedAt')) >= assignedAt
		);
		// Duplicate submitted verdicts are ambiguous and must never manufacture consensus.
		if (submitted.length !== 1 || field(submitted[0], 'decision') !== 'approve') return false;
	}
	return true;
}

function assignments(app, editionId) {
	return app.findRecordsByFilter(
		'reviewAssignments',
		'editionId = {:id} && reviewStage = 1',
		'created,id',
		0,
		0,
		{ id: editionId }
	);
}

function reviews(app, editionId) {
	return app.findRecordsByFilter(
		'editionReviews',
		'editionId = {:id} && reviewStage = 1',
		'created,id',
		0,
		0,
		{ id: editionId }
	);
}

function acceptIfUnanimous(app, editionId, context) {
	const edition = app.findRecordById('editions', editionId);
	if (edition.getString('status') !== 'editorial_review') return false;
	if (
		!hasUnanimousApproval(
			assignments(app, editionId),
			reviews(app, editionId),
			edition.getString('proposalSubmittedAt')
		)
	)
		return false;
	edition.set('status', 'concept_accepted');
	const closeDraftFiles = initializeDraftAssets(app, edition);
	try {
		app.saveWithContext(context, edition);
	} finally {
		closeDraftFiles?.();
	}
	return true;
}

function initialize(e) {
	const editionId = e.request.pathValue('editionId');
	let edition;
	e.app.runInTransaction((tx) => {
		edition = tx.findRecordById('editions', editionId);
		const access = require('./orcid-service.cjs').roles({ app: tx, auth: e.auth }, edition);
		if (!access.admin && !access.owner && !access.author && !access.collaborator)
			throw new ForbiddenError('Edition author access is required.');
		if (edition.getString('status') !== 'concept_accepted')
			throw new BadRequestError('Draft assets can only be initialized after proposal acceptance.');
		const closeDraftFiles = initializeDraftAssets(tx, edition);
		if (closeDraftFiles)
			try {
				tx.saveWithContext(
					new Context(null, 'pure3d.actor', require('./activity-service.cjs').actor(e.auth)),
					edition
				);
			} finally {
				closeDraftFiles();
			}
	});
	return e.json(200, edition);
}

function savedReview(e) {
	if (e.record.getInt('reviewStage') !== 1) return e.next();
	const app = e.app;
	try {
		return app.runInTransaction((tx) => {
			e.app = tx;
			e.next();
			const edition = tx.findRecordById('editions', e.record.getString('editionId'));
			const active = currentAssignments(
				assignments(tx, edition.id),
				edition.getString('proposalSubmittedAt')
			);
			if (e.record.getString('reviewStatus') === 'submitted') {
				for (const assignment of active) {
					if (
						assignment.getString('reviewerId') === e.record.getString('reviewerId') &&
						assignment.getString('status') !== 'completed'
					) {
						assignment.set('status', 'completed');
						tx.saveWithContext(e.context, assignment);
					}
				}
			}
			acceptIfUnanimous(tx, edition.id, e.context);
		});
	} finally {
		e.app = app;
	}
}

function changedAssignment(e) {
	if (e.record.getInt('reviewStage') !== 1) return e.next();
	const app = e.app;
	try {
		return app.runInTransaction((tx) => {
			e.app = tx;
			const editionId = e.record.getString('editionId');
			e.next();
			acceptIfUnanimous(tx, editionId, e.context);
		});
	} finally {
		e.app = app;
	}
}

function changedEdition(e) {
	const app = e.app;
	try {
		return app.runInTransaction((tx) => {
			e.app = tx;
			e.next();
			if (e.record.getString('status') === 'editorial_review')
				acceptIfUnanimous(tx, e.record.id, e.context);
		});
	} finally {
		e.app = app;
	}
}

module.exports = {
	currentAssignments,
	hasUnanimousApproval,
	initializeDraftAssets,
	initialize,
	savedReview,
	changedAssignment,
	changedEdition
};
