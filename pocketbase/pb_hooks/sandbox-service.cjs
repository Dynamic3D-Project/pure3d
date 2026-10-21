/* eslint-disable @typescript-eslint/no-require-imports -- PocketBase uses CommonJS. */
const MAX_SANDBOXES_PER_USER = 3;
const MAX_SANDBOX_MODEL_ASSETS = 20;
const MAX_SANDBOX_MODEL_ASSET_BYTES = 100 * 1024 * 1024;
const MAX_SANDBOX_SCENE_DOCUMENT_BYTES = 500 * 1024 * 1024;
const copiedFields = [
	'dcSubtitle',
	'dcAbstract',
	'dcDescription',
	'dcInstitution',
	'dcContact',
	'dcSubject',
	'dcKeyword',
	'dcAudience',
	'dcFunder',
	'dcSource',
	'dcProvenance',
	'dcCoveragePeriod',
	'dcCoveragePlace',
	'dcCoverageCountry',
	'dcCoverageTemporal',
	'dcCoverageGeo',
	'dcLanguage',
	'dcRightsHolder',
	'dcRightsLicense',
	'dcDatePublished',
	'dcDateCreated',
	'dcDateModified',
	'authorToolName',
	'authorToolVersion',
	'sceneFile',
	'settingsAuthorToolName',
	'settingsAuthorToolVersion',
	'settingsSceneFile'
];
const fileFields = ['coverImage', 'modelFile', 'modelAssets', 'sceneDocument'];

