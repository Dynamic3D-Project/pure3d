#!/usr/bin/env bun
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:60021');

async function main() {
  // Authenticate
  await pb.admins.authWithPassword('admin@admin.local', '1234567890');
  console.log('✅ Authenticated\n');

  // Get collection schema FIRST
  console.log('📦 Projects Collection Schema:');
  const projectsColl = await pb.collections.getOne('projects');
  console.log('Full collection:', JSON.stringify(projectsColl, null, 2));

  if (projectsColl.schema) {
    console.log('\n📋 Schema fields:', projectsColl.schema.map((f: any) => f.name).join(', '));
  } else {
    console.log('⚠️  No schema found!');
  }

  // Try direct fetch without SDK
  console.log('\n\n📦 Trying direct API call...');
  const response = await fetch('http://127.0.0.1:60021/api/collections/projects/records?perPage=1', {
    headers: {
      'Authorization': pb.authStore.token
    }
  });

  const data = await response.json();
  console.log('API Response:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
