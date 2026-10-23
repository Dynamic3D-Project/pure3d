import { error } from '@sveltejs/kit';
import { base } from '$app/paths';
import type { PageLoad } from './$types';

const destinations: Record<string, string> = {
	index: '/',
	projects: '/collections',
	editions: '/editions',
	about: '/documentation/about',
	call_for_projects: '/documentation'
};

export const load: PageLoad = ({ params, url }) => {
	const destination = Object.hasOwn(destinations, params.legacyPage)
		? destinations[params.legacyPage]
		: undefined;
	if (!destination) error(404, 'This legacy page is not available.');
	return { destination: `${base}${destination}${url.search}` };
};
