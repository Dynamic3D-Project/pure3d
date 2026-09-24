// Synthetic UI evidence only. Loaded after the existing isolated integration fixture.
routerAdd(
	'POST',
	'/_test/seed-ui',
	(e) => {
		// Only identity setup is synthetic; activity records must come from real application operations.
		for (const [id, email, role] of [
			['admin0000000000', 'admin@example.test', 'admin'],
			['author000000000', 'author@example.test', 'user'],
			['other0000000000', 'other@example.test', 'user'],
			['pending00000000', 'pending@example.test', 'user']
		]) {
			const user = new Record(e.app.findCollectionByNameOrId('users'), { id, email, role });
			user.setPassword('local-test-password-only');
			if (id === 'author000000000') {
				user.set('orcid', 'https://orcid.org/0000-0002-1825-0097');
				user.set('orcidVerifiedAt', new Date().toISOString());
			}
			e.app.saveWithContext(new Context(null, 'pure3d.orcid.proof', true), user);
			if (id === 'author000000000')
				e.app.save(
					new Record(e.app.findCollectionByNameOrId('_externalAuths'), {
						collectionRef: user.collection().id,
						recordRef: user.id,
						provider: 'oidc',
						providerId: '0000-0002-1825-0097'
					})
				);
		}
		const names = {
			admin0000000000: 'Synthetic Administrator',
			author000000000: 'Synthetic Researcher',
			other0000000000: 'Synthetic Collaborator',
			pending00000000: 'Synthetic Pending Researcher'
		};
		for (const id in names) {
			const user = e.app.findRecordById('users', id);
			user.set('nickname', names[id]);
			if (id === 'author000000000') {
				user.set('affiliation', 'Example Research Institute');
				user.set('titleRole', 'Research fellow');
				user.set(
					'bio',
					'Synthetic public biography for local UI verification. No live ORCID data.'
				);
			}
			e.app.saveWithContext(new Context(null, 'pure3d.orcid.proof', true), user);
		}
		const credits = [
			{
				type: 'person',
				name: 'Synthetic Researcher',
				userId: 'author000000000',
				orcid: 'https://orcid.org/0000-0002-1825-0097',
				role: 'creator',
				provenance: 'oauth'
			},
			{
				type: 'org',
				name: 'Example Heritage Laboratory',
				orcid: null,
				role: 'creator',
				provenance: 'manual'
			},
			{
				type: 'person',
				name: 'Synthetic Contributor',
				orcid: null,
				role: 'contributor',
				contributionRole: '3D documentation',
				provenance: 'manual'
			}
		];
		const collection = new Record(e.app.findCollectionByNameOrId('collections'), {
			id: 'uicollection001',
			title: 'Synthetic Heritage Collection',
			dcTitle: 'Synthetic Heritage Collection',
			description: 'Synthetic local fixture demonstrating ordered research credits.',
			dcDescription: 'Synthetic local fixture demonstrating ordered research credits.',
			isVisible: true,
			credits,
			pubNum: 99001
		});
		e.app.save(collection);
		for (const [id, title, status] of [
			['uiedition000001', 'Synthetic Monument Edition', 'published'],
			['uiedition000002', 'Synthetic Working Edition', 'draft'],
			['uiedition000003', 'Synthetic Monument Revision', 'published']
		]) {
			const edition = new Record(e.app.findCollectionByNameOrId('editions'), {
				id,
				title,
				dcTitle: title,
				collection: collection.id,
				status,
				isPublished: status === 'published',
				credits: status === 'draft' ? credits.slice(1) : credits,
				dcAbstract: 'Synthetic research edition for browser verification only.',
				dcDescription: 'Locally seeded example, not a live ORCID record or production publication.',
				dcRightsLicense: 'CC BY 4.0',
				dcDate: '2026',
				pubNum: Number(id.slice(-1))
			});
			e.app.save(edition);
		}
		return e.json(200, { synthetic: true });
	},
	$apis.requireSuperuserAuth()
);
