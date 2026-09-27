import { describe, expect, test } from 'bun:test';
import { getCardImageSources } from './asset-image-sources';

describe('getCardImageSources', () => {
	test('keeps legacy icons until generated derivatives have been deployed', () => {
		const url = 'https://assets.test/project/1/icon.avif';
		expect(getCardImageSources(url)).toEqual({ src: url, srcset: undefined });
	});

	test('does not pretend PocketBase AVIF thumb query strings resize images', () => {
		const url = 'https://api.test/api/files/collection/record/cover.avif?thumb=400x300';
		expect(getCardImageSources(url)).toEqual({
			src: 'https://api.test/api/files/collection/record/cover.avif',
			srcset: undefined
		});
	});

	test('uses only published manifest derivatives for a PocketBase AVIF cover', () => {
		const url = 'https://api.test/api/files/pbc_editions/record/cover.avif';
		expect(
			getCardImageSources(url, {
				version: 1,
				images: {
					'/api/files/pbc_editions/record/cover.avif': [
						{ url: '/card-images/cover-card-380.avif', width: 380 },
						{ url: '/card-images/cover-card-640.avif', width: 640 }
					]
				}
			})
		).toEqual({
			src: '/card-images/cover-card-640.avif',
			srcset: '/card-images/cover-card-380.avif 380w, /card-images/cover-card-640.avif 640w'
		});
	});

	test('falls back to the original when a URL has no manifest entry', () => {
		const url = 'https://api.test/api/files/collection/record/cover.jpg';
		expect(getCardImageSources(url)).toEqual({ src: url, srcset: undefined });
	});
});
test('collection cards consume published responsive derivatives', async () => {
	const source = await Bun.file('src/lib/components/cards/CollectionCard.svelte').text();
	expect(source).toContain('getCardImageSources(collection.thumbnail)');
	expect(source).toContain('srcset={imageSources.srcset}');
});
