// Site configuration
export interface Site {
	id: string;
	name: string;
	blog: string | null;
	publishedProjectCount: number;
	lastPublished: string | null;
	processing: boolean;
	featured: string[]; // Array of pubNums
	sweeperStartTm: string | null;
	dcDateCreated: string | null;
	dcDateModified: string | null;
}

// User
export interface User {
	id: string;
	mongoId: string;
	userHash: string;
	email: string | null;
	nickname: string | null;
	role: string; // root, user, etc.
}

// Keyword/taxonomy entry
export interface Keyword {
	id: string;
	category: string; // country, period, subject, audience, etc.
	value: string;
}

// Collection (project in MongoDB)
export interface Collection {
	id: string;
	mongoId: string;
	slug: string;
	title: string;
	description: string;
	thumbnail: string;
	editionIds: string[];
	created: string;
	// Full fields
	site: string | null;
	isVisible: boolean;
	lastPublished: string | null;
	pubNum: number;
	// Dublin Core
	dcTitle: string | null;
	dcSubtitle: string | null;
	dcAbstract: string | null;
	dcDescription: string | null;
	dcCreator: string[];
	dcContributor: string[];
	dcInstitution: string[];
	dcSubject: string[];
	dcLanguage: string[];
	dcCoveragePeriod: string | null;
	dcCoveragePlace: string | null;
	dcDateCreated: string | null;
	dcDateModified: string | null;
}

// Edition - complete type
export interface Edition {
	id: string;
	mongoId?: string;
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

	// Publishing
	isPublished: boolean;
	pubNum: number;
	collectionId: string;
	collection?: Collection;

	// Dublin Core - Basic
	dcTitle: string | null;
	dcSubtitle: string | null;
	dcAbstract: string | null;
	dcDescription: string | null;

	// Dublin Core - People/Orgs
	dcCreator: string[];
	dcContributor: string[];
	dcInstitution: string[];
	dcContact: string | null;

	// Dublin Core - Classification
	dcSubject: string[];
	dcKeyword: string[];
	dcAudience: string[];
	dcLanguage: string[];
	dcSource: string[];

	// Dublin Core - Coverage (geography/time)
	dcCoveragePeriod: string[];
	dcCoveragePlace: string | null;
	dcCoverageCountry: string[];
	dcCoverageTemporal: string | null;
	dcCoverageGeo: string | null;

	// Dublin Core - Rights
	dcRightsHolder: string | null;
	dcRightsLicense: string | null;

	// Dublin Core - Dates
	dcDatePublished: string | null;
	dcDateUnPublished: string | null;
	dcDateCreated: string | null;
	dcDateModified: string | null;

	// Dublin Core - Other
	dcFunder: string[];
	dcProvenance: string | null;
	dcDoi: string[];

	// Peer Review
	peerReviewKind: string | null;
	peerReviewContent: string | null;
	hasPeerReview: boolean;

	// Settings
	settingsAuthorToolName: string | null;
	settingsAuthorToolVersion: string | null;
	settingsSceneFile: string | null;
}

// Project-User relationship
export interface ProjectUser {
	id: string;
	mongoId: string;
	collection: string; // Collection ID
	user: string | null; // User ID
	userHash: string;
	role: string; // organiser, editor, etc.
}

// Edition-User relationship
export interface EditionUser {
	id: string;
	mongoId: string;
	edition: string; // Edition ID
	user: string | null; // User ID
	userHash: string;
	role: string; // editor, viewer, etc.
}

// Filter category definition
export interface FilterCategory {
	key: keyof Pick<
		Edition,
		'dcSubject' | 'dcAudience' | 'dcLanguage' | 'dcCoverageCountry' | 'dcCoveragePeriod'
	>;
	label: string;
	icon?: string;
}

// Filter state for UI
export interface FilterState {
	dcSubject: string[];
	dcAudience: string[];
	dcLanguage: string[];
	dcCoverageCountry: string[];
	dcCoveragePeriod: string[];
}
