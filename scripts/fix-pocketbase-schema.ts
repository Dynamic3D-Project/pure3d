#!/usr/bin/env bun
/**
 * Fix PocketBase collection schemas by adding fields
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

async function updateCollection(collectionId: string, updateData: any) {
  const response = await fetch(`${PB_URL}/api/collections/${collectionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authToken
    },
    body: JSON.stringify(updateData)
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`❌ Failed to update collection:`, text);
    return null;
  }

  return JSON.parse(text);
}

async function main() {
  console.log('🚀 Fixing PocketBase Schemas\n');

  await authenticate();

  // Update projects collection
  console.log('📦 Updating projects collection schema...');

  const projectsSchema = {
    fields: [
      {
        name: 'title',
        type: 'text',
        required: true
      },
      {
        name: 'siteId',
        type: 'relation',
        required: false,
        collectionId: 'pbc_1313762900', // site collection ID
        cascadeDelete: false,
        maxSelect: 1
      },
      {
        name: 'isVisible',
        type: 'bool',
        required: false
      },
      {
        name: 'pubNum',
        type: 'number',
        required: false
      },
      {
        name: 'thumbnail',
        type: 'url',
        required: false
      },
      {
        name: 'dcTitle',
        type: 'text',
        required: false
      },
      {
        name: 'dcAbstract',
        type: 'editor',
        required: false
      }
    ]
  };

  const result = await updateCollection('projects', projectsSchema);

  if (result) {
    console.log('✅ Projects collection updated');
    console.log('Fields:', result.fields?.map((f: any) => f.name).join(', ') || result.schema?.map((f: any) => f.name).join(', '));
  }
}

main().catch(console.error);
