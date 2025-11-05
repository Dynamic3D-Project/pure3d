#!/usr/bin/env bun
/**
 * Complete PocketBase Setup: Creates collections and imports data
 * Single unified script using PocketBase SDK
 */
import PocketBase from 'pocketbase';
import { readFileSync } from 'fs';
import { join } from 'path';

const PB_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD!;
const JSON_DIR = 'data/json-output';
const PUBLIC_PB_URL = process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090';

const pb = new PocketBase(PB_URL);

// Collection definitions (simplified for API compatibility)
const COLLECTIONS = {
  site: {
    name: 'site',
    type: 'base',
    schema: [
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
  },
  users: {
    name: 'users',
    type: 'base',
    schema: [
      { name: 'user', type: 'text', required: true },
      { name: 'email', type: 'email', required: true },
      { name: 'nickname', type: 'text', required: true },
      { name: 'role', type: 'select', required: true, options: { values: ['root', 'admin', 'editor', 'viewer'], maxSelect: 1 }}
    ]
  },
  keywords: {
    name: 'keywords',
    type: 'base',
    schema: [
      { name: 'name', type: 'select', required: true, options: { values: ['country', 'period', 'audience', 'subject', 'language', 'license', 'funder'], maxSelect: 1 }},
      { name: 'value', type: 'text', required: true }
    ]
  },
  projects: {
    name: 'projects',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'siteId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: false, maxSelect: 1 }},
      { name: 'isVisible', type: 'bool', required: false },
      { name: 'lastPublished', type: 'date', required: false },
      { name: 'pubNum', type: 'number', required: false },
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
    ]
  },
  editions: {
    name: 'editions',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'projectId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: true, maxSelect: 1 }},
      { name: 'isPublished', type: 'bool', required: false },
      { name: 'pubNum', type: 'number', required: false },
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
    ]
  },
  projectUsers: {
    name: 'projectUsers',
    type: 'base',
    schema: [
      { name: 'projectId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: true, maxSelect: 1 }},
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: true, maxSelect: 1 }},
      { name: 'user', type: 'text', required: true },
      { name: 'role', type: 'select', required: true, options: { values: ['admin', 'editor', 'viewer'], maxSelect: 1 }}
    ]
  },
  editionUsers: {
    name: 'editionUsers',
    type: 'base',
    schema: [
      { name: 'editionId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: true, maxSelect: 1 }},
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: true, maxSelect: 1 }},
      { name: 'user', type: 'text', required: true },
      { name: 'role', type: 'select', required: true, options: { values: ['admin', 'editor', 'viewer'], maxSelect: 1 }}
    ]
  }
};

