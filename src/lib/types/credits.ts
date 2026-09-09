export type Credit = {
	type: 'person' | 'org';
	name: string;
	orcid: string | null;
	role: 'creator' | 'contributor';
	provenance: 'manual' | 'oauth';
	userId?: string;
	contributionRole?: string;
};
