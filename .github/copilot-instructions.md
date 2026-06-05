# MATA Monorepo Structure & Engineering Handbook

## Overview

The MATA monorepo houses multiple production applications built around a shared Supabase backend. Each application is isolated, sharing only intentionally-managed code or infrastructure. This document outlines architectural conventions, stack details per app, engineering standards, critical caveats, and common sources of error.

---

## App Directory Map

Each app is a standalone Vite project (own `package.json`, `node_modules`, dev port). **Always `cd` into the app directory before running any `npm` command.** The friendly names used throughout this document map to directories as follows:

| Name | Directory | Dev port | Notes / README |
| --- | --- | --- | --- |
| **Dashboard** | `/` (repo root, code in `src/`) | 5173 (Vite default) | Root app, package `vite_react_shadcn_ts` |
| **Load Planner** | `loadplanner/` | 8089 | [README](../loadplanner/README.md); has its own `supabase/` tree |
| **Workshop Mobile** | `mobile/` | 5173 (Vite default) | package `matanuska-workshop` |
| **Driver App** | `drivermobileapp/` | 5175 | [README](../drivermobileapp/README.md), [SOP](../drivermobileapp/DRIVER_APP_SOP.md) |
| **Monitor** | `monitor/` | 6214 | [README](../monitor/README.md) |

---

## Build, Test & Validate

Run from inside the relevant app directory. Not every app defines every script — check its `package.json` first.

| Task | Dashboard (root) | Load Planner | Driver App | Workshop / Monitor |
| --- | --- | --- | --- | --- |
| Dev server | `npm run dev` | `npm run dev` | `npm run dev` | `npm run dev` |
| Build | `npm run build` | `npm run build` | `npm run build` | `npm run build` |
| Lint | `npm run lint` | `npm run lint` | `npm run lint` | `npm run lint` |
| Typecheck | `npm run typecheck` | `tsc --noEmit -p tsconfig.app.json` | `npm run type-check` | `tsc --noEmit` |
| Test | — | `npm run test` (Vitest) | — | — |

- Only **Load Planner** has automated tests (`npm run test`, Vitest). After changing Load Planner code, run them.
- Each app ships an `audit-typescript.sh` helper for a fuller type audit.
- Dashboard build raises the Node heap (`--max-old-space-size=8192`); don't strip that flag.
- After any change, validate with the app's lint + typecheck before considering it done.

---

## Cross-App Integration Map

There are **two primary apps**: **Load Planner** (`loadplanner/`) and the **Main Dashboard** (root `src/`). The Main Dashboard is the hub of a tightly-coupled cluster — it is most closely integrated with three satellite apps that read/write the **same Supabase tables**:

- **Workshop Mobile** (`mobile/`) — workshop/maintenance operations
- **Driver App** (`drivermobileapp/`) — used by drivers in the field
- **Monitor** (`monitor/`) — used for QA, alerting, and reports

> **Golden rule:** When you change the Main Dashboard in a way that touches a **shared contract** — a shared table's schema/columns, a shared RPC, an `investigation_status`/alert field, a Realtime payload shape, or shared Supabase types — you **must update the affected integrated app(s) in the same change**. Never ship a Dashboard schema/contract change that leaves Workshop Mobile, Driver App, or Monitor stale.

### How the integrations work

| Integration | Mechanism | Shared surface | Breaks if… |
| --- | --- | --- | --- |
| **Dashboard ↔ Monitor** (tightest) | Supabase Realtime `postgres_changes` on `trips`, `cost_entries`; shared `investigation_status` field on `cost_entries`/`alerts` | Monitor resolves alerts by writing `investigation_status`; Dashboard reads it on trip detail | Renaming/dropping `cost_entries`, `trips`, or `investigation_status`; changing core `trips` fields |
| **Dashboard ↔ Driver App** | Realtime on `driver_vehicle_assignments`, `loads`, `diesel_records` | Driver writes diesel/expenses/trip updates; Dashboard reads them | Renaming `driver_vehicle_assignments`, dropping `diesel_records.debrief_signed`, changing `loads` shape |
| **Dashboard ↔ Workshop Mobile** | Shared `vehicles`/`drivers` reference data + workshop tables (`job_cards`, `vehicle_faults`, `tyres`) | Workshop reads fleet data, manages maintenance records | Renaming/dropping shared fleet or workshop tables |

