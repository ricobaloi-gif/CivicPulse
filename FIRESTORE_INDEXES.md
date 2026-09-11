# Firestore Composite Indexes Required for CivicPulse

This document lists all composite indexes that must be created in the Firebase Console for the application to function correctly.

## How to Create Indexes

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes** → **Composite**
4. Click **Add Index** for each entry below
5. Wait for indexes to build (status will show "Building" → "Enabled")

---

## Required Indexes

### 1. `reports` Collection

| Fields | Query Scope | Used By |
|--------|-------------|---------|
| `organizationId` **ASC**, `createdAt` **DESC** | Collection | `/reports`, `/admin`, `/report/new` (duplicate check) |
| `createdBy` **ASC**, `createdAt` **DESC** | Collection | `/my-reports` |
| `organizationId` **ASC**, `status` **ASC**, `createdAt` **DESC** | Collection | Admin filtering by status |
| `organizationId` **ASC**, `assignedTo` **ASC**, `createdAt` **DESC** | Collection | `/staff` (assigned cases) |
| `organizationId` **ASC**, `category` **ASC**, `status` **ASC**, `createdAt` **DESC** | Collection | Admin/Reports category + status filtering |
| `organizationId` **ASC**, `areaId` **ASC**, `createdAt` **DESC** | Collection | Area-based report filtering |

> **Critical**: The `organizationId ASC, createdAt DESC` index is required for the main browse reports functionality and is currently missing (causing the "Browse Reports requires a Firestore composite index" error).

### 2. `users` Collection

| Fields | Query Scope | Used By |
|--------|-------------|---------|
| `organizationId` **ASC**, `role` **ASC** | Collection | `/admin` (staff list), `/staff` (staff list), `/report/[id]` (staff dropdown), escalation notifications |
| `email` **ASC** | Collection | `/organization/invites` (check existing user), invitations.ts |
| `organizationId` **ASC**, `role` **ASC**, `name` **ASC** | Collection | `/organization/manage` (member list) |

### 3. `organizationInvites` Collection

| Fields | Query Scope | Used By |
|--------|-------------|---------|
| `email` **ASC**, `status` **ASC** | Collection | `/organization/invites` (user's pending invites) |
| `organizationId` **ASC**, `status` **ASC** | Collection | `/organization/manage` (pending invites list) |
| `organizationId` **ASC**, `email` **ASC**, `status` **ASC** | Collection | `invitations.ts` (duplicate check) |

### 4. `areas` Collection

| Fields | Query Scope | Used By |
|--------|-------------|---------|
| `organizationId` **ASC**, `active` **ASC**, `name` **ASC** | Collection | `/report/new`, `/reports`, `/admin`, `/staff`, `/report/[id]`, `/organization/areas` |
| `organizationId` **ASC**, `name` **ASC** | Collection | `areas.ts` (duplicate check) |

### 5. `notifications` Collection

| Fields | Query Scope | Used By |
|--------|-------------|---------|
| `userId` **ASC**, `read` **ASC**, `createdAt` **DESC** | Collection | Layout.tsx (unread count listener) |
| `userId` **ASC**, `createdAt` **DESC** | Collection | `/notifications` page |

### 6. `auditLogs` Collection

| Fields | Query Scope | Used By |
|--------|-------------|---------|
| `organizationId` **ASC**, `timestamp` **DESC** | Collection | Future analytics/audit view |

### 6. Subcollections

#### `reports/{reportId}/caseNotes`

| Fields | Query Scope | Used By |
|--------|-------------|---------|
| `createdAt` **DESC** | Collection Group | `/report/[id]` (case notes) |

#### `reports/{reportId}/comments`

| Fields | Query Scope | Used By |
|--------|-------------|---------|
| `createdAt` **ASC** | Collection Group | `/report/[id]` (public comments) |

---

## Index Creation Commands (Firebase CLI)

If you prefer using the Firebase CLI, you can create a `firestore.indexes.json` file and deploy:

```json
{
  "indexes": [
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdBy", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "assignedTo", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "areaId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "email", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "organizationInvites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "email", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "organizationInvites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "organizationInvites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "email", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "areas",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "active", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "areas",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "read", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "auditLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "caseNotes",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "comments",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy with:
```bash
firebase deploy --only firestore:indexes
```

---

## Notes

- **Single-field indexes** are created automatically by Firestore for basic queries
- **Composite indexes** are required for queries with multiple `where` clauses combined with `orderBy`
- The `organizationId ASC, createdAt DESC` index on `reports` is the most critical and should be created first
- Index building can take several minutes for large collections
- Monitor the Firebase Console for index build status