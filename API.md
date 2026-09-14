# CivicPulse REST API Documentation

## Overview

The CivicPulse REST API provides programmatic access to civic reports, service areas, and analytics for partner organizations and external integrations. All API endpoints are organization-scoped, ensuring tenant isolation.

**Base URL:** `https://your-domain.com/api`

## Authentication

All API requests require an API key passed in the `Authorization` header:

```
Authorization: Bearer cp_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### API Key Format

- **Prefix:** `cp_live_` (identifies as CivicPulse live key)
- **Length:** 43 characters (prefix + 32-char base64url random string)
- **Example:** `cp_live_abcdefghijklmnopqrstuvwxyz123456`

### Security

- API keys are hashed using SHA-256 before storage
- Raw keys are shown **only once** at creation
- Keys belong to exactly one organization
- Disabled/revoked keys are rejected immediately
- Rate limiting is enforced per API key

## Rate Limits

| Endpoint Type | Requests/Minute | Burst |
|---------------|-----------------|-------|
| GET /reports  | 100             | 100   |
| GET /reports/:id | 100          | 100   |
| POST /reports | 20              | 20    |
| PATCH /reports/:id | 20         | 20    |
| GET /areas    | 100             | 100   |
| GET /analytics| 30              | 30    |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `Retry-After`: Seconds until next request allowed (on 429)

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 201  | Created |
| 400  | Validation Error |
| 401  | Unauthorized (invalid/missing API key) |
| 403  | Forbidden (insufficient permissions) |
| 404  | Not Found |
| 409  | Conflict |
| 429  | Rate Limited |
| 500  | Internal Server Error |

### Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Invalid or missing API key |
| `FORBIDDEN` | Access denied |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request parameters |
| `RATE_LIMITED` | Rate limit exceeded |
| `INTERNAL_ERROR` | Server error |
| `CONFLICT` | Resource conflict |
| `METHOD_NOT_ALLOWED` | HTTP method not supported |

---

## Endpoints

### Reports

#### List Reports

**GET** `/api/reports`

Returns paginated reports belonging to the authenticated organization.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category (Pothole, Water Leak, Power Outage, etc.) |
| `severity` | string | Filter by severity (low, medium, high, critical) |
| `status` | string | Filter by status (submitted, acknowledged, assigned, in-progress, resolved, reopened, verified, rejected, duplicate) |
| `areaId` | string | Filter by area ID |
| `assignedTo` | string | Filter by assigned staff user ID |
| `dateFrom` | string | Filter reports created after this date (ISO 8601) |
| `dateTo` | string | Filter reports created before this date (ISO 8601) |
| `limit` | integer | Results per page (1-100, default: 20) |
| `cursor` | string | Pagination cursor (report ID from previous page) |

**Response:**

```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "report_id",
        "title": "Large pothole on Main Street",
        "description": "Deep pothole causing vehicle damage",
        "category": "Pothole",
        "severity": "high",
        "status": "submitted",
        "latitude": -26.2041,
        "longitude": 28.0473,
        "address": "123 Main St, Johannesburg",
        "areaId": "area_123",
        "areaName": "Ward 42",
        "ward": "42",
        "municipality": "City of Johannesburg",
        "imageUrl": "https://...",
        "confirmationCount": 3,
        "assignedTo": "user_456",
        "assignedToName": "John Smith",
        "escalationLevel": 0,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "submittedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "count": 20,
      "hasMore": true,
      "nextCursor": "report_id_last"
    }
  }
}
```

#### Get Single Report

**GET** `/api/reports/:id`

Returns a single report if it belongs to the authenticated organization.

**Response:**

```json
{
  "success": true,
  "data": {
    "report": {
      "id": "report_id",
      "title": "Large pothole on Main Street",
      "description": "Deep pothole causing vehicle damage",
      "category": "Pothole",
      "severity": "high",
      "status": "submitted",
      "latitude": -26.2041,
      "longitude": 28.0473,
      "address": "123 Main St, Johannesburg",
      "areaId": "area_123",
      "areaName": "Ward 42",
      "ward": "42",
      "municipality": "City of Johannesburg",
      "imageUrl": "https://...",
      "confirmationCount": 3,
      "assignedTo": "user_456",
      "assignedToName": "John Smith",
      "escalationLevel": 0,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "submittedAt": "2024-01-15T10:30:00.000Z",
      "acknowledgedAt": null,
      "createdBy": "user_789",
      "createdByName": "Jane Resident",
      "organizationId": "org_123",
      "organizationName": "City of Johannesburg",
      "confirmedBy": ["user_111", "user_222", "user_333"],
      "assignedAt": "2024-01-16T08:00:00.000Z",
      "priority": 5,
      "escalated": false,
      "resolutionNote": null,
      "resolvedAt": null,
      "resolvedBy": null,
      "resolutionImageUrls": [],
      "moderationStatus": "normal",
      "disputeStatus": "none",
      "statusHistory": [
        { "status": "submitted", "changedAt": "2024-01-15T10:30:00.000Z", "changedBy": "user_789" },
        { "status": "acknowledged", "changedAt": "2024-01-15T14:00:00.000Z", "changedBy": "user_456" },
        { "status": "assigned", "changedAt": "2024-01-16T08:00:00.000Z", "changedBy": "user_456" }
      ]
    }
  }
}
```

**Note:** Returns 404 if report doesn't exist or belongs to another organization (prevents ID enumeration).

#### Create Report

**POST** `/api/reports`

Creates a new report in the authenticated organization.

**Request Body:**

```json
{
  "title": "Large pothole on Main Street",
  "description": "Deep pothole causing vehicle damage near the intersection with 5th Ave",
  "category": "Pothole",
  "severity": "high",
  "latitude": -26.2041,
  "longitude": 28.0473,
  "address": "123 Main St, Johannesburg",
  "areaId": "area_123",
  "areaName": "Ward 42",
  "ward": "42",
  "municipality": "City of Johannesburg",
  "imageUrl": "https://example.com/image.jpg"
}
```

**Required Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `title` | string | 5-200 characters |
| `description` | string | 10-5000 characters |
| `category` | string | Must be valid category |
| `severity` | string | Must be valid severity |
| `latitude` | number | -90 to 90 |
| `longitude` | number | -180 to 180 |

**Optional Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `address` | string | Max 500 characters |
| `areaId` | string | Max 100 characters |
| `areaName` | string | Max 100 characters |
| `ward` | string | Max 50 characters |
| `municipality` | string | Max 100 characters |
| `imageUrl` | string | Valid URL |

**Server-Set Fields (cannot be overridden):**

- `organizationId` - From API key
- `organizationName` - From organization
- `status` - Always "submitted"
- `confirmationCount` - Always 0
- `confirmedBy` - Always []
- `createdAt` - Server timestamp
- `updatedAt` - Server timestamp
- `submittedAt` - Server timestamp

**Response:** 201 Created

```json
{
  "success": true,
  "data": {
    "report": { ... }
  }
}
```

#### Update Report

**PATCH** `/api/reports/:id`

Updates a report belonging to the authenticated organization.

**Allowed Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `status` | string | Must follow valid transitions |
| `assignedTo` | string/null | Staff user ID or null |
| `priority` | number | 0-10 |
| `escalationLevel` | number | 0-3 |
| `areaId` | string/null | Valid area ID in organization |
| `resolutionNote` | string/null | Max 5000 characters |

**Status Transitions:**

| From | Allowed To |
|------|------------|
| submitted | acknowledged, assigned, rejected, duplicate |
| acknowledged | assigned, in-progress, rejected, duplicate |
| assigned | in-progress, rejected, duplicate, submitted |
| in-progress | resolved, rejected, duplicate, assigned |
| resolved | verified, reopened |
| verified | reopened |
| reopened | assigned, in-progress, resolved, rejected |
| rejected | submitted, duplicate |
| duplicate | (none) |

**Response:**

```json
{
  "success": true,
  "data": {
    "report": { ... }
  }
}
```

---

### Areas

#### List Areas

**GET** `/api/areas`

Returns service areas belonging to the authenticated organization.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `active` | string | Filter: "true", "false", or omit for all |

**Response:**

```json
{
  "success": true,
  "data": {
    "areas": [
      {
        "id": "area_123",
        "name": "Ward 42",
        "type": "ward",
        "code": "42",
        "description": "Central business district",
        "municipality": "City of Johannesburg",
        "province": "Gauteng",
        "country": "South Africa",
        "active": true,
        "assignedStaff": ["user_456", "user_789"],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 15
  }
}
```

---

### Analytics

#### Get Organization Analytics

**GET** `/api/analytics`

Returns aggregated metrics for the authenticated organization.

**Response:**

```json
{
  "success": true,
  "data": {
    "totalReports": 1250,
    "openReports": 342,
    "resolvedReports": 856,
    "criticalReports": 23,
    "statusBreakdown": {
      "submitted": 45,
      "acknowledged": 67,
      "assigned": 112,
      "in-progress": 89,
      "resolved": 756,
      "reopened": 12,
      "verified": 100,
      "rejected": 45,
      "duplicate": 24
    },
    "severityBreakdown": {
      "low": 312,
      "medium": 456,
      "high": 342,
      "critical": 140
    },
    "categoryBreakdown": {
      "Pothole": 234,
      "Water Leak": 189,
      "Power Outage": 156,
      "Broken Streetlight": 134,
      "Illegal Dumping": 123,
      "Road Hazard": 112,
      "Sewer Issue": 89,
      "Vandalism": 67,
      "Other": 146
    },
    "averageResolutionTimeMs": 259200000,
    "averageResolutionTimeHours": 72.0,
    "escalatedCases": 45,
    "assignedCases": 567
  }
}
```

---

## API Key Management (Admin UI)

API keys are managed through the CivicPulse admin interface at `/organization/api`.

### Creating an API Key

1. Navigate to **Operations → API Keys** or **Organization → Manage → API Keys**
2. Click "Create API Key"
3. Enter a descriptive name (e.g., "Mobile App", "CI/CD Pipeline")
4. Copy the generated key immediately - **it will never be shown again**
5. Store the key securely

### API Key Properties

| Property | Description |
|----------|-------------|
| **Name** | Human-readable identifier |
| **Prefix** | First 8 chars of key (for identification) |
| **Status** | Active/Revoked |
| **Created** | Creation timestamp |
| **Last Used** | Most recent API call timestamp |
| **Permissions** | Scope of access (reports:read, reports:write, areas:read, analytics:read) |

### Revoking a Key

- Click "Revoke" next to any active key
- Revoked keys immediately stop working
- Action is irreversible

### Renaming a Key

- Click "Rename" to update the display name
- Does not affect the key itself

---

## Categories Reference

| Category | Emoji (Map) |
|----------|-------------|
| Pothole | 🕳️ |
| Water Leak | 💧 |
| Power Outage | ⚡ |
| Broken Streetlight | 💡 |
| Illegal Dumping | ⚠️ |
| Road Hazard | 🚧 |
| Sewer Issue | ☣️ |
| Vandalism | 🧱 |
| Other | 📍 |

---

## Severities Reference

| Severity | Priority | Color |
|----------|----------|-------|
| critical | Highest | Red |
| high | High | Orange |
| medium | Medium | Yellow |
| low | Low | Green |

---

## Statuses Reference

| Status | Description |
|--------|-------------|
| submitted | Newly created, awaiting review |
| acknowledged | Acknowledged by staff |
| assigned | Assigned to a staff member |
| in-progress | Work has begun |
| resolved | Issue fixed, awaiting verification |
| verified | Fix confirmed |
| reopened | Issue re-reported after resolution |
| rejected | Not a valid issue |
| duplicate | Duplicate of existing report |

---

## Tenant Isolation

**Critical:** All API endpoints enforce organization-level isolation. The organization ID is derived solely from the authenticated API key. Never trust organization IDs supplied in request bodies, query parameters, or headers.

- Organization A cannot read Organization B's reports
- Organization A cannot create reports for Organization B
- Organization A cannot access Organization B's areas or analytics
- Cross-tenant access attempts return 404 (not 403) to prevent ID enumeration

---

## Environment Variables (Server)

Required for Firebase Admin SDK (server-side only):

```env
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Never expose these to the client.** They are only used in Next.js API routes (server-side).

---

## Firestore Collections

### `apiKeys`

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | string | Owning organization |
| `name` | string | Human-readable name |
| `keyHash` | string | SHA-256 hash of raw key |
| `prefix` | string | First 13 chars (cp_live_XXXXXXXX) |
| `active` | boolean | Whether key is usable |
| `permissions` | string[] | Granted scopes |
| `createdAt` | timestamp | Creation time |
| `createdBy` | string | Admin user ID |
| `lastUsedAt` | timestamp | Last successful auth |
| `revokedAt` | timestamp | Revocation time (if revoked) |

### `rateLimits` (optional, for distributed rate limiting)

| Field | Type | Description |
|-------|------|-------------|
| `count` | number | Requests in current window |
| `windowStart` | timestamp | Window start time |
| `createdAt` | timestamp | Document creation |

**Indexes Required:**

```javascript
// apiKeys collection
db.collection('apiKeys').createIndex({ organizationId: 'asc', active: 'asc' });
db.collection('apiKeys').createIndex({ keyHash: 'asc' });

// reports collection (existing)
db.collection('reports').createIndex({ organizationId: 'asc', createdAt: 'desc' });
db.collection('reports').createIndex({ organizationId: 'asc', status: 'asc', createdAt: 'desc' });
db.collection('reports').createIndex({ organizationId: 'asc', category: 'asc', createdAt: 'desc' });
db.collection('reports').createIndex({ organizationId: 'asc', severity: 'asc', createdAt: 'desc' });
db.collection('reports').createIndex({ organizationId: 'asc', areaId: 'asc', createdAt: 'desc' });
db.collection('reports').createIndex({ organizationId: 'asc', assignedTo: 'asc', createdAt: 'desc' });

// areas collection (existing)
db.collection('areas').createIndex({ organizationId: 'asc', name: 'asc' });
db.collection('areas').createIndex({ organizationId: 'asc', active: 'asc', name: 'asc' });
```

---

## Example Usage

### cURL Examples

```bash
# List reports
curl -H "Authorization: Bearer cp_live_abcdefghijklmnopqrstuvwxyz123456" \
  "https://api.civicpulse.com/api/reports?status=submitted&limit=10"

# Get single report
curl -H "Authorization: Bearer cp_live_abcdefghijklmnopqrstuvwxyz123456" \
  "https://api.civicpulse.com/api/reports/report_abc123"

# Create report
curl -X POST \
  -H "Authorization: Bearer cp_live_abcdefghijklmnopqrstuvwxyz123456" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Broken streetlight on Oak Ave",
    "description": "Streetlight has been out for 3 days, very dark at night",
    "category": "Broken Streetlight",
    "severity": "medium",
    "latitude": -26.2041,
    "longitude": 28.0473,
    "address": "456 Oak Ave, Johannesburg"
  }' \
  "https://api.civicpulse.com/api/reports"

# Update report status
curl -X PATCH \
  -H "Authorization: Bearer cp_live_abcdefghijklmnopqrstuvwxyz123456" \
  -H "Content-Type: application/json" \
  -d '{"status": "acknowledged"}' \
  "https://api.civicpulse.com/api/reports/report_abc123"

# Get areas
curl -H "Authorization: Bearer cp_live_abcdefghijklmnopqrstuvwxyz123456" \
  "https://api.civicpulse.com/api/areas?active=true"

# Get analytics
curl -H "Authorization: Bearer cp_live_abcdefghijklmnopqrstuvwxyz123456" \
  "https://api.civicpulse.com/api/analytics"
```

### JavaScript/TypeScript Example

```typescript
const API_KEY = "cp_live_abcdefghijklmnopqrstuvwxyz123456";
const BASE_URL = "https://api.civicpulse.com/api";

async function fetchReports(filters = {}) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`${BASE_URL}/reports?${params}`, {
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error.message);
  }
  return data.data;
}

// Usage
const { reports, pagination } = await fetchReports({ 
  status: "submitted", 
  limit: 50 
});
```

---

## Production Recommendations

### Rate Limiting

The built-in rate limiter uses in-memory storage (per server instance). For production deployments with multiple instances:

1. **Use Redis** for distributed rate limiting
2. **Or use a gateway** (Cloudflare, AWS API Gateway, Kong) for edge rate limiting
3. **Monitor** rate limit headers to adjust limits

### Security

1. **Rotate API keys** periodically (every 90 days recommended)
2. **Monitor** `lastUsedAt` to detect unused keys
3. **Use HTTPS** only in production
4. **Implement IP allowlisting** at infrastructure level if needed
5. **Log all API access** for audit trails

### Scaling

1. **Enable Firestore indexes** as listed above
2. **Use composite indexes** for multi-field queries
3. **Consider read replicas** for high-read analytics endpoints
4. **Implement caching** (Redis/CDN) for analytics if needed

---

## Support

For API support, integration questions, or commercial licensing:

- **Email:** api@civicpulse.example.com
- **Documentation:** https://docs.civicpulse.example.com
- **Status Page:** https://status.civicpulse.example.com

---

*Last updated: 2024*
*API Version: v1*