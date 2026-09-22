#!/usr/bin/env bun
import PocketBase, { ClientResponseError } from 'pocketbase';
import { mkdir } from 'node:fs/promises';
import { setupCms } from './cms-schema';
import { navigation } from './navigation-seed';
import {
	emptyMenu,
	newMenuLink,
	publishableMenu,
	type MenuConfig,
	type MenuTarget
} from '../src/lib/cms';

const pb = new PocketBase('http://127.0.0.1:60021');
pb.autoCancellation(false);
await pb
	.collection('_superusers')
	.authWithPassword(
		process.env.LOCAL_CONTENT_ADMIN_EMAIL || 'admin@admin.local',
		process.env.LOCAL_CONTENT_ADMIN_PASSWORD || '1234567890'
	);
await mkdir('data/cms-backup', { recursive: true });
const before: Record<string, unknown> = {};
for (const name of [
	'content',
	'content_assets',
	'documentation',
	'cms_categories',
	'cms_menus',
	'cms_menu_drafts'
]) {
	try {
		before[name] = await pb.collection(name).getFullList();
	} catch (e) {
		if (!(e instanceof ClientResponseError) || e.status !== 404) throw e;
	}
}
await Bun.write(`data/cms-backup/before-${Date.now()}.json`, JSON.stringify(before, null, 2));
await setupCms(pb);
const names: Record<string, string> = {
	news: 'News',
	article: 'Articles & stories',
	publication: 'Publications',
	presentation: 'Presentations & workshops',
	edition: 'Edition stories',
	outputs: 'Research outputs'
};
let categories = await pb.collection('cms_categories').getFullList();
for (const [slug, name] of Object.entries(names)) {
	if (!categories.some((c) => c.slug === slug))
		await pb.collection('cms_categories').create({ name, slug });
}
categories = await pb.collection('cms_categories').getFullList();
const rows = await pb.collection('content').getFullList();
for (const row of rows) {
	if (row.layout) continue;
	const labels = (row.categories || []) as string[];
	const slugs = new Set<string>(row.kind === 'page' ? [] : [row.kind]);
	for (const label of labels) {
		const key = /publications/i.test(label)
			? 'publication'
			: /presentations/i.test(label)
				? 'presentation'
				: /articles|blog/i.test(label)
					? 'article'
					: /forthcoming/i.test(label)
						? 'edition'
						: /^news$/i.test(label)
							? 'news'
							: /^outputs$/i.test(label)
								? 'outputs'
								: '';
		if (key) slugs.add(key);
	}
	await pb.collection('content').update(row.id, {
		kind: row.kind === 'page' ? 'page' : 'post',
		layout: row.kind === 'page' ? 'standard' : 'article',
		categoryIds: categories.filter((c) => slugs.has(c.slug)).map((c) => c.id)
	});
}
const root = (
	await pb
		.collection('content')
		.getFullList({ filter: 'layout = "guide" && slug = "documentation"' })
)[0];
if (!root) throw new Error('The documentation landing page is missing.');
const docs = (before.documentation || []) as import('pocketbase').RecordModel[];
for (const doc of docs) {
	const exists = await pb
		.collection('content')
		.getFullList({ filter: pb.filter('layout = "guide" && slug = {:slug}', { slug: doc.slug }) });
	if (!exists.length)
		await pb.collection('content').create({
			title: doc.title,
			slug: doc.slug,
			kind: 'page',
			layout: 'guide',
			section: 'publish',
			parent: root.id,
			order: doc.order,
			body: doc.content,
			summary: doc.summary,
			isPublished: doc.isPublished,
			created: doc.created,
			updated: doc.updated
		});
}
const all = await pb.collection('content').getFullList();
await pb.collection('content').update(root.id, { documentationSeeded: true });
function target(href: string): MenuTarget {
	if (href === '/resources/about') href = '/documentation/about';
	if (href.startsWith('/resources?kind=')) {
		const slug = href.split('=')[1];
		return { type: 'category', value: categories.find((c) => c.slug === slug)!.id };
	}
	if (href.startsWith('/resources/')) {
		const slug = href.split('/').pop()!;
		return { type: 'content', value: all.find((c) => c.slug === slug && c.layout !== 'guide')!.id };
	}
	if (href.startsWith('/documentation')) {
		const slug = href.split('/')[2] || 'documentation';
		return { type: 'content', value: all.find((c) => c.slug === slug && c.layout === 'guide')!.id };
	}
	return { type: 'route', value: href };
}
const main: MenuConfig = {
	...emptyMenu(),
	items: navigation.map((n) => ({
		id: crypto.randomUUID(),
		label: n.label === 'Publish' ? 'Publish with us' : n.label,
		visible: true,
		groups: n.groups.map((g) => ({
			id: crypto.randomUUID(),
			label: g.label,
			prominent: 'prominent' in g && !!g.prominent,
			links: g.links
				.filter((l) => !(n.label === 'Resources' && l.href === '/documentation'))
				.map((l) => ({ ...newMenuLink(), label: l.label, target: target(l.href) }))
		}))
	}))
};
const publish = main.items.find((n) => n.label === 'Publish with us')!;
publish.groups.unshift({
	id: crypto.randomUUID(),
	label: 'Documentation',
	prominent: true,
	links: [
		{ ...newMenuLink(), label: 'Get started', target: { type: 'content', value: root.id } },
		...all
			.filter((c) => c.layout === 'guide' && c.id !== root.id)
			.sort((a, b) => a.order - b.order)
			.map((c) => ({ ...newMenuLink(), label: c.title, target: { type: 'content', value: c.id } }))
	]
});
publish.groups = publish.groups.filter((g) => g.label !== 'Help along the way');
main.primary = {
	...newMenuLink(),
	label: 'Start a submission',
	target: target('/documentation/submission')
};
main.helpText = 'Looking to publish your own 3D research?';
main.helpLink = {
	...newMenuLink(),
	label: 'Explore the publication process ↗',
	target: target('/documentation')
};
main.items.find((n) => n.label === 'Resources')!.featured = {
	kicker: 'From the research library',
	title: 'Making 3D Scholarly Editions FAIR',
	description: 'Publication · March 2025',
	artwork: 'F A I R',
	link: {
		...newMenuLink(),
		label: 'Read the publication ↗',
		target: target('/resources/making-3d-scholarly-editions-fair')
	}
};
const footer: MenuConfig = {
	...emptyMenu(),
	helpText: 'PURE3D · 3D scholarship, cultural heritage and research.',
	items: main.items.map((n) => ({
		...structuredClone(n),
		id: crypto.randomUUID(),
		featured: null,
		groups: n.groups.map((g) => ({
			...structuredClone(g),
			id: crypto.randomUUID(),
			prominent: false,
			links: g.links.slice(0, 4).map((l) => ({ ...l, id: crypto.randomUUID() }))
		}))
	}))
};
for (const [slot, config] of [
	['main', main],
	['footer', footer]
] as const)
	for (const name of ['cms_menus', 'cms_menu_drafts']) {
		if (
			(before[name] as import('pocketbase').RecordModel[] | undefined)?.some(
				(row) => row.slot === slot
			)
		)
			continue;
		const current = (
			await pb.collection(name).getFullList({ filter: pb.filter('slot = {:slot}', { slot }) })
		)[0];
		const data = {
			slot,
			config:
				name === 'cms_menus'
					? publishableMenu(config, { content: all, categories, collections: [], editions: [] })
					: config
		};
		if (current)
			await pb
				.collection(name)
				.update(current.id, data, { headers: { 'X-Pure3D-Menu-Version': current.updated } });
		else await pb.collection(name).create(data);
	}
if (docs.length) {
	for (const doc of docs) {
		const moved = all.find((c) => c.layout === 'guide' && c.slug === doc.slug);
		if (!moved || moved.body !== doc.content || moved.isPublished !== doc.isPublished)
			throw new Error(`Documentation integrity failed: ${doc.slug}`);
	}
	await pb.collections.delete('documentation');
}
const schema = await pb.collections.getOne('content');
await pb.collections.update(schema.id, {
	fields: schema.fields.map((f: { name: string }) =>
		f.name === 'kind' ? { ...f, values: ['page', 'post'] } : f
	)
});
console.log(
	JSON.stringify(
		{
			content: all.length,
			documentation: docs.length,
			categories: categories.length,
			menus: ['main', 'footer'],
			backup: 'data/cms-backup'
		},
		null,
		2
	)
);
