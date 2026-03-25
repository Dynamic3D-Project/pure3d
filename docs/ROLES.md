# Pure3D Role-Based Access Control (RBAC)

This document defines the role system for the Pure3D platform, covering all 7 roles, their permissions, and the editorial workflow.

## Role Definitions

### Global Roles

These roles are assigned system-wide in the `users` collection.

| Role | Who | Scope |
|------|-----|-------|
| **Super Admin** | Platform maintainers, KNAW/HuC staff | Full system access. Can manage all users, collections, editions, and platform settings. |
| **Admin** | Trusted staff or delegated managers | Can manage users and oversee all collections/editions. Cannot modify platform-level settings. |
| **Editorial Board** | Appointed reviewers for peer review | Can review submitted editions across all collections. Cannot create or edit content. |
| **Viewer** | Default role for registered users | Can browse published content. No editing or management permissions. |

### Collection-Level Roles

These roles are assigned per-collection in the `collectionUsers` join table.

| Role | Who | Scope |
|------|-----|-------|
| **Collection Owner** | PI, project lead, or institution representative | Full control over a specific collection: manage editions, assign authors/collaborators, configure metadata. |
| **Editor** | Co-PI or senior collaborator | Can edit collection metadata and manage editions within the collection. |
| **Viewer** | Interested parties with read access | Can view unpublished content within the collection (e.g., drafts). |

### Edition-Level Roles

These roles are assigned per-edition in the `editionUsers` join table.

| Role | Who | Scope |
|------|-----|-------|
| **Author** | Primary content creator | Full control over a specific edition: edit content, manage 3D assets, submit for review. |
| **Collaborator** | Contributing researcher or technician | Can edit edition content and assets but cannot submit for review or publish. |
| **Reviewer** | Assigned peer reviewer | Can view and annotate the edition during review. Can approve or request changes. |

## Permission Matrix

Actions marked with the role that can perform them. Global roles (SA=Super Admin, A=Admin, EB=Editorial Board, V=Viewer) and scoped roles (CO=Collection Owner, E=Editor, Au=Author, Cl=Collaborator, R=Reviewer).

### Edition Lifecycle

| Action | SA | A | EB | V | CO | E | Au | Cl | R |
|--------|:--:|:-:|:--:|:-:|:--:|:-:|:--:|:--:|:-:|
| Create edition | x | x | | | x | | | | |
| Edit edition content | x | x | | | x | x | x | x | |
| Delete edition | x | x | | | x | | | | |
| View draft edition | x | x | | | x | x | x | x | x |
| Submit for review | x | x | | | x | | x | | |
| Approve/reject edition | x | | x | | | | | | x |
| Publish edition | x | x | | | x | | | | |
| Unpublish edition | x | x | | | x | | | | |

### Collection Management

| Action | SA | A | EB | V | CO | E |
|--------|:--:|:-:|:--:|:-:|:--:|:-:|
| Create collection | x | x | | | | |
| Edit collection metadata | x | x | | | x | x |
| Delete collection | x | x | | | x | |
| Manage collection users | x | x | | | x | |

### User & Platform Management

| Action | SA | A | EB | V |
|--------|:--:|:-:|:--:|:-:|
| View admin panel | x | x | | |
| Manage user global roles | x | x | | |
| Manage platform settings | x | | | |
| View all users | x | x | | |

### Content Browsing

| Action | SA | A | EB | V |
|--------|:--:|:-:|:--:|:-:|
| Browse published editions | x | x | x | x |
| Browse published collections | x | x | x | x |
| Search/filter content | x | x | x | x |
| View own profile | x | x | x | x |

## Editorial Workflow

Editions follow a review workflow with defined status transitions:

```
                    ┌──────────┐
                    │  Draft   │
                    └────┬─────┘
                         │ submit
                         ▼
                    ┌──────────┐
                    │Submitted │
                    └────┬─────┘
                         │ begin review
                         ▼
                    ┌──────────┐
              ┌─────│In Review │─────┐
              │     └──────────┘     │
              │ approve              │ reject
              ▼                      ▼
        ┌──────────┐          ┌──────────┐
        │ Approved │          │ Rejected │
        └────┬─────┘          └────┬─────┘
             │ publish              │ revise (→ Draft)
             ▼                      │
        ┌──────────┐               │
        │Published │               │
        └──────────┘               │
                                    ▼
                              ┌──────────┐
                              │  Draft   │
                              └──────────┘
```

