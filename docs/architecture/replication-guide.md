# PURE3D Platform Replication Guide

## Executive Summary

PURE3D (https://editions.pure3d.eu/) is a Virtual Research Environment for 3D Digital Humanities and Heritage built on top of Smithsonian Voyager. This guide provides a comprehensive plan to replicate its features for DPO Voyager.

**Key Insight**: PURE3D is essentially a portal/gallery platform that wraps around Voyager, providing project discovery, metadata management, and scholarly publication workflows.

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Core Features](#core-features)
3. [Architecture](#architecture)
4. [Feature Breakdown & Implementation](#feature-breakdown--implementation)
5. [Technical Specifications](#technical-specifications)
6. [Implementation Roadmap](#implementation-roadmap)
7. [User Workflows](#user-workflows)

---

## Platform Overview

### What is PURE3D?

PURE3D is a national infrastructure for the publication and preservation of 3D scholarship consisting of:

- **Authoring Environment**: Web-based tool for creating 3D Scholarly Editions using Smithsonian Voyager
- **Publishing Platform**: Gallery/portal for browsing and discovering published editions
- **Repository Integration**: Long-term preservation of 3D models and associated data
- **Peer Review System**: Academic quality control for submissions

### 3D Scholarly Editions

A 3D Scholarly Edition treats the 3D model as the primary "text" enriched with:
- Multimodal annotations (text, images, video, audio)
- Contextual information and research findings
- Process documentation (paradata)
- Alternative hypotheses and interpretations
- Historical contexts

---

## Core Features

### 1. Project Gallery/Discovery

**Current PURE3D Implementation**:
- Landing page with featured projects carousel
- Project browsing interface
- Separate sections for "3D Editions" and "3D Projects"
- Project cards showing:
  - Project name
  - Creator/author
  - Abstract description
  - Thumbnail image
  - Link to full edition

**Features to Replicate**:
- [ ] Responsive project gallery with card-based layout
- [ ] Featured projects carousel on homepage
- [ ] Project categorization (Editions vs Projects)
- [ ] Thumbnail generation from 3D models
- [ ] Project metadata display
- [ ] Search and filter functionality
- [ ] Sorting options (date, author, topic)

### 2. Individual Project Pages

**Current PURE3D Implementation**:
- Dedicated page per project with:
  - Project title and metadata
  - Author information
  - Publication date
  - Embedded Voyager Story viewer (fullscreen capable)
  - Historical/contextual information
  - Navigation guide for the 3D model
  - Social media sharing options
  - Recommended viewing instructions

**Features to Replicate**:
- [ ] Project detail page template
- [ ] Embedded Voyager viewer (Explorer/Story)
- [ ] Metadata display section
- [ ] Rich text description support
- [ ] Image galleries for context
- [ ] Citation information
- [ ] Sharing capabilities
- [ ] Related projects recommendations

### 3. Authoring Environment

**Current PURE3D Implementation**:
- Web-based authoring interface (author.pure3d.eu)
- Integrated Smithsonian Voyager Story
- Project creation and management
- Model upload and processing
- Annotation tools
- Publishing workflow

**Features to Replicate**:
- [ ] User authentication system
- [ ] Project creation wizard
- [ ] 3D model upload (GLB/GLTF)
- [ ] Model validation and optimization
- [ ] Integrated Voyager Story editor
- [ ] Draft/publish workflow
- [ ] Version control for editions
- [ ] Collaboration tools

### 4. Content Management

**Current PURE3D Implementation**:
- Project metadata management
- User/author profiles
- Draft and published states
- Editorial workflow
- Static page generation

**Features to Replicate**:
- [ ] Project metadata schema
- [ ] User role management (author, editor, admin)
- [ ] Project status workflow (draft/review/published)
- [ ] Metadata editing interface
- [ ] Bulk operations
- [ ] Import/export capabilities

### 5. Technical Features

**Model Requirements**:
- Format: .gltf/.glb (Draco compression recommended)
- Texture standards:
  - Single objects: 4K texture map (.jpg, 86 compression)
  - Complex scenes: 1024×1024 textures
- Size limit: 230,000 triangles maximum
- Required elements: Geometry, texture, normals

**Features to Replicate**:
- [ ] Model validation on upload
- [ ] Automatic texture optimization
- [ ] Triangle count verification
- [ ] Draco compression support
- [ ] Format conversion utilities
- [ ] Model preview generation
- [ ] Performance metrics display

### 6. Repository & Preservation

**Current PURE3D Implementation**:
- Long-term preservation repository
- FAIR data principles (Findable, Accessible, Interoperable, Reusable)
- Metadata standards compliance
- Persistent identifiers (DOIs)

**Features to Replicate**:
- [ ] Data archival system
- [ ] Metadata export (Dublin Core, DataCite)
- [ ] DOI integration
- [ ] Version archiving
- [ ] Data package generation
- [ ] FAIR compliance checks

### 7. Peer Review & Quality Control

**Current PURE3D Implementation**:
- Submission guidelines
- Editorial review process
- Quality assurance checks
- Publication approval workflow

**Features to Replicate**:
- [ ] Submission form with guidelines
- [ ] Review assignment system
- [ ] Reviewer feedback interface
- [ ] Revision tracking
- [ ] Publication approval workflow
- [ ] Quality checklist automation

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PURE3D Platform                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐        ┌─────────────────────┐   │
│  │  Authoring App   │        │  Publishing App     │   │
│  │  (author.*)      │        │  (editions.*)       │   │
│  ├──────────────────┤        ├─────────────────────┤   │
│  │ - Project CRUD   │───────▶│ - Project Gallery   │   │
│  │ - Model Upload   │        │ - Detail Pages      │   │
│  │ - Voyager Story  │        │ - Search/Filter     │   │
│  │ - Annotations    │        │ - Embedded Viewers  │   │
│  │ - Publishing     │        │ - Static Generation │   │
│  └──────────────────┘        └─────────────────────┘   │
│           │                           │                 │
│           └───────────┬───────────────┘                 │
│                       │                                 │
│              ┌────────▼──────────┐                      │
│              │   Data Layer      │                      │
│              ├───────────────────┤                      │
│              │ - Project DB      │                      │
│              │ - User DB         │                      │
│              │ - File Storage    │                      │
│              │ - Metadata Store  │                      │
│              └───────────────────┘                      │
│                       │                                 │
│              ┌────────▼──────────┐                      │
│              │  Voyager Core     │                      │
│              ├───────────────────┤                      │
│              │ - Voyager Story   │                      │
│              │ - Voyager Explorer│                      │
│              │ - Voyager Mini    │                      │
│              └───────────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

**PURE3D Current Stack**:
- Backend: Python (78.5%)
- Frontend: HTML, JavaScript, CSS
- Template Engine: Mako
- 3D Viewer: Smithsonian Voyager
- Deployment: Kubernetes + Docker
- File Storage: WebDAV

**Recommended Stack for DPO Voyager**:
- Backend: Node.js/Express (already present) or Python/Flask
- Frontend: Modern framework (React, Vue, or Svelte)
- Database: PostgreSQL or MongoDB
- File Storage: S3-compatible object storage or filesystem
- Authentication: OAuth2/JWT
- Deployment: Docker + Kubernetes or Docker Compose

---

## Feature Breakdown & Implementation

### Phase 1: Project Gallery (Publishing Platform)

#### 1.1 Homepage & Navigation

**Features**:
- Responsive navigation menu
- Logo and branding
- Featured projects carousel
- Call-to-action for submissions
- Institutional partners section

**Implementation**:
```
src/
├── client/
│   ├── applications/
│   │   └── GalleryApp.ts          # New gallery application
│   ├── ui/
│   │   ├── gallery/
│   │   │   ├── HomePage.ts        # Homepage with carousel
│   │   │   ├── Navigation.ts      # Main navigation
│   │   │   ├── ProjectCard.ts     # Project card component
│   │   │   ├── Carousel.ts        # Featured projects carousel
│   │   │   └── Footer.ts          # Footer with partners
│   │   └── styles/
│   │       └── gallery.scss       # Gallery styles
└── server/
    └── routes/
        └── gallery.ts              # Gallery API routes
```

**Database Schema**:
```typescript
interface Project {
  id: string;
  title: string;
  slug: string;
  author: string;
  authorId: string;
  abstract: string;
  description: string; // Full HTML description
  thumbnail: string;
  modelUrl: string;
  documentUrl: string; // Voyager document JSON
  category: 'edition' | 'project';
  status: 'draft' | 'review' | 'published';
  featured: boolean;
  publishedDate: Date;
  createdDate: Date;
  updatedDate: Date;
  metadata: ProjectMetadata;
  stats: {
    views: number;
    likes: number;
  };
}

interface ProjectMetadata {
  discipline: string[];
  keywords: string[];
  license: string;
  doi?: string;
  citation: string;
  technicalSpecs: {
    triangleCount: number;
    textureSize: string;
    fileSize: number;
    format: string;
  };
}
```

#### 1.2 Project Browsing Interface

**Features**:
- Grid/list view toggle
- Search bar
- Filter by category, discipline, author
- Sort by date, title, popularity
- Pagination

**Implementation**:
```typescript
// CVProjectGallery.ts
export default class CVProjectGallery extends Component {
  protected static readonly ins = {
    searchQuery: types.String("Search.Query"),
    filterCategory: types.Enum("Filter.Category", ["all", "edition", "project"]),
    filterDiscipline: types.String("Filter.Discipline"),
    sortBy: types.Enum("Sort.By", ["date", "title", "views"]),
    page: types.Number("Pagination.Page", 1),
    itemsPerPage: types.Number("Pagination.Items", 12)
  };

  protected static readonly outs = {
    projects: types.Object("Projects.List"),
    totalCount: types.Number("Projects.Total"),
    loading: types.Boolean("Loading")
  };

  // Fetch and filter projects
  protected async fetchProjects() {
    const { ins } = this;
    const params = {
      q: ins.searchQuery.value,
      category: ins.filterCategory.value,
      discipline: ins.filterDiscipline.value,
      sort: ins.sortBy.value,
      page: ins.page.value,
      limit: ins.itemsPerPage.value
    };

    const response = await fetch(`/api/projects?${new URLSearchParams(params)}`);
    const data = await response.json();

    this.outs.projects.setValue(data.projects);
    this.outs.totalCount.setValue(data.total);
  }
}
```

#### 1.3 Project Detail Page

**Features**:
- Project metadata display
- Embedded Voyager viewer
- Contextual information
- Image galleries
- Related projects
- Sharing buttons
- Citation generator

**Implementation**:
```html
<!-- project-detail.html -->
<div class="project-detail">
  <header class="project-header">
    <h1>{project.title}</h1>
    <div class="project-meta">
      <span class="author">By {project.author}</span>
      <span class="date">{project.publishedDate}</span>
      <span class="category">{project.category}</span>
    </div>
  </header>

  <div class="viewer-container">
    <voyager-story
      document="{project.documentUrl}"
      root="{project.modelUrl}">
    </voyager-story>
  </div>

  <div class="project-content">
    <section class="description">
      <h2>About this Edition</h2>
      {project.description}
    </section>

    <section class="metadata">
      <h3>Project Information</h3>
      <dl>
        <dt>Discipline</dt>
        <dd>{project.metadata.discipline}</dd>
        <dt>Keywords</dt>
        <dd>{project.metadata.keywords}</dd>
        <dt>License</dt>
        <dd>{project.metadata.license}</dd>
        <dt>Citation</dt>
        <dd>{project.metadata.citation}</dd>
      </dl>
    </section>

    <section class="technical-specs">
      <h3>Technical Specifications</h3>
      <ul>
        <li>Triangle Count: {project.metadata.technicalSpecs.triangleCount}</li>
        <li>Texture Size: {project.metadata.technicalSpecs.textureSize}</li>
        <li>File Size: {project.metadata.technicalSpecs.fileSize}</li>
        <li>Format: {project.metadata.technicalSpecs.format}</li>
      </ul>
    </section>
  </div>
</div>
```

### Phase 2: Authoring Environment

#### 2.1 User Authentication

**Features**:
- User registration
- Login/logout
- Password reset
- OAuth integration (optional)
- User profiles

**Implementation**:
```typescript
// User schema
interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  affiliation: string;
  role: 'author' | 'editor' | 'admin';
  bio: string;
  avatar: string;
  createdDate: Date;
  lastLogin: Date;
}

// Authentication middleware
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

#### 2.2 Project Creation Wizard

**Features**:
- Step-by-step project setup
- Model upload and validation
- Metadata entry form
- Thumbnail selection
- Initial settings configuration

**Implementation**:
```typescript
// Project creation wizard steps
const wizardSteps = [
  {
    id: 'basic-info',
    title: 'Basic Information',
    component: 'BasicInfoStep',
    fields: ['title', 'abstract', 'category']
  },
  {
    id: 'model-upload',
    title: 'Upload 3D Model',
    component: 'ModelUploadStep',
    validation: validateModel
  },
  {
    id: 'metadata',
    title: 'Project Metadata',
    component: 'MetadataStep',
    fields: ['discipline', 'keywords', 'license']
  },
  {
    id: 'thumbnail',
    title: 'Select Thumbnail',
    component: 'ThumbnailStep',
    options: { autoGenerate: true }
  },
  {
    id: 'review',
    title: 'Review & Create',
    component: 'ReviewStep'
  }
];

// Model validation
async function validateModel(file: File): Promise<ValidationResult> {
  const validations = {
    format: checkFormat(file),
    size: checkSize(file),
    triangles: await countTriangles(file),
    textures: await checkTextures(file),
    structure: await validateStructure(file)
  };

  const errors = [];
  const warnings = [];

  if (!['model/gltf-binary', 'model/gltf+json'].includes(file.type)) {
    errors.push('Invalid format. Only GLTF/GLB files are supported.');
  }

  if (validations.triangles > 230000) {
    errors.push(`Triangle count (${validations.triangles}) exceeds maximum (230,000).`);
  }

  if (file.size > 100 * 1024 * 1024) { // 100MB
    warnings.push('Large file size may impact loading performance.');
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

#### 2.3 Integrated Voyager Editor

**Features**:
- Embedded Voyager Story interface
- Annotation creation and editing
- Tour creation
- Article authoring
- Media upload
- Preview mode

**Implementation**:
```html
<!-- authoring-interface.html -->
<div class="authoring-workspace">
  <aside class="sidebar">
    <nav class="project-nav">
      <button class="nav-item" data-view="structure">Structure</button>
      <button class="nav-item" data-view="annotations">Annotations</button>
      <button class="nav-item" data-view="tours">Tours</button>
      <button class="nav-item" data-view="articles">Articles</button>
      <button class="nav-item" data-view="media">Media</button>
      <button class="nav-item" data-view="settings">Settings</button>
    </nav>

    <div class="project-actions">
      <button class="btn-save">Save Draft</button>
      <button class="btn-preview">Preview</button>
      <button class="btn-publish">Publish</button>
    </div>
  </aside>

  <main class="editor-main">
    <div class="viewer-pane">
      <voyager-story
        document="{projectDocumentUrl}"
        root="{projectRootUrl}"
        mode="authoring">
      </voyager-story>
    </div>

    <div class="editor-pane">
      <!-- Dynamic content based on selected view -->
      <div id="editor-content"></div>
    </div>
  </main>
</div>
```

#### 2.4 Model Processing Pipeline

**Features**:
- Upload handling
- Format validation
- Automatic optimization
- Thumbnail generation
- Metadata extraction

**Implementation**:
```typescript
// Model processing service
export class ModelProcessingService {
  async processUpload(file: File, projectId: string): Promise<ProcessingResult> {
    const tempPath = await this.saveTempFile(file);

    try {
      // 1. Validate format
      const validation = await this.validateModel(tempPath);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // 2. Extract metadata
      const metadata = await this.extractMetadata(tempPath);

      // 3. Optimize if needed
      let optimizedPath = tempPath;
      if (metadata.triangleCount > 230000 || metadata.fileSize > 50 * 1024 * 1024) {
        optimizedPath = await this.optimizeModel(tempPath, {
          targetTriangles: 200000,
          compressTextures: true,
          useDraco: true
        });
      }

      // 4. Generate thumbnail
      const thumbnail = await this.generateThumbnail(optimizedPath);

      // 5. Move to permanent storage
      const finalPath = await this.moveToStorage(optimizedPath, projectId);

      // 6. Create Voyager document
      const document = await this.createVoyagerDocument(finalPath, metadata);

      return {
        modelUrl: finalPath,
        documentUrl: document,
        thumbnailUrl: thumbnail,
        metadata: metadata,
        optimizations: {
          applied: optimizedPath !== tempPath,
          originalSize: file.size,
          optimizedSize: await this.getFileSize(optimizedPath)
        }
      };
    } finally {
      await this.cleanupTempFiles(tempPath);
    }
  }

  private async optimizeModel(path: string, options: OptimizationOptions) {
    // Use gltf-pipeline or similar tool
    const gltfPipeline = require('gltf-pipeline');
    const gltf = await this.loadGLTF(path);

    const optimized = await gltfPipeline.processGltf(gltf, {
      dracoOptions: {
        compressionLevel: 7
      },
      ...options
    });

    const outputPath = path.replace('.glb', '.optimized.glb');
    await this.saveGLTF(optimized, outputPath);
    return outputPath;
  }

  private async generateThumbnail(modelPath: string): Promise<string> {
    // Use headless rendering or Three.js on server
    const renderer = new OffscreenRenderer();
    const model = await renderer.loadModel(modelPath);
    const screenshot = await renderer.captureScreenshot(model, {
      width: 800,
      height: 600,
      cameraPosition: 'auto'
    });

    const thumbnailPath = modelPath.replace('.glb', '.thumb.jpg');
    await screenshot.save(thumbnailPath, { quality: 85 });
    return thumbnailPath;
  }
}
```

### Phase 3: Content Management System

#### 3.1 Project Dashboard

**Features**:
- List of user's projects
- Project status indicators
- Quick actions (edit, duplicate, delete)
- Statistics display
- Recent activity

**Implementation**:
```typescript
// CVProjectDashboard.ts
export default class CVProjectDashboard extends Component {
  protected static readonly ins = {
    userId: types.String("User.ID"),
    statusFilter: types.Enum("Filter.Status", ["all", "draft", "review", "published"]),
    sortBy: types.Enum("Sort.By", ["date", "title", "views"])
  };

  protected static readonly outs = {
    projects: types.Object("Projects.List"),
    stats: types.Object("Statistics")
  };

  protected async fetchUserProjects() {
    const { ins } = this;
    const response = await fetch(`/api/users/${ins.userId.value}/projects?status=${ins.statusFilter.value}&sort=${ins.sortBy.value}`);
    const data = await response.json();

    this.outs.projects.setValue(data.projects);
    this.outs.stats.setValue({
      total: data.total,
      published: data.published,
      drafts: data.drafts,
      totalViews: data.totalViews
    });
  }
}
```

#### 3.2 Metadata Editor

**Features**:
- Form-based metadata editing
- Validation rules
- Auto-save
- Rich text editing
- Keyword suggestions

**Implementation**:
```typescript
// Metadata form schema
const metadataSchema = {
  basic: {
    title: { type: 'text', required: true, maxLength: 200 },
    abstract: { type: 'textarea', required: true, maxLength: 500 },
    description: { type: 'richtext', required: true }
  },
  classification: {
    discipline: {
      type: 'multiselect',
      required: true,
      options: ['Archaeology', 'History', 'Art History', 'Architecture', 'Museum Studies', 'Other']
    },
    keywords: { type: 'tags', required: true, minTags: 3 },
    category: {
      type: 'radio',
      required: true,
      options: ['edition', 'project']
    }
  },
  rights: {
    license: {
      type: 'select',
      required: true,
      options: [
        'CC0 1.0',
        'CC BY 4.0',
        'CC BY-SA 4.0',
        'CC BY-NC 4.0',
        'CC BY-NC-SA 4.0',
        'All Rights Reserved'
      ]
    },
    attribution: { type: 'text', required: true },
    copyright: { type: 'text' }
  },
  publication: {
    citation: { type: 'textarea', required: true },
    relatedPublications: { type: 'list' },
    fundingSource: { type: 'text' }
  }
};

// Auto-save implementation
class AutoSaveManager {
  private saveTimeout: number;
  private isDirty: boolean = false;

  onChange(field: string, value: any) {
    this.isDirty = true;
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.save(), 2000);
  }

  async save() {
    if (!this.isDirty) return;

    const data = this.getFormData();
    await fetch(`/api/projects/${this.projectId}/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    this.isDirty = false;
    this.showSaveIndicator('Saved');
  }
}
```

#### 3.3 Publishing Workflow

**Features**:
- Status transitions (draft → review → published)
- Publication checklist
- Preview before publishing
- Unpublish capability
- Version history

**Implementation**:
```typescript
// Publishing workflow state machine
enum ProjectStatus {
  Draft = 'draft',
  Review = 'review',
  Published = 'published',
  Archived = 'archived'
}

class PublishingWorkflow {
  private project: Project;

  async transitionTo(newStatus: ProjectStatus): Promise<WorkflowResult> {
    const validTransitions = {
      [ProjectStatus.Draft]: [ProjectStatus.Review],
      [ProjectStatus.Review]: [ProjectStatus.Draft, ProjectStatus.Published],
      [ProjectStatus.Published]: [ProjectStatus.Archived],
      [ProjectStatus.Archived]: []
    };

    if (!validTransitions[this.project.status].includes(newStatus)) {
      throw new Error(`Invalid transition from ${this.project.status} to ${newStatus}`);
    }

    // Pre-transition checks
    const checks = await this.runPreChecks(newStatus);
    if (!checks.passed) {
      return { success: false, errors: checks.errors };
    }

    // Execute transition
    await this.executeTransition(newStatus);

    // Post-transition actions
    await this.runPostActions(newStatus);

    return { success: true };
  }

  private async runPreChecks(status: ProjectStatus): Promise<CheckResult> {
    if (status === ProjectStatus.Review || status === ProjectStatus.Published) {
      return this.runPublicationChecklist();
    }
    return { passed: true, errors: [] };
  }

  private async runPublicationChecklist(): Promise<CheckResult> {
    const checks = [
      { name: 'Has title', test: () => !!this.project.title },
      { name: 'Has abstract', test: () => !!this.project.abstract },
      { name: 'Has model', test: () => !!this.project.modelUrl },
      { name: 'Has thumbnail', test: () => !!this.project.thumbnail },
      { name: 'Has license', test: () => !!this.project.metadata.license },
      { name: 'Has keywords', test: () => this.project.metadata.keywords.length >= 3 },
      { name: 'Model validated', test: async () => this.validateModel() }
    ];

    const results = await Promise.all(
      checks.map(async c => ({ name: c.name, passed: await c.test() }))
    );

    const failed = results.filter(r => !r.passed);
    return {
      passed: failed.length === 0,
      errors: failed.map(f => `${f.name} check failed`)
    };
  }

  private async executeTransition(newStatus: ProjectStatus) {
    const oldStatus = this.project.status;
    this.project.status = newStatus;
    this.project.updatedDate = new Date();

    if (newStatus === ProjectStatus.Published && oldStatus !== ProjectStatus.Published) {
      this.project.publishedDate = new Date();
      this.project.version = (this.project.version || 0) + 1;
    }

    await this.saveProject();
    await this.createVersionSnapshot();
  }

  private async runPostActions(status: ProjectStatus) {
    if (status === ProjectStatus.Published) {
      await this.generateStaticPage();
      await this.updateSearchIndex();
      await this.notifyAuthor('published');
    }

    if (status === ProjectStatus.Review) {
      await this.notifyEditors('review_needed');
    }
  }

  private async generateStaticPage() {
    // Generate static HTML page for the project
    const template = await this.loadTemplate('project-detail');
    const html = template.render({
      project: this.project,
      metadata: this.project.metadata,
      voyagerDocument: this.project.documentUrl
    });

    const outputPath = `/public/projects/${this.project.slug}/index.html`;
    await this.writeFile(outputPath, html);
  }
}
```

### Phase 4: Search & Discovery

#### 4.1 Full-Text Search

**Features**:
- Search across title, abstract, description
- Keyword matching
- Author search
- Fuzzy matching

**Implementation**:
```typescript
// Search service using Elasticsearch or similar
export class SearchService {
  private client: ElasticsearchClient;

  async indexProject(project: Project) {
    await this.client.index({
      index: 'projects',
      id: project.id,
      document: {
        title: project.title,
        abstract: project.abstract,
        description: this.stripHtml(project.description),
        author: project.author,
        keywords: project.metadata.keywords,
        discipline: project.metadata.discipline,
        category: project.category,
        publishedDate: project.publishedDate,
        status: project.status
      }
    });
  }

  async search(query: string, filters: SearchFilters): Promise<SearchResults> {
    const must = [
      {
        multi_match: {
          query: query,
          fields: ['title^3', 'abstract^2', 'description', 'keywords^2'],
          fuzziness: 'AUTO'
        }
      },
      { term: { status: 'published' } }
    ];

    const filter = [];
    if (filters.category) filter.push({ term: { category: filters.category } });
    if (filters.discipline) filter.push({ term: { discipline: filters.discipline } });
    if (filters.author) filter.push({ match: { author: filters.author } });

    const response = await this.client.search({
      index: 'projects',
      body: {
        query: { bool: { must, filter } },
        sort: this.buildSort(filters.sortBy),
        from: (filters.page - 1) * filters.limit,
        size: filters.limit,
        highlight: {
          fields: {
            title: {},
            abstract: {},
            description: {}
          }
        }
      }
    });

    return {
      total: response.hits.total.value,
      projects: response.hits.hits.map(hit => ({
        ...hit._source,
        highlights: hit.highlight
      })),
      facets: await this.buildFacets(query)
    };
  }
}
```

#### 4.2 Faceted Filtering

**Features**:
- Filter by discipline
- Filter by category
- Filter by author
- Filter by date range
- Filter by license
- Active filter display
- Clear filters option

**Implementation**:
```typescript
// Facet aggregation
async buildFacets(query: string): Promise<Facets> {
  const response = await this.client.search({
    index: 'projects',
    body: {
      query: { match_all: {} },
      size: 0,
      aggs: {
        disciplines: {
          terms: { field: 'discipline', size: 20 }
        },
        categories: {
          terms: { field: 'category' }
        },
        authors: {
          terms: { field: 'author.keyword', size: 50 }
        },
        years: {
          date_histogram: {
            field: 'publishedDate',
            calendar_interval: 'year'
          }
        },
        licenses: {
          terms: { field: 'metadata.license.keyword' }
        }
      }
    }
  });

  return {
    disciplines: response.aggregations.disciplines.buckets,
    categories: response.aggregations.categories.buckets,
    authors: response.aggregations.authors.buckets,
    years: response.aggregations.years.buckets,
    licenses: response.aggregations.licenses.buckets
  };
}
```

### Phase 5: Repository Integration

#### 5.1 Data Archival

**Features**:
- Archive project data
- Generate preservation package
- Export metadata
- Version snapshots

**Implementation**:
```typescript
// Archive generation
export class ArchivalService {
  async createArchive(project: Project): Promise<ArchivePackage> {
    const archive = new Archive();

    // 1. Add 3D model files
    await archive.addFile(project.modelUrl, 'model/model.glb');

    // 2. Add Voyager document
    await archive.addFile(project.documentUrl, 'document/voyager.svx.json');

    // 3. Add metadata in multiple formats
    await archive.addFile(
      this.generateMetadataXML(project),
      'metadata/dublin-core.xml'
    );
    await archive.addFile(
      this.generateDataCiteXML(project),
      'metadata/datacite.xml'
    );
    await archive.addFile(
      JSON.stringify(project.metadata, null, 2),
      'metadata/metadata.json'
    );

    // 4. Add thumbnail
    await archive.addFile(project.thumbnail, 'media/thumbnail.jpg');

    // 5. Add README
    await archive.addFile(
      this.generateReadme(project),
      'README.md'
    );

    // 6. Add license file
    await archive.addFile(
      this.getLicenseText(project.metadata.license),
      'LICENSE.txt'
    );

    // 7. Generate BagIt structure
    await archive.generateBagIt();

    return archive;
  }

  private generateMetadataXML(project: Project): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${escapeXml(project.title)}</dc:title>
  <dc:creator>${escapeXml(project.author)}</dc:creator>
  <dc:date>${project.publishedDate.toISOString()}</dc:date>
  <dc:description>${escapeXml(project.abstract)}</dc:description>
  <dc:subject>${project.metadata.keywords.join('; ')}</dc:subject>
  <dc:rights>${escapeXml(project.metadata.license)}</dc:rights>
  <dc:type>3D Scholarly Edition</dc:type>
  <dc:format>model/gltf-binary</dc:format>
  ${project.metadata.doi ? `<dc:identifier>${project.metadata.doi}</dc:identifier>` : ''}
</metadata>`;
  }
}
```

#### 5.2 DOI Integration

**Features**:
- Request DOI for published projects
- Mint DOIs via DataCite
- Display DOIs on project pages
- Update DOI metadata

**Implementation**:
```typescript
// DOI service
export class DOIService {
  private dataciteClient: DataCiteClient;

  async mintDOI(project: Project): Promise<string> {
    if (project.metadata.doi) {
      throw new Error('Project already has a DOI');
    }

    const doi = await this.dataciteClient.create({
      prefix: process.env.DATACITE_PREFIX,
      creators: [{ name: project.author }],
      titles: [{ title: project.title }],
      publisher: 'PURE3D Platform',
      publicationYear: project.publishedDate.getFullYear(),
      resourceType: '3D Model',
      url: `https://editions.pure3d.eu/projects/${project.slug}`,
      descriptions: [
        { description: project.abstract, descriptionType: 'Abstract' }
      ],
      subjects: project.metadata.keywords.map(k => ({ subject: k })),
      rights: [{ rights: project.metadata.license }]
    });

    // Update project with DOI
    project.metadata.doi = doi;
    await this.saveProject(project);

    return doi;
  }

  async updateDOI(project: Project) {
    if (!project.metadata.doi) return;

    await this.dataciteClient.update(project.metadata.doi, {
      titles: [{ title: project.title }],
      descriptions: [
        { description: project.abstract, descriptionType: 'Abstract' }
      ],
      subjects: project.metadata.keywords.map(k => ({ subject: k }))
    });
  }
}
```

### Phase 6: Administration

#### 6.1 User Management

**Features**:
- User list with roles
- Role assignment
- User statistics
- Account suspension
- Activity logs

**Implementation**:
```typescript
// Admin user management
export class UserManagementService {
  async listUsers(filters: UserFilters): Promise<UserList> {
    const query = this.db.collection('users')
      .where('role', filters.role ? '==' : '!=', filters.role || null);

    const users = await query.get();

    return users.docs.map(doc => ({
      ...doc.data(),
      stats: this.getUserStats(doc.id)
    }));
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const projects = await this.db.collection('projects')
      .where('authorId', '==', userId)
      .get();

    return {
      projectCount: projects.size,
      publishedCount: projects.docs.filter(p => p.data().status === 'published').length,
      totalViews: projects.docs.reduce((sum, p) => sum + (p.data().stats?.views || 0), 0),
      joinDate: projects.docs[0]?.data().createdDate
    };
  }

  async changeUserRole(userId: string, newRole: UserRole): Promise<void> {
    await this.db.collection('users').doc(userId).update({
      role: newRole,
      roleChangedDate: new Date()
    });

    await this.logActivity({
      type: 'role_changed',
      userId: userId,
      newRole: newRole,
      timestamp: new Date()
    });
  }
}
```

#### 6.2 Content Moderation

**Features**:
- Review queue
- Project approval workflow
- Feedback to authors
- Quality standards enforcement

**Implementation**:
```typescript
// Review queue
export class ReviewQueue {
  async getProjectsInReview(): Promise<Project[]> {
    const projects = await this.db.collection('projects')
      .where('status', '==', 'review')
      .orderBy('updatedDate', 'desc')
      .get();

    return projects.docs.map(doc => ({
      ...doc.data(),
      checklist: this.getReviewChecklist(doc.id)
    }));
  }

  async submitReview(projectId: string, review: Review): Promise<void> {
    const project = await this.getProject(projectId);

    if (review.approved) {
      await this.workflow.transitionTo(project, ProjectStatus.Published);
      await this.notifyAuthor(project, 'approved', review.feedback);
    } else {
      await this.workflow.transitionTo(project, ProjectStatus.Draft);
      await this.notifyAuthor(project, 'rejected', review.feedback);
    }

    await this.saveReviewRecord({
      projectId,
      reviewerId: review.reviewerId,
      approved: review.approved,
      feedback: review.feedback,
      checklist: review.checklist,
      timestamp: new Date()
    });
  }

  private getReviewChecklist(projectId: string): ReviewChecklist {
    return {
      items: [
        { id: 'quality', label: 'Model quality acceptable', checked: false },
        { id: 'metadata', label: 'Metadata complete and accurate', checked: false },
        { id: 'licensing', label: 'Licensing properly specified', checked: false },
        { id: 'content', label: 'Content appropriate and scholarly', checked: false },
        { id: 'technical', label: 'Technical specifications met', checked: false },
        { id: 'annotations', label: 'Annotations meaningful and clear', checked: false }
      ]
    };
  }
}
```

#### 6.3 Analytics Dashboard

**Features**:
- Platform statistics
- Usage metrics
- Popular projects
- User engagement
- Traffic analytics

**Implementation**:
```typescript
// Analytics service
export class AnalyticsService {
  async getPlatformStats(): Promise<PlatformStats> {
    const [projects, users, views] = await Promise.all([
      this.db.collection('projects').count().get(),
      this.db.collection('users').count().get(),
      this.getAggregatedViews()
    ]);

    return {
      totalProjects: projects.data().count,
      publishedProjects: await this.getPublishedCount(),
      totalUsers: users.data().count,
      totalViews: views,
      avgViewsPerProject: views / projects.data().count,
      newProjectsThisMonth: await this.getNewProjectsCount(30),
      newUsersThisMonth: await this.getNewUsersCount(30)
    };
  }

  async getPopularProjects(limit: number = 10): Promise<Project[]> {
    const projects = await this.db.collection('projects')
      .where('status', '==', 'published')
      .orderBy('stats.views', 'desc')
      .limit(limit)
      .get();

    return projects.docs.map(doc => doc.data());
  }

  async trackView(projectId: string, metadata: ViewMetadata): Promise<void> {
    await this.db.collection('analytics').add({
      type: 'view',
      projectId,
      timestamp: new Date(),
      userAgent: metadata.userAgent,
      referer: metadata.referer,
      country: metadata.country
    });

    await this.db.collection('projects').doc(projectId).update({
      'stats.views': FieldValue.increment(1)
    });
  }
}
```

---

## Technical Specifications

### Model Requirements

| Specification | Requirement | Recommended |
|--------------|-------------|-------------|
| Format | .gltf, .glb | .glb with Draco compression |
| Triangle Count | Max 230,000 | 100,000 - 200,000 |
| Texture Size (single object) | 4K max | 4K .jpg @ 86% quality |
| Texture Size (complex scene) | 1024×1024 | Multiple 1024×1024 textures |
| File Size | Max 100MB | 20-50MB |
| Required Components | Geometry, textures, normals | + PBR materials |
| Compression | Optional | Draco for geometry, JPEG for textures |

### API Endpoints

```
# Public API
GET    /api/projects              # List projects
GET    /api/projects/:id          # Get project details
GET    /api/search                # Search projects
GET    /api/projects/:id/stats    # Get project statistics

# Authenticated API
POST   /api/auth/register         # User registration
POST   /api/auth/login            # User login
POST   /api/auth/logout           # User logout
GET    /api/users/me              # Get current user
PUT    /api/users/me              # Update profile

# Author API
GET    /api/users/:id/projects    # List user's projects
POST   /api/projects              # Create project
PUT    /api/projects/:id          # Update project
DELETE /api/projects/:id          # Delete project
POST   /api/projects/:id/upload   # Upload model
PATCH  /api/projects/:id/status   # Change status
POST   /api/projects/:id/publish  # Publish project

# Admin API
GET    /api/admin/users           # List all users
PUT    /api/admin/users/:id/role  # Change user role
GET    /api/admin/review-queue    # Get review queue
POST   /api/admin/reviews         # Submit review
GET    /api/admin/analytics       # Platform analytics
```

### Database Schema Summary

```typescript
// Collections
- users
- projects
- reviews
- analytics
- sessions
- notifications

// Indexes
projects:
  - status + publishedDate (desc)
  - authorId + status
  - category + publishedDate (desc)
  - slug (unique)

users:
  - email (unique)
  - role

reviews:
  - projectId + timestamp (desc)
  - reviewerId + timestamp (desc)

analytics:
  - projectId + timestamp (desc)
  - type + timestamp (desc)
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Goals**: Set up basic infrastructure and publishing platform

**Tasks**:
- [ ] Set up project structure and database
- [ ] Implement user authentication
- [ ] Create project schema and models
- [ ] Build basic API endpoints
- [ ] Create landing page
- [ ] Implement project gallery
- [ ] Create project detail page template
- [ ] Embed Voyager Story viewer
- [ ] Basic styling and responsive design

**Deliverables**:
- Working gallery with static project data
- Project detail pages with embedded viewer
- User registration and login

### Phase 2: Authoring Tools (Weeks 5-8)

**Goals**: Enable users to create and manage projects

**Tasks**:
- [ ] Build project creation wizard
- [ ] Implement file upload system
- [ ] Create model validation pipeline
- [ ] Build metadata editor
- [ ] Integrate Voyager Story editor
- [ ] Implement auto-save functionality
- [ ] Create project dashboard
- [ ] Build draft/publish workflow

**Deliverables**:
- Complete authoring interface
- Model upload and validation
- Metadata management
- Publishing workflow

### Phase 3: Search & Discovery (Weeks 9-10)

**Goals**: Make projects discoverable

**Tasks**:
- [ ] Set up search infrastructure (Elasticsearch)
- [ ] Implement full-text search
- [ ] Build faceted filtering
- [ ] Create search results page
- [ ] Implement sorting options
- [ ] Add pagination
- [ ] Create tag/keyword system

**Deliverables**:
- Working search functionality
- Filter and sort capabilities
- Enhanced discovery experience

### Phase 4: Content Management (Weeks 11-12)

**Goals**: Provide admin and moderation tools

**Tasks**:
- [ ] Build admin dashboard
- [ ] Create user management interface
- [ ] Implement review queue
- [ ] Build moderation tools
- [ ] Create analytics dashboard
- [ ] Add notification system

**Deliverables**:
- Admin panel
- Review workflow
- Analytics tracking

### Phase 5: Repository Integration (Weeks 13-14)

**Goals**: Enable preservation and DOI minting

**Tasks**:
- [ ] Implement archival package generation
- [ ] Integrate DOI service (DataCite)
- [ ] Create metadata export (Dublin Core, DataCite)
- [ ] Build version control system
- [ ] Add citation generator

**Deliverables**:
- Data preservation pipeline
- DOI minting capability
- Metadata export formats

### Phase 6: Polish & Launch (Weeks 15-16)

**Goals**: Refine UX and prepare for launch

**Tasks**:
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation
- [ ] Tutorial/help content
- [ ] Email templates
- [ ] Terms of service & privacy policy
- [ ] Deployment configuration

**Deliverables**:
- Production-ready platform
- Documentation
- Launch-ready infrastructure

---

## User Workflows

### Workflow 1: Author Creating a New Edition

1. **Registration/Login**
   - Navigate to platform
   - Create account or log in
   - Complete profile

2. **Project Creation**
   - Click "Create New Project"
   - Enter basic information (title, abstract, category)
   - Upload 3D model (.glb file)
   - System validates model (triangles, textures, format)
   - System generates thumbnail options
   - Select thumbnail

3. **Metadata Entry**
   - Fill in required metadata:
     - Discipline
     - Keywords (minimum 3)
     - License
     - Citation
   - Fill in optional metadata:
     - Related publications
     - Funding source
     - Contributors

4. **Content Creation**
   - Open integrated Voyager Story editor
   - Add annotations to 3D model
   - Create tours
   - Write articles
   - Upload supporting media
   - Preview edition

5. **Review & Publish**
   - Complete publication checklist
   - Submit for review (if required)
   - Receive feedback from editors
   - Make revisions if needed
   - Publish edition

6. **Post-Publication**
   - Share project link
   - Monitor view statistics
   - Make updates if needed
   - Request DOI (optional)

### Workflow 2: Visitor Discovering Content

1. **Discovery**
   - Land on platform homepage
   - Browse featured projects carousel
   - OR use search bar
   - OR navigate to "3D Editions" section

2. **Browsing**
   - View project cards in grid
   - Use filters (discipline, category, author)
   - Sort results (date, popularity, title)
   - Read project abstracts

3. **Exploration**
   - Click on project card
   - Read project metadata
   - View embedded 3D model
   - Interact with annotations
   - Follow tours
   - Read articles
   - View supporting media

4. **Engagement**
   - Share project on social media
   - Copy citation
   - Download data package (if available)
   - View related projects

### Workflow 3: Editor Reviewing Submission

1. **Review Assignment**
   - Log in to platform
   - Navigate to review queue
   - See list of projects in review
   - Select project to review

2. **Quality Assessment**
   - Review project metadata
   - Check model quality in viewer
   - Evaluate annotations and content
   - Complete review checklist:
     - Model quality
     - Metadata completeness
     - Licensing clarity
     - Content appropriateness
     - Technical specifications
     - Annotation quality

3. **Decision**
   - Approve for publication
     - Provide positive feedback
     - Suggest minor improvements
   - OR Request revisions
     - Provide specific feedback
     - List required changes
     - Suggest improvements

4. **Follow-up**
   - Monitor author's revisions
   - Re-review if needed
   - Approve final version

---

## Differences from PURE3D

While replicating PURE3D features, consider these potential improvements:

### Enhancements to Consider

1. **Better Search**
   - Advanced search operators
   - Saved searches
   - Search alerts

2. **Social Features**
   - User profiles with portfolios
   - Follow authors
   - Comments and discussions
   - Project collections/playlists

3. **Collaboration**
   - Multi-author projects
   - Real-time co-editing
   - Version control with git-like features
   - Change history and attribution

4. **Analytics**
   - Author dashboards with insights
   - Heatmaps of model interactions
   - Engagement metrics
   - Geographic distribution

5. **API & Integrations**
   - Public API for third-party access
   - IIIF integration
   - LMS integration (Canvas, Moodle)
   - Citation manager export (Zotero, Mendeley)

6. **Advanced Viewer Features**
   - VR/AR support
   - Measurement tools
   - Side-by-side comparison
   - Timeline animations

7. **Community Features**
   - Featured collections
   - "Projects of the Month"
   - Newsletter
   - Blog integration

---

## Next Steps

1. **Review this Document**
   - Discuss with stakeholders
   - Prioritize features
   - Identify must-haves vs. nice-to-haves

2. **Set Up Development Environment**
   - Choose tech stack
   - Set up repositories
   - Configure CI/CD

3. **Create Detailed Specifications**
   - Wireframes for each page
   - API specification (OpenAPI)
   - Database schema in detail
   - Component architecture

4. **Begin Phase 1 Implementation**
   - Follow roadmap
   - Iterate based on feedback
   - Regular demos and reviews

5. **User Testing**
   - Alpha testing with team
   - Beta testing with select authors
   - Gather feedback continuously
   - Iterate on UX

---

## Resources

### PURE3D References
- Homepage: https://pure3d.eu/
- Editions Platform: https://editions.pure3d.eu/
- Authoring Platform: https://author.pure3d.eu/
- GitHub Repository: https://github.com/CLARIAH/pure3dx
- Example Project: https://pure3d.eu/25northumberlandrd/

### Technical Documentation
- Smithsonian Voyager: https://github.com/Smithsonian/dpo-voyager
- GLTF Specification: https://www.khronos.org/gltf/
- Draco Compression: https://github.com/google/draco
- DataCite API: https://support.datacite.org/docs/api
- Dublin Core: https://www.dublincore.org/specifications/dublin-core/

### Tools & Libraries
- gltf-pipeline: https://github.com/CesiumGS/gltf-pipeline
- Three.js: https://threejs.org/
- BagIt: https://datatracker.ietf.org/doc/html/rfc8493

---

## Conclusion

This replication guide provides a comprehensive roadmap for building a PURE3D-like platform on top of DPO Voyager. The implementation focuses on:

1. **Modular Architecture**: Separating authoring and publishing concerns
2. **User-Centric Design**: Streamlined workflows for authors, editors, and visitors
3. **Technical Excellence**: Robust model processing, validation, and optimization
4. **Scholarly Standards**: Metadata, preservation, and citation support
5. **Extensibility**: Architecture that allows for future enhancements

By following this guide systematically, you'll create a powerful platform for 3D scholarly editions that serves the digital humanities and heritage community.
