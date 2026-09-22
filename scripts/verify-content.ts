#!/usr/bin/env bun
import assert from 'node:assert/strict';
import PocketBase, { ClientResponseError } from 'pocketbase';

// Intentionally local: these checks create and remove disposable records.
const root = new PocketBase('http://127.0.0.1:60021');
await root
	.collection('_superusers')
	.authWithPassword(
		process.env.LOCAL_CONTENT_ADMIN_EMAIL || 'admin@admin.local',
		process.env.LOCAL_CONTENT_ADMIN_PASSWORD || '1234567890'
	);
const ids: string[] = [];
let recordId = '';
let parentId = '',
	mediaId = '',
	categoryId = '';
let menuBackup: import('pocketbase').RecordModel | null = null;
async function denied(action: () => Promise<unknown>) {
	let status = 0;
	try {
		await action();
	} catch (e) {
		if (!(e instanceof ClientResponseError)) throw e;
		status = e.status;
	}
	assert.ok([400, 403, 404].includes(status), `Expected denial, received ${status}`);
}
try {
	const password = crypto.randomUUID() + 'Aa1!';
	const tag = Date.now();
	const clients: Record<string, PocketBase> = {};
	for (const role of ['admin', 'user']) {
		const email = `content-${role}-${tag}@pure3d.test`;
		const user = await root
			.collection('users')
			.create({ email, password, passwordConfirm: password, role, verified: true });
		ids.push(user.id);
		const client = new PocketBase(root.baseURL);
		await client.collection('users').authWithPassword(email, password);
		clients[role] = client;
	}
	const anonymous = new PocketBase(root.baseURL);
	const payload = {
		title: 'Content verification',
		slug: `content-verification-${tag}`,
		kind: 'post',
		layout: 'article',
		section: 'resources',
		body: '<h2>Test</h2><p>Saved body</p>',
		isPublished: false
	};
	await denied(() => anonymous.collection('content').create(payload));
	await denied(() => clients.user.collection('content').create(payload));
	const record = await clients.admin.collection('content').create(payload);
	recordId = record.id;
	await denied(() =>
		clients.admin.collection('content').create({ ...payload, kind: 'page', layout: 'standard' })
	);
	await denied(() => anonymous.collection('content').getOne(recordId));
	const category = await clients.admin
		.collection('cms_categories')
		.create({ name: 'Verification category', slug: `verification-${tag}` });
	categoryId = category.id;
	await clients.admin.collection('content').update(recordId, { categoryIds: [categoryId] });
	assert.deepEqual((await clients.admin.collection('content').getOne(recordId)).categoryIds, [
		categoryId
	]);
	await denied(() =>
		clients.user.collection('cms_categories').update(categoryId, { name: 'Not allowed' })
	);
	const parent = await clients.admin.collection('content').create({
		title: 'Verification parent',
		slug: `verification-parent-${tag}`,
		kind: 'page',
		layout: 'standard',
		isPublished: false
	});
	parentId = parent.id;
	await clients.admin
		.collection('content')
		.update(recordId, { kind: 'page', layout: 'standard', parent: parentId });
	await denied(() => clients.admin.collection('content').update(parentId, { parent: recordId }));
	await denied(() => clients.admin.collection('content').update(recordId, { isPublished: true }));
	await clients.admin.collection('content').update(parentId, { isPublished: true });
	await denied(() => clients.user.collection('content').getOne(recordId));
	await denied(() => clients.user.collection('content').update(recordId, { isPublished: true }));
	await clients.admin.collection('content').update(recordId, { isPublished: true });
	await denied(() => clients.admin.collection('content').update(parentId, { isPublished: false }));
	await denied(() => clients.admin.collection('content').delete(parentId));
	assert.equal((await anonymous.collection('content').getOne(recordId)).body, payload.body);
	await denied(() => anonymous.collection('content').update(recordId, { title: 'Bad update' }));
	await clients.admin.collection('content').update(recordId, { isPublished: false });
	await denied(() => anonymous.collection('content').getOne(recordId));
	menuBackup = await root.collection('cms_menu_drafts').getFirstListItem('slot = "main"');
	const live = await anonymous.collection('cms_menus').getFirstListItem('slot = "main"');
	await denied(() => anonymous.collection('cms_menu_drafts').getOne(menuBackup!.id));
	await denied(() => clients.user.collection('cms_menus').update(live.id, { config: live.config }));
	menuBackup = await clients.admin
		.collection('cms_menu_drafts')
		.update(
			menuBackup.id,
			{ config: { ...menuBackup.config, helpText: 'Private draft verification' } },
			{ headers: { 'X-Pure3D-Menu-Version': menuBackup.updated } }
		);
	assert.deepEqual((await anonymous.collection('cms_menus').getOne(live.id)).config, live.config);
	await denied(() =>
		clients.admin.collection('cms_menu_drafts').update(
			menuBackup!.id,
			{
				config: {
					items: [
						{
							id: 'unsafe',
							label: 'Unsafe',
							groups: [],
							direct: {
								id: 'link',
								label: 'Bad',
								target: { type: 'external', value: 'javascript:alert(1)' }
							}
						}
					]
				}
			},
			{ headers: { 'X-Pure3D-Menu-Version': menuBackup!.updated } }
		)
	);
	const form = new FormData();
	form.set(
		'file',
		new Blob(
			[
				Buffer.from(
					'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZYsAAAAASUVORK5CYII=',
					'base64'
				)
			],
			{ type: 'image/png' }
		),
		'verification.png'
	);
	const asset = await clients.admin.collection('content_assets').create(form);
	mediaId = asset.id;
	await clients.admin
		.collection('content')
		.update(recordId, { body: `<p><img src="${root.files.getURL(asset, asset.file)}"></p>` });
	await denied(() => clients.admin.collection('content_assets').delete(mediaId));
	assert.equal(
		(await root.collection('content').getFullList({ filter: 'layout = "guide"' })).length,
		9
	);
	const all = await root.collection('content').getFullList({ filter: 'sourceId > 0' });
	assert.equal(all.length, 119);
	assert.ok(all.every((r) => !r.isPublished));
	console.log(
		'PASS: CMS permissions, draft privacy, page hierarchy, categories, menu draft isolation, unsafe URL rejection, media protection, 119 WordPress drafts and 9 guides.'
	);
} finally {
	if (recordId) await root.collection('content').delete(recordId);
	if (parentId) await root.collection('content').delete(parentId);
	if (mediaId) await root.collection('content_assets').delete(mediaId);
	if (categoryId) await root.collection('cms_categories').delete(categoryId);
	if (menuBackup)
		await root
			.collection('cms_menu_drafts')
			.update(
				menuBackup.id,
				{ config: menuBackup.config },
				{ headers: { 'X-Pure3D-Menu-Version': menuBackup.updated } }
			);
	for (const id of ids) await root.collection('users').delete(id);
}
