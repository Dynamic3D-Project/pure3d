# Pure3D - Comprehensive Feature Documentation

## System Overview

**Pure3D** is a 3D digital edition authoring and publishing platform built for creating, managing, and publishing interactive 3D scholarly editions with rich annotations and multimedia content.

### Architecture

Pure3D consists of two main applications:

1. **Authoring App (A)** - `https://author.pure3d.eu`
   - Python Flask-based web application
   - WebDAV-enabled for 3D viewer integration
   - Full user authentication and authorization
   - MongoDB database backend
   - Business logic and workflow management

2. **Publishing App (P)** - `https://editions.pure3d.eu`
   - Static nginx web server
   - Serves pre-generated HTML pages
   - No database or dynamic generation
   - Designed for long-term preservation
   - Can operate independently of authoring app

3. **3D Viewer Integration**
   - Uses Smithsonian DPO Voyager viewer technology
   - **Voyager Story** (edit mode) in authoring app
   - **Voyager Explorer** (read mode) in published editions

---

## Core Features

### 1. Authentication & Authorization

#### 1.1 User Authentication
- **OpenID Connect (OIDC)** federated authentication
- Integration with CLARIAH infrastructure
- Flask-OIDC module for authentication flow
- Session management
- Secure login/logout functionality

#### 1.2 User Roles (Site-wide)
| Role | Description |
|------|-------------|
| **Guest** | Unauthenticated user - read-only access to public content |
| **User** | Default authenticated role - can view projects |
| **Admin** | Administrative privileges - manage users, projects, keywords |
| **Owner/Root** | Full system access - all admin privileges plus system management |

#### 1.3 Context-Specific Roles
| Role | Context | Permissions |
|------|---------|-------------|
| **Organiser** | Project | Create editions, manage project, assign editors |
| **Editor** | Edition | Edit edition, upload files, manage content, assign reviewers |
| **Reviewer** | Edition | View and review edition (commenting done externally) |

#### 1.4 Authorization Features
- **Granular permissions system** based on:
  - User's site-wide role
  - User's context-specific role (project/edition)
  - Record state (visible/invisible, published/unpublished)
  - Namespace-based field permissions
- **Action-based authorization**: read, create, update, delete
- **Master-detail relationship** authorization inheritance
- **Dynamic permission calculation** based on multiple role sources

#### 1.5 Test/Pilot Mode (Non-Production)
- Special test users with predefined roles
- Quick user switching for development/testing
- Bypasses OIDC authentication

---

### 2. Project & Edition Management

#### 2.1 Hierarchical Structure
```
Site (single instance)
  └── Projects (multiple)
        └── Editions (multiple per project)
              └── Files (models, articles, media)
```

#### 2.2 Project Features
- **Create/Delete Projects**
  - Admin-created with assigned organiser
  - Soft delete with grace period (31 days)
  - Restore functionality for deleted projects
- **Project Metadata**
  - Title, description, abstract
  - Creator, contributor, publisher information
  - Controlled vocabulary fields
  - Thumbnail images (1024x1024 recommended)
- **Visibility Control**
  - Visible/invisible toggle
  - Published projects appear in public interface
- **Project Organization**
  - Multiple editions per project
  - File storage per project
  - Project-level permissions

#### 2.3 Edition Features
- **Create/Delete Editions**
  - Organiser creates editions within projects
  - Soft delete with 31-day grace period
  - Restore deleted editions
- **Edition Metadata** (Dublin Core based)
  - Title, description, abstract, provenance
  - Creator, contributor, publisher
  - Date created, date modified
  - Subject, language, rights, license
  - Type, format, source, relation
  - Coverage (temporal/spatial)
  - Identifier (DOI support)
  - Peer review information
- **Edition States**
  - Draft (unpublished)
  - Published
  - Unpublished (previously published)
- **Edition Versions**
  - Download existing edition files
  - Upload to create revised edition
  - No automatic linking between versions
- **Editor Assignment**
  - Multiple editors per edition
  - Editor permissions for content management
  - Reviewer assignment by editors

