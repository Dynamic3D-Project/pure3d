#!/usr/bin/env bun
/**
 * Simple PocketBase setup using the official SDK
 */
import PocketBase from 'pocketbase';

const PB_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD!;

const pb = new PocketBase(PB_URL);

async function main() {
  console.log('🚀 PocketBase Setup');
  console.log(`   URL: ${PB_URL}`);
  console.log(`   Email: ${ADMIN_EMAIL}\n`);

  // Wait for PocketBase
  console.log('⏳ Waiting for PocketBase...');
  for (let i = 0; i < 30; i++) {
    try {
      await pb.health.check();
      console.log('✅ PocketBase is ready\n');
      break;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));
  }

  // Authenticate as admin
  try {
    console.log('🔑 Authenticating...');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    const authData = await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Authenticated successfully');
    console.log(`   Token: ${authData.token ? 'present' : 'missing'}\n`);
  } catch (error: any) {
    console.error('❌ Authentication failed:', error.message);
    console.error('\n📝 Troubleshooting:');
    console.error('   1. Check admin account exists at http://localhost:7090/_/');
    console.error('   2. Verify credentials match .env file:');
    console.error(`      Email: ${ADMIN_EMAIL}`);
    console.error('   3. Try logging in manually at http://localhost:7090/_/\n');
    process.exit(1);
  }

  // Check if collections already exist
  try {
    const collections = await pb.collections.getFullList();
    const hasOurCollections = collections.some(c => c.name === 'users' || c.name === 'projects');

    if (hasOurCollections) {
      console.log('⚠️  Collections already exist. Skipping creation.\n');
    } else {
      console.log('📦 Creating collections via Admin UI export is recommended.\n');
      console.log('   Alternatively, create them manually at: http://localhost:7090/_/\n');
    }
  } catch (error: any) {
    console.log('ℹ️  Cannot check collections (expected for first run)\n');
  }

  console.log('✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('1. Create collections via Admin UI: http://localhost:7090/_/');
  console.log('2. Then run: docker compose --profile import up pocketbase-importer\n');
}

main().catch(console.error);
