export interface Collection {
	id: string;
	slug: string;
	title: string;
	description: string;
	thumbnail: string;
	editionIds: string[];
	created: string;
}

export interface Edition {
	id: string;
	slug: string;
	title: string;
	description: string;
	authors: string;
	thumbnail: string;
	voyagerUrl: string;
	usageConditions: string;
	alternativeVersion: string | null;
	tags: string[];
	created: string;
}
