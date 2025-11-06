#!/usr/bin/env bun
/**
 * Verify PocketBase data import
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

  const { token } = await authResponse.json();

  // Check projects
  const projectsResponse = await fetch(`${PB_URL}/api/collections/projects/records?perPage=3`, {
    headers: { 'Authorization': token }
  });
  const projectsData = await projectsResponse.json();

  console.log('📦 Sample Projects:');
  console.log('==================');
  projectsData.items.forEach((p: any) => {
    console.log(`\nTitle: ${p.title}`);
    console.log(`PubNum: ${p.pubNum}`);
    console.log(`Thumbnail: ${p.thumbnail}`);
    console.log(`Visible: ${p.isVisible}`);
  });

  // Check editions
  const editionsResponse = await fetch(`${PB_URL}/api/collections/editions/records?perPage=3`, {
    headers: { 'Authorization': token }
  });
  const editionsData = await editionsResponse.json();

  console.log('\n\n📚 Sample Editions:');
  console.log('==================');
  editionsData.items.forEach((e: any) => {
    console.log(`\nTitle: ${e.title}`);
    console.log(`PubNum: ${e.pubNum}`);
    console.log(`Thumbnail: ${e.thumbnail}`);
    console.log(`Published: ${e.isPublished}`);
  });

  console.log('\n\n📊 Summary:');
  console.log('==================');
  console.log(`Projects: ${projectsData.totalItems}`);
  console.log(`Editions: ${editionsData.totalItems}`);
}

main().catch(console.error);
