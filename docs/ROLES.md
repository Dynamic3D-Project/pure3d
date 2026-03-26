# Pure3D Role-Based Access Control (RBAC)

This document defines the role system for the Pure3D platform, covering all roles, their permissions, and the editorial workflow.

## Role Definitions

### Global Roles

These roles are assigned system-wide in the `userProfiles` collection.

| Role | Who | Scope |
|------|-----|-------|
| **Admin** | Platform maintainers, KNAW/HuC staff | Full system access. Can manage all users, collections, editions, and platform settings. |
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

Actions marked with the role that can perform them. Global roles (A=Admin, EB=Editorial Board, V=Viewer) and scoped roles (CO=Collection Owner, E=Editor, Au=Author, Cl=Collaborator, R=Reviewer).

### Edition Lifecycle

| Action | A | EB | V | CO | E | Au | Cl | R |
|--------|:-:|:--:|:-:|:--:|:-:|:--:|:--:|:-:|
| Create edition | x | | | x | | | | |
| Edit edition content | x | | | x | x | x | x | |
| Delete edition | x | | | x | | | | |
| View draft edition | x | | | x | x | x | x | x |
| Submit for review | x | | | x | | x | | |
| Approve/reject edition | x | x | | | | | | x |
| Publish edition | x | | | x | | | | |
| Unpublish edition | x | | | x | | | | |

### Collection Management

| Action | A | EB | V | CO | E |
|--------|:-:|:--:|:-:|:--:|:-:|
| Create collection | x | | | | |
| Edit collection metadata | x | | | x | x |
| Delete collection | x | | | x | |
| Manage collection users | x | | | x | |

### User & Platform Management

| Action | A | EB | V |
|--------|:-:|:--:|:-:|
| View admin panel | x | | |
| Manage user global roles | x | | |
| View all users | x | | |

### Content Browsing

| Action | A | EB | V |
|--------|:-:|:--:|:-:|
| Browse published editions | x | x | x |
| Browse published collections | x | x | x |
| Search/filter content | x | x | x |
| View own profile | x | x | x |

## Editorial Workflow

Editions follow a multi-stage review workflow with defined status transitions.

### Status Definitions

| Status | Description |
|--------|-------------|
| `draft` | Edition is being worked on. Only visible to assigned users. |
| `concept_submitted` | Author has submitted the concept for review. |
| `editorial_review` | Editorial board is reviewing the concept. |
| `concept_accepted` | Concept approved. Ready for alpha stage. |
| `concept_rejected` | Concept rejected. Author must revise and resubmit. |
| `alpha_review` | Reviewers are evaluating the alpha version. |
| `alpha_revisions` | Revisions requested during alpha review. |
| `alpha_accepted` | Alpha accepted. Ready for final review. |
| `alpha_rejected` | Alpha rejected. Returns to draft. |
| `final_review` | Final review before publication. |
| `final_revisions` | Revisions requested during final review. |
| `published` | Edition is publicly visible to all users. |

### Valid Status Transitions

| From | To | Who Can Trigger |
|------|----|-----------------|
| `draft` | `concept_submitted` | Author, Collection Owner, Admin |
| `concept_submitted` | `editorial_review` | Editorial Board, Reviewer, Admin |
| `editorial_review` | `concept_accepted` | Editorial Board, Reviewer, Admin |
| `editorial_review` | `concept_rejected` | Editorial Board, Reviewer, Admin |
| `concept_accepted` | `alpha_review` | Admin |
| `concept_rejected` | `draft` | Author, Collection Owner, Admin |
| `alpha_review` | `alpha_accepted` | Editorial Board, Reviewer, Admin |
| `alpha_review` | `alpha_rejected` | Editorial Board, Reviewer, Admin |
| `alpha_review` | `alpha_revisions` | Editorial Board, Reviewer, Admin |
| `alpha_revisions` | `alpha_review` | Author, Collection Owner, Admin |
| `alpha_accepted` | `final_review` | Admin |
| `alpha_rejected` | `draft` | Author, Collection Owner, Admin |
| `final_review` | `published` | Collection Owner, Admin |
| `final_review` | `final_revisions` | Editorial Board, Reviewer, Admin |
| `final_revisions` | `final_review` | Author, Collection Owner, Admin |
| `published` | `draft` | Collection Owner, Admin |

## PocketBase Schema Mapping

### Global Roles → `userProfiles.role` (select field)

```
admin           → Admin
editorial_board → Editorial Board
viewer          → Viewer (default for new registrations)
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
draft | concept_submitted | editorial_review | concept_accepted | concept_rejected |
alpha_review | alpha_revisions | alpha_accepted | alpha_rejected |
final_review | final_revisions | published
```

### Auth Linking → `userProfiles.pbAuthId` (text field, unique)

The `userProfiles` collection (app data) stores a `pbAuthId` field that links to the PocketBase built-in auth user ID. This bridges the gap between PocketBase authentication and the application's user data model.
