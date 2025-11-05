# PocketBase Manual Setup Guide

Since the automatic migration has API compatibility issues, we'll create the collections manually through the Admin UI. This is actually simpler and gives you more control.

## Step 1: Access PocketBase Admin UI

```bash
# Ensure PocketBase is running
docker compose up -d pocketbase

# Open in browser
open http://localhost:7090/_/
```

Create an admin account when prompted:
- Email: `admin@pure3d.local` (or your preference)
- Password: (choose a secure password)

## Step 2: Create Collections

Click "New collection" for each of the following:

### Collection 1: users

**Type:** Base
**Name:** `users`

**Fields:**
1. `user` - Text
   - Required: Yes
   - Unique: Yes

2. `email` - Email
   - Required: Yes

3. `nickname` - Text
   - Required: Yes
   - Presentable: Yes

4. `role` - Select
   - Required: Yes
   - Values: `root`, `admin`, `editor`, `viewer`
   - Max select: 1

**API Rules:**
- List rule: `@request.auth.id != ''`
- View rule: `@request.auth.id != ''`
- Create rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`
- Update rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`
- Delete rule: `@request.auth.role = 'root'`

---

### Collection 2: site

**Type:** Base
**Name:** `site`

**Fields:**
1. `name` - Text (Required)
2. `blog` - URL
3. `lastPublished` - Date
4. `processing` - Bool
5. `featured` - JSON
6. `publishedProjectCount` - Number
7. `sweeperStartTm` - Date
8. `dcDateCreated` - Date
9. `dcDateModified` - Date

**API Rules:**
- List rule: (empty - public)
- View rule: (empty - public)
- Create rule: `@request.auth.role = 'root'`
- Update rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`
- Delete rule: (leave empty/null)

---

### Collection 3: keywords

**Type:** Base
**Name:** `keywords`

**Fields:**
1. `name` - Select (Required)
   - Values: `country`, `period`, `audience`, `subject`, `language`, `license`, `funder`
   - Max select: 1

2. `value` - Text (Required, Presentable)

**API Rules:**
- List rule: (empty - public)
- View rule: (empty - public)
- Create rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`
- Update rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`
- Delete rule: `@request.auth.role = 'root'`

---

### Collection 4: projects

**Type:** Base
**Name:** `projects`

**Fields:**
1. `title` - Text (Required, min: 1, max: 500)
2. `siteId` - Relation
   - Collection: `site`
   - Max select: 1
3. `isVisible` - Bool
4. `lastPublished` - Date
5. `pubNum` - Number
6. `dcTitle` - Text (max: 500)
7. `dcSubtitle` - Text (max: 500)
8. `dcCreator` - JSON
9. `dcContributor` - JSON
10. `dcInstitution` - JSON
11. `dcAbstract` - Editor
12. `dcDescription` - Editor
13. `dcSubject` - JSON
14. `dcCoveragePeriod` - Text
15. `dcCoveragePlace` - Text
16. `dcLanguage` - JSON
17. `dcDateCreated` - Date
18. `dcDateModified` - Date

**API Rules:**
- List rule: `isVisible = true || (@request.auth.id != '' && @request.auth.role != '')`
- View rule: `isVisible = true || (@request.auth.id != '' && @request.auth.role != '')`
- Create rule: `@request.auth.role = 'root' || @request.auth.role = 'admin' || @request.auth.role = 'editor'`
- Update rule: `@request.auth.role = 'root' || @request.auth.role = 'admin' || @request.auth.role = 'editor'`
- Delete rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`

---

### Collection 5: editions

**Type:** Base
**Name:** `editions`

**Fields:**
1. `title` - Text (Required, min: 1, max: 500)
2. `projectId` - Relation
   - Collection: `projects`
   - Max select: 1
   - Cascade delete: Yes
3. `isPublished` - Bool
4. `pubNum` - Number
5. `dcTitle` - Text (max: 500)
6. `dcSubtitle` - Text (max: 500)
7. `dcCreator` - JSON
8. `dcContributor` - JSON
9. `dcInstitution` - JSON
10. `dcAbstract` - Editor
11. `dcDescription` - Editor
12. `dcContact` - Email
13. `dcSubject` - JSON
14. `dcKeyword` - JSON
15. `dcAudience` - JSON
16. `dcFunder` - JSON
17. `dcSource` - JSON
18. `dcProvenance` - Editor
19. `dcCoveragePeriod` - JSON
20. `dcCoveragePlace` - Text
21. `dcCoverageCountry` - JSON
22. `dcCoverageTemporal` - Text
23. `dcCoverageGeo` - Text
24. `dcLanguage` - JSON
25. `dcRightsHolder` - Text
26. `dcRightsLicense` - Text
27. `dcDatePublished` - Date
28. `dcDateUnPublished` - Date
29. `dcDateCreated` - Date
30. `dcDateModified` - Date
31. `authorToolName` - Text
32. `authorToolVersion` - Text
33. `sceneFile` - Text

**API Rules:**
- List rule: `isPublished = true || (@request.auth.id != '' && @request.auth.role != '')`
- View rule: `isPublished = true || (@request.auth.id != '' && @request.auth.role != '')`
- Create rule: `@request.auth.role = 'root' || @request.auth.role = 'admin' || @request.auth.role = 'editor'`
- Update rule: `@request.auth.role = 'root' || @request.auth.role = 'admin' || @request.auth.role = 'editor'`
- Delete rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`

---

### Collection 6: projectUsers

**Type:** Base
**Name:** `projectUsers`

**Fields:**
1. `projectId` - Relation (Required)
   - Collection: `projects`
   - Max select: 1
   - Cascade delete: Yes

2. `userId` - Relation (Required)
   - Collection: `users`
   - Max select: 1
   - Cascade delete: Yes

3. `user` - Text (Required) *(legacy compatibility)*

4. `role` - Select (Required)
   - Values: `admin`, `editor`, `viewer`
   - Max select: 1

**API Rules:**
- List rule: `@request.auth.id != ''`
- View rule: `@request.auth.id != ''`
- Create rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`
- Update rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`
- Delete rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`

---

### Collection 7: editionUsers

**Type:** Base
**Name:** `editionUsers`

**Fields:**
1. `editionId` - Relation (Required)
   - Collection: `editions`
   - Max select: 1
   - Cascade delete: Yes

2. `userId` - Relation (Required)
   - Collection: `users`
   - Max select: 1
   - Cascade delete: Yes

3. `user` - Text (Required) *(legacy compatibility)*

4. `role` - Select (Required)
   - Values: `admin`, `editor`, `viewer`
   - Max select: 1

**API Rules:**
- List rule: `@request.auth.id != ''`
- View rule: `@request.auth.id != ''`
- Create rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`
- Update rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`
- Delete rule: `@request.auth.role = 'root' || @request.auth.role = 'admin'`

---

## Step 3: Run Data Import

Once all collections are created, run the import:

```bash
docker compose --profile import up pocketbase-importer
```

## Quick Copy-Paste Script (Alternative)

If you prefer, I can provide a script that creates collections via the PocketBase API. Let me know if you'd like that approach instead!

## Verification

After creating collections, verify in the admin UI:
1. All 7 collections should be visible in the sidebar
2. Each collection should have the correct fields
3. API rules should be set

Then proceed with the data import as described in `DOCKER_POCKETBASE_SETUP.md`.
