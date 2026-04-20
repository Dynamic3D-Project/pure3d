import { pb } from '$lib/database/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async ({ params }) => {
	try {
		const collection = await pb.collection('collections').getOne(params.slug);
		return { collection };
	} catch {
		throw error(404, 'Collection not found');
	}
};
