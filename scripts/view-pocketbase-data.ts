#!/usr/bin/env bun
/**
 * View PocketBase data with proper authentication
 */
import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:7090';
const ADMIN_EMAIL = 'admin@admin.local';
const ADMIN_PASSWORD = 'changeme';

const pb = new PocketBase(POCKETBASE_URL);

async function main() {
  try {
    // Authenticate
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Authenticated successfully\n');

    // Check projects
    console.log('📦 PROJECTS:');
    console.log('='.repeat(80));
    const projects = await pb.collection('projects').getList(1, 5, {
      sort: '-created',
    });

    console.log(`Total projects: ${projects.totalItems}\n`);

    for (const project of projects.items) {
      console.log(`ID: ${project.id}`);
      console.log(`Title: ${project.title}`);
      console.log(`PubNum: ${project.pubNum}`);
      console.log(`Thumbnail: ${project.thumbnail}`);
      console.log(`Visible: ${project.isVisible}`);
      console.log(`Created: ${project.created}`);
      console.log('-'.repeat(80));
    }

    // Check editions
    console.log('\n📦 EDITIONS:');
    console.log('='.repeat(80));
    const editions = await pb.collection('editions').getList(1, 5, {
      sort: '-created',
    });

    console.log(`Total editions: ${editions.totalItems}\n`);

    for (const edition of editions.items) {
      console.log(`ID: ${edition.id}`);
      console.log(`Title: ${edition.title}`);
      console.log(`PubNum: ${edition.pubNum}`);
      console.log(`Thumbnail: ${edition.thumbnail}`);
      console.log(`Published: ${edition.isPublished}`);
      console.log(`Created: ${edition.created}`);
      console.log('-'.repeat(80));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
