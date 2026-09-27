import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { generateCardDerivativeManifest } from './generate-card-derivatives';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
	);
});

describe('generateCardDerivatives', () => {
	test('rejects an output directory aliased back into the originals', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'pure3d-card-images-'));
		temporaryDirectories.push(directory);
		const sourceRoot = join(directory, 'source');
		await mkdir(sourceRoot);
		const outputRoot = join(directory, 'output-alias');
		await symlink(sourceRoot, outputRoot);
		await expect(
			generateCardDerivativeManifest({
				sourceRoot,
				outputRoot,
				manifestPath: join(directory, 'manifest.json'),
				sourceUrlPrefix: '/assets',
				outputUrlPrefix: '/cards'
			})
		).rejects.toThrow('Output root');
	});

	test('writes separate derivatives and a manifest with measured widths', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'pure3d-card-images-'));
		temporaryDirectories.push(directory);
		const sourceRoot = join(directory, 'source');
		const outputRoot = join(directory, 'output');
		const source = join(sourceRoot, 'project', '1', 'icon.avif');
		const manifestPath = join(directory, 'card-image-derivatives.json');
		await mkdir(join(sourceRoot, 'project', '1'), { recursive: true });
		await sharp({ create: { width: 500, height: 300, channels: 3, background: '#446655' } })
			.avif()
			.toFile(source);

		const manifest = await generateCardDerivativeManifest({
			sourceRoot,
			outputRoot,
			manifestPath,
			sourceUrlPrefix: '/assets',
			outputUrlPrefix: '/card-images'
		});
		const outputs = manifest.images['/assets/project/1/icon.avif'];

		expect(outputs).toEqual([
			{ url: '/card-images/project/1/icon-card-380.avif', width: 380 },
			{ url: '/card-images/project/1/icon-card-500.avif', width: 500 }
		]);
		expect((await sharp(join(outputRoot, 'project/1/icon-card-380.avif')).metadata()).width).toBe(
			380
		);
		expect((await sharp(join(outputRoot, 'project/1/icon-card-500.avif')).metadata()).width).toBe(
			500
		);
		expect(JSON.parse(await readFile(manifestPath, 'utf8'))).toEqual(manifest);
		expect((await sharp(source).metadata()).width).toBe(500);
	});
});
