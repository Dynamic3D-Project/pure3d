/* eslint-disable @typescript-eslint/no-require-imports -- PocketBase Goja supports CommonJS, not ESM. */
// Each Goja handler has an isolated scope; require helpers inside the handler.
onRecordCreateRequest(
	(e) => require(__hooks + '/activity-service.cjs').request(e),
	'users',
	'collections',
	'editions',
	'collectionUsers',
	'editionUsers',
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback',
	'documentation'
);
onRecordUpdateRequest(
	(e) => require(__hooks + '/activity-service.cjs').request(e),
	'users',
	'collections',
	'editions',
	'collectionUsers',
	'editionUsers',
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback',
	'documentation'
);
onRecordDeleteRequest(
	(e) => require(__hooks + '/activity-service.cjs').request(e),
	'users',
	'collections',
	'editions',
	'collectionUsers',
	'editionUsers',
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback',
	'documentation'
);

onRecordCreateRequest(
	() => require(__hooks + '/activity-service.cjs').denyWrite(),
	'auditLog',
	'notifications'
);
onRecordUpdateRequest(() => require(__hooks + '/activity-service.cjs').denyWrite(), 'auditLog');
onRecordDeleteRequest(
	() => require(__hooks + '/activity-service.cjs').denyWrite(),
	'auditLog',
	'notifications'
);
onRecordCreate(
	(e) => require(__hooks + '/activity-service.cjs').createEvent(e),
	'auditLog',
	'notifications'
);
onRecordUpdateRequest(
	(e) => require(__hooks + '/activity-service.cjs').markRead(e),
	'notifications'
);

onRecordCreateRequest(
	(e) => require(__hooks + '/review-service.cjs').request(e, 'create'),
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback'
);
onRecordUpdateRequest(
	(e) => require(__hooks + '/review-service.cjs').request(e, 'update'),
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback'
);
onRecordDeleteRequest(
	(e) => require(__hooks + '/review-service.cjs').request(e, 'delete'),
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback'
);
onRecordValidate(
	(e) => require(__hooks + '/review-service.cjs').validate(e),
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback'
);

routerAdd(
	'GET',
	'/api/pure3d/orcid/config',
	(e) => {
		if (
			!e.auth ||
			(!e.auth.isSuperuser() &&
				(e.auth.collection().name !== 'users' || e.auth.getString('role') !== 'admin'))
		)
			throw new ForbiddenError();
		const { issuer } = require(__hooks + '/orcid-validation.cjs').orcidEndpoints(
			$os.getenv('ORCID_ISSUER') || 'https://orcid.org'
		);
		return e.json(200, {
			backend: 'pure3d-orcid-v1',
			issuer,
			reviewAccess: 'assignment-scoped-v1',
			activity: 'trusted-events-v1'
		});
	},
	$apis.requireAuth()
);

onRecordAuthWithOAuth2Request((e) => {
	return require(__hooks + '/orcid-service.cjs').oauth(e);
}, 'users');

onRecordAuthRequest((e) => {
	// Never expose provider tokens or the raw provider payload in auth meta.
	if (e.authMethod === 'oauth2') e.meta = { isNew: !!(e.meta && e.meta.isNew) };
	return e.next();
}, 'users');

onRecordCreateRequest(
	(e) => {
		return require(__hooks + '/orcid-service.cjs').createRequest(e);
	},
	'users',
	'collections',
	'editions',
	'collectionUsers',
	'editionUsers'
);

onRecordUpdateRequest(
	(e) => {
		return require(__hooks + '/orcid-service.cjs').updateRequest(e);
	},
	'users',
	'collections',
	'editions',
	'collectionUsers',
	'editionUsers'
);

onRecordDeleteRequest(
	(e) => {
		return require(__hooks + '/orcid-service.cjs').deleteRequest(e);
	},
	'users',
	'collections',
	'editions',
	'collectionUsers',
	'editionUsers'
);

onRecordCreate(
	(e) => {
		return require(__hooks + '/orcid-service.cjs').createMembership(e);
	},
	'collections',
	'editions'
);

onRecordCreate(
	(e) => require(__hooks + '/activity-service.cjs').model(e),
	'users',
	'collections',
	'editions',
	'collectionUsers',
	'editionUsers',
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback',
	'documentation'
);
onRecordUpdate(
	(e) => require(__hooks + '/activity-service.cjs').model(e),
	'users',
	'collections',
	'editions',
	'collectionUsers',
	'editionUsers',
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback',
	'documentation'
);
onRecordDelete(
	(e) => require(__hooks + '/activity-service.cjs').model(e),
	'users',
	'collections',
	'editions',
	'collectionUsers',
	'editionUsers',
	'reviewAssignments',
	'editionReviews',
	'reviewFeedback',
	'documentation'
);

onRecordValidate(
	(e) => {
		return require(__hooks + '/orcid-service.cjs').validateRecord(e);
	},
	'users',
	'collections',
	'editions',
	'collectionUsers',
	'editionUsers'
);

onRecordDelete((e) => {
	return require(__hooks + '/orcid-service.cjs').deleteUser(e);
}, 'users');

onRecordDeleteRequest((e) => {
	if (e.record.getString('collectionRef') === e.app.findCollectionByNameOrId('users').id)
		throw new ForbiddenError('ORCID is the account identity and cannot be unlinked');
	return e.next();
}, '_externalAuths');

routerAdd(
	'POST',
	'/api/pure3d/orcid/profile-refresh',
	(e) => {
		return require(__hooks + '/orcid-service.cjs').refresh(e);
	},
	$apis.requireAuth('users')
);

routerAdd(
	'GET',
	'/api/pure3d/orcid/pending/{userId}',
	(e) => {
		return require(__hooks + '/orcid-service.cjs').pending(e, false);
	},
	$apis.requireAuth()
);

routerAdd(
	'POST',
	'/api/pure3d/orcid/pending/{userId}',
	(e) => {
		return require(__hooks + '/orcid-service.cjs').pending(e, true);
	},
	$apis.requireAuth()
);

routerAdd('GET', '/api/pure3d/orcid/ready', (e) => {
	e.response.header().set('Cache-Control', 'no-store');
	try {
		return require(__hooks + '/orcid-readiness.cjs').ready(e);
	} catch {
		return e.json(503, {
			ready: false,
			checks: { hooks: false, auth: false, schema: false, credits: false }
		});
	}
});

onBootstrap((e) => {
	e.next();
	e.app.store().set('pure3d.orcid.hooks', 'trusted-events-v1');
});
