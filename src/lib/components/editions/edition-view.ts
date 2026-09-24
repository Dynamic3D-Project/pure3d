import type { Credit } from '$lib/types/credits';
import type { EditionStatus } from '$lib/types/roles';

export interface ViewPreset {
	name: string;
	yaw: number;
	pitch: number;
	offsetX?: number;
	offsetY?: number;
	offsetZ?: number;
}

export interface EditionVersion {
	id: string;
	slug: string;
	title: string;
	pubNum: number;
	status: string | null;
	dcDoi: string[];
	modelSize: string | null;
	dcAbstract: string;
	created: string;
	hasPeerReview: boolean;
	thumbnail: string;
}

export interface EditionViewData {
	edition: {
		id: string;
		slug: string;
		title: string;
		description: string;
		authors: string;
		thumbnail: string;
		voyagerUrl: string;
		voyagerRoot: string;
		voyagerResourceRoot: string;
		voyagerVersion: string;
		sceneFile: string;
		uploadedAssetMap?: Record<string, string>;
		usageConditions: string;
		alternativeVersion: string | null;
		tags: string[];
		created: string;
		hasPeerReview: boolean;
		peerReviewRequested?: boolean;
		peerReviewKind: string | null;
		peerReviewContent: string | null;
		modelSize: string | null;
		pubNum: number;
		dcDoi: string[];
		dcInstitution: string[];
		credits: Credit[];
		dcCoveragePeriod: string | string[] | null;
		dcCoveragePlace: string | null;
		settingsAuthorToolVersion: string | null;
		settingsAuthorToolName: string | null;
		dcProvenance: string | null;
		status: EditionStatus | null;
		isPublished: boolean;
		collectionId: string | null;
		collectionTitle?: string;
		viewPresets?: ViewPreset[];
		showVoyagerMenu?: boolean;
		printables?: {
			title: string;
			description: string;
			type: string;
			size: string;
			url: string;
			filename?: string;
		}[];
		demoReviewFeedback?: {
			id: string;
			category: string;
			targetLabel: string;
			comment: string;
			reviewer: string;
			created: string;
			resolved: boolean;
		}[];
	};
	siblingEditions: EditionVersion[];
	viewerHelp: string | null;
	viewerHelpVideoUrl: string | null;
}
