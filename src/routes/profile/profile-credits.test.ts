import { expect, test } from 'bun:test';
// @ts-expect-error -- The repository's minimal bun:test shim omits Bun's mock API.
import { mock } from 'bun:test';
import type { Credit } from '../../lib/types/credits';

const userId = 'exact-user-id';
const credit: Credit = {
	type: 'person',
	name: 'Same name',
	orcid: null,
	role: 'contributor',
	provenance: 'manual',
	userId
};
const calls: string[] = [];
const records = [
	...Array.from({ length: 501 }, (_, i) => ({
		id: `unrelated-${i}`,
		credits: [{ ...credit, userId: `${userId}-suffix` }]
	})),
	{ id: 'name-only', credits: [{ ...credit, userId: undefined }] },
	{ id: 'membership-only', credits: [] },
	{ id: 'credited', title: 'Credited work', collection: 'credited', credits: [credit] }
];

mock.module('$lib/database/client', () => ({
	pb: {
		collection(name: string) {
			calls.push(name);
			if (name === 'users')
				return {
					getOne: async () => ({
						id: userId,
						nickname: 'Same name',
						verified: true,
						orcidVerifiedAt: ''
					})
				};
			if (name !== 'editions' && name !== 'collections')
				throw new Error('Membership is not attribution');
			return { getFullList: async () => records };
		}
	}
}));
mock.module('$lib/utils/asset-urls', () => ({
	getCollectionThumbnailUrl: () => '',
	getEditionRoot: () => '',
	getEditionThumbnailUrl: () => ''
}));

test('public credited work uses exact user IDs across the full accessible list, never names or membership', async () => {
	const { load } = await import('./[id]/+page');
	const data = await load({ params: { id: userId } } as Parameters<typeof load>[0]);
	if (!data) throw new Error('Expected profile data');
	expect(data.editions.map((edition: { id: string }) => edition.id)).toEqual(['credited']);
	expect(data.collections.map((collection: { id: string }) => collection.id)).toEqual(['credited']);
	expect(data.editions[0].credits).toEqual([credit]);
	expect(data.profile.orcidVerifiedAt).toBeNull();
	expect(calls).toEqual(['users', 'editions', 'collections']);
});
