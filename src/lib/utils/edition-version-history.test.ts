import { describe, expect, test } from 'bun:test';
import { mapEditionVersions } from './edition-version-history';

describe('mapEditionVersions', () => {
	test('excludes the current edition and maps projected history fields', () => {
		const versions = mapEditionVersions(
			[
				{ id: 'current', title: 'Current' },
				{
					id: 'older',
					dcTitle: 'Older title',
					pubNum: 2,
					dcDoi: ['10/example'],
					peerReviewKind: 'Open review',
					thumbnail: 'icon.avif'
				}
			],
			'current',
			4,
			(collection, edition) => `/project/${collection}/edition/${edition}/icon.avif`
		);

		expect(versions).toEqual([
			{
				id: 'older',
				slug: 'older',
				title: 'Older title',
				pubNum: 2,
				status: null,
				dcDoi: ['10/example'],
				modelSize: null,
				dcAbstract: '',
				created: '',
				hasPeerReview: true,
				thumbnail: '/project/4/edition/2/icon.avif'
			}
		]);
	});
});