---

### 3. File Management

#### 3.1 File Types Supported

**3D Models:**
- GLB (GL Binary)
- GLTF (GL Transmission Format)

**Articles:**
- HTML files with Voyager annotations

**Media:**
- Images: PNG, JPG, GIF, SVG
- Audio files
- Video files
- Documents

**Configuration:**
- scene.svx.json (Voyager scene file)

#### 3.2 Upload Features
- **Maximum upload size**: 1 GB per file
- **Drag-and-drop interface**
- **Multiple file uploads**
- **File type validation**
- **Automatic file organization**:
  - Models in root of edition directory
  - Articles in subdirectories
  - Media in subdirectories
- **Progress indication**
- **Error handling and validation**

#### 3.3 File Organization
```
/project/{projectId}/
  ├── thumbnail.png
  └── edition/{editionId}/
        ├── scene.svx.json
        ├── model.glb
        ├── articles/
        │     ├── article1.html
        │     └── article2.html
        └── media/
              ├── images/
              ├── audio/
              └── video/
```

#### 3.4 Download Features
- **Download entire project** as ZIP
- **Download entire edition** as ZIP
- Includes:
  - All files (models, articles, media)
  - Database record as YAML
- **Maximum download size**: 1 GB

#### 3.5 Delete Features
- Individual file deletion
- Confirmation required
- Logged with user and timestamp
- 31-day grace period before permanent deletion

---

### 4. 3D Viewer Integration (Voyager)

#### 4.1 Voyager Story (Authoring)
- **Full 3D editing capabilities**
- **Annotation creation and editing**
- **Article authoring** with rich text
- **Tour creation** with guided sequences
- **Camera position management**
- **Lighting controls**
- **Material editing**
- **Model inspection tools**

#### 4.2 Voyager Explorer (Viewing)
- **Interactive 3D model viewing**
- **Read-only annotation display**
- **Article viewing**
- **Tour playback**
- **Camera controls**
- **Model inspection**

#### 4.3 Viewer Versions
- Multiple Voyager versions supported simultaneously
- Version selection per edition
- Default version configuration
- Backward compatibility support

#### 4.4 Viewer Actions
| Action | Mode | Description |
|--------|------|-------------|
| **Read** | Voyager Explorer | View published content |
| **Update** | Voyager Story | Edit existing scenes |
| **Create** | Voyager Story | Create new scenes |

#### 4.5 WebDAV Integration
- **Purpose**: Enables Voyager Story to save changes directly to server
- **Protocol**: WebDAV (Web Distributed Authoring and Versioning)
- **Implementation**: WsgiDAV library
- **Authorization**: Custom dispatcher intercepts WebDAV requests
- **Methods Supported**:
  - GET - Retrieve files
  - PUT - Update files
  - DELETE - Remove files
  - PROPFIND - Get file properties
  - MKCOL - Create directories
  - COPY - Copy resources
  - MOVE - Move resources
- **Security**: All WebDAV requests authorized through main app
- **URL Pattern**: `/webdav/project/{projectId}/edition/{editionId}/...`

#### 4.6 Scene File Management
- **scene.svx.json** format
- Stores:
  - Model references
  - Annotations
  - Articles
  - Tours
  - Camera settings
  - Lighting configuration
  - Material properties
- Automatically updated by Voyager Story
- Validated before publishing

---

### 5. Publishing Workflow

#### 5.1 Pre-Publication Checks

**Metadata Validation:**
- All mandatory fields must be filled
- Date created (auto-set on first edit)
- Title, description
- Creator information
- License information

**File Validation:**
- Scene file exists and is valid JSON
- All referenced files exist
- No broken internal links
- No links pointing outside edition directory
- Media files are referenced from articles

**Link Checking:**
- Internal links resolve to existing files
- External links identified (not validated)
- Broken links reported with source locations
- Unconfined links (pointing outside edition) flagged

#### 5.2 Publishing Actions

