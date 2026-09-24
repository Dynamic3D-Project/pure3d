import { describe, expect, test } from 'bun:test';
import {
	filterAnnotations,
	normalizeEditionContent,
	parseAnnotationCategories,
	resolveHttpUrl,
	resolveVoyagerAssetUrl
} from './edition-content';

describe('edition content normalization', () => {
	test('uses selected-language titles and public tags', () => {
		const [annotation] = normalizeEditionContent(
			[
				{
					id: 'door',
					title: 'Public title',
					titles: { NL: 'Deur', EN: 'Door' },
					tags: ['Entrance'],
					taglist: { EN: ['Architecture'] }
				}
			],
			'nl',
			'annotation'
		);

		expect(annotation).toMatchObject({
			id: 'door',
			title: 'Deur',
			tags: ['Entrance', 'Architecture']
		});
	});

	test('falls back to public fields and counts tour steps', () => {
		const [tour] = normalizeEditionContent(
			[{ id: 'tour-1', title: 'Highlights', steps: [{}, {}] }],
			'FR',
			'tour'
		);

		expect(tour).toMatchObject({ title: 'Highlights', steps: 2 });
	});
});

describe('annotation categories', () => {
	const items = normalizeEditionContent(
		[
			{ id: 'a', title: 'Window', tags: ['Building'] },
			{ id: 'b', title: 'Door', tags: ['Building', 'Battle'] },
			{ id: 'c', title: 'Garden', tags: ['Battle'] },
			{ id: 'd', title: 'Overview', tags: [] }
		],
		'EN',
		'annotation'
	);

	test('parses Voyager category strings without blanks or duplicates', () => {
		expect(parseAnnotationCategories(' Building, Battle, Building, ')).toEqual([
			'Building',
			'Battle'
		]);
		expect(parseAnnotationCategories(undefined)).toEqual([]);
	});

	test('reveals only matching annotations after selecting a category', () => {
		expect(filterAnnotations(items, [])).toEqual([]);
		expect(filterAnnotations(items, ['Building']).map((item) => item.id)).toEqual(['a', 'b']);
		expect(filterAnnotations(items, ['Unknown'])).toEqual([]);
	});

	test('all categories includes untagged annotations and preserves multi-category matches', () => {
		expect(filterAnnotations(items, ['Building', 'Battle'])).toEqual(items);
		expect(filterAnnotations(items, ['Building', 'Unknown']).map((item) => item.id)).toEqual([
			'a',
			'b'
		]);
	});

	test('editions without categories remain directly browsable', () => {
		expect(filterAnnotations([items[3]], [])).toEqual([items[3]]);
	});
});

describe('Voyager reading assets', () => {
	test('resolves relative Voyager articles and rejects unsafe URLs', () => {
		expect(
			resolveVoyagerAssetUrl('/project/demo/', 'articles/story.html', 'https://pure3d.example/')
		).toBe('https://pure3d.example/project/demo/articles/story.html');
		expect(
			resolveHttpUrl('Media/image.jpeg', 'https://pure3d.example/project/demo/articles/story.html')
		).toBe('https://pure3d.example/project/demo/articles/Media/image.jpeg');
		expect(resolveHttpUrl('javascript:alert(1)', 'https://pure3d.example/')).toBeNull();
		expect(resolveHttpUrl('', 'https://pure3d.example/')).toBeNull();
		expect(
			resolveHttpUrl('https://user:password@example.com', 'https://pure3d.example/')
		).toBeNull();
	});
});