function isSandbox(record) {
	return record.getBool('isSandbox');
}
function owner(record) {
	return record.getString('sandboxOwner');
}
function changed(record, field) {
	return JSON.stringify(record.get(field)) !== JSON.stringify(record.original().get(field));
}
function actor(e) {
	if (!e.auth || e.auth.collection().name !== 'users')
		throw new ForbiddenError('Sign in to use a sandbox.');
	return e.auth;
}
function owns(e, record) {
	return !!e.auth && e.auth.collection().name === 'users' && owner(record) === e.auth.id;
}
function rejectExternalCreate(record) {
	if (isSandbox(record) || owner(record))
		throw new BadRequestError('Private sandboxes must be created from My Work.');
}
function prepareUpdate(e) {
	const record = e.record;
	if (!owns(e, record))
		throw new ForbiddenError('Only the sandbox owner can edit this private sandbox.');
	if (
		[
			'isSandbox',
			'sandboxOwner',
			'collection',
			'status',
			'isPublished',
			'publishedAt',
			'publishedBy',
			'reviewStage'
		].some((field) => changed(record, field))
	)
		throw new ForbiddenError('Private sandboxes cannot enter collections, review, or publication.');
	if (record.getString('status') !== 'draft' || record.getBool('isPublished'))
		throw new ForbiddenError('Private sandboxes stay private drafts.');
	if (listFiles(record, 'modelAssets').length > MAX_SANDBOX_MODEL_ASSETS)
		throw new BadRequestError(
			`Private sandboxes support up to ${MAX_SANDBOX_MODEL_ASSETS} model companion files.`
		);
	if (uploadedFiles(e, 'modelAssets').some((file) => file.size > MAX_SANDBOX_MODEL_ASSET_BYTES))
		throw new BadRequestError('Private sandbox model companion files must be 100 MB or smaller.');
	if (
		uploadedFiles(e, 'sceneDocument').some(
			(file) => file.size > MAX_SANDBOX_SCENE_DOCUMENT_BYTES
		)
	)
		throw new BadRequestError('Private sandbox Voyager scene files must be 500 MB or smaller.');
}
function prepareDelete(e) {
	if (!owns(e, e.record))
		throw new ForbiddenError('Only the sandbox owner can delete this private sandbox.');
}
function assertNoSandboxMutation(record) {
	if (isSandbox(record) || owner(record))
		throw new ForbiddenError('Sandbox identity is server-owned.');
}
function countFor(app, userId) {
	return app.findRecordsByFilter(
		'editions',
		'isSandbox = true && sandboxOwner = {:owner}',
		'',
		0,
		0,
		{ owner: userId }
	).length;
}
function create(e) {
	const user = actor(e);
	let result;
	e.app.runInTransaction((tx) => {
		if (countFor(tx, user.id) >= MAX_SANDBOXES_PER_USER)
			throw new BadRequestError(
				`You can keep up to ${MAX_SANDBOXES_PER_USER} private sandboxes. Delete one before creating another.`
			);
		const profile = tx.findRecordById('users', user.id);
		const edition = new Record(tx.findCollectionByNameOrId('editions'));
		edition.set('title', 'Untitled Sandbox');
		edition.set('dcTitle', 'Untitled Sandbox');
		edition.set('status', 'draft');
		edition.set('isPublished', false);
		edition.set('isSandbox', true);
		edition.set('sandboxOwner', user.id);
		// Sandbox attribution is intentionally unlinked: signed-in users need not have ORCID proof
		// until they transfer work into an approved edition.
		edition.set('credits', [
			{
				type: 'person',
				name: profile.getString('nickname') || 'Author',
				orcid: profile.getString('orcid') || null,
				role: 'creator',
				provenance: 'manual'
			}
		]);
		tx.saveWithContext(new Context(null, 'pure3d.actor', 'users/' + user.id), edition);
		const membership = new Record(tx.findCollectionByNameOrId('editionUsers'));
		membership.set('edition', edition.id);
		membership.set('editionId', edition.id);
		membership.set('user', user.id);
		membership.set('userId', user.id);
		membership.set('role', 'author');
		tx.saveWithContext(new Context(null, 'pure3d.actor', 'users/' + user.id), membership);
		result = { id: edition.id, title: edition.getString('title') };
	});
	return e.json(201, result);
}
function listFiles(record, field) {
	const value = record.get(field);
	return (Array.isArray(value) ? value : value ? [value] : [])
		.map((file) => (typeof file === 'string' ? file : file?.name))
		.filter(Boolean);
}
function hasField(record, field) {
	return !!record.collection().fields.getByName(field);
}
function uploadedFiles(e, field) {
	if (!changed(e.record, field)) return [];
	return [...e.findUploadedFiles(field), ...e.findUploadedFiles(field + '+')];
}
function targetIsEmpty(target) {
	if (fileFields.some((field) => listFiles(target, field).length)) return false;
	return !copiedFields.some((field) => {
		if (!hasField(target, field)) return false;
		const value = target.get(field);
		return Array.isArray(value) ? value.length > 0 : !!value;
	});
}
function transfer(e) {
	const user = actor(e);
	const body = e.requestInfo().body || {};
	if (typeof body.targetEditionId !== 'string' || !body.targetEditionId)
		throw new BadRequestError('Choose an approved edition to receive this sandbox.');
	if (typeof body.expectedUpdated !== 'string' || !body.expectedUpdated)
		throw new BadRequestError('Reload the sandbox before transferring it.');
	let result;
	e.app.runInTransaction((tx) => {
		const source = tx.findRecordById('editions', e.request.pathValue('sandboxId'));
		const target = tx.findRecordById('editions', body.targetEditionId);
		if (!isSandbox(source) || owner(source) !== user.id)
			throw new ForbiddenError('Only the sandbox owner can transfer this work.');
		if (source.getString('updated') !== body.expectedUpdated)
			throw new BadRequestError('This sandbox changed. Reload before transferring the latest work.');
		if (isSandbox(target) || target.getString('status') !== 'concept_accepted')
			throw new BadRequestError('Choose one of your approved editions that is ready to build.');
		if (
			!tx.findRecordsByFilter(
				'editionUsers',
				'editionId = {:edition} && userId = {:user} && role = "author"',
				'',
				1,
				0,
				{ edition: target.id, user: user.id }
			).length
		)
			throw new ForbiddenError('You can only transfer work into your own approved edition.');
		if (!targetIsEmpty(target))
			throw new BadRequestError(
				'The approved edition already has editor content or files. Empty it first; transfer never overwrites existing work.'
			);
		const filesystem = tx.newFilesystem();
		try {
			for (const field of copiedFields)
				if (hasField(source, field) && hasField(target, field))
					target.set(field, source.get(field));
			for (const field of fileFields) {
				const files = listFiles(source, field).map((filename) =>
					filesystem.getReuploadableFile(source.baseFilesPath() + '/' + filename, false)
				);
				target.set(field, field === 'modelAssets' ? files : files[0] || null);
			}
			tx.saveWithContext(new Context(null, 'pure3d.actor', 'users/' + user.id), target);
			// Retain the source so the owner can confirm the copied work before deleting it.
			result = { editionId: target.id, sandboxId: source.id };
		} finally {
			filesystem.close();
		}
	});
	return e.json(200, result);
}

module.exports = {
	MAX_SANDBOXES_PER_USER,
	MAX_SANDBOX_MODEL_ASSETS,
	MAX_SANDBOX_MODEL_ASSET_BYTES,
	MAX_SANDBOX_SCENE_DOCUMENT_BYTES,
	isSandbox,
	owner,
	rejectExternalCreate,
	prepareUpdate,
	prepareDelete,
	assertNoSandboxMutation,
	create,
	transfer
};
