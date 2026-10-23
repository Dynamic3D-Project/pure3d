import { error } from '@sveltejs/kit';
import { base } from '$app/paths';
import { pb } from '$lib/database/client';
import { getAssetBaseUrl } from '$lib/utils/asset-urls';
import { legacyEditionDestinations } from '$lib/utils/legacy-publications';
import type { PageLoad } from './$types';

// These must be client-side pages: production is a static GitHub Pages site.
export const load: PageLoad = async ({ params, url, fetch }) => {
	const match = /^([1-9]\d*)(?:\/edition\/([1-9]\d*))?(?:\/(.*))?$/.exec(params.legacy);
	if (!match) error(404, 'This legacy link is not recognised.');
	const [, project, edition, tail = ''] = match;
	if (
		![project, ...(edition ? [edition] : [])].every((value) => Number.isSafeInteger(Number(value)))
	)
		error(404, 'This legacy link is not recognised.');

	const suffix = url.search;
	if (tail && !/^index(?:-voyager-\d+(?:\.\d+)*)?\.html$/.test(tail)) {
		// Article, model and media links must remain files, not become edition pages.
		if (tail.split('/').some((part) => part === '.' || part === '..' || part.includes('\\')))
			error(404, 'This legacy asset link is not recognised.');
		const path = `project/${project}/${edition ? `edition/${edition}/` : ''}${tail}`;
		return { destination: `${getAssetBaseUrl()}/${path}${suffix}` };
	}

	const collections = await pb.collection('collections').getList(1, 2, {
		filter: `pubNum = ${Number(project)} && isVisible = true`,
		fields: 'id',
		fetch
	});
	if (collections.items.length !== 1) error(404, 'This collection is not available.');
	const collectionId = collections.items[0].id;
	if (!edition) return { destination: `${base}/collections/${collectionId}${suffix}` };

	const canonical = legacyEditionDestinations[`${project}/${edition}`];
	const editions = await pb.collection('editions').getList(1, 2, {
		filter: pb.filter(
			`collection = {:collection} && pubNum = {:number} && isPublished = true${canonical ? ' && id = {:id} && mongoId = {:mongoId}' : ''}`,
			{
				collection: collectionId,
				number: Number(edition),
				id: canonical?.id || '',
				mongoId: canonical?.mongoId || ''
			}
		),
		fields: 'id',
		fetch
	});
	if (editions.items.length !== 1) error(404, 'This edition is not available.');
	return { destination: `${base}/editions/${editions.items[0].id}${suffix}` };
};