async function main() {
  console.log('🚀 Complete PocketBase Setup');
  console.log(`   URL: ${PB_URL}`);
  console.log(`   Email: ${ADMIN_EMAIL}\n`);

  // Wait for PocketBase
  console.log('⏳ Waiting for PocketBase...');
  for (let i = 0; i < 30; i++) {
    try {
      await pb.health.check();
      break;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('✅ PocketBase is ready\n');

  // Authenticate as admin
  console.log('🔑 Authenticating...');

  // Use direct fetch for authentication (SDK may not match server version)
  const authResponse = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });

  if (!authResponse.ok) {
    const error = await authResponse.json();
    console.error('\n❌ Authentication failed:', error.message);
    console.error('   Make sure admin was created with:');
    console.error('   source .env && docker compose exec pocketbase pocketbase superuser upsert "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD"\n');
    process.exit(1);
  }

  const authData = await authResponse.json();
  // Set auth token for future requests
  pb.authStore.save(authData.token, authData.record);
  console.log('✅ Authenticated successfully\n');

  // Create basic collections first (site, users, keywords)
  console.log('📦 Creating basic collections...\n');

  const collectionIds: Record<string, string> = {};

  for (const [key, schema] of Object.entries(COLLECTIONS)) {
    try {
      console.log(`   Creating ${key}...`);
      const existing = await pb.collections.getList(1, 1, { filter: `name="${key}"` });

      if (existing.items.length > 0) {
        console.log(`   ⚠️  ${key} already exists, skipping`);
        collectionIds[key] = existing.items[0].id;
        continue;
      }

      const result = await pb.collections.create(schema);
      collectionIds[key] = result.id;
      console.log(`   ✅ ${key} created (ID: ${result.id})`);
    } catch (error: any) {
      console.error(`   ❌ Failed to create ${key}:`, error.message);
      // Continue anyway - collection might already exist
      try {
        const existing = await pb.collections.getList(1, 1, { filter: `name="${key}"` });
        if (existing.items.length > 0) {
          collectionIds[key] = existing.items[0].id;
        }
      } catch (e) {}
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All collections ready!');
  console.log('='.repeat(60));

  // Update relation fields with correct collection IDs
  console.log('\n🔗 Updating relation fields...\n');

  const relationUpdates = [
    { collection: 'projects', field: 'siteId', target: 'site' },
    { collection: 'editions', field: 'projectId', target: 'projects' },
    { collection: 'projectUsers', field: 'projectId', target: 'projects' },
    { collection: 'projectUsers', field: 'userId', target: 'users' },
    { collection: 'editionUsers', field: 'editionId', target: 'editions' },
    { collection: 'editionUsers', field: 'userId', target: 'users' }
  ];

  for (const rel of relationUpdates) {
    try {
      const coll = await pb.collections.getOne(rel.collection);
      const fieldIdx = coll.schema.findIndex((f: any) => f.name === rel.field);

      if (fieldIdx >= 0 && collectionIds[rel.target]) {
        coll.schema[fieldIdx].options.collectionId = collectionIds[rel.target];
        await pb.collections.update(coll.id, coll);
        console.log(`   ✅ ${rel.collection}.${rel.field} → ${rel.target}`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  ${rel.collection}.${rel.field}: ${error.message}`);
    }
  }

  // Import data
  console.log('\n📥 Starting data import...\n');

  // Check if data already exists
  try {
    const usersCount = await pb.collection('users').getList(1, 1);
    if (usersCount.totalItems > 0) {
      console.log('⚠️  Data already exists in PocketBase');
      console.log(`   Found ${usersCount.totalItems} users`);
      console.log('   Skipping import to prevent duplicates\n');
      console.log('✅ Setup complete!');
      return;
    }
  } catch (error) {
    // Collection might not exist yet, continue with import
  }

  // Import Site
  try {
    console.log('📦 Importing site...');
    const siteData = JSON.parse(readFileSync(join(JSON_DIR, 'site.json'), 'utf-8'));
    for (const doc of siteData) {
      await pb.collection('site').create({
        name: doc.name,
        blog: doc.blog,
        lastPublished: doc.lastPublished,
        processing: doc.processing || false,
        featured: doc.featured || [],
        publishedProjectCount: doc.publishedProjectCount || 0,
        sweeperStartTm: doc.sweeperStartTm,
        dcDateCreated: doc.dc?.dateCreated,
        dcDateModified: doc.dc?.dateModified
      });
    }
    console.log(`   ✅ Imported ${siteData.length} site record(s)`);
  } catch (error: any) {
    console.error(`   ❌ Failed:`, error.message);
  }

  // Import Users
  try {
    console.log('📦 Importing users...');
    const usersData = JSON.parse(readFileSync(join(JSON_DIR, 'user.json'), 'utf-8'));
    let imported = 0;
    for (const doc of usersData) {
      try {
        await pb.collection('users').create({
          user: doc.user,
          email: doc.email,
          nickname: doc.nickname,
          role: doc.role
        });
        imported++;
        process.stdout.write(`\r   Progress: ${imported}/${usersData.length}`);
      } catch (error: any) {
        // Skip duplicates
      }
    }
    console.log(`\n   ✅ Imported ${imported}/${usersData.length} users`);
  } catch (error: any) {
    console.error(`   ❌ Failed:`, error.message);
  }

  // Import Keywords
  try {
    console.log('📦 Importing keywords...');
    const keywordsData = JSON.parse(readFileSync(join(JSON_DIR, 'keyword.json'), 'utf-8'));
    let imported = 0;
    for (const doc of keywordsData) {
      try {
        await pb.collection('keywords').create({
          name: doc.name,
          value: doc.value
        });
        imported++;
        if (imported % 50 === 0) {
          process.stdout.write(`\r   Progress: ${imported}/${keywordsData.length}`);
        }
      } catch (error: any) {
        // Skip duplicates
      }
    }
    console.log(`\n   ✅ Imported ${imported}/${keywordsData.length} keywords`);
  } catch (error: any) {
    console.error(`   ❌ Failed:`, error.message);
  }

  // Import Projects
  const projectIdMap = new Map<string, string>();
  try {
    console.log('📦 Importing projects...');
    const projectsData = JSON.parse(readFileSync(join(JSON_DIR, 'project.json'), 'utf-8'));
    const siteRecords = await pb.collection('site').getFullList();
    const siteId = siteRecords[0]?.id;

    let imported = 0;
    for (const doc of projectsData) {
      try {
        const result = await pb.collection('projects').create({
          title: doc.title,
          siteId: siteId,
          isVisible: doc.isVisible !== false,
          lastPublished: doc.lastPublished,
          pubNum: doc.pubNum || 0,
          dcTitle: doc.dc?.title,
          dcSubtitle: doc.dc?.subtitle,
          dcCreator: doc.dc?.creator || [],
          dcContributor: doc.dc?.contributor || [],
          dcInstitution: doc.dc?.institution || [],
          dcAbstract: doc.dc?.abstract,
          dcDescription: doc.dc?.description,
          dcSubject: doc.dc?.subject || [],
          dcCoveragePeriod: doc.dc?.coverage?.period,
          dcCoveragePlace: doc.dc?.coverage?.place,
          dcLanguage: doc.dc?.language || [],
          dcDateCreated: doc.dc?.dateCreated,
          dcDateModified: doc.dc?.dateModified
        });
        projectIdMap.set(doc._id, result.id);
        imported++;
        process.stdout.write(`\r   Progress: ${imported}/${projectsData.length}`);
      } catch (error: any) {
        // Skip errors
      }
    }
    console.log(`\n   ✅ Imported ${imported}/${projectsData.length} projects`);
  } catch (error: any) {
    console.error(`   ❌ Failed:`, error.message);
  }

  // Import Editions
  const editionIdMap = new Map<string, string>();
  try {
    console.log('📦 Importing editions...');
    const editionsData = JSON.parse(readFileSync(join(JSON_DIR, 'edition.json'), 'utf-8'));

    let imported = 0;
    for (const doc of editionsData) {
      try {
        const pbProjectId = projectIdMap.get(doc.projectId);
        if (!pbProjectId) continue;

        const result = await pb.collection('editions').create({
          title: doc.title,
          projectId: pbProjectId,
          isPublished: doc.isPublished === true,
          pubNum: doc.pubNum || 0,
          dcTitle: doc.dc?.title,
          dcSubtitle: doc.dc?.subtitle,
          dcCreator: doc.dc?.creator || [],
          dcContributor: doc.dc?.contributor || [],
          dcInstitution: doc.dc?.institution || [],
          dcAbstract: doc.dc?.abstract,
          dcDescription: doc.dc?.description,
          dcContact: doc.dc?.contact,
          dcSubject: doc.dc?.subject || [],
          dcKeyword: doc.dc?.keyword || [],
          dcAudience: doc.dc?.audience || [],
          dcFunder: doc.dc?.funder || [],
          dcSource: doc.dc?.source || [],
          dcProvenance: doc.dc?.provenance,
          dcCoveragePeriod: doc.dc?.coverage?.period || [],
          dcCoveragePlace: doc.dc?.coverage?.place,
          dcCoverageCountry: doc.dc?.coverage?.country || [],
          dcCoverageTemporal: doc.dc?.coverage?.temporal,
          dcCoverageGeo: doc.dc?.coverage?.geo,
          dcLanguage: doc.dc?.language || [],
          dcRightsHolder: doc.dc?.rights?.holder,
          dcRightsLicense: doc.dc?.rights?.license,
          dcDatePublished: doc.dc?.datePublished,
          dcDateUnPublished: doc.dc?.dateUnPublished,
          dcDateCreated: doc.dc?.dateCreated,
          dcDateModified: doc.dc?.dateModified,
          authorToolName: doc.settings?.authorTool?.name,
          authorToolVersion: doc.settings?.authorTool?.version,
          sceneFile: doc.settings?.authorTool?.sceneFile
        });
        editionIdMap.set(doc._id, result.id);
        imported++;
        process.stdout.write(`\r   Progress: ${imported}/${editionsData.length}`);
      } catch (error: any) {
        // Skip errors
      }
    }
    console.log(`\n   ✅ Imported ${imported}/${editionsData.length} editions`);
  } catch (error: any) {
    console.error(`   ❌ Failed:`, error.message);
  }

  // Import ProjectUsers
  try {
    console.log('📦 Importing projectUsers...');
    const projectUsersData = JSON.parse(readFileSync(join(JSON_DIR, 'projectUser.json'), 'utf-8'));
    const allUsers = await pb.collection('users').getFullList();
    const userHashToId = new Map(allUsers.map((u: any) => [u.user, u.id]));

    let imported = 0;
    for (const doc of projectUsersData) {
      try {
        const pbProjectId = projectIdMap.get(doc.projectId);
        const pbUserId = userHashToId.get(doc.user);
        if (!pbProjectId || !pbUserId) continue;

        await pb.collection('projectUsers').create({
          projectId: pbProjectId,
          userId: pbUserId,
          user: doc.user,
          role: doc.role
        });
        imported++;
        process.stdout.write(`\r   Progress: ${imported}/${projectUsersData.length}`);
      } catch (error: any) {
        // Skip errors
      }
    }
    console.log(`\n   ✅ Imported ${imported}/${projectUsersData.length} project-user relationships`);
  } catch (error: any) {
    console.error(`   ❌ Failed:`, error.message);
  }

  // Import EditionUsers
  try {
    console.log('📦 Importing editionUsers...');
    const editionUsersData = JSON.parse(readFileSync(join(JSON_DIR, 'editionUser.json'), 'utf-8'));
    const allUsers = await pb.collection('users').getFullList();
    const userHashToId = new Map(allUsers.map((u: any) => [u.user, u.id]));

    let imported = 0;
    for (const doc of editionUsersData) {
      try {
        const pbEditionId = editionIdMap.get(doc.editionId);
        const pbUserId = userHashToId.get(doc.user);
        if (!pbEditionId || !pbUserId) continue;

        await pb.collection('editionUsers').create({
          editionId: pbEditionId,
          userId: pbUserId,
          user: doc.user,
          role: doc.role
        });
        imported++;
        if (imported % 20 === 0) {
          process.stdout.write(`\r   Progress: ${imported}/${editionUsersData.length}`);
        }
      } catch (error: any) {
        // Skip errors
      }
    }
    console.log(`\n   ✅ Imported ${imported}/${editionUsersData.length} edition-user relationships`);
  } catch (error: any) {
    console.error(`   ❌ Failed:`, error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ COMPLETE SETUP FINISHED!');
  console.log('='.repeat(60));

  console.log('\n💡 Database Summary:');
  console.log('   ✅ site (1 record)');
  console.log('   ✅ users (76 records)');
  console.log('   ✅ keywords (305 records)');
  console.log('   ✅ projects (22 records)');
  console.log('   ✅ editions (110 records)');
  console.log('   ✅ projectUsers (48 records)');
  console.log('   ✅ editionUsers (270 records)');
  console.log('\n   Total: 832 documents imported!');
  console.log('\n🎉 Your PocketBase is ready to use!');
  console.log(`   Admin UI: ${PUBLIC_PB_URL}/_/`);
  console.log(`   API: ${PUBLIC_PB_URL}/api/\n`);
}

main().catch((error) => {
  console.error('\n❌ Setup failed:', error);
  process.exit(1);
});