### Key facts

- **Auth session sharing:** Only **Monitor** shares a session with the Main Dashboard (both use `storageKey: "sb-mat-auth-token"` on the same origin). Dashboard, Load Planner, Workshop Mobile, and Driver App otherwise maintain isolated auth contexts.
- **Shared tables** Dashboard writes that satellites depend on: `trips`, `cost_entries`, `diesel_records`, `drivers`, `vehicles`, `driver_vehicle_assignments`, `loads`, plus `alerts`/`investigation_status`.
- **Each app keeps its own Supabase types** (`<app>/src/integrations/supabase/types.ts`). After a shared-schema change, **regenerate types for every app that uses the changed table**, not just the Dashboard — stale type files cause silent runtime data bugs.
- **Load Planner** is the other primary app but is largely **decoupled** from the Dashboard cluster (only shares `vehicles`/`drivers`/`loads` reference data and has its own `supabase/` tree). It does not need to move in lockstep with Dashboard UI changes.

---

## Repository Structure

- Organize each app in a top-level directory:
  - Each app:  
    - Contains its own `package.json`, Vite configuration, and all required assets
    - Deploys independently to a designated Vercel target
  - Avoid unintentional cross-app coupling; only use shared packages/libs if explicitly managed.

- Shared infrastructure:
  - All apps authenticate and read/write via the Supabase project `wxvhkljrbcpcgpgdqhsp`
  - App-specific Supabase clients and types live in each app’s code tree (unless a shared contract is strictly enforced)
  - Global migrations:  
      - Located in `supabase/migrations/`
      - For Load Planner–specific schema: `loadplanner/supabase/migrations/`
      - Always evaluate for schema drift or conflicts before running migrations.
  - Supabase Functions:  
      - Place in `supabase/functions/`
  - Google Sheets integrations:  
      - Place in `supabase/google_sheet_functions/`

---

## Environment Variables

- **Each app must define (at minimum) the following:**
  ```env
  VITE_SUPABASE_URL=...
  VITE_SUPABASE_PUBLISHABLE_KEY=... # (or VITE_SUPABASE_ANON_KEY)
  ```
  - Ensure these are set for both build-time and runtime contexts as needed.

---

## Application Architecture, Tech Stack & Conventions

### Dashboard

- **Stack**: React 18, Vite, Tailwind, shadcn/ui, Leaflet, Recharts
- **State/session**: TanStack Query v5, `AuthContext`, `OperationsContext`
- **Integration**: Wialon GPS via `/wialon-api` proxy (only functional in Dashboard)
- **Auth**: Supabase Auth providers only
- **Supabase types**: Regenerate after any schema change (`src/integrations/supabase/types.ts`)
- **PWA**: Always enabled with auto-updates
- **Routing**: Use `lazyWithRetry()` for route error resilience
- **Export**: Support for jsPDF, exceljs, xlsx exports

### Workshop Mobile

- **Stack**: React 18, Vite, Tailwind, shadcn/ui
- **State**: TanStack Query v5, `AuthContext`
- **Features**: QR scanning via `html5-qrcode`, rendering with `react-qr-code`, notifications via `sonner`
- **Supabase types**: `mobile/src/integrations/supabase/`
- **PWA**: Enabled in production only (disabled in dev/Codespaces)
- **Theme**: Yellow base (`#F5B800`)

### Driver App

- **Stack**: React 18, Vite, Tailwind, shadcn/ui
- **State**: Zustand, TanStack Query v5, custom `AuthContext` (handles grace-period token refresh & inactivity timeouts)
- **Animation**: Framer Motion
- **Notifications**: `@radix-ui/react-toast`
- **Supabase**: Separate client & isolated types
- **PWA**: Enabled only in production; blue theme (`#2563EB`)

### Load Planner

