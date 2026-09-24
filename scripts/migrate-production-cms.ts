#!/usr/bin/env bun
// One-time additive CMS setup for the existing OVH PocketBase. Never deletes legacy documentation.
import PocketBase from 'pocketbase';
import { setupCms } from './cms-schema';
import {
	emptyMenu,
	newMenuLink,
	publishableMenu,
	validateMenu,
	type MenuConfig,
	type MenuLink
} from '../src/lib/cms';

const target = 'https://main.57-129-98-223.sslip.io';
const args = process.argv.slice(2);
const apply = args[0] === '--apply' && args.length === 2;
if (args.length && !apply)
	throw new Error('Usage: bun scripts/migrate-production-cms.ts [--apply BACKUP_KEY]');
if (new URL(process.env.PROD_POCKETBASE_URL || '').origin !== target)
	throw new Error('PROD_POCKETBASE_URL must match the approved OVH origin.');
if (!process.env.POCKETBASE_ADMIN_EMAIL || !process.env.POCKETBASE_ADMIN_PASSWORD)
	throw new Error('Production superuser credentials are required in the protected environment.');

const pb = new PocketBase(target);
pb.autoCancellation(false);
await pb
	.collection('_superusers')
	.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);

const required = ['cms_categories', 'content', 'content_assets', 'cms_menus', 'cms_menu_drafts'];
const existing = new Set((await pb.collections.getFullList()).map((collection) => collection.name));
if (!existing.has('documentation') || !existing.has('auditLog'))
	throw new Error('Expected legacy documentation and audit collections are missing.');
if (required.some((name) => existing.has(name)))
	throw new Error('CMS migration already started or completed; reconcile before retrying.');
const legacy = await pb.collection('documentation').getFullList({ sort: 'order,title' });
const slugs = legacy.map((doc) => doc.slug);
if (slugs.includes('documentation') || new Set(slugs).size !== slugs.length)
	throw new Error('Legacy guide slugs conflict with the required landing page or each other.');
if (legacy.some((doc) => !doc.title || !doc.slug || typeof doc.content !== 'string'))
	throw new Error('Legacy guide fields must be reviewed before migration.');
console.log(`Preflight: ${legacy.length} legacy guides, all CMS collections absent.`);
if (!apply) process.exit(0);

const backupKey = args[1];
if (!/^cms-before-[\w-]+\.zip$/.test(backupKey)) throw new Error('Invalid backup key.');
const backup = (await pb.backups.getFullList()).find((entry) => entry.key === backupKey);
if (!backup || backup.size <= 0)
	throw new Error('Verified production backup required before writes.');
console.log(`Backup confirmed: ${backupKey} (${backup.size} bytes).`);

const root = await setupCms(pb);
const landing = await pb
	.collection('content')
	.getFirstListItem('layout = "guide" && slug = "documentation"');
const copied = new Map<string, string>();
for (const doc of legacy) {
	const created = await pb.collection('content').create({
		title: doc.title,
		slug: doc.slug,
		kind: 'page',
		layout: 'guide',
		parent: landing.id,
		section: 'publish',
		body: doc.content,
		summary: doc.summary || '',
		order: doc.order,
		isPublished: doc.isPublished
	});
	for (const [field, value] of Object.entries({
		title: doc.title,
		slug: doc.slug,
		body: doc.content,
		summary: doc.summary || '',
		order: doc.order,
		isPublished: doc.isPublished
	}))
		if (created[field] !== value) throw new Error(`Guide readback mismatch: ${doc.slug}/${field}`);
	copied.set(doc.slug, created.id);
}
const unchanged = await pb.collection('documentation').getFullList({ sort: 'order,title' });
if (
	unchanged.length !== legacy.length ||
	unchanged.some((doc, i) => JSON.stringify(doc) !== JSON.stringify(legacy[i]))
)
	throw new Error('Legacy documentation changed during migration; stop and investigate.');
const guides = await pb.collection('content').getFullList({ filter: 'layout = "guide"' });
if (guides.length !== legacy.length + 1) throw new Error('Guide count mismatch after copy.');

const link = (label: string, type: 'route' | 'content', value: string): MenuLink => ({
	...newMenuLink(),
	label,
	target: { type, value }
});
const published = legacy.filter((doc) => doc.isPublished);
const guideLinks = [
	link('Get started', 'content', landing.id),
	...published.map((doc) => link(doc.title, 'content', copied.get(doc.slug)!))
];
const item = (label: string, links: MenuLink[]) => ({
	id: crypto.randomUUID(),
	label,
	visible: true,
	groups: [{ id: crypto.randomUUID(), label, prominent: true, links }]
});
const main: MenuConfig = {
	...emptyMenu(),
	items: [
		item('Explore', [
			link('Collections', 'route', '/collections'),
			link('Editions', 'route', '/editions'),
			link('Try the demo', 'route', '/demo')
		]),
		item('Publish with us', guideLinks),
		item('Resources', [link('All resources', 'route', '/resources')])
	],
	primary: copied.has('submission')
		? link('Start a submission', 'content', copied.get('submission')!)
		: null,
	helpText: 'Looking to publish your own 3D research?',
	helpLink: link('Explore the publication process', 'content', landing.id)
};
if (copied.has('about'))
	main.items.push(item('About', [link('Our mission', 'content', copied.get('about')!)]));
const directory = { content: guides, categories: [], collections: [], editions: [] };
const errors = validateMenu(main, directory);
if (errors.length) throw new Error(`Generated navigation invalid: ${errors.join(' ')}`);
for (const slot of ['main', 'footer'] as const) {
	const config = slot === 'main' ? main : { ...main, primary: null, helpLink: null };
	const publishedMenu = publishableMenu(config, directory);
	if (!publishedMenu.items.length) throw new Error(`${slot} has no publishable items.`);
	for (const name of ['cms_menu_drafts', 'cms_menus']) {
		const record = await pb
			.collection(name)
			.getFirstListItem(pb.filter('slot = {:slot}', { slot }));
		if (record.config?.items?.length) throw new Error(`${name}/${slot} is no longer empty; stop.`);
		await pb
			.collection(name)
			.update(
				record.id,
				{ config: name === 'cms_menus' ? publishedMenu : config },
				{ headers: { 'X-Pure3D-Menu-Version': record.updated } }
			);
	}
}
console.log(
	`CMS ready: ${root.name}, ${legacy.length} guides copied, legacy documentation retained, main/footer menus published.`
);