**Check Edition:**
- Runs all validation checks
- Generates quality control report
- Shows:
  - Scene file structure (collapsible JSON tree)
  - Table of models with reference counts
  - Table of articles with reference counts
  - Table of media files with reference counts
  - Table of broken links with sources
  - Table of unreferenced files
- Color-coded issues (errors/warnings)
- Available to editors at any time

**Publish Edition:**
- Runs all checks automatically
- Assigns publication numbers (sequential)
- Copies files to publication directory
- Removes unreferenced files
- Generates static HTML pages
- Updates database records
- Marks edition as published
- Prevents concurrent publishing operations

**Force Publish:**
- Publishes even if validation fails
- Admin/organiser decision
- Warnings logged
- Used when errors are acceptable

**Unpublish Edition:**
- Removes from public interface
- Keeps edition in authoring environment
- Removes publication files
- Updates database records
- Regenerates site pages
- Admin/owner privilege

**Republish Edition:**
- Updates existing published edition
- Maintains same publication numbers
- Re-runs validation
- Updates files and HTML

#### 5.3 Publication Numbering
- **Project numbers**: Sequential integers starting from 1
- **Edition numbers**: Sequential within each project, starting from 1
- **Persistent**: Numbers never reused after unpublishing
- **Tracked** in site record's `publishedProjectCount` and project's `publishedEditionCount`
- **URLs**: `https://editions.pure3d.eu/project/{pNum}/edition/{eNum}`

#### 5.4 Static Site Generation
- **Handlebars templates** for HTML generation
- **Tailwind CSS** for styling
- **Generated pages**:
  - Home page with featured projects
  - Project landing pages
  - Edition landing pages
  - Article pages
  - Media galleries
  - Table of contents
- **Citation generation** from metadata
- **Peer review display** with logo
- **License-based obfuscation** (TOC hidden for closed licenses)

#### 5.5 Featured Projects
- Admin-selected featured projects
- Displayed on public home page
- Configurable order
- Requires page regeneration to update

#### 5.6 Regenerate Pages
- **Purpose**: Update static HTML without re-publishing content
- **Use cases**:
  - Featured projects changed
  - Site metadata updated
  - Voyager version updated
  - Layout/design changes
- **Scope**: All published projects and editions
- **Admin-only** function

---

### 6. Metadata Management

#### 6.1 Metadata Schema

**Field Categories:**
1. **Main Fields**: Title, description, core information
2. **Narrative Fields**: Abstract, provenance, detailed descriptions
3. **Box Fields**: Technical metadata displayed in boxes

**Field Types:**
| Type | Description | Example |
|------|-------------|---------|
| **string** | Single-line text | Title |
| **text** | Multi-line Markdown | Abstract |
| **keyword** | Controlled vocabulary | Language, Subject |
| **datetime** | ISO date/time | Date created |
| **date** | Date only | Publication date |

#### 6.2 Controlled Vocabularies (Keywords)

**Managed Lists:**
- Languages
- Subjects
- Periods
- Countries
- License types
- Peer review kinds
- Object types

**Keyword Management (Admin):**
- Add new keywords
- Delete unused keywords
- Cannot delete keywords in use
- Cannot modify existing keywords
- Validation against duplicates (case-insensitive, whitespace-normalized)

**Keyword Usage:**
- Multiple selection allowed
- Dropdown/multiselect interface
- Usage count tracked
- Shows editions using each keyword

**Foreign Keywords:**
- Imported editions may have keywords not in current lists
- System accepts foreign keywords
- Cannot re-apply foreign keywords unless added to list
- Visible in usage statistics

#### 6.3 Namespaces
- **Dublin Core (dc)**: Standard metadata elements
- **Custom namespaces**: Application-specific fields
- Namespace-based permission control

#### 6.4 Field Properties
- **Mandatory**: Required for publication
- **Read-only**: System-managed fields
- **Multiple**: Allow multiple values (lists)
- **Default values**: Pre-filled values
- **Table-specific**: Different configuration per table (site/project/edition)

