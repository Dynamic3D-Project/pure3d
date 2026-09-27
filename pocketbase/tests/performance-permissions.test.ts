import { expect, test } from 'bun:test';
import schema from '../pb_schema/collections.json';
import { batchRoles, roles } from '../pb_hooks/orcid-service.cjs';
import { progress } from '../pb_hooks/publication-service.cjs';

const editionData: Record<string, string> = {
	collection: 'collection000001',
	status: 'alpha_review'
};
const edition = {
	collection: () => ({ name: 'editions' }),
	id: 'edition00000001',
	getString: (field: string) => editionData[field] || '',
	getInt: () => 1,
	setRaw: (field: string, value: string) => {
		editionData[field] = value;
	}
};

test('private permission rules use correlated reverse relations', () => {
	for (const name of ['editions', 'editionReviews', 'reviewFeedback']) {
		const collection = schema.find((item) => item.name === name)!;
		for (const rule of [collection.listRule, collection.viewRule]) {
			expect(rule).not.toContain('@collection.');
			expect(rule).toContain('_via_');
		}
	}
});

test('roles use a server-owned list batch instead of request-object expandos', () => {
	const calls: string[] = [];
	const row = (data: Record<string, string | number>) => ({
		getString: (field: string) => String(data[field] || ''),
		getInt: (field: string) => Number(data[field] || 0)
	});
	const app = {
		findRecordsByFilter: (collection: string) => {
			calls.push(collection);
			if (collection === 'collectionUsers')
				return [
					row({ collection: 'collection000001', role: 'owner' }),
					row({ collection: 'collection000001', role: 'editor' })
				];
			if (collection === 'editionUsers')
				return [
					row({ editionId: 'edition00000001', role: 'author' }),
					row({ editionId: 'edition00000001', role: 'collaborator' })
				];
			return [
				row({
					editionId: 'edition00000001',
					reviewStage: 2,
					reviewRound: 1,
					status: 'pending'
				})
			];
		}
	};
	const auth = {
		id: 'user000000000001',
		isSuperuser: () => false,
		collection: () => ({ name: 'users' }),
		getString: () => 'user'
	};
	const request = { app, auth };

	batchRoles(request, [edition]);
	expect(roles(request, edition)).toMatchObject({
		owner: true,
		editor: true,
		author: true,
		collaborator: true,
		reviewer: true
	});
	expect(roles(request, edition)).toMatchObject({ owner: true, reviewer: true });
	expect(calls).toEqual(['collectionUsers', 'editionUsers', 'reviewAssignments']);

	const unbatchedEdition = {
		...edition,
		getString: (field: string) =>
			({ collection: 'collection000001', status: 'alpha_review' })[field] || ''
	};
	roles(request, unbatchedEdition);
	expect(calls).toEqual([
		'collectionUsers',
		'editionUsers',
		'reviewAssignments',
		'collectionUsers',
		'editionUsers',
		'reviewAssignments'
	]);
});

test('public final reviews load only released feedback', () => {
	const calls: string[] = [];
	const event = {
		app: {
			findRecordById: () => ({ id: 'edition00000001', getBool: () => true }),
			findRecordsByFilter: (collection: string) => {
				calls.push(collection);
				return [
					{
						getString: (field: string) =>
							field === 'finalAnswers'
								? JSON.stringify({ comments: 'Released review', attribution: 'anonymous' })
								: '',
						getInt: () => 1
					}
				];
			}
		},
		request: { pathValue: () => 'edition00000001' },
		json: (_status: number, body: unknown) => body
	};

	expect(progress(event, true)).toEqual({
		feedback: [
			{
				reviewer: 'Reviewer 1',
				round: 1,
				valueRating: '',
				valueExplanation: '',
				experienceComments: '',
				changesRating: '',
				changesExplanation: '',
				recommendation: '',
				comments: 'Released review'
			}
		]
	});
	expect(calls).toEqual(['editionReviews']);
});
