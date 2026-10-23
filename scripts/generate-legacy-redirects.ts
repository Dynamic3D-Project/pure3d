#!/usr/bin/env bun
import PocketBase from 'pocketbase';
import { legacyEditionDestinations } from '../src/lib/utils/legacy-publications';

// Public records only. Redirect generation never needs administrator credentials.
const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL || 'https://api.pure3d.eu');
const collections = await pb.collection('collections').getFullList({
	filter: 'isVisible = true && pubNum > 0',
	fields: 'id,pubNum',
	sort: 'pubNum'
});
const editions = await pb.collection('editions').getFullList({
	filter: 'isPublished = true && pubNum > 0',
	fields: 'id,mongoId,collection,pubNum',
	sort: 'pubNum'
});
const parents = new Map(collections.map((record) => [record.id, record.pubNum]));
const slots = new Set<string>();
const lines = [
	'# Generated from public PocketBase records; include at nginx http scope.',
	'map $uri $pure3d_legacy_destination {',
	'    default "";',
	'    / https://pure3d.eu/;',
	'    /index.html https://pure3d.eu/;',
	'    /projects.html https://pure3d.eu/collections;',
	'    /editions.html https://pure3d.eu/editions;',
	'    /about.html https://pure3d.eu/documentation/about;',
	'    /call_for_projects.html https://pure3d.eu/documentation;'
];

function add(path: string, destination: string) {
	if (slots.has(path)) throw new Error(`Ambiguous legacy publication slot: ${path}`);
	slots.add(path);
	lines.push(`    ~^${path}(?:/(?:index(?:-voyager-[0-9.]+)?\\.html)?)?$ ${destination};`);
}

for (const collection of collections) {
	if (!Number.isSafeInteger(collection.pubNum) || !/^[a-z0-9]{15}$/.test(collection.id))
		throw new Error('Invalid public collection identity');
	add(`/project/${collection.pubNum}`, `https://pure3d.eu/collections/${collection.id}`);
}
for (const edition of editions) {
	const parent = parents.get(edition.collection);
	if (!parent) continue;
	const canonical = legacyEditionDestinations[`${parent}/${edition.pubNum}`];
	if (canonical) {
		if (
			!editions.some(
				(record) =>
					record.id === canonical.id &&
					record.mongoId === canonical.mongoId &&
					record.collection === edition.collection &&
					record.pubNum === edition.pubNum
			)
		)
			throw new Error(
				'The reviewed legacy destination is no longer published in its original slot'
			);
		if (edition.id !== canonical.id) continue;
	}
	if (!Number.isSafeInteger(edition.pubNum) || !/^[a-z0-9]{15}$/.test(edition.id))
		throw new Error('Invalid public edition identity');
	add(`/project/${parent}/edition/${edition.pubNum}`, `https://pure3d.eu/editions/${edition.id}`);
}
lines.push('}');
console.log(lines.join('\n'));
