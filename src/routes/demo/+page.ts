import type { PageLoad } from './$types';
import {
	getEditionRoot,
	getEditionThumbnailUrl,
	getVoyagerResourceRoot,
	DEFAULT_VOYAGER_VERSION
} from '$lib/utils/asset-urls';

export const ssr = false;

const makeTextResource = (title: string, body: string) =>
	`data:text/plain;charset=utf-8,${encodeURIComponent(`${title}\n\n${body}`)}`;

export const load: PageLoad = async () => {
	const voyagerVersion = DEFAULT_VOYAGER_VERSION;
	const voyagerResourceRoot = getVoyagerResourceRoot(voyagerVersion);

	const showcaseEditionPubNum = 1;
	const apiCollectionPubNum = 13;
	const apiEditionPubNum = 1;

	const edition = {
		id: 'demo',
		slug: 'demo',
		title: '[DEMO] The Battle at 25 Northumberland Road',
		description:
			'This public demo combines the scholarly edition experience with Voyager API controls. Explore the [[view:right|right side of the building]], inspect the [[view:front|front entrance]], compare the [[view:top|street layout from above]], or switch to [[view:street-level|street level]] to understand the historical scene as a spatial argument.',
		authors:
			'Susan Schreibman, Kelly Gillikin Schoueri, John Kaulakis, Luca Moine, Sandra Martinez Bohme',
		dcCreator: [
			'Susan Schreibman',
			'Kelly Gillikin Schoueri',
			'John Kaulakis',
			'Luca Moine',
			'Sandra Martinez Bohme'
		],
		dcInstitution: ['Maastricht University', 'King\'s Digital Lab', 'PURE3D'],
		dcDoi: ['10.60131/p3d.demo.01'],
		dcCoveragePeriod: '1916 Easter Rising',
		dcCoveragePlace: '25 Northumberland Road, Dublin, Ireland',
		dcProvenance:
			'Demo record assembled from static project assets to show publication metadata, peer review, reusable teaching resources, and versioning without requiring PocketBase data.',
		thumbnail: getEditionThumbnailUrl(showcaseEditionPubNum, 1),
		voyagerUrl: '',
		voyagerRoot: getEditionRoot(showcaseEditionPubNum, 1),
		voyagerResourceRoot,
		voyagerVersion,
		sceneFile: 'scene.svx.json',
		usageConditions: 'CC BY-NC 4.0: attribution required; non-commercial reuse permitted.',
		alternativeVersion: null,
		tags: ['demo', '3D scholarly edition', 'peer review', 'printables', 'Voyager API'],
		created: '2025-01-21T00:00:00Z',
		hasPeerReview: true,
		peerReviewKind: 'Open peer review',
		peerReviewContent:
			'Reviewer 1: The edition demonstrates a clear relationship between the historical claim and the spatial evidence. The view links are especially useful for moving readers between narrative interpretation and specific architectural details.\n\nReviewer 2: The metadata, provenance statement, and licensing information make this a strong example of a reusable 3D publication. I recommend keeping the printable teaching resources alongside the model so classroom use is visible from the publication page.\n\nEditorial decision: Accepted for demo publication after minor revisions to the introductory description and the addition of version-history notes.',
		modelSize: '~19 MB',
		pubNum: showcaseEditionPubNum,
		collectionId: 'demo-collection',
		status: 'published',
		isPublished: true,
		settingsAuthorToolName: 'Voyager Story',
		settingsAuthorToolVersion: voyagerVersion,
		viewPresets: [
			{ name: 'front', yaw: 0, pitch: -25, offsetX: 0, offsetY: 0, offsetZ: 0 },
			{ name: 'right', yaw: 90, pitch: -25, offsetX: 1.6, offsetY: 0, offsetZ: 0 },
			{ name: 'back', yaw: 180, pitch: -25, offsetX: 0, offsetY: 0, offsetZ: -1.4 },
			{ name: 'left', yaw: -90, pitch: -25, offsetX: -1.6, offsetY: 0, offsetZ: 0 },
			{ name: 'top', yaw: 0, pitch: -89, offsetX: 0, offsetY: 0.5, offsetZ: 0 },
			{ name: 'corner', yaw: 45, pitch: -35, offsetX: 1.2, offsetY: 0, offsetZ: 1.2 },
			{ name: 'street-level', yaw: 15, pitch: -5, offsetX: 0, offsetY: -1, offsetZ: 1.1 }
		],
		printables: [
			{
				title: 'Classroom Worksheet',
				type: 'PDF handout',
				description: 'Guided observation prompts for comparing model views with the historical argument.',
				size: '2 pages',
				url: makeTextResource(
					'Classroom Worksheet',
					'Observe the front entrance, right side, and street-level views. Record one spatial feature, one historical claim, and one question for discussion.'
				),
				filename: 'pure3d-demo-classroom-worksheet.txt'
			},
			{
				title: 'Citation Sheet',
				type: 'Reference export',
				description: 'Chicago-style citation, DOI, license, and attribution text for reuse.',
				size: '1 page',
				url: makeTextResource(
					'Citation Sheet',
					'Susan Schreibman, Kelly Gillikin Schoueri, John Kaulakis, Luca Moine, Sandra Martinez Bohme. [DEMO] The Battle at 25 Northumberland Road. Pure 3D, ed. 01 (2025). doi:10.60131/p3d.demo.01. License: CC BY-NC 4.0.'
				),
				filename: 'pure3d-demo-citation-sheet.txt'
			},
			{
				title: 'Exhibition Label',
				type: 'Printable label',
				description: 'Short public-facing summary suitable for a gallery or workshop setting.',
				size: 'A5',
				url: makeTextResource(
					'Exhibition Label',
					'This 3D scholarly edition uses spatial reconstruction to explain how the built environment shaped events at 25 Northumberland Road during the 1916 Easter Rising.'
				),
				filename: 'pure3d-demo-exhibition-label.txt'
			},
			{
				title: '3D Print Preparation Notes',
				type: 'Fabrication guide',
				description: 'Scale, material, and orientation notes for preparing a simplified print.',
				size: 'Checklist',
				url: makeTextResource(
					'3D Print Preparation Notes',
					'Use a simplified mesh, check wall thickness, orient the facade upward for inspection, and include citation and license metadata with the printed object.'
				),
				filename: 'pure3d-demo-3d-print-notes.txt'
			}
		],
		demoReviewFeedback: [
			{
				id: 'demo-feedback-1',
				category: 'annotation',
				targetLabel: 'Front entrance annotation',
				comment:
					'Clarify why this entrance matters for the interpretation instead of only naming the feature.',
				reviewer: 'Reviewer 1',
				created: '2025-01-08T00:00:00Z',
				resolved: true
			},
			{
				id: 'demo-feedback-2',
				category: 'metadata',
				targetLabel: 'Rights statement',
				comment: 'Add a reuse note that distinguishes classroom use from model redistribution.',
				reviewer: 'Reviewer 2',
				created: '2025-01-10T00:00:00Z',
				resolved: true
			},
			{
				id: 'demo-feedback-3',
				category: 'general',
				targetLabel: 'Printable resources',
				comment: 'Include a compact worksheet so the demo can support hands-on workshops.',
				reviewer: 'Editor',
				created: '2025-01-12T00:00:00Z',
				resolved: false
			}
		]
	};

	const apiEdition = {
		id: 'demo-api',
		title: 'Demo API Sandbox - The Baby Doll',
		authors: 'Nina Steuermann, Lena Reichel',
		voyagerRoot: getEditionRoot(apiCollectionPubNum, apiEditionPubNum),
		voyagerResourceRoot,
		voyagerVersion,
		sceneFile: 'scene.svx.json',
		usageConditions: 'CC BY: attribution required.',
		tags: ['demo', 'testing', 'Voyager controls', 'API sandbox']
	};

	const siblingEditions = [
		{
			id: 'demo-v0',
			slug: 'demo-v0',
			title: '[DEMO] Northumberland Road - review draft',
			pubNum: 0,
			status: 'archived',
			dcDoi: ['10.60131/p3d.demo.00'],
			modelSize: '~16 MB',
			dcAbstract: 'Earlier demo draft with fewer annotations and no printable resources.',
			created: '2024-11-15T00:00:00Z',
			hasPeerReview: false,
			thumbnail: getEditionThumbnailUrl(showcaseEditionPubNum, 1)
		}
	];

	return {
		edition,
		apiEdition,
		siblingEditions
	};
};
