#!/usr/bin/env bun
/**
 * Creates all PocketBase collections via API
 * Two-phase approach: 1) Create base collections, 2) Add relation fields
 */
import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

const pb = new PocketBase(POCKETBASE_URL);

async function authenticate() {
  console.log('🔑 Authenticating with existing admin account...');
  console.log(`   Email: ${ADMIN_EMAIL}`);

  try {
    await pb.admins.authWithPassword(ADMIN_EMAIL!, ADMIN_PASSWORD!);
    console.log('✅ Authenticated successfully');
    return true;
  } catch (error: any) {
    throw new Error(`Authentication failed. Please check your credentials in .env:\n${error.message}`);
  }
}

async function collectionExists(name: string): Promise<string | null> {
  try {
    const coll = await pb.collections.getOne(name);
    return coll.id;
  } catch (error) {
    return null;
  }
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD');
    process.exit(1);
  }

  console.log('🚀 Creating PocketBase Collections');
  console.log(`   URL: ${POCKETBASE_URL}\n`);

  // Wait for PocketBase
  console.log('⏳ Waiting for PocketBase...');
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${POCKETBASE_URL}/api/health`);
      if (res.ok) break;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));
  }

  await authenticate();

  // Phase 1: Create base collections (without relation fields)
  console.log('\n📦 Phase 1: Creating base collections...\n');

  const collectionIds: Record<string, string> = {};

  // Users collection
  let existingId = await collectionExists('users');
  if (existingId) {
    console.log('   users: already exists');
    collectionIds['users'] = existingId;
  } else {
    const result = await pb.collections.create({
      name: 'users',
      type: 'base',
      fields: [
        { name: 'user', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'nickname', type: 'text', required: true },
        { name: 'role', type: 'select', required: true, maxSelect: 1, values: ['root', 'admin', 'editor', 'viewer'] }
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_users_user ON users (user)',
        'CREATE INDEX idx_users_email ON users (email)'
      ]
    });
    console.log(`   users: created (${result.id})`);
    collectionIds['users'] = result.id;
  }

  // Site collection
  existingId = await collectionExists('site');
  if (existingId) {
    console.log('   site: already exists');
    collectionIds['site'] = existingId;
  } else {
    const result = await pb.collections.create({
      name: 'site',
      type: 'base',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'blog', type: 'url', required: false },
        { name: 'lastPublished', type: 'date', required: false },
        { name: 'processing', type: 'bool', required: false },
        { name: 'featured', type: 'json', required: false },
        { name: 'publishedProjectCount', type: 'number', required: false },
        { name: 'sweeperStartTm', type: 'date', required: false },
        { name: 'dcDateCreated', type: 'date', required: false },
        { name: 'dcDateModified', type: 'date', required: false }
      ]
    });
    console.log(`   site: created (${result.id})`);
    collectionIds['site'] = result.id;
  }

  // Keywords collection
  existingId = await collectionExists('keywords');
  if (existingId) {
    console.log('   keywords: already exists');
    collectionIds['keywords'] = existingId;
  } else {
    const result = await pb.collections.create({
      name: 'keywords',
      type: 'base',
      fields: [
        { name: 'name', type: 'select', required: true, maxSelect: 1, values: ['country', 'period', 'audience', 'subject', 'language', 'license', 'funder'] },
        { name: 'value', type: 'text', required: true }
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_keywords_name_value ON keywords (name, value)',
        'CREATE INDEX idx_keywords_name ON keywords (name)'
      ]
    });
    console.log(`   keywords: created (${result.id})`);
    collectionIds['keywords'] = result.id;
  }

  // Collections collection (without relation field initially)
  existingId = await collectionExists('collections');
  if (existingId) {
    console.log('   collections: already exists');
    collectionIds['collections'] = existingId;
  } else {
    const result = await pb.collections.create({
      name: 'collections',
      type: 'base',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'isVisible', type: 'bool', required: false },
        { name: 'lastPublished', type: 'date', required: false },
        { name: 'pubNum', type: 'number', required: false },
        { name: 'thumbnail', type: 'url', required: false },
        { name: 'dcTitle', type: 'text', required: false },
        { name: 'dcSubtitle', type: 'text', required: false },
        { name: 'dcCreator', type: 'json', required: false },
        { name: 'dcContributor', type: 'json', required: false },
        { name: 'dcInstitution', type: 'json', required: false },
        { name: 'dcAbstract', type: 'editor', required: false },
        { name: 'dcDescription', type: 'editor', required: false },
        { name: 'dcSubject', type: 'json', required: false },
        { name: 'dcCoveragePeriod', type: 'text', required: false },
        { name: 'dcCoveragePlace', type: 'text', required: false },
        { name: 'dcLanguage', type: 'json', required: false },
        { name: 'dcDateCreated', type: 'date', required: false },
        { name: 'dcDateModified', type: 'date', required: false }
      ],
      indexes: [
        'CREATE INDEX idx_collections_visible ON collections (isVisible)'
      ],
      listRule: 'isVisible = true',
      viewRule: 'isVisible = true'
    });
    console.log(`   collections: created (${result.id})`);
    collectionIds['collections'] = result.id;
  }

  // Editions collection (without relation field initially)
  existingId = await collectionExists('editions');
  if (existingId) {
    console.log('   editions: already exists');
    collectionIds['editions'] = existingId;
  } else {
    const result = await pb.collections.create({
      name: 'editions',
      type: 'base',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'isPublished', type: 'bool', required: false },
        { name: 'pubNum', type: 'number', required: false },
        { name: 'thumbnail', type: 'url', required: false },
        { name: 'dcTitle', type: 'text', required: false },
        { name: 'dcSubtitle', type: 'text', required: false },
        { name: 'dcCreator', type: 'json', required: false },
        { name: 'dcContributor', type: 'json', required: false },
        { name: 'dcInstitution', type: 'json', required: false },
        { name: 'dcAbstract', type: 'editor', required: false },
        { name: 'dcDescription', type: 'editor', required: false },
        { name: 'dcContact', type: 'email', required: false },
        { name: 'dcSubject', type: 'json', required: false },
        { name: 'dcKeyword', type: 'json', required: false },
        { name: 'dcAudience', type: 'json', required: false },
        { name: 'dcFunder', type: 'json', required: false },
        { name: 'dcSource', type: 'json', required: false },
        { name: 'dcProvenance', type: 'editor', required: false },
        { name: 'dcCoveragePeriod', type: 'json', required: false },
        { name: 'dcCoveragePlace', type: 'text', required: false },
        { name: 'dcCoverageCountry', type: 'json', required: false },
        { name: 'dcCoverageTemporal', type: 'text', required: false },
        { name: 'dcCoverageGeo', type: 'text', required: false },
        { name: 'dcLanguage', type: 'json', required: false },
        { name: 'dcRightsHolder', type: 'text', required: false },
        { name: 'dcRightsLicense', type: 'text', required: false },
        { name: 'dcDatePublished', type: 'date', required: false },
        { name: 'dcDateUnPublished', type: 'date', required: false },
        { name: 'dcDateCreated', type: 'date', required: false },
        { name: 'dcDateModified', type: 'date', required: false },
        { name: 'authorToolName', type: 'text', required: false },
        { name: 'authorToolVersion', type: 'text', required: false },
        { name: 'sceneFile', type: 'text', required: false }
      ],
      indexes: [
        'CREATE INDEX idx_editions_published ON editions (isPublished)'
      ],
      listRule: 'isPublished = true',
      viewRule: 'isPublished = true'
    });
    console.log(`   editions: created (${result.id})`);
    collectionIds['editions'] = result.id;
  }

  // CollectionUsers collection (without relation fields initially)
  existingId = await collectionExists('collectionUsers');
  if (existingId) {
    console.log('   collectionUsers: already exists');
    collectionIds['collectionUsers'] = existingId;
  } else {
    const result = await pb.collections.create({
      name: 'collectionUsers',
      type: 'base',
      fields: [
        { name: 'user', type: 'text', required: true },
        { name: 'role', type: 'select', required: true, maxSelect: 1, values: ['admin', 'editor', 'viewer'] }
      ]
    });
    console.log(`   collectionUsers: created (${result.id})`);
    collectionIds['collectionUsers'] = result.id;
  }

  // EditionUsers collection (without relation fields initially)
  existingId = await collectionExists('editionUsers');
  if (existingId) {
    console.log('   editionUsers: already exists');
    collectionIds['editionUsers'] = existingId;
  } else {
    const result = await pb.collections.create({
      name: 'editionUsers',
      type: 'base',
      fields: [
        { name: 'user', type: 'text', required: true },
        { name: 'role', type: 'select', required: true, maxSelect: 1, values: ['admin', 'editor', 'viewer'] }
      ]
    });
    console.log(`   editionUsers: created (${result.id})`);
    collectionIds['editionUsers'] = result.id;
  }

  // Phase 2: Add relation fields
  console.log('\n🔗 Phase 2: Adding relation fields...\n');

  const relationFields = [
    { collection: 'collections', fieldName: 'siteId', targetCollection: 'site', cascadeDelete: false },
    { collection: 'editions', fieldName: 'collection', targetCollection: 'collections', cascadeDelete: true },
    { collection: 'collectionUsers', fieldName: 'collection', targetCollection: 'collections', cascadeDelete: true },
    { collection: 'collectionUsers', fieldName: 'userId', targetCollection: 'users', cascadeDelete: true },
    { collection: 'editionUsers', fieldName: 'editionId', targetCollection: 'editions', cascadeDelete: true },
    { collection: 'editionUsers', fieldName: 'userId', targetCollection: 'users', cascadeDelete: true }
  ];

  for (const rel of relationFields) {
    try {
      const coll = await pb.collections.getOne(rel.collection);

      // Check if field already exists
      const fieldExists = coll.fields.some((f: any) => f.name === rel.fieldName);
      if (fieldExists) {
        console.log(`   ${rel.collection}.${rel.fieldName}: already exists`);
        continue;
      }

      // Add the relation field
      coll.fields.push({
        name: rel.fieldName,
        type: 'relation',
        required: false,
        maxSelect: 1,
        collectionId: collectionIds[rel.targetCollection],
        cascadeDelete: rel.cascadeDelete
      });

      await pb.collections.update(coll.id, coll);
      console.log(`   ${rel.collection}.${rel.fieldName} → ${rel.targetCollection}: added`);
    } catch (error: any) {
      console.error(`   ⚠️  ${rel.collection}.${rel.fieldName}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All collections created successfully!');
  console.log('='.repeat(60));
  console.log('\nCollection IDs:');
  for (const [name, id] of Object.entries(collectionIds)) {
    console.log(`   ${name}: ${id}`);
  }
  console.log('\nNext step: Data will be imported automatically.\n');
}

main().catch(console.error);
