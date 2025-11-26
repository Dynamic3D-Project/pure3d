#!/usr/bin/env bun
/**
 * Removes duplicate editions from PocketBase
 * Keeps the first record for each unique title
 */
import PocketBase from 'pocketbase';

const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:7090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD!;

const pb = new PocketBase(PB_URL);

async function main() {
  console.log('🧹 Cleaning up duplicate editions...\n');

  // Authenticate
  const authResponse = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });

  if (!authResponse.ok) {
    console.error('❌ Authentication failed');
    process.exit(1);
  }

  const authData = await authResponse.json();
  pb.authStore.save(authData.token, authData.record);
  console.log('✅ Authenticated\n');

  // Get all editions
  const editions = await pb.collection('editions').getFullList();

  console.log(`📊 Total editions in database: ${editions.length}`);

  // Group by title + collection to find duplicates
  const seen = new Map<string, any>();
  const duplicates: any[] = [];

  for (const edition of editions) {
    const key = `${edition.title}|${edition.collection}`;

    if (seen.has(key)) {
      duplicates.push(edition);
    } else {
      seen.set(key, edition);
    }
  }

  console.log(`🔍 Found ${duplicates.length} duplicates\n`);

  if (duplicates.length === 0) {
    console.log('✅ No duplicates to remove!');
    return;
  }

  // Delete duplicates
  console.log('🗑️  Removing duplicates...');
  let deleted = 0;
  for (const dup of duplicates) {
    try {
      await pb.collection('editions').delete(dup.id);
      deleted++;
      process.stdout.write(`\r   Deleted: ${deleted}/${duplicates.length}`);
    } catch (error: any) {
      console.error(`\n   Failed to delete ${dup.title}: ${error.message}`);
    }
  }

  console.log(`\n\n✅ Cleanup complete!`);
  console.log(`   Removed: ${deleted} duplicates`);
  console.log(`   Remaining: ${editions.length - deleted} editions`);
}

main().catch(console.error);
