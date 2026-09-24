#!/usr/bin/env bun
/**
 * One-off, additive local CMS -> production CMS copier.
 *
 * Read-only is the default. Applying requires a fresh, already-created PocketBase backup and a
 * private, durable journal outside this checkout. The journal deliberately contains identifiers
 * and hashes only, never CMS text, credentials, or PocketBase error responses.
 */
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import PocketBase, { type RecordModel } from 'pocketbase';
import {
	publishableMenu,
	targetPath,
	validateMenu,
	type MenuConfig,
	type MenuDirectory,
	type MenuTarget
} from '../src/lib/cms';

export const LOCAL_ORIGIN = 'http://127.0.0.1:60021';
export const TARGET_ORIGIN = 'https://main.57-129-98-223.sslip.io';
const MAX_FILE_BYTES = 30_000_000;
const FRESH_BACKUP_MS = 24 * 60 * 60 * 1000;
const MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/avif',
	'image/gif',
	'application/pdf',
	'audio/mpeg',
	'video/mp4'
]);
type CmsRecord = RecordModel & Record<string, unknown>;
type AssetUrlMap = Map<string, string>;
type JournalEntry = Record<string, unknown>;
interface JournalState {
	header?: JournalEntry;
	entries: JournalEntry[];
}
interface Mapping {
	categories: Map<string, string>;
	content: Map<string, string>;
	assets: Map<string, string>;
}
export interface ReviewedSeedManifest {
	version: 1;
	target: string;
	menus: {
		collection: 'cms_menus' | 'cms_menu_drafts';
		id: string;
		slot: 'main' | 'footer';
		configHash: string;
	}[];
}

function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === 'object')
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, canonical(child)])
		);
	return value;
}
const digest = (value: unknown) =>
	createHash('sha256')
		.update(typeof value === 'string' ? value : JSON.stringify(canonical(value)))
		.digest('hex');
export const menuFingerprint = (config: unknown) => digest(config);
const origin = (value: string) => new URL(value).origin;
const contentKey = (row: CmsRecord) =>
	`${row.layout === 'guide' ? 'guide' : 'content'}:${row.slug}`;
const stableGuide = (row: CmsRecord) =>
	Object.fromEntries(
		['title', 'slug', 'kind', 'layout', 'body', 'summary', 'order', 'section', 'isPublished'].map(
			(key) => [key, row[key]]
		)
	);

export function mapUnique<T extends Record<string, unknown>>(
	rows: T[],
	key: (row: T) => string,
	label: string
): Map<string, T> {
	const result = new Map<string, T>();
	for (const row of rows) {
		const value = key(row);
		if (!value || result.has(value)) throw new Error(`Ambiguous ${label} mapping.`);
		result.set(value, row);
	}
	return result;
}

export function assertTargetSeed(
	target: {
		guides: CmsRecord[];
		content: CmsRecord[];
		categories: CmsRecord[];
		assets: CmsRecord[];
		menus: CmsRecord[];
		drafts: CmsRecord[];
	},
	journal: JournalState = { entries: [] },
	manifest?: ReviewedSeedManifest
) {
	const mapped = new Set(
		journal.entries
			.filter((entry) => entry.event === 'mapping' && typeof entry.targetId === 'string')
			.map((entry) => `${entry.collection}:${entry.targetId}`)
	);
	const unexpected = (name: string, rows: CmsRecord[]) =>
		rows.filter((row) => !mapped.has(`${name}:${row.id}`));
	if (unexpected('cms_categories', target.categories).length)
		throw new Error('Production has unexpected CMS categories; refusing to overwrite.');
	if (unexpected('content_assets', target.assets).length)
		throw new Error('Production has unexpected CMS media; refusing to overwrite.');
	if (
		unexpected(
			'content',
			target.content.filter((row) => row.layout !== 'guide')
		).length
	)
		throw new Error('Production has unexpected non-guide CMS content; refusing to overwrite.');
	if (target.guides.some((row) => row.layout !== 'guide'))
		throw new Error('Production guide inventory is invalid.');
	if (target.menus.length !== 2 || target.drafts.length !== 2)
		throw new Error('Production menus must contain exactly the seeded main and footer records.');
	if (
		manifest &&
		(manifest.version !== 1 || manifest.target !== TARGET_ORIGIN || manifest.menus.length !== 4)
	)
		throw new Error('Reviewed seed manifest is invalid.');
	for (const [collection, rows] of [
		['cms_menus', target.menus],
		['cms_menu_drafts', target.drafts]
	] as const) {
		if (
			new Set(rows.map((row) => row.slot)).size !== 2 ||
			rows.some((row) => !['main', 'footer'].includes(row.slot))
		)
			throw new Error('Production menu slots are invalid.');
		for (const row of rows) {
			const mapping = journal.entries.find(
				(entry) =>
					entry.event === 'mapping' && entry.collection === collection && entry.targetId === row.id
			);
			if (mapping) {
				if (
					typeof mapping.configHash !== 'string' ||
					mapping.configHash !== menuFingerprint(row.config)
				)
					throw new Error('Production menu differs from its journaled write; refusing replay.');
				continue;
			}
			const expected = manifest?.menus.find(
				(entry) => entry.collection === collection && entry.id === row.id && entry.slot === row.slot
			);
			if (!expected || expected.configHash !== menuFingerprint(row.config))
				throw new Error('Production seeded menu requires an exact reviewed seed manifest.');
		}
	}
}

