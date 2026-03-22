---
name: api-design
description: REST API design patterns for the Kevv marketing-app ↔ listing-data-service boundary. Use when designing, reviewing, or implementing API endpoints.
---

# API Design Patterns — Kevv Service Boundary

Standards for the REST API contract between `marketing-app` (consumer) and `listing-data-service` (provider), and for marketing-app's own public/internal APIs.

## When to Activate

- Designing new API endpoints
- Creating the listing-data API client
- Reviewing existing tRPC → REST migration
- Building webhook receivers (listing events)
- Implementing public share/embed endpoints

## URL Structure

```
# Resources: plural, lowercase, kebab-case, no verbs
GET    /api/v1/listings
GET    /api/v1/listings/:listingKey
POST   /api/v1/listings/search
GET    /api/v1/listings/:listingKey/media

# Sub-resources for relationships
GET    /api/v1/campaigns/:id/creatives
GET    /api/v1/shares/:token/feedback

# Actions (use verbs sparingly, only for non-CRUD)
POST   /api/v1/campaigns/:id/publish
POST   /api/v1/campaigns/:id/pause
POST   /api/v1/vector/search
```

## Response Format

### Success (single resource)
```json
{
  "data": {
    "listingKey": "abc-123",
    "address": "123 Main St, Irvine, CA 92618",
    "listPrice": "1200000",
    "source": "MLSGrid",
    "freshness": "2026-03-11T10:30:00Z"
  }
}
```

### Success (collection with pagination)
```json
{
  "data": [...],
  "meta": {
    "total": 142,
    "page": 1,
    "perPage": 20,
    "totalPages": 8
  },
  "links": {
    "self": "/api/v1/listings?page=1&perPage=20",
    "next": "/api/v1/listings?page=2&perPage=20"
  }
}
```

### Error
```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [
      { "field": "listingKey", "message": "Required", "code": "required" }
    ]
  }
}
```

## HTTP Status Codes

```
# Success
200 OK              — GET, PUT, PATCH with body
201 Created         — POST (include Location header)
204 No Content      — DELETE

# Client Errors
400 Bad Request     — Validation failure
401 Unauthorized    — Missing/invalid API key or token
403 Forbidden       — Authenticated but not authorized
404 Not Found       — Resource doesn't exist
409 Conflict        — Duplicate (e.g., campaign already published)
422 Unprocessable   — Valid JSON but semantically wrong
429 Too Many Reqs   — Rate limit hit

# Server Errors
500 Internal Error  — Never expose stack traces
502 Bad Gateway     — listing-data-service unreachable
503 Unavailable     — Temporary overload, include Retry-After
```

## Listing-Data Service Contract

5 endpoints the marketing-app consumes:

```
GET  /api/v1/listings/:mls              → single listing by MLS ID
GET  /api/v1/listings/by-key/:key       → single listing by listingKey
GET  /api/v1/listings/search?...        → filtered search (status, city, price, type)
POST /api/v1/vector/search              → semantic search with embedding
GET  /api/v1/system/sync-status         → sync health check
```

Every response MUST include:
```typescript
interface ListingResponse {
  data: Property;
  source: "MLSGrid" | "manual";
  fallbackUsed: boolean;
  freshness: string;          // ISO timestamp of last sync
  media: MediaItem[];
  imageUrls: string[];        // Pre-resolved proxy URLs
}
```

## Authentication

```
# marketing-app → listing-data-service (service-to-service)
GET /api/v1/listings/123
Authorization: Bearer bbo_sk_xxxxx
X-Company-Id: 42

# Public endpoints (share pages, no auth)
GET /api/v1/shares/:token    → no auth required

# Agent-facing endpoints (OAuth)
POST /api/v1/campaigns
Authorization: Bearer <jwt_token>
```

## Pagination Rules

| Endpoint Type | Pagination | Reason |
|---|---|---|
| Listing search | Cursor-based | Large dataset, infinite scroll |
| Campaign list | Offset-based | Agent dashboard, page numbers |
| Analytics events | Cursor-based | Time-series, append-only |
| Share feedback | Offset-based | Small dataset per session |

## Webhook Contract (listing-data → marketing-app)

```
POST /api/v1/webhooks/listing-event
Content-Type: application/json
X-Webhook-Secret: <shared_secret>

{
  "event": "listing.new" | "listing.updated" | "listing.sold" | "listing.expired",
  "listingKey": "abc-123",
  "mls": "CRMLS",
  "timestamp": "2026-03-11T10:30:00Z",
  "changes": ["price", "status"]
}
```

## Checklist

Before shipping any endpoint:
- [ ] URL follows naming conventions (plural, kebab-case)
- [ ] Correct HTTP method (GET for reads, POST for creates/actions)
- [ ] Semantic status codes (not 200 for everything)
- [ ] Input validated with Zod schema
- [ ] Error response follows standard format
- [ ] Pagination for list endpoints
- [ ] Auth required (or explicitly public)
- [ ] Rate limiting configured
- [ ] No internal details leaked (SQL errors, stack traces)
- [ ] Consistent naming with existing endpoints
