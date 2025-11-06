#!/usr/bin/env bun
/**
 * Automatically creates all PocketBase collections via API
 * Run this BEFORE importing data
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

async function createCollection(schema: any) {
  try {
    return await pb.collections.create(schema);
  } catch (error: any) {
    console.error(`   Error details:`, error.response || error);
    throw new Error(`Failed to create collection ${schema.name}: ${error.message}`);
  }
}

async function collectionExists(name: string): Promise<boolean> {
  try {
    await pb.collections.getOne(name);
    return true;
  } catch (error) {
    return false;
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

  // Define collections
  const collections = [
    {
      name: 'users',
      type: 'base',
      schema: [
        { name: 'user', type: 'text', required: true, options: { min: null, max: null, pattern: '' }},
        { name: 'email', type: 'email', required: true, options: { exceptDomains: null, onlyDomains: null }},
        { name: 'nickname', type: 'text', required: true, options: { min: null, max: null, pattern: '' }},
        { name: 'role', type: 'select', required: true, options: { maxSelect: 1, values: ['root', 'admin', 'editor', 'viewer'] }}
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_users_user ON users (user)',
        'CREATE INDEX idx_users_email ON users (email)'
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "root" || @request.auth.role = "admin"',
      updateRule: '@request.auth.role = "root" || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "root"'
    },
    {
      name: 'site',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true, options: { min: null, max: null, pattern: '' }},
        { name: 'blog', type: 'url', required: false, options: { exceptDomains: null, onlyDomains: null }},
        { name: 'lastPublished', type: 'date', required: false, options: { min: '', max: '' }},
        { name: 'processing', type: 'bool', required: false },
        { name: 'featured', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'publishedProjectCount', type: 'number', required: false, options: { min: null, max: null, noDecimal: true }},
        { name: 'sweeperStartTm', type: 'date', required: false, options: { min: '', max: '' }},
        { name: 'dcDateCreated', type: 'date', required: false, options: { min: '', max: '' }},
        { name: 'dcDateModified', type: 'date', required: false, options: { min: '', max: '' }}
      ],
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.role = "root"',
      updateRule: '@request.auth.role = "root" || @request.auth.role = "admin"',
      deleteRule: null
    },
    {
      name: 'keywords',
      type: 'base',
      schema: [
        { name: 'name', type: 'select', required: true, options: { maxSelect: 1, values: ['country', 'period', 'audience', 'subject', 'language', 'license', 'funder'] }},
        { name: 'value', type: 'text', required: true, options: { min: null, max: null, pattern: '' }}
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_keywords_name_value ON keywords (name, value)',
        'CREATE INDEX idx_keywords_name ON keywords (name)'
      ],
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.role = "root" || @request.auth.role = "admin"',
      updateRule: '@request.auth.role = "root" || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "root"'
    },
    {
      name: 'projects',
      type: 'base',
      schema: [
        { name: 'title', type: 'text', required: true, options: { min: 1, max: 500, pattern: '' }},
        { name: 'siteId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: false, minSelect: null, maxSelect: 1, displayFields: null }},
        { name: 'isVisible', type: 'bool', required: false },
        { name: 'lastPublished', type: 'date', required: false, options: { min: '', max: '' }},
        { name: 'pubNum', type: 'number', required: false, options: { min: null, max: null, noDecimal: true }},
        { name: 'thumbnail', type: 'url', required: false, options: { exceptDomains: null, onlyDomains: null }},
        { name: 'dcTitle', type: 'text', required: false, options: { min: null, max: 500, pattern: '' }},
        { name: 'dcSubtitle', type: 'text', required: false, options: { min: null, max: 500, pattern: '' }},
        { name: 'dcCreator', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcContributor', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcInstitution', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcAbstract', type: 'editor', required: false, options: { convertUrls: false }},
        { name: 'dcDescription', type: 'editor', required: false, options: { convertUrls: false }},
        { name: 'dcSubject', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcCoveragePeriod', type: 'text', required: false, options: { min: null, max: null, pattern: '' }},
        { name: 'dcCoveragePlace', type: 'text', required: false, options: { min: null, max: null, pattern: '' }},
        { name: 'dcLanguage', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcDateCreated', type: 'date', required: false, options: { min: '', max: '' }},
        { name: 'dcDateModified', type: 'date', required: false, options: { min: '', max: '' }}
      ],
      indexes: [
        'CREATE INDEX idx_projects_site ON projects (siteId)',
        'CREATE INDEX idx_projects_visible ON projects (isVisible)'
      ],
      listRule: 'isVisible = true || (@request.auth.id != "" && @request.auth.role != "")',
      viewRule: 'isVisible = true || (@request.auth.id != "" && @request.auth.role != "")',
      createRule: '@request.auth.role = "root" || @request.auth.role = "admin" || @request.auth.role = "editor"',
      updateRule: '@request.auth.role = "root" || @request.auth.role = "admin" || @request.auth.role = "editor"',
      deleteRule: '@request.auth.role = "root" || @request.auth.role = "admin"'
    },
    {
      name: 'editions',
      type: 'base',
      schema: [
        { name: 'title', type: 'text', required: true, options: { min: 1, max: 500, pattern: '' }},
        { name: 'projectId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: true, minSelect: null, maxSelect: 1, displayFields: null }},
        { name: 'isPublished', type: 'bool', required: false },
        { name: 'pubNum', type: 'number', required: false, options: { min: null, max: null, noDecimal: true }},
        { name: 'thumbnail', type: 'url', required: false, options: { exceptDomains: null, onlyDomains: null }},
        { name: 'dcTitle', type: 'text', required: false, options: { min: null, max: 500, pattern: '' }},
        { name: 'dcSubtitle', type: 'text', required: false, options: { min: null, max: 500, pattern: '' }},
        { name: 'dcCreator', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcContributor', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcInstitution', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcAbstract', type: 'editor', required: false, options: { convertUrls: false }},
        { name: 'dcDescription', type: 'editor', required: false, options: { convertUrls: false }},
        { name: 'dcContact', type: 'email', required: false, options: { exceptDomains: null, onlyDomains: null }},
        { name: 'dcSubject', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcKeyword', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcAudience', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcFunder', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcSource', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcProvenance', type: 'editor', required: false, options: { convertUrls: false }},
        { name: 'dcCoveragePeriod', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcCoveragePlace', type: 'text', required: false, options: { min: null, max: null, pattern: '' }},
        { name: 'dcCoverageCountry', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcCoverageTemporal', type: 'text', required: false, options: { min: null, max: null, pattern: '' }},
        { name: 'dcCoverageGeo', type: 'text', required: false, options: { min: null, max: null, pattern: '' }},
        { name: 'dcLanguage', type: 'json', required: false, options: { maxSize: 2000000 }},
        { name: 'dcRightsHolder', type: 'text', required: false, options: { min: null, max: null, pattern: '' }},
        { name: 'dcRightsLicense', type: 'text', required: false, options: { min: null, max: null, pattern: '' }},
        { name: 'dcDatePublished', type: 'date', required: false, options: { min: '', max: '' }},
        { name: 'dcDateUnPublished', type: 'date', required: false, options: { min: '', max: '' }},
        { name: 'dcDateCreated', type: 'date', required: false, options: { min: '', max: '' }},
        { name: 'dcDateModified', type: 'date', required: false, options: { min: '', max: '' }},
        { name: 'authorToolName', type: 'text', required: false, options: { min: null, max: null, pattern: '' }},
        { name: 'authorToolVersion', type: 'text', required: false, options: { min: null, max: null, pattern: '' }},
        { name: 'sceneFile', type: 'text', required: false, options: { min: null, max: null, pattern: '' }}
      ],
      indexes: [
        'CREATE INDEX idx_editions_project ON editions (projectId)',
        'CREATE INDEX idx_editions_published ON editions (isPublished)'
      ],
      listRule: 'isPublished = true || (@request.auth.id != "" && @request.auth.role != "")',
      viewRule: 'isPublished = true || (@request.auth.id != "" && @request.auth.role != "")',
      createRule: '@request.auth.role = "root" || @request.auth.role = "admin" || @request.auth.role = "editor"',
      updateRule: '@request.auth.role = "root" || @request.auth.role = "admin" || @request.auth.role = "editor"',
      deleteRule: '@request.auth.role = "root" || @request.auth.role = "admin"'
    },
    {
      name: 'projectUsers',
      type: 'base',
      schema: [
        { name: 'projectId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: true, minSelect: null, maxSelect: 1, displayFields: null }},
        { name: 'userId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: true, minSelect: null, maxSelect: 1, displayFields: null }},
        { name: 'user', type: 'text', required: true, options: { min: null, max: null, pattern: '' }},
        { name: 'role', type: 'select', required: true, options: { maxSelect: 1, values: ['admin', 'editor', 'viewer'] }}
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_project_users_unique ON projectUsers (projectId, userId)'
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "root" || @request.auth.role = "admin"',
      updateRule: '@request.auth.role = "root" || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "root" || @request.auth.role = "admin"'
    },
    {
      name: 'editionUsers',
      type: 'base',
      schema: [
        { name: 'editionId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: true, minSelect: null, maxSelect: 1, displayFields: null }},
        { name: 'userId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: true, minSelect: null, maxSelect: 1, displayFields: null }},
        { name: 'user', type: 'text', required: true, options: { min: null, max: null, pattern: '' }},
        { name: 'role', type: 'select', required: true, options: { maxSelect: 1, values: ['admin', 'editor', 'viewer'] }}
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_edition_users_unique ON editionUsers (editionId, userId)'
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "root" || @request.auth.role = "admin"',
      updateRule: '@request.auth.role = "root" || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "root" || @request.auth.role = "admin"'
    }
  ];

  // Get collection IDs for relations
  const collectionIds: Record<string, string> = {};

  for (const collection of collections) {
    console.log(`\n📦 Creating collection: ${collection.name}`);

    // Check if exists
    const exists = await collectionExists(collection.name);
    if (exists) {
      console.log(`   ⚠️  Collection already exists, skipping`);
      const data = await pb.collections.getOne(collection.name);
      collectionIds[collection.name] = data.id;
      continue;
    }

    try {
      const result = await createCollection(collection);
      collectionIds[collection.name] = result.id;
      console.log(`   ✅ Created successfully (ID: ${result.id})`);
    } catch (error: any) {
      console.error(`   ❌ Failed:`, error.message);
      throw error;
    }
  }

  // Update relation fields with correct collection IDs
  console.log('\n🔗 Updating relation fields...');

  const updates = [
    { collection: 'projects', field: 'siteId', targetCollection: 'site' },
    { collection: 'editions', field: 'projectId', targetCollection: 'projects' },
    { collection: 'projectUsers', field: 'projectId', targetCollection: 'projects' },
    { collection: 'projectUsers', field: 'userId', targetCollection: 'users' },
    { collection: 'editionUsers', field: 'editionId', targetCollection: 'editions' },
    { collection: 'editionUsers', field: 'userId', targetCollection: 'users' }
  ];

  for (const update of updates) {
    try {
      const collectionData = await pb.collections.getOne(update.collection);

      const fieldIndex = collectionData.schema.findIndex((f: any) => f.name === update.field);
      if (fieldIndex >= 0) {
        collectionData.schema[fieldIndex].options.collectionId = collectionIds[update.targetCollection];

        await pb.collections.update(collectionData.id, collectionData);
        console.log(`   ✅ Updated ${update.collection}.${update.field} → ${update.targetCollection}`);
      }
    } catch (error: any) {
      console.error(`   ⚠️  Failed to update ${update.collection}.${update.field}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All collections created successfully!');
  console.log('='.repeat(60));
  console.log('\nNext step: Run the data import');
  console.log('docker compose --profile import up pocketbase-importer\n');
}

main().catch(console.error);
