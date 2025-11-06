#!/usr/bin/env bun
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Export data from PocketBase to frontend JSON files
 *
 * This script fetches projects and editions from PocketBase and generates
 * the JSON files used by the frontend with correct thumbnail URLs.
 *
 * Usage: bun scripts/export-from-pocketbase.ts <admin-email> <admin-password>
 */

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const OUTPUT_DIR = 'src/lib/data';

interface PocketBaseProject {
  id: string;
  title: string;
  pubNum: number;
  thumbnail?: string;
  dcTitle?: string;
  dcDescription?: string;
  created: string;
  updated: string;
}

interface PocketBaseEdition {
  id: string;
  title: string;
  projectId: string;
  pubNum: number;
  thumbnail?: string;
  isPublished: boolean;
  dcTitle?: string;
  dcDescription?: string;
  dcCreator?: string[];
  dcKeyword?: string[];
  created: string;
  updated: string;
}

interface Collection {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  editionIds: string[];
  created: string;
}

interface Edition {
  id: string;
  slug: string;
  title: string;
  description: string;
  authors: string;
  thumbnail: string;
  voyagerUrl: string;
  usageConditions: string;
  alternativeVersion: string | null;
  tags: string[];
  created: string;
}

class PocketBaseExporter {
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

  async fetchAllRecords<T>(collection: string, filter?: string): Promise<T[]> {
    const params = new URLSearchParams({
      perPage: '500',
      sort: '-created'
    });

    if (filter) {
      params.set('filter', filter);
    }

    const response = await fetch(
      `${this.baseUrl}/api/collections/${collection}/records?${params}`,
      {
        headers: { 'Authorization': this.token }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ${collection}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items;
  }

  slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async exportCollections(): Promise<void> {
    console.log('\n📦 Exporting collections (projects)...');

    const projects = await this.fetchAllRecords<PocketBaseProject>('projects', 'isVisible = true');
    const editions = await this.fetchAllRecords<PocketBaseEdition>('editions', 'isPublished = true');

    // Group editions by project
    const editionsByProject = new Map<string, PocketBaseEdition[]>();
    for (const edition of editions) {
      const projectEditions = editionsByProject.get(edition.projectId) || [];
      projectEditions.push(edition);
      editionsByProject.set(edition.projectId, projectEditions);
    }

    const collections: Collection[] = projects.map(project => {
      const projectEditions = editionsByProject.get(project.id) || [];

      return {
        id: this.slugify(project.title),
        slug: this.slugify(project.title),
        title: project.title,
        description: project.dcDescription || project.dcTitle || '',
        thumbnail: project.thumbnail || `https://editions.pure3d.eu/project/${project.pubNum}/icon.png`,
        editionIds: projectEditions.map(e => this.slugify(e.title)),
        created: project.created.split('T')[0]
      };
    });

    const outputPath = join(OUTPUT_DIR, 'collections.json');
    writeFileSync(outputPath, JSON.stringify(collections, null, 2));
    console.log(`   ✅ Exported ${collections.length} collections to ${outputPath}`);
  }

  async exportEditions(): Promise<void> {
    console.log('\n📦 Exporting editions...');

    const editions = await this.fetchAllRecords<PocketBaseEdition>('editions', 'isPublished = true');
    const projects = await this.fetchAllRecords<PocketBaseProject>('projects');

    // Create project map for lookups
    const projectMap = new Map(projects.map(p => [p.id, p]));

    const editionsOutput: Edition[] = editions.map(edition => {
      const project = projectMap.get(edition.projectId);
      const projectPubNum = project?.pubNum || 0;
      const editionPubNum = edition.pubNum || 1;

      // Construct Voyager URL (adjust this based on your actual URL pattern)
      const voyagerUrl = `https://editions.pure3d.eu/project/${projectPubNum}/edition/${editionPubNum}/`;

      return {
        id: this.slugify(edition.title),
        slug: this.slugify(edition.title),
        title: edition.title,
        description: edition.dcDescription || edition.dcTitle || '',
        authors: edition.dcCreator?.join(', ') || 'Unknown',
        thumbnail: edition.thumbnail || `https://editions.pure3d.eu/project/${projectPubNum}/edition/${editionPubNum}/icon.png`,
        voyagerUrl: voyagerUrl,
        usageConditions: 'CC BY-SA',
        alternativeVersion: null,
        tags: edition.dcKeyword || [],
        created: edition.created.split('T')[0]
      };
    });

    const outputPath = join(OUTPUT_DIR, 'editions.json');
    writeFileSync(outputPath, JSON.stringify(editionsOutput, null, 2));
    console.log(`   ✅ Exported ${editionsOutput.length} editions to ${outputPath}`);
  }
}

async function main() {
  const adminEmail = process.argv[2];
  const adminPassword = process.argv[3];

  if (!adminEmail || !adminPassword) {
    console.error('Usage: bun scripts/export-from-pocketbase.ts <admin-email> <admin-password>');
    process.exit(1);
  }

  console.log('🚀 Starting PocketBase Export');
  console.log(`   PocketBase URL: ${POCKETBASE_URL}`);

  const exporter = new PocketBaseExporter(POCKETBASE_URL);

  // Authenticate
  const authenticated = await exporter.authenticate(adminEmail, adminPassword);
  if (!authenticated) {
    console.error('❌ Failed to authenticate. Exiting.');
    process.exit(1);
  }

  try {
    await exporter.exportCollections();
    await exporter.exportEditions();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Export completed successfully!');
    console.log('='.repeat(60));
    console.log(`\nJSON files have been updated in ${OUTPUT_DIR}/`);
  } catch (error) {
    console.error('\n❌ Export failed:', error);
    process.exit(1);
  }
}

main();
