# MATA Monorepo Structure & Engineering Handbook

## Overview

The MATA monorepo houses multiple production applications built around a shared Supabase backend. Each application is isolated, sharing only intentionally-managed code or infrastructure. This document outlines architectural conventions, stack details per app, engineering standards, critical caveats, and common sources of error.

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
    - After schema changes, run Supabase type generation for Dashboard:
      ```
      npm run supabase:gen
      ```
    - For other apps, update type files manually or as prescribed by tooling
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

- **Supabase types generation (Dashboard):**
  ```sh
  npm run supabase:gen
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