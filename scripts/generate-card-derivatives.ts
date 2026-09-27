#!/usr/bin/env bun

import { lstat, mkdir, readFile, readdir, realpath } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';

const CARD_WIDTHS = [380, 760] as const;
const SOURCE_EXTENSIONS = new Set(['.avif', '.jpg', '.jpeg', '.png', '.webp']);

export interface CardDerivativeManifest {
	version: 1;
	images: Record<string, Array<{ url: string; width: number }>>;
}

interface ExplicitSource {
	path: string;
	url: string;
}

interface GenerateOptions {
	sourceRoot: string;
	outputRoot: string;
	manifestPath: string;
	sourceUrlPrefix: string;
	outputUrlPrefix: string;
	sources?: ExplicitSource[];
}

function joinUrl(prefix: string, path: string): string {
	return `${prefix.replace(/\/$/, '')}/${path.split(sep).join('/')}`;
}

function isDefaultCardSource(path: string): boolean {
	const stem = basename(path, extname(path)).toLowerCase();
	return SOURCE_EXTENSIONS.has(extname(path).toLowerCase()) && /^(?:icon|cover)/.test(stem);
}

function safeRelativePath(path: string): string {
	if (isAbsolute(path) || path.split(/[\\/]/).includes('..')) {
		throw new Error(`Source path must stay within source root: ${path}`);
	}
	return path;
}

async function findDefaultSources(root: string): Promise<ExplicitSource[]> {
	const sources: ExplicitSource[] = [];
	async function visit(directory: string) {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) await visit(path);
			else if (
				entry.isFile() &&
				isDefaultCardSource(entry.name) &&
				!/-card-\d+\.avif$/.test(entry.name)
			) {
				const relativePath = relative(root, path);
				sources.push({ path: relativePath, url: relativePath.split(sep).join('/') });
			}
		}
	}
	await visit(root);
	return sources;
}

function assertSeparateRoots(sourceRoot: string, outputRoot: string) {
	const relativeOutput = relative(sourceRoot, outputRoot);
	if (!relativeOutput || (!relativeOutput.startsWith(`..${sep}`) && relativeOutput !== '..')) {
		throw new Error('Output root must be separate from and outside the source root');
	}
}

function assertOutsideSource(sourceRoot: string, path: string, label: string) {
	const relativePath = relative(sourceRoot, path);
	if (!relativePath || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..')) {
		throw new Error(`${label} must be outside the source root`);
	}
}

async function rejectOutputSymlink(path: string) {
	try {
		if ((await lstat(path)).isSymbolicLink()) throw new Error('Output file must not be a symlink');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
}

export async function generateCardDerivativeManifest(
	options: GenerateOptions
): Promise<CardDerivativeManifest> {
	const sourceRoot = await realpath(resolve(options.sourceRoot));
	let outputRoot = resolve(options.outputRoot);
	let manifestPath = resolve(options.manifestPath);
	assertSeparateRoots(sourceRoot, outputRoot);
	assertOutsideSource(sourceRoot, manifestPath, 'Manifest');
	await mkdir(outputRoot, { recursive: true });
	await mkdir(dirname(manifestPath), { recursive: true });
	outputRoot = await realpath(outputRoot);
	manifestPath = join(await realpath(dirname(manifestPath)), basename(manifestPath));
	assertSeparateRoots(sourceRoot, outputRoot);
	assertOutsideSource(sourceRoot, manifestPath, 'Manifest');
	await rejectOutputSymlink(manifestPath);

	const sources = options.sources ?? (await findDefaultSources(sourceRoot));
	const images: CardDerivativeManifest['images'] = {};
	for (const source of sources) {
		const relativeSource = safeRelativePath(source.path);
		if (!SOURCE_EXTENSIONS.has(extname(relativeSource).toLowerCase())) {
			throw new Error(`Unsupported card image source: ${relativeSource}`);
		}
		const sourcePath = await realpath(resolve(sourceRoot, relativeSource));
		safeRelativePath(relative(sourceRoot, sourcePath));
		const sourceMetadata = await sharp(sourcePath).metadata();
		if (!sourceMetadata.width) throw new Error(`Unable to read image width: ${sourcePath}`);
		const widths = [...new Set(CARD_WIDTHS.map((width) => Math.min(width, sourceMetadata.width!)))];
		const extension = extname(relativeSource);
		const stem = basename(relativeSource, extension);
		const outputDirectory = join(outputRoot, dirname(relativeSource));
		await mkdir(outputDirectory, { recursive: true });
		safeRelativePath(relative(outputRoot, await realpath(outputDirectory)));

		const derivatives = [];
		for (const width of widths) {
			const filename = `${stem}-card-${width}.avif`;
			const outputPath = join(outputDirectory, filename);
			await rejectOutputSymlink(outputPath);
			await sharp(sourcePath)
				.rotate()
				.resize({ width, withoutEnlargement: true })
				.avif({ quality: 65, effort: 5 })
				.toFile(outputPath);
			const measuredWidth = (await sharp(outputPath).metadata()).width;
			if (!measuredWidth) throw new Error(`Unable to verify derivative width: ${outputPath}`);
			derivatives.push({
				url: joinUrl(options.outputUrlPrefix, join(dirname(relativeSource), filename)),
				width: measuredWidth
			});
		}

		const sourceUrl = /^https?:\/\//.test(source.url)
			? source.url
			: joinUrl(options.sourceUrlPrefix, source.url);
		images[sourceUrl] = derivatives;
	}

	const manifest: CardDerivativeManifest = { version: 1, images };
	await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	return manifest;
}

function option(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : '';
	if (!value || value.startsWith('--')) throw new Error(`Missing required option ${name}`);
	return value;
}

async function main() {
	const sourcesPath = process.argv.includes('--sources') ? option('--sources') : '';
	const sources = sourcesPath
		? (JSON.parse(await readFile(sourcesPath, 'utf8')) as ExplicitSource[])
		: undefined;
	const manifest = await generateCardDerivativeManifest({
		sourceRoot: option('--source-root'),
		outputRoot: option('--output-root'),
		manifestPath: option('--manifest'),
		sourceUrlPrefix: option('--source-url-prefix'),
		outputUrlPrefix: option('--output-url-prefix'),
		sources
	});
	console.log(`Wrote ${Object.keys(manifest.images).length} card image entries`);
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
