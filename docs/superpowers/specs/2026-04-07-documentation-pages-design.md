# Documentation Pages — Design Spec

## Overview

Add a database-backed `/documentation` section to the PURE3D website where admins can create and manage editorial content pages (submission guidelines, evaluation process, reviewer guidelines, tutorials, FAQ, etc.) through a rich text editor in the admin panel. Public users browse these pages via a `/documentation` route with sidebar navigation.

Addresses issue #34: "Website content: submission guidelines, evaluation process, and supporting pages."

## Architecture

### PocketBase Collection: `documentation`

| Field         | Type    | Notes                                         |
|---------------|---------|-----------------------------------------------|
| `title`       | string  | Page title, required                          |
| `slug`        | string  | URL-friendly identifier, unique, required     |
| `content`     | string  | HTML content from rich editor                 |
| `summary`     | string  | Short description for the overview page       |
| `order`       | number  | Controls sidebar ordering (ascending)         |
| `isPublished` | boolean | Draft/published toggle, default false         |

The collection should be created in PocketBase with API rules:
- **List/View:** public (no auth required) for `isPublished = true`
- **Create/Update/Delete:** admin only

### Rich Text Editor: Tiptap

Add Tiptap (ProseMirror-based) as the rich text editor for creating/editing documentation content.

**Packages to install:**
- `@tiptap/core`
- `@tiptap/starter-kit` (bold, italic, headings, lists, blockquote, code, horizontal rule)
- `@tiptap/extension-link`
- `@tiptap/extension-image`
- `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`
- `@tiptap/extension-underline`
- `@tiptap/extension-placeholder`

**Reusable editor component:** `src/lib/components/ui/RichTextEditor.svelte`
- Toolbar with formatting buttons (bold, italic, underline, headings 1-3, bullet list, ordered list, blockquote, link, image, table, horizontal rule)
- Props: `content` (HTML string in/out), `placeholder`
- Uses DaisyUI styling for the toolbar to match the rest of the admin UI
- Emits `onchange` with HTML string

This editor component is generic and can be reused for blog posts or other content areas in the future.

## Routes

### Public Routes

**`/documentation` — Overview/Landing**
- `src/routes/documentation/+page.svelte`
- `src/routes/documentation/+page.ts` (load function fetching all published docs)
- Displays a card grid or list of all published documentation pages with title and summary
- Links to individual pages

**`/documentation/[slug]` — Individual Page**
- `src/routes/documentation/[slug]/+page.svelte`
- `src/routes/documentation/[slug]/+page.ts` (load function fetching single doc by slug)
- Renders content via `{@html doc.content}` inside prose container

**`/documentation/+layout.svelte` — Shared Layout**
- Sidebar (left) listing all published doc pages, ordered by `order` field
- Active state highlighting for current page
- Content area (right) with `prose prose-lg` styling (same as About page)
- On mobile: sidebar collapses to a horizontal scrollable tab bar or dropdown at the top

### Admin Route

**`/admin/documentation` — CRUD Management**
- `src/routes/admin/documentation/+page.svelte`
- Table listing all documentation pages (title, slug, status, order)
- "Create" button opens a full-width modal or inline form with:
  - Title input
  - Slug input (auto-generated from title, editable)
  - Summary textarea
  - Order number input
  - Published toggle
  - Tiptap rich text editor for content
- Edit: same form, pre-populated
- Delete: confirmation modal
- Reorder: number input in the table (simple approach)
- Audit logging on all CRUD operations via `logAudit()`

## Navigation

Add "Documentation" to `src/lib/models/menu-itmes.ts`:

```typescript
export default [
  { title: 'Collections', path: '/collections', displayTitle: 'Collections' },
  { title: 'Editions', path: '/editions', displayTitle: 'Editions' },
  { title: 'Documentation', path: '/documentation', displayTitle: 'Documentation' },
  { title: 'About', path: '/about', displayTitle: 'About' }
];
```

## Contextual Links

Add links to relevant documentation pages from existing UI where appropriate:
- Edition creation/editing flow: link to `/documentation/submission` (submission guidelines)
- Review dashboard: link to `/documentation/review` (reviewer guidelines)
- "Publish with us" CTA on homepage: link to `/documentation/submission`
- About page "Publish a 3D Scholarly Edition" section: update link to `/documentation/submission`

## Initial Content Pages

Seed the following documentation pages (content from the editorial instructions provided):

| Slug             | Title                                  | Order |
|------------------|----------------------------------------|-------|
| `submission`     | Submission Guidelines                  | 1     |
| `evaluation`     | Evaluation and Publication Process     | 2     |
| `review`         | Evaluation Guidelines for Reviewers    | 3     |
| `platform-guide` | Voyager Explorer Guide                 | 4     |
| `tutorials`      | Tutorials                              | 5     |
| `faq`            | FAQ & Troubleshooting                  | 6     |
| `examples`       | Example Editions                       | 7     |

Content for each page comes from the editorial instructions text. Internal `(link)` placeholders should be replaced with actual `/documentation/[slug]` cross-references where they point to other documentation pages.

## Type Definitions

Add to `src/lib/database/client.ts`:

```typescript
export interface Documentation {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary: string;
  order: number;
  isPublished: boolean;
  created: string;
  updated: string;
}
```

## Data Fetching Pattern

Follow the existing pattern from blog/editions:
- Load functions in `+page.ts` files fetch from PocketBase
- Use `pb.collection('documentation')` with appropriate filters
- Public pages filter by `isPublished = true`, sort by `order`
- Admin page fetches all (including drafts)

## Error Handling

- `/documentation/[slug]` returns 404 if slug not found or page not published
- Admin operations show toast notifications on success/failure (existing pattern with svelte-french-toast)

## Testing Plan

- Verify PocketBase collection creation and API rules
- Admin: create, edit, reorder, publish/unpublish, delete documentation pages
- Public: browse overview, navigate to individual pages, verify sidebar ordering
- Rich editor: formatting, links, images, tables render correctly in both editor and public view
- Mobile: sidebar collapses appropriately
- Contextual links work from edition editor, review dashboard, homepage
- 404 handling for non-existent slugs
