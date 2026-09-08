/* eslint-disable @typescript-eslint/no-require-imports -- PocketBase Goja supports CommonJS, not ESM. */
const v = require('./orcid-validation.cjs');
const activity = require('./activity-service.cjs');

function ready(e) {
	const checks = { hooks: false, auth: false, schema: false, credits: false };
	try {
		checks.hooks =
			e.app.store().get('pure3d.orcid.hooks') === 'trusted-events-v1' &&
			typeof require('./orcid-service.cjs').oauth === 'function' &&
			typeof require('./review-service.cjs').request === 'function' &&
			typeof activity.model === 'function';
		const { issuer } = v.orcidEndpoints($os.getenv('ORCID_ISSUER') || 'https://orcid.org');
		const users = e.app.findCollectionByNameOrId('users');
		const provider = users.oauth2.providers[0];
		// Goja exposes PB pointer-valued options/rules as objects, not primitive strings/booleans.
		checks.auth = !!(
			users.oauth2.enabled &&
			users.oauth2.providers.length === 1 &&
			provider.name === 'oidc' &&
			provider.clientId &&
			String(provider.pkce) === 'true' &&
			provider.authURL === issuer + '/oauth/authorize' &&
			provider.tokenURL === issuer + '/oauth/token' &&
			!provider.userInfoURL &&
			provider.extra &&
			provider.extra.jwksURL === issuer + '/oauth/jwks' &&
			JSON.stringify(provider.extra.issuers) === JSON.stringify([issuer]) &&
			!users.passwordAuth.enabled &&
			!users.otp.enabled &&
			!users.mfa.enabled &&
			!Object.values(users.oauth2.mappedFields).some(Boolean) &&
			String(users.authRule) === '' &&
			users.manageRule == null
		);
		const audit = e.app.findCollectionByNameOrId('auditLog');
		const notifications = e.app.findCollectionByNameOrId('notifications');
		const expected = {
			users: {
				nickname: 'text',
				profilePicture: 'file',
				affiliation: 'text',
				bio: 'editor',
				titleRole: 'text',
				socials: 'text',
				orcid: 'url',
				orcidVerifiedAt: 'date',
				pendingOrcid: 'url',
				role: 'select'
			},
			collections: { credits: 'json' },
			editions: { credits: 'json' },
			collectionUsers: { collection: 'relation', userId: 'relation', role: 'select' },
			editionUsers: { editionId: 'relation', userId: 'relation', role: 'select' },
			reviewAssignments: {
				editionId: 'relation',
				reviewerId: 'relation',
				reviewStage: 'number',
				status: 'select',
				created: 'autodate'
			},
			editionReviews: {
				editionId: 'relation',
				reviewerId: 'relation',
				reviewStage: 'number',
				decision: 'select',
				created: 'autodate'
			},
			reviewFeedback: {
				editionId: 'relation',
				reviewerId: 'relation',
				reviewStage: 'number',
				resolved: 'bool',
				created: 'autodate'
			},
			auditLog: {
				action: 'text',
				performedBy: 'text',
				targetType: 'select',
				targetId: 'text',
				details: 'json',
				created: 'autodate'
			},
			notifications: {
				recipientId: 'relation',
				type: 'select',
				title: 'text',
				read: 'bool',
				created: 'autodate'
			}
		};
		checks.schema =
			Object.keys(expected).every((name) => {
				const collection = e.app.findCollectionByNameOrId(name);
				return Object.keys(expected[name]).every((key) => {
					const field = collection.fields.getByName(key);
					return field && field.type() === expected[name][key];
				});
			}) &&
			users.fields.getByName('pendingOrcid').getHidden() &&
			audit.fields.getByName('targetType').values.includes('documentation') &&
			!!activity.applicationURL(e.app) &&
			audit.createRule == null &&
			audit.updateRule == null &&
			audit.deleteRule == null &&
			String(audit.listRule) === "@request.auth.role = 'admin'" &&
			String(audit.viewRule) === String(audit.listRule) &&
			notifications.createRule == null &&
			notifications.deleteRule == null &&
			String(notifications.listRule) === activity.notificationRule &&
			String(notifications.viewRule) === activity.notificationRule &&
			String(notifications.updateRule) === activity.notificationRule &&
			activity.notificationTypes.every((type) =>
				notifications.fields.getByName('type').values.includes(type)
			);
		if (checks.schema) {
			const linkedUsers = {};
			const lookup = (id) => {
				if (!linkedUsers[id])
					linkedUsers[id] = require('./orcid-service.cjs').creditUser(e.app, id);
				return linkedUsers[id];
			};
			checks.credits = true;
			// ponytail: scan live attribution for the deployment gate; cache only if this endpoint becomes hot.
			for (const name of ['collections', 'editions']) {
				for (const record of e.app.findAllRecords(name)) {
					const credits = JSON.parse(record.getString('credits') || 'null');
					// Legacy preservation is a migration preflight, not a constraint on subsequent editing.
					if (
						!Array.isArray(credits) ||
						!v.sameCredits(v.credits(credits, credits, false, lookup), credits)
					) {
						checks.credits = false;
						break;
					}
				}
				if (!checks.credits) break;
			}
		}
	} catch {
		// No database errors, config values, names, counts or identities escape this public endpoint.
		checks.credits = false;
	}
	const ready = Object.values(checks).every(Boolean);
	return e.json(ready ? 200 : 503, { ready, checks });
}

module.exports = { ready };