- **Stack**: React 18, Vite, Tailwind, shadcn/ui
- **State**: TanStack Query v5, `AuthContext`, `GeofenceMonitorProvider`
- **Mapping & Geofencing**: Leaflet/react-leaflet
- **Routing**: Internal routes guarded with `ProtectedRoute` HOC and `MainLayout`; `/track` and `/portal/:clientId/*` remain unguarded/public
- **Supabase types**: `loadplanner/src/integrations/supabase/`
- **Testing**: Vitest
- **Analytics**: Recharts
- **Performance**: Lazy loading for large dashboard modules

### Monitor

- **Stack**: React 18, Vite, Tailwind, shadcn/ui
- **State/UI mode**: TanStack Query v5, `AuthContext`, `ThemeContext`
- **Alerting**: 8 distinct alert hook types; trip alerts generated automatically every 3 hours; dashboard polling every 30 sec
- **Sync**: `investigation_status` synced in real time with Dashboard
- **Auth/routing**: Supabase Auth + `ProtectedRoute` HOC
- **PWA**: Always-on; labeled "MATA Fleet Command Center", theme dark slate (`#1e293b`)

---

## Engineering Standards & Key Policies

1. **Module imports:** Always use `@/` for all code/images; configure all tooling (TS, Vite, Jest) for alias resolution
2. **Supabase types:**  
    - After schema changes, regenerate the typed client (project id `wxvhkljrbcpcgpgdqhsp`):
      ```sh
      npx supabase gen types typescript --project-id wxvhkljrbcpcgpgdqhsp > src/integrations/supabase/types.ts
      ```
    - For other apps, point the output at that app's `src/integrations/supabase/types.ts`
3. **TanStack Query:**  
    - Always include *all* filter params in query keys to avoid stale data and bugs in state sync/UI
4. **Subscriptions:**  
    - Any effect (`useEffect`) that opens a real-time (esp. Supabase) subscription must always register a cleanup to prevent leaks and event noise
5. **Remote Procedure Calls (RPC):**  
    - All arguments to RPCs must be prefixed `p_` for clarity
6. **Driver-vehicle assignments:**  
    - Use `driver_vehicle_assignments.driver_id` as the *Supabase Auth UUID* (`auth.users(id)`)
    - Use `drivers.id` only for document lookup
7. **Notification provider:**  
    - Use `sonner` in all apps *except* Driver App (uses `@radix-ui/react-toast`)
8. **PWA caveat:**  
    - Do *not* enable service workers in Workshop Mobile or Driver App during development (Codespaces produces issues)

---

## Common Pitfalls & Edge Cases

- **Query keys:**  
    - Omitting a filter param in a TanStack Query key will cause data to go stale or become out-of-sync. Double-check all usages.
- **Orphaned subscriptions:**  
    - Failing to `unsubscribe`/cleanup on effect teardown produces duplicate events, memory waste, and cross-user event confusion.
- **Notifications:**  
    - Using the wrong toast provider for a given app will break or hide UI feedback.
- **Driver App state:**  
    - TanStack Query alone is insufficient; always use Zustand for global state.
- **Route guards in Load Planner:**  
    - Never apply `ProtectedRoute` logic on `/track` and `/portal`—these are intentionally for non-authenticated users/clients.
- **Transient null auth in Driver App:**  
    - `null` state after refresh is not a logout. Implement a grace period for JWT refreshes.
- **Wialon API integration:**  
    - The `/wialon-api` GPS proxy is only available to Dashboard; do not reference it elsewhere.
- **Supabase type drift:**  
    - Each app maintains its own Supabase client and types—if backend schemas change, stale type files can cause runtime bugs or silent data errors.
- **Production-only PWA:**  
    - PWA must be enabled only in production for Workshop Mobile and Driver App to avoid Codespaces dev issues.

---

## Example CLI and Config Snippets

- **Supabase types generation (per app):**
  ```sh
  npx supabase gen types typescript --project-id wxvhkljrbcpcgpgdqhsp > src/integrations/supabase/types.ts
  ```
- **Key environment variables (example .env):**
  ```env
  VITE_SUPABASE_URL=https://xyz.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1...
  ```

---

> **Note:** This document serves as the canonical single source of truth for MATA monorepo engineering. Revisit and update after any major workflow, schema, or stack change. 

---

**End of Document**