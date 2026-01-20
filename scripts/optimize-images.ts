#!/usr/bin/env bun
/**
 * Image Optimization Script
 *
 * Converts PNG thumbnails to AVIF and WebP formats for better compression.
 * Also resizes large images to 600px width for faster card loading.
 *
 * Usage:
 *   bun scripts/optimize-images.ts [--dry-run]
 *
 * Requirements:
 *   bun add sharp
 */

import sharp from 'sharp';
import { readdir, stat, mkdir } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { existsSync } from 'fs';

const STATIC_PROJECT_DIR = './static/project';
const TARGET_WIDTH = 600; // Resize to 600px width for card thumbnails
const AVIF_QUALITY = 65; // Good balance of quality and size
const WEBP_QUALITY = 75;

interface OptimizationResult {
	file: string;
	originalSize: number;
	avifSize: number;
	webpSize: number;
	resized: boolean;
}

const dryRun = process.argv.includes('--dry-run');

async function findIconFiles(dir: string): Promise<string[]> {
	const iconFiles: string[] = [];

	async function walk(currentDir: string) {
		try {
			const entries = await readdir(currentDir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(currentDir, entry.name);

				if (entry.isDirectory()) {
					await walk(fullPath);
				} else if (entry.isFile() && entry.name === 'icon.png') {
					iconFiles.push(fullPath);
				}
			}
		} catch (error) {
			// Skip directories we can't read
		}
	}

	await walk(dir);
	return iconFiles;
}

async function optimizeImage(inputPath: string): Promise<OptimizationResult | null> {
	const dir = dirname(inputPath);
	const avifPath = join(dir, 'icon.avif');
	const webpPath = join(dir, 'icon.webp');

	// Get original file size
	const stats = await stat(inputPath);
	const originalSize = stats.size;

	// Read the image
	const image = sharp(inputPath);
	const metadata = await image.metadata();

	// Check if we need to resize
	const needsResize = metadata.width && metadata.width > TARGET_WIDTH;

	if (dryRun) {
		console.log(`[DRY RUN] Would process: ${inputPath}`);
		console.log(`  - Original: ${(originalSize / 1024).toFixed(1)} KB, ${metadata.width}x${metadata.height}`);
		console.log(`  - Would create: ${avifPath}`);
		console.log(`  - Would create: ${webpPath}`);
		if (needsResize) {
			console.log(`  - Would resize from ${metadata.width}px to ${TARGET_WIDTH}px width`);
		}
		return null;
	}

	// Process the image (resize if needed)
	let processedImage = sharp(inputPath);
	if (needsResize) {
		processedImage = processedImage.resize(TARGET_WIDTH, null, {
			withoutEnlargement: true,
			fit: 'inside'
		});
	}

	// Convert to AVIF
	const avifBuffer = await processedImage
		.clone()
		.avif({ quality: AVIF_QUALITY })
		.toBuffer();
	await Bun.write(avifPath, avifBuffer);

	// Convert to WebP
	const webpBuffer = await processedImage
		.clone()
		.webp({ quality: WEBP_QUALITY })
		.toBuffer();
	await Bun.write(webpPath, webpBuffer);

	return {
		file: inputPath,
		originalSize,
		avifSize: avifBuffer.length,
		webpSize: webpBuffer.length,
		resized: needsResize || false
	};
}

async function main() {
	console.log('Image Optimization Script');
	console.log('=========================');
	console.log('');

	if (dryRun) {
		console.log('Running in DRY RUN mode - no files will be modified');
		console.log('');
	}

	// Check if static/project exists
	if (!existsSync(STATIC_PROJECT_DIR)) {
		console.error(`Error: ${STATIC_PROJECT_DIR} does not exist.`);
		console.log('Make sure you have the 3D edition data copied to static/project/');
		process.exit(1);
	}

	// Find all icon.png files
	console.log(`Scanning ${STATIC_PROJECT_DIR} for icon.png files...`);
	const iconFiles = await findIconFiles(STATIC_PROJECT_DIR);
	console.log(`Found ${iconFiles.length} icon.png files`);
	console.log('');

	if (iconFiles.length === 0) {
		console.log('No icon.png files found. Nothing to do.');
		return;
	}

	const results: OptimizationResult[] = [];
	let processedCount = 0;
	let skippedCount = 0;

	for (const iconFile of iconFiles) {
		try {
			const result = await optimizeImage(iconFile);
			if (result) {
				results.push(result);
				processedCount++;

				// Progress indicator
				const savings = ((1 - result.avifSize / result.originalSize) * 100).toFixed(0);
				console.log(`[${processedCount}/${iconFiles.length}] ${iconFile}`);
				console.log(`  PNG: ${(result.originalSize / 1024).toFixed(0)} KB -> AVIF: ${(result.avifSize / 1024).toFixed(0)} KB (${savings}% smaller)`);
			} else if (dryRun) {
				processedCount++;
			}
		} catch (error) {
			console.error(`Error processing ${iconFile}:`, error);
			skippedCount++;
		}
	}

	// Summary
	console.log('');
	console.log('=========================');
	console.log('Summary');
	console.log('=========================');

	if (dryRun) {
		console.log(`Would process ${iconFiles.length} files`);
	} else {
		const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
		const totalAvif = results.reduce((sum, r) => sum + r.avifSize, 0);
		const totalWebp = results.reduce((sum, r) => sum + r.webpSize, 0);
		const resizedCount = results.filter(r => r.resized).length;

		console.log(`Processed: ${processedCount} files`);
		console.log(`Skipped:   ${skippedCount} files`);
		console.log(`Resized:   ${resizedCount} files`);
		console.log('');
		console.log('Size comparison:');
		console.log(`  Original (PNG): ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
		console.log(`  AVIF:           ${(totalAvif / 1024 / 1024).toFixed(2)} MB (${((1 - totalAvif / totalOriginal) * 100).toFixed(0)}% smaller)`);
		console.log(`  WebP:           ${(totalWebp / 1024 / 1024).toFixed(2)} MB (${((1 - totalWebp / totalOriginal) * 100).toFixed(0)}% smaller)`);
	}
}

main().catch(console.error);
