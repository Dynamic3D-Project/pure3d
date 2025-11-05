#!/usr/bin/env bun
import { deserialize } from 'bson';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Reads BSON files from MongoDB backup and converts them to JSON
 * Usage: bun scripts/read-bson.ts [collection-name]
 */

const DATA_DIR = 'data/db';
const OUTPUT_DIR = 'data/json-output';

interface CollectionStats {
  name: string;
  documentCount: number;
  sampleDocument: any;
  schema: any;
}

function extractSchema(doc: any, depth = 0, maxDepth = 3): any {
  if (depth > maxDepth || doc === null || doc === undefined) {
    return typeof doc;
  }

  if (Array.isArray(doc)) {
    return doc.length > 0 ? [extractSchema(doc[0], depth + 1, maxDepth)] : [];
  }

  if (typeof doc === 'object' && doc !== null) {
    const schema: any = {};
    for (const [key, value] of Object.entries(doc)) {
      schema[key] = extractSchema(value, depth + 1, maxDepth);
    }
    return schema;
  }

  return typeof doc;
}

function readBSONFile(filePath: string): any[] {
  const buffer = readFileSync(filePath);
  const documents: any[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    try {
      // Read the document size (first 4 bytes, little-endian)
      const docSize = buffer.readInt32LE(offset);

      if (docSize <= 0 || offset + docSize > buffer.length) {
        break;
      }

      // Extract and deserialize the document
      const docBuffer = buffer.slice(offset, offset + docSize);
      const document = deserialize(docBuffer);
      documents.push(document);

      offset += docSize;
    } catch (error) {
      console.error(`Error reading document at offset ${offset}:`, error);
      break;
    }
  }

  return documents;
}

function analyzeCollection(collectionName: string): CollectionStats | null {
  const bsonPath = join(DATA_DIR, `${collectionName}.bson`);

  try {
    console.log(`\n📖 Reading ${collectionName}.bson...`);
    const documents = readBSONFile(bsonPath);

    const stats: CollectionStats = {
      name: collectionName,
      documentCount: documents.length,
      sampleDocument: documents[0] || null,
      schema: documents[0] ? extractSchema(documents[0]) : null
    };

    // Save to JSON file
    const jsonPath = join(OUTPUT_DIR, `${collectionName}.json`);
    writeFileSync(jsonPath, JSON.stringify(documents, null, 2));
    console.log(`✅ Saved ${documents.length} documents to ${jsonPath}`);

    return stats;
  } catch (error) {
    console.error(`❌ Error processing ${collectionName}:`, error);
    return null;
  }
}

function main() {
  const targetCollection = process.argv[2];

  // Create output directory
  const fs = require('fs');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  if (targetCollection) {
    // Process single collection
    const stats = analyzeCollection(targetCollection);
    if (stats) {
      console.log('\n📊 Collection Stats:');
      console.log(`   Name: ${stats.name}`);
      console.log(`   Documents: ${stats.documentCount}`);
      console.log(`\n🔍 Schema Structure:`);
      console.log(JSON.stringify(stats.schema, null, 2));
    }
  } else {
    // Process all collections
    const bsonFiles = readdirSync(DATA_DIR).filter(f => f.endsWith('.bson'));
    const allStats: CollectionStats[] = [];

    console.log(`Found ${bsonFiles.length} BSON files in ${DATA_DIR}`);

    for (const file of bsonFiles) {
      const collectionName = file.replace('.bson', '');
      const stats = analyzeCollection(collectionName);
      if (stats) {
        allStats.push(stats);
      }
    }

    // Generate summary report
    console.log('\n' + '='.repeat(60));
    console.log('📋 DATABASE STRUCTURE SUMMARY');
    console.log('='.repeat(60));

    for (const stats of allStats) {
      console.log(`\n📦 Collection: ${stats.name}`);
      console.log(`   Documents: ${stats.documentCount}`);
      console.log(`   Schema:`);
      console.log(JSON.stringify(stats.schema, null, 2).split('\n').map(line => `   ${line}`).join('\n'));
    }

    // Save summary
    const summaryPath = join(OUTPUT_DIR, '_database_structure.json');
    writeFileSync(summaryPath, JSON.stringify(allStats, null, 2));
    console.log(`\n✅ Complete database structure saved to ${summaryPath}`);
  }
}

main();
