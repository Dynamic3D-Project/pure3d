#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Generate frontend JSON files directly from MongoDB exports
 * with proper thumbnail URLs
 */

const JSON_DIR = 'data/json-output';
const OUTPUT_DIR = 'src/lib/data';

interface MongoProject {
  _id: string;
  title: string;
  pubNum: number;
  dc?: {
    title?: string;
    subtitle?: string;
    description?: string;
    abstract?: string;
  };
  isVisible?: boolean;
}

interface MongoEdition {
  _id: string;
  title: string;
  projectId: string;
  pubNum: number;
  dc?: {
    title?: string;
    subtitle?: string;
    description?: string;
    abstract?: string;
    creator?: string[];
    keyword?: string[];
  };
  isPublished?: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

console.log('🚀 Generating Frontend JSON Files\n');

// Read MongoDB exports
console.log('📖 Reading MongoDB exports...');
const projectsData: MongoProject[] = JSON.parse(
  readFileSync(join(JSON_DIR, 'project.json'), 'utf-8')
);
const editionsData: MongoEdition[] = JSON.parse(
  readFileSync(join(JSON_DIR, 'edition.json'), 'utf-8')
);

// Filter visible/published only
const visibleProjects = projectsData.filter(p => p.isVisible !== false);
const publishedEditions = editionsData.filter(e => e.isPublished === true);

console.log(`   Found ${visibleProjects.length} visible projects`);
console.log(`   Found ${publishedEditions.length} published editions\n`);

// Create project lookup map
const projectMap = new Map(projectsData.map(p => [p._id, p]));

// Group editions by project
const editionsByProject = new Map<string, MongoEdition[]>();
for (const edition of publishedEditions) {
  const projectEditions = editionsByProject.get(edition.projectId) || [];
  projectEditions.push(edition);
  editionsByProject.set(edition.projectId, projectEditions);
}

// Generate collections.json
console.log('📦 Generating collections.json...');
const collections = visibleProjects.map(project => {
  const projectEditions = editionsByProject.get(project._id) || [];
  const thumbnailUrl = project.pubNum > 0
    ? `https://editions.pure3d.eu/project/${project.pubNum}/icon.png`
    : '';

  return {
    id: slugify(project.title),
    slug: slugify(project.title),
    title: project.title,
    description: project.dc?.abstract || project.dc?.description || project.dc?.subtitle || '',
    thumbnail: thumbnailUrl,
    editionIds: projectEditions.map(e => slugify(e.title)),
    created: new Date().toISOString().split('T')[0]
  };
});

writeFileSync(
  join(OUTPUT_DIR, 'collections.json'),
  JSON.stringify(collections, null, 2)
);
console.log(`   ✅ Created ${collections.length} collections\n`);

// Generate editions.json
console.log('📦 Generating editions.json...');
const editions = publishedEditions.map(edition => {
  const project = projectMap.get(edition.projectId);
  const projectPubNum = project?.pubNum || 0;
  const editionPubNum = edition.pubNum || 1;

  const thumbnailUrl = `https://editions.pure3d.eu/project/${projectPubNum}/edition/${editionPubNum}/icon.png`;
  const voyagerUrl = `https://editions.pure3d.eu/project/${projectPubNum}/edition/${editionPubNum}/`;

  const creators = edition.dc?.creator;
  const authorsStr = Array.isArray(creators)
    ? creators.join(', ')
    : typeof creators === 'string'
    ? creators
    : 'Unknown';

  const keywords = edition.dc?.keyword;
  const tagsArray = Array.isArray(keywords)
    ? keywords
    : typeof keywords === 'string'
    ? [keywords]
    : [];

  return {
    id: slugify(edition.title),
    slug: slugify(edition.title),
    title: edition.title,
    description: edition.dc?.abstract || edition.dc?.description || edition.dc?.subtitle || '',
    authors: authorsStr,
    thumbnail: thumbnailUrl,
    voyagerUrl: voyagerUrl,
    usageConditions: 'CC BY-SA',
    alternativeVersion: null,
    tags: tagsArray,
    created: new Date().toISOString().split('T')[0]
  };
});

writeFileSync(
  join(OUTPUT_DIR, 'editions.json'),
  JSON.stringify(editions, null, 2)
);
console.log(`   ✅ Created ${editions.length} editions\n`);

console.log('='.repeat(60));
console.log('✅ Frontend JSON files generated successfully!');
console.log('='.repeat(60));
console.log(`\nFiles created:`);
console.log(`   - ${OUTPUT_DIR}/collections.json`);
console.log(`   - ${OUTPUT_DIR}/editions.json\n`);
