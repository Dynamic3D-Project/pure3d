import { expect, mock, test } from 'bun:test';
import type { Credit } from '../../lib/types/credits';

test('public profiles show only explicitly credited work across paginated backend results', async () => {
	const userId = 'exact-user-id';
	const credit: Credit = {
		type: 'person',
		name: 'Same name',
		orcid: null,
		role: 'contributor',
		provenance: 'manual',
		userId
	};
	const records = [
		...Array.from({ length: 501 }, (_, i) => ({
			id: `unrelated-${i}`,
			credits: [{ ...credit, userId: `${userId}-suffix` }]
		})),
		{ id: 'name-only', credits: [{ ...credit, userId: undefined }] },
		{ id: 'membership-only', credits: [] },
		{
			id: 'credited',
			title: 'Credited work',
			collection: 'credited',
			pubNum: 2,
			thumbnail: 'icon.avif',
			expand: { collection: { pubNum: 1 } },
			credits: [credit]
		}
	];
	// Only the external PocketBase HTTP API and SvelteKit runtime environment are doubled.
	const backend = Bun.serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch(request) {
			const url = new URL(request.url);
			if (url.pathname === `/api/collections/users/records/${userId}`)
				return Response.json({ id: userId, nickname: 'Same name', verified: true });
			if (/^\/api\/collections\/(editions|collections)\/records$/.test(url.pathname)) {
				const page = Number(url.searchParams.get('page') || 1);
				const perPage = Number(url.searchParams.get('perPage') || 500);
				return Response.json({
					page,
					perPage,
					totalItems: records.length,
					totalPages: Math.ceil(records.length / perPage),
					items: records.slice((page - 1) * perPage, page * perPage)
				});
			}
			return Response.json({ message: 'Not found' }, { status: 404 });
		}
	});
	try {
		mock.module('$env/static/public', () => ({
			PUBLIC_POCKETBASE_URL: backend.url.origin,
			PUBLIC_ASSET_BASE_URL: `${backend.url.origin}/assets`
		}));
		mock.module('$app/environment', () => ({ dev: false }));
		mock.module('$app/paths', () => ({ base: '/pure3d' }));
		const { load } = await import('./[id]/+page');
		const data = await load({ params: { id: userId } } as Parameters<typeof load>[0]);
		if (!data) throw new Error('Expected profile data');
		expect(data.profile.name).toBe('Same name');
		expect(data.profile.orcidVerifiedAt).toBeNull();
		expect(data.editions.map((edition: { id: string }) => edition.id)).toEqual(['credited']);
		expect(data.collections.map((collection: { id: string }) => collection.id)).toEqual([
			'credited'
		]);
		expect(data.editions[0].credits).toEqual([credit]);
		expect(data.editions[0].thumbnail).toBe(
			`${backend.url.origin}/assets/project/1/edition/2/icon.avif`
		);
		expect(data.collections[0].editionCount).toBe(1);
		await expect(
			load({ params: { id: 'missing' } } as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 404 });
	} finally {
		backend.stop(true);
		mock.restore();
	}
});
