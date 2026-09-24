const proposalFields = [
	'proposalType',
	'proposalPurpose',
	'proposalArgument',
	'proposalThreeDRationale',
	'proposalAudience',
	'proposalContextualMaterial',
	'proposalHasExistingModel',
	'proposalModelSources',
	'proposalCopyrightOwnership',
	'proposalDigitisationSituation',
	'proposalSupportingLinks',
	'proposalSupportingFiles',
	'proposalModelFiles',
	'proposalModelAssets',
	'proposalModelScenes',
	'proposalModels',
	'proposalAuthorAffiliations',
	'proposalSnapshot',
	'proposalSubmittedAt'
];
const proposalTypes = ['research', 'teaching', 'public-engagement', 'other'];
const audiences = [
	'general-public',
	'academics',
	'specialists',
	'primary-students',
	'secondary-students',
	'university-students'
];
const modelSources = [
	'computer-graphic-reconstruction',
	'structured-light-scan',
	'medical-xray-computed-tomography',
	'photogrammetry',
	'ct-scan',
	'magnetic-resonance-imaging',
	'confocal-image-stacking',
	'infrared-scanning',
	'micro-xray-computed-tomography'
];

function words(value) {
	return String(value || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean).length;
}
function json(record, field) {
	try {
		const value = record.getString ? record.getString(field) : record[field];
		return typeof value === 'string' ? JSON.parse(value || 'null') : value;
	} catch {
		return null;
	}
}
function text(record, field) {
	return String(record.getString ? record.getString(field) : record[field] || '');
}
function bool(record, field) {
	return record.getBool ? record.getBool(field) : !!record[field];
}
function list(record, field) {
	if (
		record.get &&
		['proposalModelFiles', 'proposalModelAssets', 'proposalModelScenes'].includes(field)
	) {
		const raw = record.get(field);
		return (Array.isArray(raw) ? raw : [raw])
			.map((file) => (typeof file === 'string' ? file : file?.name))
			.filter(Boolean);
	}
	const value = json(record, field);
	return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}
function submissionErrors(record) {
	if (!proposalTypes.includes(text(record, 'proposalType'))) return ['Select a proposal type.'];
	if (!text(record, 'title').trim()) return ['Title is required.'];
	const credits = json(record, 'credits');
	if (!Array.isArray(credits) || !credits.some((credit) => credit && credit.role === 'creator'))
		return ['Add at least one author.'];
	for (const [field, label] of [
		['proposalPurpose', 'Purpose'],
		['proposalArgument', 'Research argument and model centrality'],
		['proposalThreeDRationale', 'Why 3D is appropriate'],
		['proposalContextualMaterial', 'Contextual material description']
	]) {
		const value = text(record, field).trim();
		if (!value) return [label + ' is required.'];
		if (words(value) > 150) return [label + ' must be 150 words or fewer.'];
	}
	const selectedAudiences = list(record, 'proposalAudience');
	if (!selectedAudiences.length || selectedAudiences.some((value) => !audiences.includes(value)))
		return ['Select at least one intended audience.'];
	if (bool(record, 'proposalHasExistingModel')) {
		if (list(record, 'proposalModelFiles').length === 0)
			return ['Upload an existing 3D model before submitting.'];
		if (
			!list(record, 'proposalModelSources').length ||
			list(record, 'proposalModelSources').some((value) => !modelSources.includes(value))
		)
			return ['Select at least one model source.'];
		const ownership = text(record, 'proposalCopyrightOwnership').trim();
		if (!ownership) return ['Explain copyright ownership and permissions.'];
		if (words(ownership) > 150) return ['Copyright ownership must be 150 words or fewer.'];
	} else {
		const situation = text(record, 'proposalDigitisationSituation').trim();
		if (!situation) return ['Describe the digitisation situation.'];
		if (words(situation) > 150) return ['Digitisation situation must be 150 words or fewer.'];
	}
	const links = json(record, 'proposalSupportingLinks');
	if (
		links != null &&
		(!Array.isArray(links) ||
			links.some(
				(link) => typeof link !== 'string' || !/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(link)
			))
	)
		return ['Supporting links must be valid HTTP or HTTPS URLs.'];
	return [];
}
function validateSubmission(record) {
	const errors = submissionErrors(record);
	if (errors.length) throw new BadRequestError(errors[0]);
}
function canAuthorEditProposal(status, changedFields) {
	if (status === 'draft' || status === 'concept_rejected') return true;
	const locked = proposalFields.concat(
		['concept_submitted', 'editorial_review'].includes(status)
			? ['title', 'dcTitle', 'credits', 'modelFile', 'modelAssets', 'sceneDocument']
			: []
	);
	return !changedFields.some((field) => locked.includes(field));
}

// Group a single upload and its companions in the same record update, never a second request.
function syncModels(record) {
	const before = record.original();
	const files = list(record, 'proposalModelFiles');
	const added = files.filter((file) => !list(before, 'proposalModelFiles').includes(file));
	const assets = list(record, 'proposalModelAssets');
	const scenes = list(record, 'proposalModelScenes');
	const addedAssets = assets.filter((file) => !list(before, 'proposalModelAssets').includes(file));
	const addedScenes = scenes.filter((file) => !list(before, 'proposalModelScenes').includes(file));
	if (
		added.length > 1 ||
		addedScenes.length > 1 ||
		(!added.length && (addedAssets.length || addedScenes.length))
	)
		throw new BadRequestError('Upload one primary model with its companions at a time.');
	if (added.some((file) => !/\.(glb|gltf|obj|ply)$/i.test(file)))
		throw new BadRequestError('Model files must be GLB, GLTF, OBJ, or PLY.');
	const models = (json(before, 'proposalModels') || []).filter((model) =>
		files.includes(model.file)
	);
	if (added.length)
		models.push({ file: added[0], assets: addedAssets, scene: addedScenes[0] || '' });
	for (const model of models) {
		if (
			model.assets.some((file) => !assets.includes(file)) ||
			(model.scene && !scenes.includes(model.scene))
		)
			throw new BadRequestError('Remove the model together with its companion files.');
	}
	record.set('proposalModels', models);
}

module.exports = {
	proposalFields,
	submissionErrors,
	validateSubmission,
	canAuthorEditProposal,
	syncModels
};