#### 6.5 Metadata Editing
- **In-place editing** with AJAX save
- **Rich text editor** for Markdown fields
- **Date picker** for date fields
- **Dropdown selectors** for keywords
- **Validation** on save
- **Auto-save** of changes
- **Change tracking** with user and timestamp
- **Original value** preserved for cancel

---

### 7. User Management

#### 7.1 User Discovery
- **Automatic user creation** on first login
- User attributes from OIDC provider:
  - Sub (unique identifier)
  - Email
  - Nickname
- Auto-generated nickname from email if not provided

#### 7.2 User Administration

**Manage Users (Admin):**
- View all authenticated users
- List shows:
  - Nickname
  - Email
  - Current role
  - Associated projects/editions
- Change user roles
- Promote/demote users
- Cannot delete users with active work

**User Roles Management:**
- **Site-wide roles**: Guest, User, Admin, Owner
- **Project roles**: Organiser
- **Edition roles**: Editor, Reviewer
- Role change logged with admin and timestamp

#### 7.3 User Linking

**Link Users to Projects:**
- Organiser assigns editors to editions
- Editors assign reviewers to editions
- Admins can modify any assignments
- User must have logged in at least once

**User Work Tracking:**
- Count projects where user is organiser
- Count editions where user is editor/reviewer
- Prevents deletion of users with active assignments

#### 7.4 My Work Page

**For All Users:**
- My details (name, email, role)
- My projects and editions
- Role change capability (demote only)

**For Admins/Owners:**
- All projects and editions
- Manage users
- Manage keywords
- Deleted items
- Published projects controls

**Self-Service Role Management:**
- Can demote yourself
- Can promote yourself only if no higher roles exist
- Prevents lockout scenarios
- Enables initial system setup

#### 7.5 Test Users (Non-Production)

**Features:**
- Admin can create test users
- Quick-switch between test users
- Predefined roles
- No OIDC authentication
- Cannot be deleted if linked to work
- Visible only in non-prod environments

---

### 8. Content Validation & Quality Control

#### 8.1 Scene Validation

**JSON Structure Check:**
- Valid JSON syntax
- Required fields present
- Correct data types
- URI references validated

**Model References:**
- All models referenced in scene exist
- Model file format validation (GLB/GLTF)
- Model file size checks

**Article References:**
- All articles referenced exist
- HTML validity
- Internal link checking

**Media References:**
- All media files referenced exist
- File type validation
- Usage tracking

#### 8.2 Link Validation

**Internal Links:**
- `href` and `src` attributes extracted
- Resolved relative to source file
- Checked against filesystem
- Missing targets reported with:
  - Source file
  - Target path
  - Occurrence count

**External Links:**
- HTTP/HTTPS URLs identified
- Mailto links identified
- Not validated (assumed accessible)
- Counted for reporting

**Unconfined Links:**
- Links with `..` (parent directory)
- Point outside edition directory
- Security risk - flagged as errors
- Source locations reported

#### 8.3 Reference Tracking

**For Each File:**
- Count of references from other files
- List of source files with counts
- Unreferenced files flagged

**For Articles:**
- Which articles reference each media file
- Article-to-article cross-references
- Article-to-model references

**For Media:**
- Which articles use each media file
- Usage count
- Warning for unused files

#### 8.4 Quality Reports

**Scene Overview:**
- Collapsible JSON tree view
- Color-coded issues:
  - Red: Broken references
  - Yellow: Warnings
  - Green: Valid
- Expandable to error locations

**Table of Models:**
- Model filename
- File size
- Referenced by (count)
- Source files listing

**Table of Articles:**
- Article filename
- Referenced by (count)
- References to (outgoing links)

**Table of Media:**
- Media filename
- File type
- Referenced by (count)
- Warning if unreferenced

**Table of Link Issues:**
- Missing target path
- Source file(s)
- Occurrence count per source

