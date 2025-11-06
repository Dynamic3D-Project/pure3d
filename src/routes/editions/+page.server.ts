import { getEditions } from '$lib/server/pocketbase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const editions = await getEditions();

	return {
		editions
	};
};
