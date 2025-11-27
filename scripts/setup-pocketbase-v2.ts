#!/usr/bin/env bun
/**
 * Complete PocketBase setup using correct 0.30 API format
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const PB_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@admin.local';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || '1234567890';
const JSON_DIR = 'data/json-output';

let authToken = '';

async function authenticate() {
  const response = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });

  if (!response.ok) throw new Error(`Auth failed: ${await response.text()}`);

  const data = await response.json();
  authToken = data.token;
  console.log('✅ Authenticated\n');
}

async function createOrUpdateCollection(name: string, fields: any[], deleteFirst = false) {
  // Check if exists
  const checkResponse = await fetch(`${PB_URL}/api/collections/${name}`, {
    headers: { 'Authorization': authToken }
  });

  if (checkResponse.ok && deleteFirst) {
    const existing = await checkResponse.json();
    await fetch(`${PB_URL}/api/collections/${existing.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': authToken }
    });
    console.log(`   🗑️  Deleted old ${name} collection`);
    await new Promise(r => setTimeout(r, 500)); // Wait for name to be freed
  }

  if (!checkResponse.ok || deleteFirst) {
    // Create new with public read access
    const createResponse = await fetch(`${PB_URL}/api/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      },
      body: JSON.stringify({
        name,
        type: 'base',
        fields,
        listRule: '',  // Allow public list access
        viewRule: ''   // Allow public view access
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create ${name}: ${await createResponse.text()}`);
    }

    const result = await createResponse.json();
    console.log(`   ✅ ${name} created (ID: ${result.id})`);
    return result.id;
  } else {
    const existing = await checkResponse.json();
    console.log(`   ℹ️  ${name} already exists (ID: ${existing.id})`);
    return existing.id;
  }
}

async function main() {
  console.log('🚀 PocketBase Complete Setup v2\n');

  // Wait for PocketBase
  console.log('⏳ Waiting for PocketBase...');
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${PB_URL}/api/health`);
      if (res.ok) {
        // Wait a bit more for admin endpoints to be ready
        await new Promise(r => setTimeout(r, 3000));
        break;
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));
  }

  await authenticate();

  console.log('📦 Creating collections...\n');

  // Create site collection
  const siteId = await createOrUpdateCollection('site', [
    { name: 'name', type: 'text', required: true },
    { name: 'blog', type: 'url' },
    { name: 'publishedProjectCount', type: 'number' }
  ], true);

  // Create collections collection (renamed from projects)
  const collectionsId = await createOrUpdateCollection('collections', [
    { name: 'title', type: 'text', required: true },
    { name: 'siteId', type: 'relation', collectionId: siteId, maxSelect: 1 },
    { name: 'isVisible', type: 'bool' },
    { name: 'pubNum', type: 'number' },
    { name: 'thumbnail', type: 'url' },
    { name: 'dcTitle', type: 'text' },
    { name: 'dcAbstract', type: 'editor' }
  ], true);

  // Create editions collection
  const editionsId = await createOrUpdateCollection('editions', [
    { name: 'title', type: 'text', required: true },
    { name: 'collection', type: 'relation', collectionId: collectionsId, maxSelect: 1, cascadeDelete: true },
    { name: 'isPublished', type: 'bool' },
    { name: 'pubNum', type: 'number' },
    { name: 'thumbnail', type: 'url' },
    { name: 'dcTitle', type: 'text' },
    { name: 'dcAbstract', type: 'editor' },
    { name: 'dcCreator', type: 'json' },
    { name: 'dcKeyword', type: 'json' },
    { name: 'peerReviewKind', type: 'text' },
    { name: 'peerReviewContent', type: 'editor' }
  ], true);

  console.log('\n📥 Importing data...\n');

  // Import site
  console.log('📦 Importing site...');
  const siteData = JSON.parse(readFileSync(join(JSON_DIR, 'site.json'), 'utf-8'));
  for (const doc of siteData) {
    await fetch(`${PB_URL}/api/collections/site/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      },
      body: JSON.stringify({
        name: doc.name,
        blog: doc.blog,
        publishedProjectCount: doc.publishedProjectCount || 0
      })
    });
  }
  console.log(`   ✅ Imported 1 site\n`);

  // Import collections (renamed from projects)
  console.log('📦 Importing collections...');
  const projectsData = JSON.parse(readFileSync(join(JSON_DIR, 'project.json'), 'utf-8'));
  const collectionIdMap = new Map();

  const siteResponse = await fetch(`${PB_URL}/api/collections/site/records`, {
    headers: { 'Authorization': authToken }
  });
  const siteRecords = await siteResponse.json();
  const pbSiteId = siteRecords.items[0]?.id;

  let imported = 0;
  for (const doc of projectsData) {
    const collectionPubNum = doc.pubNum || 0;
    const thumbnailUrl = collectionPubNum > 0
      ? `https://editions.pure3d.eu/project/${collectionPubNum}/icon.png`
      : '';

    const response = await fetch(`${PB_URL}/api/collections/collections/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      },
      body: JSON.stringify({
        title: doc.title,
        siteId: pbSiteId,
        isVisible: doc.isVisible !== false,
        pubNum: collectionPubNum,
        thumbnail: thumbnailUrl,
        dcTitle: doc.dc?.title,
        dcAbstract: doc.dc?.abstract
      })
    });

    if (response.ok) {
      const result = await response.json();
      collectionIdMap.set(doc._id, result.id);
      imported++;
      process.stdout.write(`\r   Progress: ${imported}/${projectsData.length}`);
    }
  }
  console.log(`\n   ✅ Imported ${imported} collections\n`);

  // Import editions
  console.log('📦 Importing editions...');
  const editionsData = JSON.parse(readFileSync(join(JSON_DIR, 'edition.json'), 'utf-8'));

  imported = 0;
  for (const doc of editionsData) {
    const pbCollectionId = collectionIdMap.get(doc.projectId);
    if (!pbCollectionId) continue;

    // Get collection pubNum for thumbnail
    const collectionResponse = await fetch(`${PB_URL}/api/collections/collections/records/${pbCollectionId}`, {
      headers: { 'Authorization': authToken }
    });
    const collection = await collectionResponse.json();
    const collectionPubNum = collection.pubNum || 0;
    const editionPubNum = doc.pubNum || 1;
    const thumbnailUrl = `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/icon.png`;

    const response = await fetch(`${PB_URL}/api/collections/editions/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      },
      body: JSON.stringify({
        title: doc.title,
        collection: pbCollectionId,
        isPublished: doc.isPublished === true,
        pubNum: editionPubNum,
        thumbnail: thumbnailUrl,
        dcTitle: doc.dc?.title,
        dcAbstract: doc.dc?.abstract,
        dcCreator: doc.dc?.creator || [],
        dcKeyword: doc.dc?.keyword || [],
        peerReviewKind: doc.dc?.peerReviewKind || null,
        peerReviewContent: doc.dc?.peerReviewContent || null
      })
    });

    if (response.ok) {
      imported++;
      process.stdout.write(`\r   Progress: ${imported}/${editionsData.length}`);
    }
  }
  console.log(`\n   ✅ Imported ${imported} editions\n`);

  console.log('='.repeat(60));
  console.log('✅ Setup completed successfully!');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('\n❌ Setup failed:', error);
  process.exit(1);
});