### Status Definitions

| Status | Description |
|--------|-------------|
| `draft` | Edition is being worked on. Only visible to assigned users. |
| `submitted` | Author has submitted the edition for peer review. |
| `in_review` | Editorial board / reviewers are actively reviewing. |
| `approved` | Review passed. Ready to be published by collection owner or admin. |
| `rejected` | Review failed. Author must revise and resubmit. Returns to draft. |
| `published` | Edition is publicly visible to all users. |

### Valid Status Transitions

| From | To | Who Can Trigger |
|------|----|-----------------|
| `draft` | `submitted` | Author, Collection Owner, Super Admin, Admin |
| `submitted` | `in_review` | Editorial Board, Reviewer, Super Admin, Admin |
| `in_review` | `approved` | Editorial Board, Reviewer, Super Admin |
| `in_review` | `rejected` | Editorial Board, Reviewer, Super Admin |
| `approved` | `published` | Collection Owner, Super Admin, Admin |
| `rejected` | `draft` | Author, Collection Owner, Super Admin, Admin |
| `published` | `draft` | Collection Owner, Super Admin, Admin |

## PocketBase Schema Mapping

### Global Roles → `users.role` (select field)

```
superadmin  → Super Admin
admin       → Admin
editorial_board → Editorial Board
viewer      → Viewer (default for new registrations)
```

### Collection Roles → `collectionUsers.role` (select field)

```
owner   → Collection Owner
editor  → Editor
viewer  → Viewer
```

### Edition Roles → `editionUsers.role` (select field)

```
author       → Author
collaborator → Collaborator
reviewer     → Reviewer
```

### Edition Status → `editions.status` (select field)

```
draft | submitted | in_review | approved | rejected | published
```

### Auth Linking → `users.pbAuthId` (text field, unique)

The `users` collection (app data) stores a `pbAuthId` field that links to the PocketBase built-in auth user ID. This bridges the gap between PocketBase authentication and the application's user data model.

## Gap Analysis: Current vs Target State

### Current State

| Area | Status |
|------|--------|
| `users.role` values | `root`, `admin`, `editor`, `viewer` — generic, doesn't match partner requirements |
| `collectionUsers.role` values | `admin`, `editor`, `viewer` — no "owner" concept |
| `editionUsers.role` values | `admin`, `editor`, `viewer` — no author/collaborator/reviewer distinction |
| Edition status/workflow | No `status` field. Only `isPublished` boolean. No review workflow. |
| Permission checking | None. No middleware or utility functions check roles before actions. |
| Auth ↔ App user link | PB auth users and app `users` collection are separate, linked only by email (fragile). |
| Admin UI | No admin page exists. Role management requires direct PocketBase admin access. |
| Profile page | Hardcodes role as `'user'` regardless of actual role. |

### Target State (This Implementation)

| Area | Status |
|------|--------|
| `users.role` values | `superadmin`, `admin`, `editorial_board`, `viewer` — matches partner diagram |
| `collectionUsers.role` values | `owner`, `editor`, `viewer` — explicit ownership |
| `editionUsers.role` values | `author`, `collaborator`, `reviewer` — clear responsibilities |
| Edition status/workflow | `status` select field with 6 states and defined transitions |
| Permission checking | `permissions.ts` utility with `hasPermission()`, `canTransitionStatus()`, etc. |
| Auth ↔ App user link | `pbAuthId` field links PB auth to app user; auth store resolves role on login |
| Admin UI | `/admin/users` page for viewing and managing user roles |
| Profile page | Shows actual global role from auth store |

### Future Work (Not in This Implementation)

- Server-side middleware enforcing permissions on all data access
- Collection-level and edition-level role assignment UIs
- PocketBase API rules using role-based filters
- Audit logging for role changes and status transitions
- Email notifications for workflow events (submission, review, approval)
