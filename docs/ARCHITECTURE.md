# 03. System Architecture

## 3.1 High-Level Architecture Diagram

```mermaid
graph TB
  subgraph PL["Presentation Layer"]
    CIT["Citizen Web Client\n(dashboard, report, verify, profile)"]
    AUTH_UI["Auth Pages\n(login, register)"]
    AUTH_MAP["Authority Web Client\n(dashboard, team, issues)"]
    EXEC["Executive Web Client\n(dashboard, issues)"]
  end

  subgraph AL["Application Layer"]
    APP["Next.js App Router\nsrc/app"]
    PROXY["Request Proxy\nsrc/proxy.ts"]
    API["API Route Handlers\nsrc/app/api"]
    SA["Server Actions\nsrc/lib/actions"]
    AUTH["better-auth\nsrc/lib/auth.ts"]
    SESS["Session and RBAC\nsrc/lib/session.ts, safe-action.ts"]
    QRY["Query Layer\nsrc/lib/queries.ts"]
    AI["AI Services\nsrc/lib/ai, gemini.ts"]
    UP["Upload Service\nsrc/app/api/uploads"]
    NOTIF["Notifications\nsonner, src/components/ui"]
  end

  subgraph DL["Data Layer"]
    PG["PostgreSQL\nPrisma Client"]
    FS["Local File Storage\npublic/uploads"]
    CACHE["Cache\nnext/cache, revalidatePath"]
    GEM["Google Gemini API"]
    MB["Mapbox GL JS\nclient-side"]
  end

  CIT --> APP
  AUTH_UI --> APP
  AUTH_MAP --> APP
  EXEC --> APP

  APP --> PROXY
  PROXY --> AUTH
  APP --> SA
  APP --> API
  APP --> QRY

  AUTH_UI --> AUTH
  CIT --> SA
  AUTH_MAP --> SA
  CIT --> API
  AUTH_MAP --> API
  EXEC --> API

  SA --> SESS
  API --> SESS
  SA --> PG
  API --> PG
  QRY --> PG
  AUTH --> PG

  CIT --> UP
  AUTH_MAP --> UP
  UP --> FS
  API --> FS

  SA --> AI
  AI --> GEM

  SA --> NOTIF
  CIT --> NOTIF
  AUTH_MAP --> NOTIF

  QRY --> CACHE
  SA --> CACHE
  API --> CACHE

  CIT --> MB
  AUTH_MAP --> MB
  EXEC --> MB
```

## 3.2 Component Interaction & Data Flow

Citizens submit reports through `createReportAction` (`src/lib/actions/reports.ts`). The server queries open issues in the same municipality, applies a 50 m haversine geospatial match (same category), then falls back to Gemini (`analyzeReport`) for category, priority, duplicate detection, and optional root-cause suggestions. Semantic matches ≥ 0.80 within 200 m attach silently; 0.50–0.79 prompt the citizen via `resolveReportDecisionAction`; otherwise a new `Issue` is created. Duplicate attachments increment `reportCount` and may auto-elevate priority (`computeImpact`). On new-issue creation, `detectCascadeWithAI` links causal upstream issues (Gemini with same-category proximity fallback).

New issues start `SUBMITTED`. Citizens verify via `verifyIssueAction`: municipality-scoped, ward-weighted (1.0 same ward / 0.5 same municipality), with optional geotagged proof (EXIF via `/api/uploads/proof`, 200 m radius, ×1.5 weight). Weighted confirm − dispute ≥ 3.0 moves `SUBMITTED` → `VERIFIED`. `LOCAL_BODY_HEAD` can also manually verify via `updateIssueStatusAction`.

Assignment is hierarchical: section heads or `LOCAL_BODY_HEAD` call `requestAssignmentAction` while the issue stays `VERIFIED`; the requested officer accepts via `respondToAssignmentAction` with a `dueDate`, moving to `ASSIGNED`. Officers progress `ASSIGNED` → `IN_PROGRESS` → `RESOLVED` via `updateIssueStatusAction`, posting `IssueUpdate` entries. Resolution opens a separate `RESOLUTION` verification phase; weighted disputes ≥ 3.0 reopen to `REOPENED`.

AI runs synchronously at report submission and new-issue cascade detection. `analyzeRootCauses` exists but is not wired to any route or action. Nepali/English text is handled by Gemini prompts; there is no separate NLP pipeline.

Auth uses better-auth email/password (`/api/auth/[...all]`), 7-day DB sessions. `src/proxy.ts` gates unauthenticated requests; `requireRole` in layouts and `roleActionClient` on mutations enforce RBAC. Municipality scoping applies to authority roles via `scopeForUser` and API handlers. Executive users have national read access only.

Offline sync: **Not yet implemented**. In-app notifications use Sonner toasts (`src/components/ui/sonner.tsx`); SMS is **not yet implemented**. Server mutations invalidate cached routes via `revalidatePath` (`next/cache`). Attention flags compute on page load (`needsAttention`, `src/lib/queries.ts`), not via background workers.
