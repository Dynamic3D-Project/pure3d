#!/usr/bin/env bun
/**
 * Fix access rules for existing PocketBase collections
 */
const PB_URL = 'http://127.0.0.1:7090';
const ADMIN_EMAIL = 'admin@admin.local';
const ADMIN_PASSWORD = '1234567890';

async function main() {
  // Authenticate
  const authResponse = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });

  if (!authResponse.ok) {
    throw new Error(`Auth failed: ${await authResponse.text()}`);
  }

  const { token } = await authResponse.json();
  console.log('✅ Authenticated\n');

  // Update each collection to allow public read access
  const collections = ['site', 'collections', 'editions'];

  for (const collectionName of collections) {
    console.log(`📝 Updating ${collectionName} access rules...`);

    // Get the collection
    const getResponse = await fetch(`${PB_URL}/api/collections/${collectionName}`, {
      headers: { 'Authorization': token }
    });

    if (!getResponse.ok) {
      console.log(`   ❌ Collection ${collectionName} not found`);
      continue;
    }

    const collection = await getResponse.json();

    // Update with public access rules
    const updateResponse = await fetch(`${PB_URL}/api/collections/${collection.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({
        listRule: '',  // Empty string = allow public list access
        viewRule: ''   // Empty string = allow public view access
      })
    });

    if (updateResponse.ok) {
      console.log(`   ✅ ${collectionName} access rules updated`);
    } else {
      console.log(`   ❌ Failed to update ${collectionName}: ${await updateResponse.text()}`);
    }
  }

  console.log('\n✅ All access rules updated!');
}

main().catch(console.error);
