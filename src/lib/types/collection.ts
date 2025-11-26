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
	// Filter fields (Dublin Core metadata)
	dcSubject?: string[];
	dcAudience?: string[];
	dcLanguage?: string[];
	dcCoverageCountry?: string[];
	dcCoveragePeriod?: string[];
}

export interface FilterCategory {
	key: keyof Pick<Edition, 'dcSubject' | 'dcAudience' | 'dcLanguage' | 'dcCoverageCountry' | 'dcCoveragePeriod'>;
	label: string;
	icon?: string;
}

export interface FilterState {
	dcSubject: string[];
	dcAudience: string[];
	dcLanguage: string[];
	dcCoverageCountry: string[];
	dcCoveragePeriod: string[];
}
