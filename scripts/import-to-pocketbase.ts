#!/usr/bin/env bun
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Import MongoDB backup data into PocketBase
 *
 * PREREQUISITES:
 * 1. PocketBase server must be running (default: http://127.0.0.1:8090)
 * 2. Migration must be applied first (collections created)
 * 3. Admin account created in PocketBase
 *
 * Usage: bun scripts/import-to-pocketbase.ts <admin-email> <admin-password>
 */

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const JSON_DIR = 'data/json-output';

interface ImportStats {
  collection: string;
  total: number;
  imported: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
}

class PocketBaseImporter {
  private token: string = '';
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async authenticate(email: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.token = data.token;
      console.log('✅ Authenticated successfully');
      return true;
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      return false;
    }
  }

  async createRecord(collection: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/collections/${collection}/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.token
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    return response.json();
  }

  transformMongoIdToPocketBase(mongoId: string | { buffer: any }): string {
    if (typeof mongoId === 'string') {
      return mongoId;
    }
    return mongoId.toString();
  }

  async importUsers(): Promise<ImportStats> {
    console.log('\n📦 Importing users...');
    const data = JSON.parse(readFileSync(join(JSON_DIR, 'user.json'), 'utf-8'));
    const stats: ImportStats = {
      collection: 'users',
      total: data.length,
      imported: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < data.length; i++) {
      const doc = data[i];
      try {
        await this.createRecord('users', {
          user: doc.user,
          email: doc.email,
          nickname: doc.nickname,
          role: doc.role
        });
        stats.imported++;
        process.stdout.write(`\r   Progress: ${stats.imported}/${stats.total}`);
      } catch (error: any) {
        stats.failed++;
        stats.errors.push({ index: i, error: error.message });
      }
    }

    console.log(`\n   ✅ Imported ${stats.imported}/${stats.total} users`);
    return stats;
  }

  async importSite(): Promise<ImportStats> {
    console.log('\n📦 Importing site...');
    const data = JSON.parse(readFileSync(join(JSON_DIR, 'site.json'), 'utf-8'));
    const stats: ImportStats = {
      collection: 'site',
      total: data.length,
      imported: 0,
      failed: 0,
      errors: []
    };

    for (const doc of data) {
      try {
        await this.createRecord('site', {
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
        stats.imported++;
      } catch (error: any) {
        stats.failed++;
        stats.errors.push({ index: 0, error: error.message });
      }
    }

    console.log(`   ✅ Imported ${stats.imported}/${stats.total} site records`);
    return stats;
  }

  async importKeywords(): Promise<ImportStats> {
    console.log('\n📦 Importing keywords...');
    const data = JSON.parse(readFileSync(join(JSON_DIR, 'keyword.json'), 'utf-8'));
    const stats: ImportStats = {
      collection: 'keywords',
      total: data.length,
      imported: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < data.length; i++) {
      const doc = data[i];
      try {
        await this.createRecord('keywords', {
          name: doc.name,
          value: doc.value
        });
        stats.imported++;
        if (i % 50 === 0) {
          process.stdout.write(`\r   Progress: ${stats.imported}/${stats.total}`);
        }
      } catch (error: any) {
        stats.failed++;
        stats.errors.push({ index: i, error: error.message });
      }
    }

    console.log(`\n   ✅ Imported ${stats.imported}/${stats.total} keywords`);
    return stats;
  }

  async importProjects(): Promise<Map<string, string>> {
    console.log('\n📦 Importing projects...');
    const data = JSON.parse(readFileSync(join(JSON_DIR, 'project.json'), 'utf-8'));
    const mongoIdToPbId = new Map<string, string>();

    // First get the site ID
    const siteResponse = await fetch(`${this.baseUrl}/api/collections/site/records`, {
      headers: { 'Authorization': this.token }
    });
    const siteData = await siteResponse.json();
    const siteId = siteData.items[0]?.id;

    if (!siteId) {
      throw new Error('Site record not found. Import site first.');
    }

    let imported = 0;
    for (const doc of data) {
      try {
        const result = await this.createRecord('projects', {
          title: doc.title,
          siteId: siteId,
          isVisible: doc.isVisible !== false,
          lastPublished: doc.lastPublished,
          pubNum: doc.pubNum || 0,
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

        mongoIdToPbId.set(doc._id, result.id);
        imported++;
        process.stdout.write(`\r   Progress: ${imported}/${data.length}`);
      } catch (error: any) {
        console.error(`\n   ⚠️  Failed to import project "${doc.title}":`, error.message);
      }
    }

    console.log(`\n   ✅ Imported ${imported}/${data.length} projects`);
    return mongoIdToPbId;
  }

  async importEditions(projectIdMap: Map<string, string>): Promise<Map<string, string>> {
    console.log('\n📦 Importing editions...');
    const data = JSON.parse(readFileSync(join(JSON_DIR, 'edition.json'), 'utf-8'));
    const mongoIdToPbId = new Map<string, string>();

    let imported = 0;
    for (const doc of data) {
      try {
        const pbProjectId = projectIdMap.get(doc.projectId);
        if (!pbProjectId) {
          throw new Error(`Project ID not found: ${doc.projectId}`);
        }

        const result = await this.createRecord('editions', {
          title: doc.title,
          projectId: pbProjectId,
          isPublished: doc.isPublished === true,
          pubNum: doc.pubNum || 0,
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

        mongoIdToPbId.set(doc._id, result.id);
        imported++;
        process.stdout.write(`\r   Progress: ${imported}/${data.length}`);
      } catch (error: any) {
        console.error(`\n   ⚠️  Failed to import edition "${doc.title}":`, error.message);
      }
    }

    console.log(`\n   ✅ Imported ${imported}/${data.length} editions`);
    return mongoIdToPbId;
  }

  async importProjectUsers(projectIdMap: Map<string, string>): Promise<ImportStats> {
    console.log('\n📦 Importing project users...');
    const data = JSON.parse(readFileSync(join(JSON_DIR, 'projectUser.json'), 'utf-8'));
    const stats: ImportStats = {
      collection: 'projectUsers',
      total: data.length,
      imported: 0,
      failed: 0,
      errors: []
    };

    // Get all users to map by hash
    const usersResponse = await fetch(`${this.baseUrl}/api/collections/users/records?perPage=500`, {
      headers: { 'Authorization': this.token }
    });
    const usersData = await usersResponse.json();
    const userHashToId = new Map(usersData.items.map((u: any) => [u.user, u.id]));

    for (let i = 0; i < data.length; i++) {
      const doc = data[i];
      try {
        const pbProjectId = projectIdMap.get(doc.projectId);
        const pbUserId = userHashToId.get(doc.user);

        if (!pbProjectId || !pbUserId) {
          throw new Error('Project or User not found');
        }

        await this.createRecord('projectUsers', {
          projectId: pbProjectId,
          userId: pbUserId,
          user: doc.user,
          role: doc.role
        });
        stats.imported++;
        process.stdout.write(`\r   Progress: ${stats.imported}/${stats.total}`);
      } catch (error: any) {
        stats.failed++;
        stats.errors.push({ index: i, error: error.message });
      }
    }

    console.log(`\n   ✅ Imported ${stats.imported}/${stats.total} project-user relationships`);
    return stats;
  }

  async importEditionUsers(editionIdMap: Map<string, string>): Promise<ImportStats> {
    console.log('\n📦 Importing edition users...');
    const data = JSON.parse(readFileSync(join(JSON_DIR, 'editionUser.json'), 'utf-8'));
    const stats: ImportStats = {
      collection: 'editionUsers',
      total: data.length,
      imported: 0,
      failed: 0,
      errors: []
    };

    // Get all users to map by hash
    const usersResponse = await fetch(`${this.baseUrl}/api/collections/users/records?perPage=500`, {
      headers: { 'Authorization': this.token }
    });
    const usersData = await usersResponse.json();
    const userHashToId = new Map(usersData.items.map((u: any) => [u.user, u.id]));

    for (let i = 0; i < data.length; i++) {
      const doc = data[i];
      try {
        const pbEditionId = editionIdMap.get(doc.editionId);
        const pbUserId = userHashToId.get(doc.user);

        if (!pbEditionId || !pbUserId) {
          throw new Error('Edition or User not found');
        }

        await this.createRecord('editionUsers', {
          editionId: pbEditionId,
          userId: pbUserId,
          user: doc.user,
          role: doc.role
        });
        stats.imported++;
        if (i % 20 === 0) {
          process.stdout.write(`\r   Progress: ${stats.imported}/${stats.total}`);
        }
      } catch (error: any) {
        stats.failed++;
        stats.errors.push({ index: i, error: error.message });
      }
    }

    console.log(`\n   ✅ Imported ${stats.imported}/${stats.total} edition-user relationships`);
    return stats;
  }
}

async function main() {
  const adminEmail = process.argv[2];
  const adminPassword = process.argv[3];

  if (!adminEmail || !adminPassword) {
    console.error('Usage: bun scripts/import-to-pocketbase.ts <admin-email> <admin-password>');
    process.exit(1);
  }

  console.log('🚀 Starting PocketBase Import');
  console.log(`   PocketBase URL: ${POCKETBASE_URL}`);

  const importer = new PocketBaseImporter(POCKETBASE_URL);

  // Authenticate
  const authenticated = await importer.authenticate(adminEmail, adminPassword);
  if (!authenticated) {
    console.error('❌ Failed to authenticate. Exiting.');
    process.exit(1);
  }

  try {
    // Import in correct order (respecting foreign key dependencies)
    await importer.importSite();
    await importer.importUsers();
    await importer.importKeywords();

    const projectIdMap = await importer.importProjects();
    const editionIdMap = await importer.importEditions(projectIdMap);

    await importer.importProjectUsers(projectIdMap);
    await importer.importEditionUsers(editionIdMap);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Import completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

main();