#### 8.5 Pre-Flight Checklist
Before publication, check:
- [ ] All mandatory metadata present
- [ ] Scene file exists and valid
- [ ] All models referenced and exist
- [ ] All articles referenced and exist
- [ ] No broken internal links
- [ ] No unconfined links
- [ ] Media files referenced (or remove unused)
- [ ] Thumbnail provided
- [ ] License specified
- [ ] DOI provided (if available)
- [ ] Peer review info (if applicable)

---

### 9. Administrative Features

#### 9.1 Site Management

**Site Record:**
- Single site record for entire system
- Site-wide metadata:
  - Title, abstract, description
  - About page content
  - Provenance
  - Logo/branding
- Featured projects list
- Publication status tracking
- Last published timestamp

**Site Configuration:**
- Viewer versions available
- Default viewer version
- File size limits
- Grace periods for deletion
- Publishing settings

#### 9.2 Publish Management

**Publication Status:**
- Check current publishing state
- Shows if publication in progress
- Prevents concurrent publications
- Admin can view status

**Terminate Publishing:**
- Emergency stop for hung publishing processes
- Admin-only function
- Resets publishing flag
- Logged action

**Publishing Lock:**
- Flag in site record: `processing: true/false`
- Set at start of publish
- Cleared at end (success or failure)
- Prevents race conditions

#### 9.3 Keyword Management

**Vocabulary Administration:**
- List all vocabularies (language, subject, etc.)
- Add new values
- Delete unused values
- Cannot modify existing values
- Cannot delete values in use

**Keyword Validation:**
- Check for duplicates (case/whitespace insensitive)
- Prevent adding variants of existing values
- Show usage count per keyword
- Show which editions use keyword

**Changing Keywords:**
- If unused: Delete old, add new
- If used by unpublished: Update editions, then change
- If used by published: Unpublish, update, change, republish

#### 9.4 Deleted Items Management

**View Deleted Items:**
- Projects recently deleted (within grace period)
- Editions recently deleted
- Shows:
  - Item name/title
  - Deleted by (user)
  - Deleted when (timestamp)
  - Days remaining before permanent deletion

**Restore Items:**
- Undelete button
- Parent must be restored first
- Edition restore doesn't auto-restore editions
- Logged action with user and timestamp

**Permanent Deletion:**
- Sweeper function runs automatically
- Grace period: 31 days
- Irreversible after grace period
- Files and database records removed
- Logged in access log

#### 9.5 Backup & Restore (Non-Production)

**Manual Backups:**
- Not available in production
- Power users: Full site backup
- Organisers: Project-specific backup
- Includes:
  - Database records (MongoDB export)
  - File system (ZIP)
  - Metadata (YAML)

**Restore from Backup:**
- Select backup by date/time
- Project-specific or full restore
- Creates new backup before restore
- Power users only

**Delete Backups:**
- Remove old backups
- Power users or project organisers
- Frees disk space

#### 9.6 Logging

**Access Log:**
- All user actions logged
- Includes:
  - User nickname and identifier
  - Action type
  - Timestamp
  - Target (project/edition/file)
- Logged actions:
  - Login/logout
  - Create/delete items
  - Publish/unpublish
  - Upload/download files
  - Restore items
  - Sweep actions

**Error Log:**
- Application errors
- Stack traces
- Request context
- User information
- Timestamp

---

### 10. Workflow Features

#### 10.1 Edition Lifecycle

```
1. Project Created (by admin)
   ↓
2. Organiser Assigned (by admin)
   ↓
3. Edition Created (by organiser)
   ↓
4. Editor Assigned (by organiser)
   ↓
5. Content Creation
   - Upload 3D model
   - Create scene in Voyager Story
   - Add annotations
   - Write articles
   - Add media
   - Create tours
   ↓
6. Reviewer Assignment (by organiser/editor)
   ↓
7. Review Process (external to Pure3D)
   ↓
8. Peer Review Documentation (by organiser)
   - Select peer review type
   - Document review comments
   - Add DOI (if obtained)
   ↓
9. Pre-Flight Check (by editor)
   ↓
10. Publish (by organiser)
    ↓
11. [Optional] Unpublish → Edit → Republish
    ↓
12. [Optional] Download for Revision
    ↓
13. [Optional] Delete from Authoring
    (Published edition persists)
```

