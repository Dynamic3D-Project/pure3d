#!/usr/bin/env bun
/** Local-only WordPress draft import. Does not overwrite existing editorial work. */
import PocketBase from 'pocketbase';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { classifyContent } from '../src/lib/content';
import { setupCms } from './cms-schema';
import { cleanContent } from './wordpress-html';

const url = process.env.LOCAL_CONTENT_URL || 'http://127.0.0.1:60021';
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
	throw new Error('Local backend required');
const pb = new PocketBase(url);
pb.autoCancellation(false);
await pb
	.collection('_superusers')
	.authWithPassword(
		process.env.LOCAL_CONTENT_ADMIN_EMAIL || 'admin@admin.local',
		process.env.LOCAL_CONTENT_ADMIN_PASSWORD || '1234567890'
	);
const settings = await pb.settings.getAll();
if (
	settings.s3?.enabled &&
	!['localhost', '127.0.0.1', 'minio'].includes(
		new URL(
			settings.s3.endpoint.includes('://') ? settings.s3.endpoint : `http://${settings.s3.endpoint}`
		).hostname
	)
)
	throw new Error('Refusing remote object storage');
await setupCms(pb);
await mkdir('data/content-import', { recursive: true });
const exportFile = Bun.file('data/content-import/wordpress.json');
if (!(await exportFile.exists())) {
	const result = Bun.spawn(
		[
			'ssh',
			'-o',
			'BatchMode=yes',
			'ubuntu@57.129.98.223',
			'sudo docker exec -i pure3d-archive-wordpress-1 php'
		],
		{ stdin: Bun.file('scripts/export-wordpress-content.php'), stdout: 'pipe', stderr: 'inherit' }
	);
	const text = await new Response(result.stdout).text();
	if ((await result.exited) !== 0) throw new Error('WordPress export failed');
	JSON.parse(text);
	await Bun.write(exportFile, text);
}
interface Source {
	id: number;
	type: string;
	slug: string;
	title: string;
	content: string;
	summary: string;
	url: string;
	date: string;
	modified: string;
	author: string;
	categories: string[];
	cover: string;
	notes: string[];
}
const items: Source[] = await exportFile.json();
if (new Set(items.map((item) => item.id)).size !== items.length)
	throw new Error('Duplicate WordPress IDs in export');
