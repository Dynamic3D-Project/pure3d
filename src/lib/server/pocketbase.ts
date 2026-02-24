import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { GlobalRole, CollectionRole, EditionRole, EditionStatus } from '$lib/types/roles';

/**
 * Create a PocketBase client
 */
export function createPocketBaseClient() {
	const pb = new PocketBase(PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090');

	// Disable auto-cancellation for server-side requests
	pb.autoCancellation(false);

	return pb;
}

/**
 * Get public file URL (for browser access)
 * Uses PUBLIC_POCKETBASE_URL instead of internal Docker URL
 */
export function getPublicFileUrl(record: any, filename: string): string {
	const baseUrl = PUBLIC_POCKETBASE_URL || 'http://localhost:7090';
	return `${baseUrl}/api/files/${record.collectionId}/${record.id}/${filename}`;
}

/**
 * Get site configuration
 */
export async function getSite() {
	const pb = createPocketBaseClient();

	try {
		const result = await pb.collection('site').getList(1, 1);
		const record = result.items[0];

		if (!record) return null;

		return {
			id: record.id,
			name: record.name,
			blog: record.blog || null,
			publishedProjectCount: record.publishedProjectCount || 0,
			lastPublished: record.lastPublished || null,
			processing: record.processing || false,
			featured: record.featured || [],
			sweeperStartTm: record.sweeperStartTm || null,
			dcDateCreated: record.dcDateCreated || null,
			dcDateModified: record.dcDateModified || null,
			viewerHelp: record.viewerHelp || null,
			viewerHelpVideoUrl: record.viewerHelpVideoUrl || null
		};
	} catch (error) {
		console.error('Error fetching site:', error);
		return null;
	}
}

/**
 * Get all user profiles (app-level user data)
 */
export async function getUsers() {
	const pb = createPocketBaseClient();

	try {
		const result = await pb.collection('userProfiles').getList(1, 500);
		return result.items.map((record) => ({
			id: record.id,
			mongoId: record.mongoId,
			userHash: record.userHash,
			email: record.email || null,
			nickname: record.nickname || null,
			role: (record.role as GlobalRole) || GlobalRole.Viewer
		}));
	} catch (error) {
		console.error('Error fetching users:', error);
		return [];
	}
}

/**
 * Get all keywords/taxonomy
 */
export async function getKeywords() {
	const pb = createPocketBaseClient();

	try {
		const result = await pb.collection('keywords').getList(1, 500);
		return result.items.map((record) => ({
			id: record.id,
			category: record.category,
			value: record.value
		}));
	} catch (error) {
		console.error('Error fetching keywords:', error);
		return [];
	}
}

/**
 * Get keywords by category
 */
export async function getKeywordsByCategory(category: string) {
	const pb = createPocketBaseClient();

	try {
		const result = await pb.collection('keywords').getList(1, 500, {
			filter: `category = "${category}"`
		});
		return result.items.map((record) => record.value);
	} catch (error) {
		console.error('Error fetching keywords by category:', error);
		return [];
	}
}

/**
 * Get all collections
 */
export async function getCollections() {
	const pb = createPocketBaseClient();

	try {
		const result = await pb.collection('collections').getList(1, 500, {
			sort: 'pubNum',
			filter: 'isVisible = true'
		});
		const records = result.items;

		return records.map((record) => {
			const pubNum = record.pubNum || 0;

			// Use uploaded thumbnail file if available, otherwise fall back to URL
			let thumbnail = '';
			if (record.thumbnailFile) {
				thumbnail = getPublicFileUrl(record, record.thumbnailFile);
			} else if (record.thumbnail) {
				thumbnail = record.thumbnail;
			}

			return {
				id: record.id,
				mongoId: record.mongoId,
				slug: record.id,
				title: record.title,
				description: record.dcAbstract || '',
				thumbnail,
				editionIds: [],
				created: record.created,
				site: record.site,
				isVisible: record.isVisible,
				lastPublished: record.lastPublished,
				pubNum: record.pubNum,
				dcTitle: record.dcTitle || null,
				dcSubtitle: record.dcSubtitle || null,
				dcAbstract: record.dcAbstract || null,
				dcDescription: record.dcDescription || null,
				dcCreator: Array.isArray(record.dcCreator) ? record.dcCreator : [],
				dcContributor: Array.isArray(record.dcContributor) ? record.dcContributor : [],
				dcInstitution: Array.isArray(record.dcInstitution) ? record.dcInstitution : [],
				dcSubject: Array.isArray(record.dcSubject) ? record.dcSubject : [],
				dcLanguage: Array.isArray(record.dcLanguage) ? record.dcLanguage : [],
				dcCoveragePeriod: record.dcCoveragePeriod || null,
				dcCoveragePlace: record.dcCoveragePlace || null,
				dcDateCreated: record.dcDateCreated || null,
				dcDateModified: record.dcDateModified || null
			};
		});
	} catch (error) {
		console.error('Error fetching collections:', error);
		return [];
	}
}

/**
 * Get a single collection by ID
 */
export async function getCollection(id: string) {
	const pb = createPocketBaseClient();

	try {
		const record = await pb.collection('collections').getOne(id);
		const pubNum = record.pubNum || 0;

		// Use uploaded thumbnail file if available, otherwise fall back to URL
		let thumbnail = '';
		if (record.thumbnailFile) {
			thumbnail = getPublicFileUrl(record, record.thumbnailFile);
		} else if (record.thumbnail) {
			thumbnail = record.thumbnail;
		}

		return {
			id: record.id,
			mongoId: record.mongoId,
			slug: record.id,
			title: record.title,
			description: record.dcAbstract || '',
			thumbnail,
			editionIds: [],
			created: record.created,
			site: record.site,
			isVisible: record.isVisible,
			lastPublished: record.lastPublished,
			pubNum: record.pubNum,
			dcTitle: record.dcTitle || null,
			dcSubtitle: record.dcSubtitle || null,
			dcAbstract: record.dcAbstract || null,
			dcDescription: record.dcDescription || null,
			dcCreator: Array.isArray(record.dcCreator) ? record.dcCreator : [],
			dcContributor: Array.isArray(record.dcContributor) ? record.dcContributor : [],
			dcInstitution: Array.isArray(record.dcInstitution) ? record.dcInstitution : [],
			dcSubject: Array.isArray(record.dcSubject) ? record.dcSubject : [],
			dcLanguage: Array.isArray(record.dcLanguage) ? record.dcLanguage : [],
			dcCoveragePeriod: record.dcCoveragePeriod || null,
			dcCoveragePlace: record.dcCoveragePlace || null,
			dcDateCreated: record.dcDateCreated || null,
			dcDateModified: record.dcDateModified || null
		};
	} catch (error) {
		console.error('Error fetching collection:', error);
		return null;
	}
}

/**
 * Transform a PocketBase edition record to our Edition type
 */
function transformEditionRecord(record: any, collection?: any) {
	const collectionPubNum = collection?.pubNum || 0;
	const editionPubNum = record.pubNum || 1;

	// Generate Voyager URL dynamically
	const voyagerUrl =
		collectionPubNum > 0
			? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/voyager`
			: '';

	// Use uploaded thumbnail file if available, otherwise fall back to URL
	let thumbnail = '';
	if (record.thumbnailFile) {
		thumbnail = getPublicFileUrl(record, record.thumbnailFile);
	} else if (record.thumbnail) {
		thumbnail = record.thumbnail;
	}

	return {
		id: record.id,
		mongoId: record.mongoId,
		slug: record.id,
		title: record.dcTitle || record.title,
		description: record.dcAbstract || '',
		authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
		thumbnail,
		voyagerUrl,
		usageConditions: record.dcRightsLicense || '',
		alternativeVersion: null,
		tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
		created: record.created,

		// Publishing
		isPublished: record.isPublished,
		status: (record.status as EditionStatus) || EditionStatus.Published,
		pubNum: record.pubNum,
		collectionId: record.collection,
		collection: record.expand?.collection,

		// Dublin Core - Basic
		dcTitle: record.dcTitle || null,
		dcSubtitle: record.dcSubtitle || null,
		dcAbstract: record.dcAbstract || null,
		dcDescription: record.dcDescription || null,

		// Dublin Core - People/Orgs
		dcCreator: Array.isArray(record.dcCreator) ? record.dcCreator : [],
		dcContributor: Array.isArray(record.dcContributor) ? record.dcContributor : [],
		dcInstitution: Array.isArray(record.dcInstitution) ? record.dcInstitution : [],
		dcContact: record.dcContact || null,

		// Dublin Core - Classification
		dcSubject: Array.isArray(record.dcSubject) ? record.dcSubject : [],
		dcKeyword: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
		dcAudience: Array.isArray(record.dcAudience) ? record.dcAudience : [],
		dcLanguage: Array.isArray(record.dcLanguage) ? record.dcLanguage : [],
		dcSource: Array.isArray(record.dcSource) ? record.dcSource : [],

		// Dublin Core - Coverage
		dcCoveragePeriod: Array.isArray(record.dcCoveragePeriod) ? record.dcCoveragePeriod : [],
		dcCoveragePlace: record.dcCoveragePlace || null,
		dcCoverageCountry: Array.isArray(record.dcCoverageCountry) ? record.dcCoverageCountry : [],
		dcCoverageTemporal: record.dcCoverageTemporal || null,
		dcCoverageGeo: record.dcCoverageGeo || null,

		// Dublin Core - Rights
		dcRightsHolder: record.dcRightsHolder || null,
		dcRightsLicense: record.dcRightsLicense || null,

		// Dublin Core - Dates
		dcDatePublished: record.dcDatePublished || null,
		dcDateUnPublished: record.dcDateUnPublished || null,
		dcDateCreated: record.dcDateCreated || null,
		dcDateModified: record.dcDateModified || null,

		// Dublin Core - Other
		dcFunder: Array.isArray(record.dcFunder) ? record.dcFunder : [],
		dcProvenance: record.dcProvenance || null,
		dcDoi: Array.isArray(record.dcDoi) ? record.dcDoi : [],

		// Peer Review
		peerReviewKind: record.peerReviewKind || null,
		peerReviewContent: record.peerReviewContent || null,
		hasPeerReview: !!record.peerReviewKind && record.peerReviewKind !== 'No peer review',

		// Settings
		settingsAuthorToolName: record.settingsAuthorToolName || null,
		settingsAuthorToolVersion: record.settingsAuthorToolVersion || null,
		settingsSceneFile: record.settingsSceneFile || null
	};
}

/**
 * Get all editions
 */
export async function getEditions() {
	const pb = createPocketBaseClient();

	try {
		const result = await pb.collection('editions').getList(1, 500, {
			filter: 'isPublished = true',
			expand: 'collection'
		});

		return result.items.map((record) => {
			const collection = record.expand?.collection;
			return transformEditionRecord(record, collection);
		});
	} catch (error) {
		console.error('Error fetching editions:', error);
		return [];
	}
}

/**
 * Get editions for a specific collection
 */
export async function getEditionsByCollection(collectionId: string) {
	const pb = createPocketBaseClient();

	try {
		const result = await pb.collection('editions').getList(1, 500, {
			sort: 'pubNum',
			filter: `collection = "${collectionId}" && isPublished = true`,
			expand: 'collection'
		});

		return result.items.map((record) => {
			const collection = record.expand?.collection;
			return transformEditionRecord(record, collection);
		});
	} catch (error) {
		console.error('Error fetching editions for collection:', error);
		return [];
	}
}

/**
 * Get a single edition by ID
 */
export async function getEdition(id: string) {
	const pb = createPocketBaseClient();

	try {
		const record = await pb.collection('editions').getOne(id, {
			expand: 'collection'
		});

		const collection = record.expand?.collection;
		return transformEditionRecord(record, collection);
	} catch (error) {
		console.error('Error fetching edition:', error);
		return null;
	}
}

/**
 * Get featured editions (based on site.featured pubNums)
 */
export async function getFeaturedEditions() {
	const pb = createPocketBaseClient();

	try {
		// Get site to find featured pubNums
		const site = await getSite();
		if (!site || !site.featured || site.featured.length === 0) {
			return [];
		}

		// Get all published editions with their collections
		const result = await pb.collection('editions').getList(1, 500, {
			filter: 'isPublished = true',
			expand: 'collection'
		});

		// Filter to featured ones based on collection pubNum
		const featuredPubNums = new Set(site.featured.map(String));
		const featuredEditions = result.items.filter((record) => {
			const collectionPubNum = String(record.expand?.collection?.pubNum || 0);
			return featuredPubNums.has(collectionPubNum);
		});

		return featuredEditions.map((record) => {
			const collection = record.expand?.collection;
			return transformEditionRecord(record, collection);
		});
	} catch (error) {
		console.error('Error fetching featured editions:', error);
		return [];
	}
}

/**
 * Get project users (collection-user relationships)
 */
export async function getProjectUsers(collectionId?: string) {
	const pb = createPocketBaseClient();

	try {
		const filter = collectionId ? `collection = "${collectionId}"` : '';
		const result = await pb.collection('collectionUsers').getList(1, 500, {
			filter,
			expand: 'collection,user'
		});

		return result.items.map((record) => ({
			id: record.id,
			mongoId: record.mongoId,
			collection: record.collection,
			user: record.user,
			userHash: record.userHash,
			role: (record.role as CollectionRole) || CollectionRole.Viewer
		}));
	} catch (error) {
		console.error('Error fetching project users:', error);
		return [];
	}
}

/**
 * Get edition users (edition-user relationships)
 */
export async function getEditionUsers(editionId?: string) {
	const pb = createPocketBaseClient();

	try {
		const filter = editionId ? `edition = "${editionId}"` : '';
		const result = await pb.collection('editionUsers').getList(1, 500, {
			filter,
			expand: 'edition,user'
		});

		return result.items.map((record) => ({
			id: record.id,
			mongoId: record.mongoId,
			edition: record.edition,
			user: record.user,
			userHash: record.userHash,
			role: (record.role as EditionRole) || EditionRole.Collaborator
		}));
	} catch (error) {
		console.error('Error fetching edition users:', error);
		return [];
	}
}

/**
 * Update a user's global role
 */
export async function updateUserRole(userId: string, newRole: GlobalRole) {
	const pb = createPocketBaseClient();

	try {
		await pb.collection('userProfiles').update(userId, { role: newRole });
		return true;
	} catch (error) {
		console.error('Error updating user role:', error);
		return false;
	}
}

// --- Collection User CRUD ---

export async function addCollectionUser(
	collectionId: string,
	userId: string,
	role: CollectionRole
) {
	const pb = createPocketBaseClient();
	return pb.collection('collectionUsers').create({
		collection: collectionId,
		userId,
		user: userId,
		role
	});
}

export async function removeCollectionUser(id: string) {
	const pb = createPocketBaseClient();
	return pb.collection('collectionUsers').delete(id);
}

export async function updateCollectionUserRole(id: string, role: CollectionRole) {
	const pb = createPocketBaseClient();
	return pb.collection('collectionUsers').update(id, { role });
}

// --- Edition User CRUD ---

export async function addEditionUser(editionId: string, userId: string, role: EditionRole) {
	const pb = createPocketBaseClient();
	return pb.collection('editionUsers').create({
		editionId,
		userId,
		user: userId,
		role
	});
}

export async function removeEditionUser(id: string) {
	const pb = createPocketBaseClient();
	return pb.collection('editionUsers').delete(id);
}

export async function updateEditionUserRole(id: string, role: EditionRole) {
	const pb = createPocketBaseClient();
	return pb.collection('editionUsers').update(id, { role });
}

// --- Edition Status ---

export async function updateEditionStatus(editionId: string, newStatus: EditionStatus) {
	const pb = createPocketBaseClient();
	const isPublished = newStatus === EditionStatus.Published;
	return pb.collection('editions').update(editionId, { status: newStatus, isPublished });
}

// --- Admin views (no public filters) ---

export async function getAllCollections() {
	const pb = createPocketBaseClient();

	try {
		const result = await pb.collection('collections').getList(1, 500, {
			sort: 'pubNum'
		});

		return result.items.map((record) => ({
			id: record.id,
			title: record.title,
			isVisible: record.isVisible,
			pubNum: record.pubNum,
			created: record.created
		}));
	} catch (error) {
		console.error('Error fetching all collections:', error);
		return [];
	}
}

export async function getAllEditions() {
	const pb = createPocketBaseClient();

	try {
		const result = await pb.collection('editions').getList(1, 500, {
			expand: 'collection'
		});

		return result.items.map((record) => ({
			id: record.id,
			title: record.dcTitle || record.title,
			isPublished: record.isPublished,
			status: (record.status as EditionStatus) || EditionStatus.Draft,
			pubNum: record.pubNum,
			collectionId: record.collection,
			collectionTitle: record.expand?.collection?.title || '',
			created: record.created
		}));
	} catch (error) {
		console.error('Error fetching all editions:', error);
		return [];
	}
}
