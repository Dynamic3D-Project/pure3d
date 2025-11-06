#!/usr/bin/env bun
/**
 * Updates the projects collection to add thumbnail field
 * and populate thumbnails for existing records
 */
import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

const pb = new PocketBase(POCKETBASE_URL);

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD');
    process.exit(1);
  }

  console.log('🚀 Updating Projects Collection Schema');
  console.log(`   URL: ${POCKETBASE_URL}\n`);

  try {
    // Authenticate
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Authenticated successfully\n');

    // Get current projects collection
    const collection = await pb.collections.getOne('projects');
    console.log('📦 Current projects collection found');

    // Ensure schema exists
    if (!collection.schema) {
      collection.schema = [];
    }

    // Check if thumbnail field already exists
    const thumbnailFieldExists = collection.schema.some((field: any) => field.name === 'thumbnail');

    if (!thumbnailFieldExists) {
      console.log('➕ Adding thumbnail field to schema...');

      // Add thumbnail field to schema
      collection.schema.push({
        name: 'thumbnail',
        type: 'url',
        required: false,
        options: {
          exceptDomains: null,
          onlyDomains: null
        }
      });

      // Update the collection
      await pb.collections.update(collection.id, collection);
      console.log('✅ Thumbnail field added to projects collection\n');
    } else {
      console.log('ℹ️  Thumbnail field already exists\n');
    }

    // Now update all project records with thumbnail URLs
    console.log('🔄 Updating project records with thumbnail URLs...');

    const projects = await pb.collection('projects').getFullList({
      sort: '-created'
    });

    let updated = 0;
    for (const project of projects) {
      if (!project.thumbnail && project.pubNum) {
        const thumbnailUrl = `https://editions.pure3d.eu/project/${project.pubNum}/icon.png`;

        try {
          await pb.collection('projects').update(project.id, {
            thumbnail: thumbnailUrl
          });
          updated++;
          process.stdout.write(`\r   Progress: ${updated}/${projects.length}`);
        } catch (error: any) {
          console.error(`\n   ⚠️  Failed to update project ${project.id}:`, error.message);
        }
      }
    }

    console.log(`\n✅ Updated ${updated} project thumbnails\n`);

    console.log('='.repeat(60));
    console.log('✅ Projects collection schema updated successfully!');
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  }
}

main();