const existing = await pb.collection('content').getFullList();
const slugs = new Map(
	items.map((item) => [
		item.id,
		decodeURIComponent(item.slug)
			.toLowerCase()
			.replace(/[^a-z0-9-]+/g, '-')
			.replace(/^-+|-+$/g, '') || `wordpress-${item.id}`
	])
);
const used = new Set<string>();
for (const item of items) {
	let slug = slugs.get(item.id)!;
	if (used.has(slug)) slug += `-${item.id}`;
	used.add(slug);
	slugs.set(item.id, slug);
}
const oldPaths = new Map(
	items.map((item) => [new URL(item.url).pathname.replace(/\/$/, ''), slugs.get(item.id)!])
);
const assetCache = new Map<string, string>();
const report: Record<string, unknown>[] = [];
async function asset(source: string, recordId: string, notes: string[]) {
	const cacheKey = `${recordId}:${source}`;
	if (assetCache.has(cacheKey)) return assetCache.get(cacheKey)!;
	try {
		const parsed = new URL(source);
		if (
			!parsed.pathname.includes('/wp-content/uploads/') ||
			!['pure3d.eu', 'www.pure3d.eu', 'legacy.57-129-98-223.sslip.io'].includes(parsed.hostname)
		)
			return source;
		const remote = `http://legacy.57-129-98-223.sslip.io${parsed.pathname}`;
		const response = await fetch(remote, { signal: AbortSignal.timeout(30000) });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		let bytes = Buffer.from(await response.arrayBuffer());
		if (bytes.length > 30000000) throw new Error('File exceeds 30MB');
		let name = decodeURIComponent(parsed.pathname.split('/').pop()!);
		let type = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
		if (/^image\/(jpeg|png|webp|avif)$/.test(type)) {
			bytes = await sharp(bytes)
				.rotate()
				.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
				.avif({ quality: 60 })
				.toBuffer();
			name = name.replace(/\.[^.]+$/, '.avif');
			type = 'image/avif';
		}
		const form = new FormData();
		form.set('content', recordId);
		form.set('sourceUrl', source);
		form.set('file', new Blob([bytes], { type }), name);
		const uploaded = await pb.collection('content_assets').create(form);
		const target = pb.files.getURL(uploaded, uploaded.file);
		assetCache.set(cacheKey, target);
		return target;
	} catch (e) {
		notes.push(`Media needs review: ${source} (${String(e)})`);
		return source.replace(/^https?:\/\/pure3d.eu/, 'http://legacy.57-129-98-223.sslip.io');
	}
}
for (const item of items) {
	const previous = existing.find((row) => row.sourceId === item.id);
	if (previous) {
		report.push({
			id: item.id,
			slug: previous.slug,
			title: previous.title,
			notes: previous.importNotes,
			status: 'already imported'
		});
		continue;
	}
	const slug = slugs.get(item.id)!;
	const notes = [...item.notes];
	if (/3d-registry/.test(slug))
		notes.push('Registry entry: review against editions/collections before publication.');
	if (
		/current-editions|forthcoming-editions|^blog$|blog-posts|^news$|^publications$|^presentations$|^about$/.test(
			slug
		)
	)
		notes.push('Review overlap with new navigation/hub; retain source content as draft.');
	if (!item.content.trim()) notes.push('Empty WordPress body; editorial review needed.');
	const classification = classifyContent(slug, item.type, item.categories);
	const categoryIds: string[] = [];
	if (item.type !== 'page')
		for (const label of new Set(item.categories.length ? item.categories : [classification.kind])) {
			const categorySlug = label
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');
			let category = (
				await pb
					.collection('cms_categories')
					.getFullList({ filter: pb.filter('slug = {:slug}', { slug: categorySlug }) })
			)[0];
			if (!category)
				category = await pb
					.collection('cms_categories')
					.create({ name: label, slug: categorySlug });
			categoryIds.push(category.id);
		}
	if (new URL(item.url).pathname.includes('/about/')) classification.section = 'about';
	const row = await pb
		.collection('content')
		.create({
			title: item.title,
			slug,
			...classification,
			kind: item.type === 'page' ? 'page' : 'post',
			layout: item.type === 'page' ? 'standard' : 'article',
			categoryIds,
			sourceId: item.id,
			sourceUrl: item.url,
			sourceModified: item.modified,
			author: item.author,
			publishedAt: item.date ? item.date.replace(' ', 'T') + 'Z' : '',
			categories: item.categories,
			isPublished: false
		})
		.catch((e) => {
			console.error(item.title, JSON.stringify(e.response));
			throw e;
		});
	let body = cleanContent(item.content);
	if (item.slug === 'contact') {
		body =
			'<h2>Get in touch</h2><p>Contact the PURE3D team at <a href="mailto:pure3d-fasos@maastrichtuniversity.nl">pure3d-fasos@maastrichtuniversity.nl</a>.</p>';
		notes.push(
			'WordPress contact form replaced with the contact email published on the submission page. Review before publishing.'
		);
	}
	if (body.includes('Open embedded resource'))
		notes.push(
			'Unsupported historical embeds are preserved as links; review their external destinations.'
		);
	const urls = [
		...new Set(
			[...body.matchAll(/(?:src|href)="([^"]+)"/g)]
				.map((m) => m[1])
				.filter((link) => link.includes('/wp-content/uploads/'))
		)
	];
	for (const media of urls) body = body.split(media).join(await asset(media, row.id, notes));
	body = body.replace(/href="(https?:\/\/[^" ]+)"/g, (all, link) => {
		try {
			const u = new URL(link);
			if (!['pure3d.eu', 'www.pure3d.eu', 'legacy.57-129-98-223.sslip.io'].includes(u.hostname))
				return all;
			const target = oldPaths.get(u.pathname.replace(/\/$/, ''));
			return target ? `href="/resources/${target}${u.hash}"` : all;
		} catch {
			return all;
		}
	});
	const coverUrl = item.cover ? await asset(item.cover, row.id, notes) : '';
	const summary =
		item.summary ||
		cleanContent(body)
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 260);
	await pb
		.collection('content')
		.update(row.id, { body, summary, coverUrl, importNotes: notes.join('\n') });
	report.push({ id: item.id, slug, title: item.title, media: urls.length, notes });
	console.log(`Draft ${report.length}/${items.length}: ${item.title}`);
	await Bun.write('data/content-import/report.json', JSON.stringify(report, null, 2));
}
console.log(
	`Imported/reused ${items.length} WordPress entries as local drafts. ${assetCache.size} media files copied. See data/content-import/report.json.`
);