/** Replace only exact, known local PocketBase file URLs; leave external provenance and project paths alone. */
export function rewriteLocalAssetUrls(value: string, urls: AssetUrlMap): string {
	let result = value;
	for (const [from, to] of urls) result = result.split(from).join(to);
	if (/(?:https?:)?\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|\b)/i.test(result))
		throw new Error('Content still contains a local URL that is not a known content asset.');
	return result;
}

export function assertKnownLocalAssetReferences(
	values: string[],
	urls: AssetUrlMap,
	expected = 410
) {
	let references = 0;
	for (const value of values) {
		const matches =
			value.match(/(?:https?:)?\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/[^\s"'<>)]*/gi) || [];
		references += matches.length;
		rewriteLocalAssetUrls(value, urls);
	}
	if (references !== expected)
		throw new Error(
			`Local media reference inventory differs from the approved ${expected} references.`
		);
	return references;
}

function walkLinks(value: unknown, visit: (link: { target: MenuTarget }) => void) {
	if (!value || typeof value !== 'object') return;
	if (
		Object.hasOwn(value, 'target') &&
		(value as { target?: unknown }).target &&
		typeof (value as { target: unknown }).target === 'object'
	)
		visit(value as { target: MenuTarget });
	for (const child of Object.values(value as Record<string, unknown>)) walkLinks(child, visit);
}

export function remapMenu(
	config: MenuConfig,
	mapping: Pick<Mapping, 'categories' | 'content'>
): MenuConfig {
	const next = structuredClone(config);
	walkLinks(next, (link) => {
		if (link.target.type === 'content') {
			const target = mapping.content.get(link.target.value);
			if (!target) throw new Error('Menu has an unresolved content destination.');
			link.target.value = target;
		}
		if (link.target.type === 'category') {
			const target = mapping.categories.get(link.target.value);
			if (!target) throw new Error('Menu has an unresolved category destination.');
			link.target.value = target;
		}
	});
	return next;
}

export function assertMenuTargets(config: MenuConfig, directory: MenuDirectory, live: boolean) {
	const errors = validateMenu(config, directory);
	if (errors.length) throw new Error(`Menu is invalid after mapping: ${errors.join(' ')}`);
	walkLinks(config, (link) => {
		const path = targetPath(link.target, directory);
		if (!path) throw new Error('Menu has an unresolved destination.');
		if (!live || !['content', 'collection', 'edition'].includes(link.target.type)) return;
		const records =
			link.target.type === 'content'
				? directory.content
				: link.target.type === 'collection'
					? directory.collections
					: directory.editions;
		const row = records.find((item) => item.id === link.target.value) as CmsRecord | undefined;
		if (!row || (link.target.type === 'collection' ? !row.isVisible : !row.isPublished))
			throw new Error('Live menu has a hidden destination.');
	});
}

export function publicationState(row: Record<string, unknown>): boolean {
	// Posts were specifically approved for publication even when currently marked draft.
	return !!row.isPublished || row.kind === 'post';
}

function readJournal(path: string): JournalState {
	if (!existsSync(path)) return { entries: [] };
	const entries = readFileSync(path, 'utf8')
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as JournalEntry);
	const header = entries.find((entry) => entry.event === 'run');
	return { header, entries };
}

function hasJournalEvent(journal: JournalState, event: string) {
	return journal.entries.some((entry) => entry.event === event);
}

function readReviewedSeedManifest(path: string | undefined): ReviewedSeedManifest | undefined {
	if (!path) return undefined;
	if (!isAbsolute(path))
		throw new Error('--seed-manifest must be an absolute reviewed manifest path.');
	return JSON.parse(readFileSync(path, 'utf8')) as ReviewedSeedManifest;
}

function journalWriter(path: string, state: JournalState) {
	let fd: number | undefined;
	return {
		open() {
			fd = openSync(path, existsSync(path) ? 'a' : 'wx', 0o600);
		},
		write(entry: JournalEntry) {
			if (fd === undefined) throw new Error('Private journal is not open.');
			writeFileSync(fd, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
			fsyncSync(fd);
			state.entries.push(entry);
		},
		close() {
			if (fd !== undefined) closeSync(fd);
		}
	};
}

function completedMappings(journal: JournalState): Mapping {
	const result: Mapping = { categories: new Map(), content: new Map(), assets: new Map() };
	for (const entry of journal.entries) {
		if (
			entry.event !== 'mapping' ||
			typeof entry.sourceId !== 'string' ||
			typeof entry.targetId !== 'string'
		)
			continue;
		if (entry.collection === 'cms_categories')
			result.categories.set(entry.sourceId, entry.targetId);
		if (entry.collection === 'content') result.content.set(entry.sourceId, entry.targetId);
		if (entry.collection === 'content_assets') result.assets.set(entry.sourceId, entry.targetId);
	}
	return result;
}

function assertNoUnsettledIntents(journal: JournalState) {
	const intents = new Set(
		journal.entries
			.filter((entry) => entry.event === 'write-intent')
			.map((entry) => `${entry.collection}:${entry.sourceId}`)
	);
	for (const entry of journal.entries)
		if (entry.event === 'mapping') intents.delete(`${entry.collection}:${entry.sourceId}`);
	const publicationIntents = new Set(
		journal.entries
			.filter((entry) => entry.event === 'publication-intent')
			.map((entry) => String(entry.sourceId))
	);
	for (const entry of journal.entries)
		if (entry.event === 'publication-committed') publicationIntents.delete(String(entry.sourceId));
	if (intents.size)
		throw new Error(
			'A previous write has no durable readback mapping; inspect the private journal before retrying.'
		);
	if (publicationIntents.size)
		throw new Error(
			'A previous publication has no durable readback checkpoint; refusing to retry.'
		);
}

function exactOrigin(value: string | undefined, expected: string, name: string) {
	if (origin(value || expected) !== expected)
		throw new Error(`${name} must match the approved origin.`);
}

async function authenticate(
	pb: PocketBase,
	email: string | undefined,
	password: string | undefined
) {
	if (!email || !password)
		throw new Error('Protected PocketBase superuser credentials are required.');
	await pb.collection('_superusers').authWithPassword(email, password);
}

async function list(pb: PocketBase, name: string) {
	return (await pb.collection(name).getFullList()) as CmsRecord[];
}

function fileUrls(pb: PocketBase, asset: CmsRecord): string[] {
	const filename = asset.file;
	if (typeof filename !== 'string' || !filename) throw new Error('Content asset has no file name.');
	const canonical = pb.files.getURL(asset, filename);
	return [...new Set([canonical, decodeURI(canonical)])];
}

function sourceFileUrls(source: PocketBase, asset: CmsRecord): string[] {
	const urls = fileUrls(source, asset);
	const path = new URL(urls[0]).pathname;
	return [
		...new Set([
			...urls,
			`${LOCAL_ORIGIN}${path}`,
			`http://localhost:60020${path}`,
			`https://localhost:60020${path}`,
			decodeURI(`${LOCAL_ORIGIN}${path}`),
			decodeURI(`http://localhost:60020${path}`),
			decodeURI(`https://localhost:60020${path}`)
		])
	];
}

async function sha256(response: Response) {
	const length = Number(response.headers.get('content-length') || 0);
	if (length > MAX_FILE_BYTES) throw new Error('Content asset exceeds the 30 MB limit.');
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.byteLength > MAX_FILE_BYTES) throw new Error('Content asset exceeds the 30 MB limit.');
	return { bytes, hash: createHash('sha256').update(bytes).digest('hex') };
}

export function allowedAssetMime(value: string | null): value is string {
	return !!value && MIME_TYPES.has(value.toLowerCase());
}

async function copyAsset(
	source: PocketBase,
	target: PocketBase,
	asset: CmsRecord,
	targetContentId: string | undefined
) {
	const sourceUrl = fileUrls(source, asset)[0];
	const response = await fetch(sourceUrl, { headers: { Authorization: source.authStore.token } });
	if (!response.ok)
		throw new Error(`Could not download local content asset (HTTP ${response.status}).`);
	const mimeType = response.headers.get('content-type')?.split(';', 1)[0].toLowerCase() || null;
	if (!allowedAssetMime(mimeType))
		throw new Error('Content asset MIME type is not allowed by the CMS schema.');
	const downloaded = await sha256(response);
	const form = new FormData();
	form.set('file', new Blob([downloaded.bytes], { type: mimeType }), asset.file as string);
	if (targetContentId) form.set('content', targetContentId);
	for (const field of ['sourceUrl', 'caption', 'alt'])
		if (asset[field]) form.set(field, asset[field]);
	const created = (await target.collection('content_assets').create(form)) as CmsRecord;
	const uploadedUrl = fileUrls(target, created)[0];
	const verify = await fetch(uploadedUrl, { headers: { Authorization: target.authStore.token } });
	if (!verify.ok)
		throw new Error(`Could not verify uploaded content asset (HTTP ${verify.status}).`);
	const uploaded = await sha256(verify);
	if (downloaded.hash !== uploaded.hash)
		throw new Error('Uploaded content asset checksum differs from local source.');
	return {
		created,
		sourceUrls: sourceFileUrls(source, asset),
		targetUrl: uploadedUrl,
		hash: downloaded.hash
	};
}

function payload(
	row: CmsRecord,
	mapping: Mapping,
	urls: AssetUrlMap,
	draft = true,
	includeAssetReferences = true
) {
	const categoryIds = (row.categoryIds || []).map((id: string) => {
		const target = mapping.categories.get(id);
		if (!target) throw new Error('Content has an unresolved category relation.');
		return target;
	});
	const body = includeAssetReferences
		? rewriteLocalAssetUrls((row.body as string) || '', urls)
		: '';
	const coverUrl = includeAssetReferences
		? rewriteLocalAssetUrls((row.coverUrl as string) || '', urls)
		: '';
	return {
		title: row.title,
		slug: row.slug,
		kind: row.kind,
		layout: row.layout,
		body,
		summary: row.summary || '',
		coverUrl,
		author: row.author || '',
		publishedAt: row.publishedAt || '',
		documentationSeeded: !!row.documentationSeeded,
		categoryIds,
		order: row.order || 0,
		section: row.section || '',
		sourceId: typeof row.sourceId === 'number' && row.sourceId > 0 ? row.sourceId : null,
		sourceUrl: row.sourceUrl || '',
		sourceModified: row.sourceModified || '',
		categories: row.categories || [],
		importNotes: row.importNotes || '',
		parent: '',
		isPublished: draft ? false : publicationState(row)
	};
}

export function sourceSnapshot(source: Record<string, CmsRecord[]>) {
	return digest(
		Object.fromEntries(
			Object.entries(source).map(([name, rows]) => [
				name,
				[...rows]
					.sort((left, right) => left.id.localeCompare(right.id))
					.map((row) => ({ id: row.id, metadataHash: digest(stableRecord(row)) }))
			])
		)
	);
}

function stableRecord(row: CmsRecord) {
	const copy = { ...row } as Record<string, unknown>;
	for (const key of ['id', 'collectionId', 'collectionName', 'created', 'updated'])
		delete copy[key];
	return copy;
}

async function inventory(pb: PocketBase) {
	const [categories, content, assets, menus, drafts, collectionRows, editionRows] =
		await Promise.all([
			list(pb, 'cms_categories'),
			list(pb, 'content'),
			list(pb, 'content_assets'),
			list(pb, 'cms_menus'),
			list(pb, 'cms_menu_drafts'),
			list(pb, 'collections'),
			list(pb, 'editions')
		]);
	return { categories, content, assets, menus, drafts, collectionRows, editionRows };
}

function validateSource(source: Awaited<ReturnType<typeof inventory>>, client: PocketBase) {
	const guide = source.content.filter((row) => row.layout === 'guide');
	const other = source.content.filter((row) => row.layout !== 'guide');
	const approvedDraftPosts = other.filter((row) => row.kind === 'post' && !row.isPublished);
	const approvedPublishedPages = other.filter((row) => row.kind === 'page' && row.isPublished);
	if (
		source.content.length !== 129 ||
		guide.length !== 9 ||
		approvedDraftPosts.length !== 79 ||
		approvedPublishedPages.length !== 41 ||
		source.categories.length !== 6 ||
		source.assets.length !== 353
	)
		throw new Error('Local CMS inventory differs from the approved 129/9/79/41/6/353 snapshot.');
	mapUnique(source.categories, (row) => row.slug, 'source category slug');
	mapUnique(source.content, contentKey, 'source content namespace and slug');
	for (const rows of [source.menus, source.drafts])
		if (rows.length !== 2 || new Set(rows.map((row) => row.slot)).size !== 2)
			throw new Error('Source menus must contain exactly main and footer slots.');
	const liveMain = source.menus.find((row) => row.slot === 'main');
	const liveFooter = source.menus.find((row) => row.slot === 'footer');
	if (
		!liveMain ||
		!liveFooter ||
		!Array.isArray((liveMain.config as MenuConfig).items) ||
		!Array.isArray((liveFooter.config as MenuConfig).items) ||
		(liveMain.config as MenuConfig).items.length !== 5 ||
		(liveFooter.config as MenuConfig).items.length !== 4
	)
		throw new Error(
			'Local live menu inventory differs from the approved main/footer 5/4 snapshot.'
		);
	for (const row of other) {
		if (!['page', 'post'].includes(row.kind) || (row.kind === 'post' && row.layout !== 'article'))
			throw new Error('Source content has an invalid kind or layout.');
		if (row.sourceId != null && (!Number.isInteger(row.sourceId) || row.sourceId < 0))
			throw new Error('Source content sourceId must be nonnegative.');
	}
	for (const row of source.content) {
		if (!row.parent) continue;
		const parent = source.content.find((candidate) => candidate.id === row.parent);
		if (!parent || parent.kind !== 'page' || parent.layout !== row.layout)
			throw new Error('Source content has an invalid parent relation.');
	}
	const knownLocalUrls: AssetUrlMap = new Map();
	for (const asset of source.assets)
		for (const url of sourceFileUrls(client, asset))
			knownLocalUrls.set(url, 'https://known-local-asset.invalid');
	assertKnownLocalAssetReferences(
		source.content.flatMap((row) => [String(row.body || ''), String(row.coverUrl || '')]),
		knownLocalUrls
	);
	return { guide, other };
}

function verifyGuides(source: CmsRecord[], target: CmsRecord[]) {
	const sourceByKey = mapUnique(source, contentKey, 'source guide');
	const targetByKey = mapUnique(target, contentKey, 'production guide');
	if (sourceByKey.size !== targetByKey.size)
		throw new Error('Production guide count does not match local.');
	for (const [key, local] of sourceByKey) {
		const remote = targetByKey.get(key);
		if (!remote || digest(stableGuide(local)) !== digest(stableGuide(remote)))
			throw new Error('Production guide differs from local outside its parent identifier.');
	}
	return new Map([...sourceByKey].map(([key, row]) => [row.id, targetByKey.get(key)!.id]));
}

function resolveJournalPath(path: string | undefined) {
	if (!path || !isAbsolute(path))
		throw new Error('--apply requires an absolute private --journal path.');
	if (resolve(path).startsWith(resolve(process.cwd()) + '/'))
		throw new Error('The private journal must be outside this checkout.');
	if (!existsSync(dirname(path))) throw new Error('The private journal directory does not exist.');
	return path;
}

async function ensureBackup(target: PocketBase, key: string) {
	const backup = (await target.backups.getFullList()).find((item) => item.key === key);
	if (!backup || backup.size <= 0)
		throw new Error('An existing verified PocketBase backup key is required.');
	const modified = Date.parse(backup.modified || '');
	if (
		!Number.isFinite(modified) ||
		modified > Date.now() ||
		Date.now() - modified > FRESH_BACKUP_MS
	)
		throw new Error('PocketBase backup must be fresh (less than 24 hours old).');
}

export async function migrate(
	source: PocketBase,
	target: PocketBase,
	apply = false,
	backupKey?: string,
	journalPath?: string,
	seedManifest?: ReviewedSeedManifest
) {
	const [local, remote] = await Promise.all([inventory(source), inventory(target)]);
	const { guide, other } = validateSource(local, source);
	const journal = apply ? readJournal(resolveJournalPath(journalPath)) : { entries: [] };
	if (apply) assertNoUnsettledIntents(journal);
	const existing = completedMappings(journal);
	assertTargetSeed(
		{
			guides: remote.content.filter((row) => row.layout === 'guide'),
			content: remote.content,
			categories: remote.categories,
			assets: remote.assets,
			menus: remote.menus,
			drafts: remote.drafts
		},
		journal,
		seedManifest
	);
	const guideMappings = verifyGuides(
		guide,
		remote.content.filter((row) => row.layout === 'guide')
	);
	const snapshot = sourceSnapshot({
		cms_categories: local.categories,
		content: local.content,
		content_assets: local.assets,
		cms_menus: local.menus,
		cms_menu_drafts: local.drafts
	});
	const summary = {
		source: {
			content: local.content.length,
			guides: guide.length,
			postsToPublish: other.filter((row) => row.kind === 'post' && !row.isPublished).length,
			categories: local.categories.length,
			assets: local.assets.length,
			liveMenus: local.menus.length,
			draftMenus: local.drafts.length,
			localUrlReferences: other.reduce(
				(count, row) =>
					count +
					(`${row.body || ''} ${row.coverUrl || ''}`.match(/(?:localhost|127\.0\.0\.1)/gi)
						?.length || 0),
				0
			)
		},
		target: {
			guides: guideMappings.size,
			categories: remote.categories.length,
			assets: remote.assets.length
		},
		origins: { source: source.baseUrl, target: target.baseUrl },
		apply
	};
	if (!apply) return summary;
	if (!backupKey) throw new Error('--apply requires --backup EXISTING_FRESH_BACKUP_KEY.');
	if (
		journal.header &&
		(journal.header.target !== TARGET_ORIGIN ||
			journal.header.snapshot !== snapshot ||
			journal.header.backup !== backupKey)
	)
		throw new Error('Private journal target, backup, or source snapshot does not match this run.');
	if (hasJournalEvent(journal, 'complete')) return summary;
	await ensureBackup(target, backupKey);
	const writer = journalWriter(resolveJournalPath(journalPath), journal);
	writer.open();
	try {
		if (!journal.header)
			writer.write({ event: 'run', target: TARGET_ORIGIN, snapshot, backup: backupKey });
		const mapping: Mapping = {
			categories: new Map(existing.categories),
			content: new Map([...guideMappings, ...existing.content]),
			assets: new Map(existing.assets)
		};
		for (const category of local.categories) {
			if (mapping.categories.has(category.id)) continue;
			writer.write({ event: 'write-intent', collection: 'cms_categories', sourceId: category.id });
			const created = (await target.collection('cms_categories').create({
				name: category.name,
				slug: category.slug,
				description: category.description || ''
			})) as CmsRecord;
			if (created.slug !== category.slug) throw new Error('Category readback mismatch.');
			mapping.categories.set(category.id, created.id);
			writer.write({
				event: 'mapping',
				collection: 'cms_categories',
				sourceId: category.id,
				targetId: created.id
			});
		}
		for (const row of other) {
			if (mapping.content.has(row.id)) continue;
			writer.write({ event: 'write-intent', collection: 'content', sourceId: row.id });
			const created = (await target
				.collection('content')
				.create(payload(row, mapping, new Map(), true, false))) as CmsRecord;
			if (created.slug !== row.slug || created.layout !== row.layout || created.isPublished)
				throw new Error('Draft content readback mismatch.');
			mapping.content.set(row.id, created.id);
			writer.write({
				event: 'mapping',
				collection: 'content',
				sourceId: row.id,
				targetId: created.id
			});
		}
		const assetUrls: AssetUrlMap = new Map();
		for (const asset of local.assets) {
			const contentId = asset.content ? mapping.content.get(asset.content) : undefined;
			if (asset.content && !contentId)
				throw new Error('Content asset has an unresolved content relation.');
			let targetId = mapping.assets.get(asset.id);
			if (!targetId) {
				writer.write({ event: 'write-intent', collection: 'content_assets', sourceId: asset.id });
				const copied = await copyAsset(source, target, asset, contentId);
				targetId = copied.created.id;
				mapping.assets.set(asset.id, targetId);
				for (const url of copied.sourceUrls) assetUrls.set(url, copied.targetUrl);
				writer.write({
					event: 'mapping',
					collection: 'content_assets',
					sourceId: asset.id,
					targetId,
					sha256: copied.hash
				});
			} else {
				const remoteAsset = await target.collection('content_assets').getOne(targetId);
				for (const url of sourceFileUrls(source, asset))
					assetUrls.set(url, fileUrls(target, remoteAsset as CmsRecord)[0]);
			}
		}
		const contentReady = hasJournalEvent(journal, 'content-ready');
		if (contentReady && mapping.assets.size !== local.assets.length)
			throw new Error('Content-ready journal checkpoint has incomplete media mappings.');
		if (!contentReady) {
			for (const row of other) {
				const targetId = mapping.content.get(row.id)!;
				const parent = row.parent ? mapping.content.get(row.parent) : '';
				if (row.parent && !parent) throw new Error('Content has an unresolved parent relation.');
				const data = { ...payload(row, mapping, assetUrls), parent: parent || '' };
				const current = (await target.collection('content').getOne(targetId)) as CmsRecord;
				if (current.isPublished)
					throw new Error(
						'Mapped content is already published before the content-ready checkpoint.'
					);
				await target.collection('content').update(targetId, data);
				const readback = (await target.collection('content').getOne(targetId)) as CmsRecord;
				if (
					readback.body !== data.body ||
					readback.coverUrl !== data.coverUrl ||
					readback.parent !== data.parent
				)
					throw new Error('Content reference readback mismatch.');
			}
			const allTargetContent = (await list(target, 'content')) as CmsRecord[];
			if (
				allTargetContent.some((row) =>
					/(?:localhost|127\.0\.0\.1)/i.test(`${row.body || ''}${row.coverUrl || ''}`)
				)
			)
				throw new Error('Local URL remains in production content.');
			writer.write({ event: 'content-ready' });
		}
		const publicationCommitted = new Set(
			journal.entries
				.filter((entry) => entry.event === 'publication-committed')
				.map((entry) => String(entry.sourceId))
		);
		for (const row of other.filter(publicationState))
			if (publicationCommitted.has(row.id)) {
				const targetId = mapping.content.get(row.id);
				if (!targetId || !(await target.collection('content').getOne(targetId)).isPublished)
					throw new Error('Journaled publication no longer matches production state.');
			}
		const pendingPublication = other.filter(
			(row) => publicationState(row) && !publicationCommitted.has(row.id)
		);
		while (pendingPublication.length) {
			let published = 0;
			for (let index = pendingPublication.length - 1; index >= 0; index--) {
				const row = pendingPublication[index];
				if (row.parent && pendingPublication.some((candidate) => candidate.id === row.parent))
					continue;
				const targetId = mapping.content.get(row.id)!;
				const current = (await target.collection('content').getOne(targetId)) as CmsRecord;
				if (current.isPublished)
					throw new Error('Content is published without a durable publication checkpoint.');
				if (current.parent) {
					const parent = (await target.collection('content').getOne(current.parent)) as CmsRecord;
					if (!parent.isPublished) throw new Error('Cannot publish content below a draft parent.');
				}
				writer.write({ event: 'publication-intent', sourceId: row.id, targetId });
				await target.collection('content').update(targetId, { isPublished: true });
				if (!(await target.collection('content').getOne(targetId)).isPublished)
					throw new Error('Publication readback mismatch.');
				writer.write({ event: 'publication-committed', sourceId: row.id, targetId });
				pendingPublication.splice(index, 1);
				published++;
			}
			if (!published)
				throw new Error('Published source pages contain a parent cycle or draft parent.');
		}
		const directory: MenuDirectory = {
			content: await list(target, 'content'),
			categories: await list(target, 'cms_categories'),
			collections: remote.collectionRows,
			editions: remote.editionRows
		};
		for (const [name, sourceMenus, live] of [
			['cms_menu_drafts', local.drafts, false],
			['cms_menus', local.menus, true]
		] as const) {
			for (const sourceMenu of sourceMenus) {
				const targetMenu = (await target
					.collection(name)
					.getFirstListItem(
						target.filter('slot = {:slot}', { slot: sourceMenu.slot })
					)) as CmsRecord;
				const prior = journal.entries.find(
					(entry) =>
						entry.event === 'mapping' &&
						entry.collection === name &&
						entry.sourceId === sourceMenu.id
				);
				if (prior) {
					if (prior.targetId !== targetMenu.id || typeof prior.configHash !== 'string')
						throw new Error('Journaled menu mapping is incomplete; refusing replay.');
					continue;
				}
				const config = remapMenu(sourceMenu.config as MenuConfig, mapping);
				assertMenuTargets(config, directory, live);
				const saved = live ? publishableMenu(config, directory) : config;
				writer.write({ event: 'write-intent', collection: name, sourceId: sourceMenu.id });
				await target
					.collection(name)
					.update(
						targetMenu.id,
						{ config: saved },
						{ headers: { 'X-Pure3D-Menu-Version': targetMenu.updated } }
					);
				const readback = (await target.collection(name).getOne(targetMenu.id)) as CmsRecord;
				if (menuFingerprint(readback.config) !== menuFingerprint(saved))
					throw new Error('Menu readback mismatch.');
				writer.write({
					event: 'mapping',
					collection: name,
					sourceId: sourceMenu.id,
					targetId: targetMenu.id,
					configHash: menuFingerprint(saved)
				});
			}
		}
		writer.write({ event: 'complete' });
		return summary;
	} finally {
		writer.close();
	}
}

export async function main(args = process.argv.slice(2)) {
	const { values } = parseArgs({
		args,
		options: {
			apply: { type: 'boolean' },
			backup: { type: 'string' },
			journal: { type: 'string' },
			'seed-manifest': { type: 'string' }
		},
		strict: true
	});
	if (!values.apply && (values.backup || values.journal))
		throw new Error('--backup and --journal require --apply.');
	const seedManifest = readReviewedSeedManifest(values['seed-manifest']);
	// Bun's ambient environment is sufficient for read-only preflight. Only an actual apply may
	// explicitly load a protected .env file when the execution environment did not inject values.
	if (
		values.apply &&
		!process.env.POCKETBASE_ADMIN_EMAIL &&
		typeof process.loadEnvFile === 'function'
	)
		process.loadEnvFile();
	exactOrigin(process.env.LOCAL_POCKETBASE_URL, LOCAL_ORIGIN, 'LOCAL_POCKETBASE_URL');
	exactOrigin(process.env.PROD_POCKETBASE_URL, TARGET_ORIGIN, 'PROD_POCKETBASE_URL');
	const source = new PocketBase(LOCAL_ORIGIN);
	const target = new PocketBase(TARGET_ORIGIN);
	source.autoCancellation(false);
	target.autoCancellation(false);
	await authenticate(
		source,
		process.env.LOCAL_CONTENT_ADMIN_EMAIL || 'admin@admin.local',
		process.env.LOCAL_CONTENT_ADMIN_PASSWORD || '1234567890'
	);
	await authenticate(
		target,
		process.env.POCKETBASE_ADMIN_EMAIL,
		process.env.POCKETBASE_ADMIN_PASSWORD
	);
	const result = await migrate(
		source,
		target,
		!!values.apply,
		values.backup,
		values.journal,
		seedManifest
	);
	console.log(JSON.stringify(result));
}

if (import.meta.main)
	main().catch(() => {
		console.error(
			'CMS migration stopped. No credentials, CMS text, or PocketBase response body was logged. Review the private journal and preflight inventory before retrying.'
		);
		process.exitCode = 1;
	});