#### 10.2 Collaboration Features

**Multi-User Editing:**
- Multiple editors per edition
- No conflict resolution (last write wins)
- WebDAV enables concurrent Voyager editing
- Metadata changes track user

**Review Process:**
- Reviewers have read access
- Can view edition in Voyager Explorer
- Commenting done outside system
- Review content documented in metadata

**Commenting:**
- Not built into Pure3D
- External tools for collaboration
- Review comments stored in peer review field

#### 10.3 Version Management

**Edition Revisions:**
- No automatic versioning
- Manual process:
  1. Download original edition
  2. Create new edition
  3. Upload downloaded files
  4. Edit new edition
  5. Publish with new number
- Old and new editions independent
- No automatic linking
- Consider DOI versioning scheme

**File Versioning:**
- No version history
- Overwrite on upload
- Download before major changes recommended

#### 10.4 Permission-Based Views

**Conditional Display:**
- UI elements shown based on permissions
- Editors see edit controls
- Organisers see publish buttons
- Admins see management interfaces
- Guests see public content only

**Action Authorization:**
- All actions checked server-side
- Permissions evaluated dynamically
- Based on current user and record state
- Failed actions return 403 or redirect

---

### 11. Integration Features

#### 11.1 External Authentication (OIDC)
- **Provider**: CLARIAH federated authentication
- **Protocol**: OpenID Connect
- **Attributes**:
  - sub (unique identifier)
  - email
  - nickname
- **Auto-update**: User attributes refreshed on login
- **Session**: Flask session management

#### 11.2 Database (MongoDB)
- **Collections**:
  - site (single record)
  - project (multiple)
  - edition (multiple)
  - user (multiple)
  - projectUser (many-to-many link)
  - editionUser (many-to-many link)
  - keyword (controlled vocabularies)
- **Soft Delete**: isDeleted flag, dateDeleted field
- **Change Tracking**: modifiedBy, dateModified
- **ObjectId**: Standard MongoDB identifiers

#### 11.3 File Storage
- **Local filesystem** for authoring app
- **Directory structure**:
  ```
  /data/
    ├── project/{projectId}/
    │   ├── thumbnail.png
    │   └── edition/{editionId}/
    │       ├── scene.svx.json
    │       ├── models/
    │       ├── articles/
    │       └── media/
  /published/
    └── project/{pubNum}/
        ├── thumbnail.png
        └── edition/{pubNum}/
            └── [same structure]
  ```

#### 11.4 Static Site Export
- **Format**: Pre-generated HTML pages
- **Styling**: Tailwind CSS
- **Templating**: Handlebars
- **Assets**: Copied from authoring to publishing
- **Viewer**: Voyager Explorer embedded

#### 11.5 DOI Integration
- **External DOI creation** (e.g., DataCite, Crossref)
- **DOI field** in edition metadata
- **Multiple DOIs** supported
- **Citation generation** uses DOI or edition URL
- **No DOI minting** in Pure3D itself

---

### 12. Search & Discovery Features

#### 12.1 Current Limitations
- **No full-text search** in authoring app
- **No full-text search** in publishing app
- **No metadata search**
- **No faceted browsing**

#### 12.2 Available Discovery
- **Browse all projects** (if visible)
- **Browse published projects**
- **Featured projects** on home page
- **My Work** page shows user's projects
- **Direct URLs** to projects/editions

---

### 13. UI/UX Features

#### 13.1 Authoring Interface
- **Responsive design** (basic)
- **Bootstrap-like** styling (custom)
- **Color coding**:
  - Errors: Red
  - Warnings: Yellow/Orange
  - Success: Green
  - Special: Blue/Purple
- **Icons** for actions
- **Buttons** with tooltips
- **Collapsible sections** (details/summary)
- **Tabs** for organization
- **Modals** for confirmations
- **Progress indicators** for uploads

