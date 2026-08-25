import { describe, expect, test } from 'bun:test';
import { formatAuthorReconciliation, reconcileAuthorProfiles } from './reconcile-author-profiles';

describe('reconcileAuthorProfiles', () => {
	test('separates unique, ambiguous, and unmatched author credits', () => {
		const report = reconcileAuthorProfiles(
			[
				{ id: 'edition-1', title: 'Edition One', dcCreator: ['Doe, Jane', 'Sam Lee'] },
				{ id: 'edition-2', title: 'Edition Two', dcCreator: ['Unknown Author'] }
			],
			[
				{ id: 'user-1', name: 'Jane Doe', nickname: 'Jane Doe' },
				{ id: 'user-2', name: 'Sam Lee' },
				{ id: 'user-3', nickname: 'Sam Lee' }
			]
		);

		expect(report.matched).toEqual([
			{
				editionId: 'edition-1',
				editionTitle: 'Edition One',
				credit: 'Doe, Jane',
				profiles: [{ id: 'user-1', displayName: 'Jane Doe' }]
			}
		]);
		expect(report.ambiguous[0]).toMatchObject({
			credit: 'Sam Lee',
			profiles: [
				{ id: 'user-2', displayName: 'Sam Lee' },
				{ id: 'user-3', displayName: 'Sam Lee' }
			]
		});
		expect(report.unmatched[0]).toMatchObject({ credit: 'Unknown Author', profiles: [] });
	});

	test('formats a reviewable Markdown report', () => {
		const markdown = formatAuthorReconciliation({
			matched: [],
			ambiguous: [
				{
					editionId: 'edition-1',
					editionTitle: 'Edition | One',
					credit: 'Sam Lee',
					profiles: [
						{ id: 'user-1', displayName: 'Sam Lee' },
						{ id: 'user-2', displayName: 'Samuel Lee' }
					]
				}
			],
			unmatched: []
		});

		expect(markdown).toContain('- Unique matches: 0');
		expect(markdown).toContain('- Ambiguous credits: 1');
		expect(markdown).toContain(
			'| Edition \\| One | `edition-1` | Sam Lee | Sam Lee (`user-1`)<br>Samuel Lee (`user-2`) |'
		);
	});
});
