import type { PageLoad } from './$types';

// Disable SSR - we'll use persisted store on client
export const ssr = false;

export const load: PageLoad = async () => {
	// Data is loaded client-side from persisted store
	return {};
};