#### 13.2 Publishing Interface
- **Clean, professional design**
- **Tailwind CSS** styling
- **Custom Pure3D theme**
- **Responsive** layout
- **Featured projects** carousel/grid
- **Project cards** with thumbnails
- **Edition viewers** embedded
- **Article rendering** with Markdown
- **Citation display**
- **Peer review** indicators
- **License** information
- **Metadata** display boxes

#### 13.3 Viewer Interface
- **Voyager Explorer**:
  - Full-screen or embedded
  - Scene navigation
  - Annotation display
  - Article reading
  - Tour playback
  - Camera controls
  - Model inspection
- **Voyager Story**:
  - Opens in new window
  - Full editing capabilities
  - Saves via WebDAV
  - Real-time updates

#### 13.4 Accessibility
- **Basic HTML semantics**
- **Alt text** for images (where provided)
- **Keyboard navigation** (limited)
- **Screen reader** support (basic)
- **Color contrast** (not verified)
- **ARIA labels** (minimal)

*Note: Accessibility could be significantly improved*

---

### 14. Development & Deployment Features

#### 14.1 Technology Stack

**Backend:**
- Python 3.8+
- Flask web framework
- Flask-OIDC authentication
- WsgiDAV for WebDAV
- Gunicorn WSGI server
- pymongo for MongoDB
- Markdown processor
- PyYAML for configuration

**Frontend:**
- Vanilla JavaScript (minimal)
- TailwindCSS
- Custom CSS
- Handlebars templates
- Voyager viewer (TypeScript compiled)

**Database:**
- MongoDB

**Server:**
- Nginx (for published app)
- Gunicorn (for authoring app)

#### 14.2 Configuration
- **YAML files** for:
  - Metadata schema (datamodel.yml)
  - Authorization rules (authorise.yml)
  - Viewer configuration (viewers.yml)
  - Field definitions (fields.yml)
- **Environment variables**:
  - PURE3D_MODE (prod/acc/custom)
  - OIDC secrets
  - MongoDB connection
  - File paths

#### 14.3 Deployment Options
- **Kubernetes** (production/acceptance)
- **Docker Compose** (local development)
- **Manual deployment** (custom setups)

#### 14.4 Environments
- **Production**: `author.pure3d.eu`, `editions.pure3d.eu`
- **Acceptance**: `author.acc.pure3d.eu`, `editions.acc.pure3d.eu`
- **Local**: Docker Compose on developer machine

---

### 15. Data Migration Features

#### 15.1 Migration Support
- **Migration script**: `src/migrate.py`
- **Database schema updates**
- **Field renaming**: `src/renamefield.py`
- **Keyword initialization**: `src/initkeywords.py`
- **Version tracking** in database

#### 15.2 Export/Import
- **Download** project/edition as ZIP
- **Upload** ZIP to create new edition
- **YAML export** of database records
- **JSON export** for published editions

#### 15.3 Backup/Restore (Non-Prod)
- **MongoDB dump/restore**
- **Filesystem backup** (ZIP or tar)
- **Incremental backups** in production (30-day retention)
- **Point-in-time recovery**

---

### 16. Monitoring & Maintenance

#### 16.1 System Health
- **Publishing status** check
- **Database connection** monitoring
- **File system** space monitoring
- **Log file** rotation
- **Error tracking**

#### 16.2 Sweeper Function
- **Automatic cleanup** of:
  - Deleted items after grace period
  - Temporary directories
  - Old upload files
- **Runs periodically**
- **Logged actions**
- **Grace period**: 31 days

#### 16.3 Performance
- **No caching** in authoring app
- **Static files** in publishing app (fast)
- **MongoDB indexes** on common queries
- **File size limits** (1 GB upload/download)
- **Concurrent publishing** prevented
- **WebDAV** requires multi-threaded server (Gunicorn)

---

### 17. Security Features

#### 17.1 Authentication Security
- **OIDC** federated authentication
- **Session** management (Flask)
- **Secure** cookies
- **Logout** functionality (requires browser quit for full logout)
- **No password** storage (delegated to OIDC provider)

