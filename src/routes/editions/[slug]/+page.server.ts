import { getEdition } from '$lib/server/pocketbase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const edition = await getEdition(params.slug);

	if (!edition) {
		throw error(404, 'Edition not found');
	}

	return {
		edition: {
			...edition,
			usageConditions: 'CC BY-NC 4.0'
		}
	};
};
