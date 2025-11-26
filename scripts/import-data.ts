#!/usr/bin/env bun
/**
 * Imports data from JSON files into PocketBase
 * Run this AFTER create-pocketbase-collections.ts
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

async function main() {
  console.log('📥 Starting Data Import');
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
    process.exit(1);
  }

  const authData = await authResponse.json();
  pb.authStore.save(authData.token, authData.record);
  console.log('✅ Authenticated successfully\n');

  // Check if data already exists
  try {
    const usersCount = await pb.collection('users').getList(1, 1);
    if (usersCount.totalItems > 0) {
      console.log('⚠️  Data already exists in PocketBase');
      console.log(`   Found ${usersCount.totalItems} users`);
      console.log('   Skipping import to prevent duplicates\n');
      console.log('✅ Import complete (skipped)!');
      return;
    }
  } catch (error) {
    // Collection might be empty, continue with import
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

  // Import Collections (projects)
  const collectionIdMap = new Map<string, string>();
  try {
    console.log('📦 Importing collections...');
    const projectsData = JSON.parse(readFileSync(join(JSON_DIR, 'project.json'), 'utf-8'));
    const siteRecords = await pb.collection('site').getFullList();
    const siteId = siteRecords[0]?.id;

    // First, try to map existing collections by title
    const existingCollections = await pb.collection('collections').getFullList();
    const titleToId = new Map(existingCollections.map((c: any) => [c.title, c.id]));

    for (const doc of projectsData) {
      const existingId = titleToId.get(doc.title);
      if (existingId) {
        collectionIdMap.set(doc._id, existingId);
      }
    }
    console.log(`   Found ${collectionIdMap.size} existing collections by title`);

    let imported = 0;
    for (const doc of projectsData) {
      // Skip if already mapped
      if (collectionIdMap.has(doc._id)) continue;

      try {
        const projectPubNum = doc.pubNum || 0;
        const thumbnailUrl = projectPubNum > 0
          ? `https://editions.pure3d.eu/project/${projectPubNum}/icon.png`
          : '';

        const result = await pb.collection('collections').create({
          title: doc.title,
          siteId: siteId,
          isVisible: doc.isVisible !== false,
          lastPublished: doc.lastPublished,
          pubNum: projectPubNum,
          thumbnail: thumbnailUrl,
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
        collectionIdMap.set(doc._id, result.id);
        imported++;
        process.stdout.write(`\r   Progress: ${imported}/${projectsData.length - collectionIdMap.size + imported}`);
      } catch (error: any) {
        // Skip errors
      }
    }
    console.log(`\n   ✅ Total mapped: ${collectionIdMap.size}/${projectsData.length} collections`);
  } catch (error: any) {
    console.error(`   ❌ Failed:`, error.message);
  }

  // Import Editions
  const editionIdMap = new Map<string, string>();
  try {
    console.log('📦 Importing editions...');
    const editionsData = JSON.parse(readFileSync(join(JSON_DIR, 'edition.json'), 'utf-8'));

    // First, map existing editions by title + collection to prevent duplicates
    const existingEditions = await pb.collection('editions').getFullList();
    const existingEditionKeys = new Set(
      existingEditions.map((e: any) => `${e.title}|${e.collection}`)
    );
    // Also map existing editions by their MongoDB _id equivalent (title + projectId)
    for (const doc of editionsData) {
      const pbCollectionId = collectionIdMap.get(doc.projectId);
      if (!pbCollectionId) continue;
      const existing = existingEditions.find(
        (e: any) => e.title === doc.title && e.collection === pbCollectionId
      );
      if (existing) {
        editionIdMap.set(doc._id, existing.id);
      }
    }
    console.log(`   Found ${editionIdMap.size} existing editions`);

    let imported = 0;
    let skipped = 0;
    for (const doc of editionsData) {
      try {
        const pbCollectionId = collectionIdMap.get(doc.projectId);
        if (!pbCollectionId) continue;

        // Skip if edition already exists
        const key = `${doc.title}|${pbCollectionId}`;
        if (existingEditionKeys.has(key)) {
          skipped++;
          continue;
        }

        // Get collection to retrieve its pubNum for thumbnail URL
        const coll = await pb.collection('collections').getOne(pbCollectionId);
        const collectionPubNum = coll.pubNum || 0;
        const editionPubNum = doc.pubNum || 1;
        const thumbnailUrl = collectionPubNum > 0
          ? `https://editions.pure3d.eu/project/${collectionPubNum}/edition/${editionPubNum}/icon.png`
          : '';

        const result = await pb.collection('editions').create({
          title: doc.title,
          collection: pbCollectionId,
          isPublished: doc.isPublished === true,
          pubNum: editionPubNum,
          thumbnail: thumbnailUrl,
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
        existingEditionKeys.add(key); // Prevent duplicates within same run
        imported++;
        process.stdout.write(`\r   Progress: ${imported + skipped}/${editionsData.length}`);
      } catch (error: any) {
        // Skip errors
      }
    }
    console.log(`\n   ✅ Imported ${imported} new, skipped ${skipped} existing editions`);
  } catch (error: any) {
    console.error(`   ❌ Failed:`, error.message);
  }

  // Import CollectionUsers
  try {
    console.log('📦 Importing collectionUsers...');
    const projectUsersData = JSON.parse(readFileSync(join(JSON_DIR, 'projectUser.json'), 'utf-8'));
    const allUsers = await pb.collection('users').getFullList();
    const userHashToId = new Map(allUsers.map((u: any) => [u.user, u.id]));

    let imported = 0;
    for (const doc of projectUsersData) {
      try {
        const pbCollectionId = collectionIdMap.get(doc.projectId);
        const pbUserId = userHashToId.get(doc.user);
        if (!pbCollectionId || !pbUserId) continue;

        await pb.collection('collectionUsers').create({
          collection: pbCollectionId,
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
    console.log(`\n   ✅ Imported ${imported}/${projectUsersData.length} collection-user relationships`);
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
  console.log('✅ DATA IMPORT COMPLETE!');
  console.log('='.repeat(60));
  console.log('\n🎉 Your PocketBase is ready to use!');
  console.log(`   Admin UI: ${PUBLIC_PB_URL}/_/`);
  console.log(`   API: ${PUBLIC_PB_URL}/api/\n`);
}

main().catch((error) => {
  console.error('\n❌ Import failed:', error);
  process.exit(1);
});
