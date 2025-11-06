#!/usr/bin/env bun
/**
 * Setup PocketBase using direct HTTP API calls
 */
const PB_URL = 'http://127.0.0.1:7090';
const ADMIN_EMAIL = 'admin@admin.local';
const ADMIN_PASSWORD = '1234567890';

let authToken = '';

async function authenticate() {
  const response = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${await response.text()}`);
  }

  const data = await response.json();
  authToken = data.token;
  console.log('✅ Authenticated\n');
}

async function createCollection(collectionData: any) {
  const response = await fetch(`${PB_URL}/api/collections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authToken
    },
    body: JSON.stringify(collectionData)
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`❌ Failed to create collection:`, text);
    return null;
  }

  return JSON.parse(text);
}

async function main() {
  console.log('🚀 PocketBase HTTP Setup\n');

  await authenticate();

  //  Fetch existing projects collection
  console.log('📦 Fetching existing projects collection...');

  const checkResponse = await fetch(`${PB_URL}/api/collections/projects`, {
    headers: { 'Authorization': authToken }
  });

  if (checkResponse.ok) {
    const checkData = await checkResponse.json();
    console.log('\nFull collection data:');
    console.log(JSON.stringify(checkData, null, 2));
  } else {
    console.log('Collection not found');
  }
}

main().catch(console.error);