#### 17.2 Authorization Security
- **Server-side** permission checks
- **No client-side** security reliance
- **Action-based** authorization
- **Context-aware** permissions
- **WebDAV** requests authorized by main app

#### 17.3 File Security
- **Upload validation** (file type, size)
- **Path traversal** prevention
- **Unconfined link** detection (.. in paths)
- **No execution** of uploaded files
- **Sandboxed storage** (separate directories)

#### 17.4 Data Security
- **Soft deletes** with grace period
- **Change tracking** (who, when)
- **Access logging**
- **No secrets** in code (environment variables)
- **MongoDB** authentication

---

### 18. Known Limitations

#### 18.1 Functional Limitations
- **No search** functionality
- **No version control** for files
- **No conflict resolution** for concurrent edits
- **No commenting** system
- **No notifications**
- **No email** integration
- **No API** for external tools
- **No bulk operations**
- **No undo/redo**

#### 18.2 Metadata Limitations
- **Basic Dublin Core** only
- **Limited controlled vocabularies**
- **No custom fields** without code changes
- **No metadata import/export** formats
- **No IIIF** integration
- **No linked data** (RDF/JSON-LD)

#### 18.3 File Limitations
- **1 GB limit** for uploads/downloads
- **No streaming** uploads
- **No resumable** uploads
- **No version history**
- **No file locking**

#### 18.4 Publishing Limitations
- **Manual publishing** (no auto-publish)
- **No staging** environment per user
- **No preview** before publish
- **No publish scheduling**
- **Numbers not reused** (can exhaust)

#### 18.5 User Experience Limitations
- **Unpolished** authoring interface
- **Different styles** between authoring and publishing
- **Limited accessibility** features
- **No mobile optimization**
- **No offline** capability
- **No progressive** web app

#### 18.6 Technical Limitations
- **No CDN** integration
- **No S3/cloud** storage
- **No persistent identifiers** (beyond DOI)
- **No SWORD** protocol
- **No OAI-PMH**
- **No preservation** formats (METS, PREMIS)

---

### 19. Future Enhancement Opportunities

*Based on documented "Missing bits" in README*

#### 19.1 User Interface
- Polish authoring app layout
- Unify design with publishing app
- Improve mobile responsiveness
- Enhanced accessibility

#### 19.2 Search & Discovery
- Full-text search in authoring app
- Full-text search in publishing app
- Faceted browsing
- Advanced filters

#### 19.3 Metadata
- More sophisticated metadata handling
- Expanded controlled vocabularies
- Linked data integration
- IIIF support

#### 19.4 Pre-Flight Checks
- More comprehensive validation
- Metadata completeness checks
- File integrity checks
- Accessibility checks

#### 19.5 Persistent Identifiers
- Handle integration
- ARK integration
- Automated DOI minting
- Cool URIs implementation

#### 19.6 Supplementary Materials
- Paradata management
- Documentation management
- Related resources
- External links management

#### 19.7 Viewer Interoperability
- Support for multiple 3D viewers
- Viewer-agnostic annotation format
- Cross-viewer compatibility
- Format conversion tools

---

## Summary Statistics

**Total Features Documented**: 200+

**Major Feature Categories**:
1. Authentication & Authorization (18 features)
2. Project & Edition Management (25 features)
3. File Management (20 features)
4. 3D Viewer Integration (22 features)
5. Publishing Workflow (26 features)
6. Metadata Management (18 features)
7. User Management (16 features)
8. Content Validation (15 features)
9. Administrative Features (22 features)
10. Workflow Features (12 features)
11. Integration Features (12 features)
12. UI/UX Features (14 features)

**Technologies Used**:
- Python Flask (backend)
- MongoDB (database)
- Smithsonian DPO Voyager (3D viewer)
- WebDAV (file sync)
- OpenID Connect (authentication)
- TailwindCSS (styling)
- Handlebars (templates)

**Primary Use Case**: Creating and publishing scholarly 3D digital editions with rich annotations, multimedia content, and peer review documentation for long-term preservation and public access.
