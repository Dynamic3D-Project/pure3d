import { error, redirect } from '@sveltejs/kit';
import { createPocketBaseClient } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

/**
 * Legacy URL redirect handler for old edition URLs.
 *
 * Old format: /project/{collectionPubNum}/edition/{editionPubNum}/index.html
 * New format: /editions/{editionId}
 *
 * Also catches any extra path segments after the edition number (e.g.,
 * /project/1/edition/2/some/deep/path) and redirects to the canonical
 * edition page.
 */
export const GET: RequestHandler = async ({ params }) => {
	const collectionPubNum = parseInt(params.project, 10);
	const editionPubNum = parseInt(params.edition, 10);

	// Validate numeric parameters
	if (isNaN(collectionPubNum) || isNaN(editionPubNum)) {
		throw error(400, 'Invalid project or edition number — expected numeric values.');
	}

	const pb = createPocketBaseClient();

	try {
		// 1. Look up the collection by its pubNum
		const collectionResult = await pb.collection('collections').getList(1, 1, {
			filter: `pubNum = ${collectionPubNum}`
		});

		if (collectionResult.items.length === 0) {
			throw error(
				404,
				`Collection #${collectionPubNum} not found. It may have been removed or renumbered.`
			);
		}

		const collection = collectionResult.items[0];

		// 2. Look up the edition within that collection by its pubNum
		const editionResult = await pb.collection('editions').getList(1, 1, {
			filter: `collection = "${collection.id}" && pubNum = ${editionPubNum} && isPublished = true`
		});

		if (editionResult.items.length === 0) {
			// Try without the isPublished filter — it might exist but be unpublished
			const anyEditionResult = await pb.collection('editions').getList(1, 1, {
				filter: `collection = "${collection.id}" && pubNum = ${editionPubNum}`
			});

			if (anyEditionResult.items.length === 0) {
				throw error(
					404,
					`Edition #${editionPubNum} not found in collection "${collection.title}" (#${collectionPubNum}).`
				);
			}

			// Edition exists but isn't published
			throw error(
				410,
				`Edition #${editionPubNum} in "${collection.title}" is no longer published.`
			);
		}

		const edition = editionResult.items[0];

		// 3. 301 redirect to the canonical edition page
		throw redirect(301, `/editions/${edition.id}`);
	} catch (e: unknown) {
		// Re-throw SvelteKit redirect/error responses
		if (e instanceof Error && 'status' in e && 'body' in e) {
			throw e;
		}
		console.error('Legacy edition redirect error:', e);
		throw error(500, 'Internal server error while processing legacy URL redirect.');
	}
};
