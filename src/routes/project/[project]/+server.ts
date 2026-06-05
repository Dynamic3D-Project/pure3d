import { error, redirect } from '@sveltejs/kit';
import { createPocketBaseClient } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

/**
 * Legacy URL redirect handler for old collection/project URLs.
 *
 * Old format: /project/{collectionPubNum}/index.html or /project/{collectionPubNum}/
 * New format: /collections/{collectionId}
 */
export const GET: RequestHandler = async ({ params }) => {
	const collectionPubNum = parseInt(params.project, 10);

	if (isNaN(collectionPubNum)) {
		throw error(400, 'Invalid project number — expected a numeric value.');
	}

	const pb = createPocketBaseClient();

	try {
		const result = await pb.collection('collections').getList(1, 1, {
			filter: `pubNum = ${collectionPubNum}`
		});

		if (result.items.length === 0) {
			throw error(
				404,
				`Project #${collectionPubNum} not found. It may have been removed or renumbered.`
			);
		}

		const collection = result.items[0];

		// 301 redirect to the canonical collection page
		throw redirect(301, `/collections/${collection.id}`);
	} catch (e: unknown) {
		if (e instanceof Error && 'status' in e && 'body' in e) {
			throw e;
		}
		console.error('Legacy collection redirect error:', e);
		throw error(500, 'Internal server error while processing legacy URL redirect.');
	}
};
