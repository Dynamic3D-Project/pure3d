import PocketBase from 'pocketbase';
import { POCKETBASE_URL } from '$env/static/private';

/**
 * Create a PocketBase client for server-side use
 */
export function createPocketBaseClient() {
	const pb = new PocketBase(POCKETBASE_URL || 'http://127.0.0.1:7090');

	// Disable auto-cancellation for server-side requests
	pb.autoCancellation(false);

	return pb;
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

		return records.map(record => {
			const pubNum = record.pubNum || 0;

			// Generate thumbnail URL dynamically
			const thumbnail = pubNum > 0
				? `https://editions.pure3d.eu/project/${pubNum}/icon.png`
				: record.thumbnail || '';

			return {
				id: record.id,
				title: record.title,
				thumbnail,
				isVisible: record.isVisible,
				pubNum: record.pubNum,
				dcTitle: record.dcTitle,
				dcAbstract: record.dcAbstract
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

		// Generate thumbnail URL dynamically
		const thumbnail = pubNum > 0
			? `https://editions.pure3d.eu/project/${pubNum}/icon.png`
			: record.thumbnail || '';

		return {
			id: record.id,
			title: record.title,
			thumbnail,
			isVisible: record.isVisible,
			pubNum: record.pubNum,
			dcTitle: record.dcTitle,
			dcAbstract: record.dcAbstract
		};
	} catch (error) {
		console.error('Error fetching collection:', error);
		return null;
	}
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
		const records = result.items;

		return records.map(record => {
			const collection = record.expand?.collection;
			const collectionPubNum = collection?.pubNum || 0;
			const editionPubNum = record.pubNum || 1;

			// Generate Voyager URL dynamically
			const voyagerUrl = collectionPubNum > 0
				? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/voyager`
				: '';

			// Generate thumbnail URL dynamically (don't rely on stored value)
			const thumbnail = collectionPubNum > 0
				? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/icon.png`
				: record.thumbnail || '';

			return {
				id: record.id,
				slug: record.id,
				title: record.dcTitle || record.title,
				description: record.dcAbstract || '',
				authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
				thumbnail,
				voyagerUrl,
				usageConditions: '',
				alternativeVersion: null,
				tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
				created: record.created,
				isPublished: record.isPublished,
				pubNum: record.pubNum,
				dcTitle: record.dcTitle,
				dcAbstract: record.dcAbstract,
				dcCreator: record.dcCreator,
				dcKeyword: record.dcKeyword,
				collectionId: record.collection,
				collection: record.expand?.collection,
				// Filter fields
				dcSubject: Array.isArray(record.dcSubject) ? record.dcSubject : [],
				dcAudience: Array.isArray(record.dcAudience) ? record.dcAudience : [],
				dcLanguage: Array.isArray(record.dcLanguage) ? record.dcLanguage : [],
				dcCoverageCountry: Array.isArray(record.dcCoverageCountry) ? record.dcCoverageCountry : [],
				dcCoveragePeriod: Array.isArray(record.dcCoveragePeriod) ? record.dcCoveragePeriod : []
			};
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
		const records = result.items;

		return records.map(record => {
			const collection = record.expand?.collection;
			const collectionPubNum = collection?.pubNum || 0;
			const editionPubNum = record.pubNum || 1;

			// Generate Voyager URL dynamically
			const voyagerUrl = collectionPubNum > 0
				? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/voyager`
				: '';

			// Generate thumbnail URL dynamically
			const thumbnail = collectionPubNum > 0
				? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/icon.png`
				: record.thumbnail || '';

			return {
				id: record.id,
				slug: record.id,
				title: record.dcTitle || record.title,
				description: record.dcAbstract || '',
				authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
				thumbnail,
				voyagerUrl,
				usageConditions: '',
				alternativeVersion: null,
				tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
				created: record.created,
				isPublished: record.isPublished,
				pubNum: record.pubNum,
				dcTitle: record.dcTitle,
				dcAbstract: record.dcAbstract,
				dcCreator: record.dcCreator,
				dcKeyword: record.dcKeyword,
				collectionId: record.collection
			};
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
		const collectionPubNum = collection?.pubNum || 0;
		const editionPubNum = record.pubNum || 1;

		// Generate Voyager URL dynamically
		const voyagerUrl = collectionPubNum > 0
			? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/voyager`
			: '';

		// Generate thumbnail URL dynamically
		const thumbnail = collectionPubNum > 0
			? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/icon.png`
			: record.thumbnail || '';

		return {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			authors: Array.isArray(record.dcCreator) ? record.dcCreator.join(', ') : '',
			thumbnail,
			voyagerUrl,
			usageConditions: '',
			alternativeVersion: null,
			tags: Array.isArray(record.dcKeyword) ? record.dcKeyword : [],
			created: record.created,
			isPublished: record.isPublished,
			pubNum: record.pubNum,
			dcTitle: record.dcTitle,
			dcAbstract: record.dcAbstract,
			dcCreator: record.dcCreator,
			dcKeyword: record.dcKeyword,
			collectionId: record.collection,
			collection: record.expand?.collection
		};
	} catch (error) {
		console.error('Error fetching edition:', error);
		return null;
	}
}
