
## Mata - Multi-App Fleet Management System

5 integrated apps in a single monorepo with shared Supabase backend. Each app has its own `package.json`, Vite config, and Vercel deployment.

### Apps

| App | Directory | Port | Purpose |
|-----|-----------|------|---------|
| **Dashboard** | `src/` (root) | 8080 | Main fleet management — vehicles, drivers, inspections, trips, tyres, GPS, procurement, analytics |
| **Workshop Mobile** | `mobile/` | 5174 | Mobile-first workshop inspections, QR scanning, tyre checks |
| **Driver App** | `drivermobileapp/` | 5175 | Driver field ops — trip tracking, diesel logging, expenses, document uploads, profile |
| **Load Planner** | `loadplanner/` | 8089 | Operations planning — load management, calendar, delivery tracking, customer portals, geofencing |
| **Monitor** | `monitor/` | 6214 | Alerting & analytics — diesel, driver behavior, document expiry, faults, trip cost alerts |

### Shared Infrastructure
- **Backend**: Supabase (project ID: `wxvhkljrbcpcgpgdqhsp`)
- **Migrations**: `supabase/migrations/` (root) + `loadplanner/supabase/migrations/`
- **Edge Functions**: `supabase/functions/`
- **Google Sheets Integration**: `supabase/google_sheet_functions/`
- **Env Vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)

## Per-App Tech Details

### Dashboard (`src/`)
- React 18 + Vite + shadcn/ui + Tailwind
- State: TanStack Query v5 + AuthContext + OperationsContext
- Maps: Leaflet + **Wialon GPS** (proxied via `/wialon-api`)
- Auth: Supabase Auth (AuthProvider), `@supabase/auth-ui-react`
- Supabase types: `src/integrations/supabase/types.ts`
- PWA: Always on, auto-update
- Lazy routes with `lazyWithRetry()` chunk recovery
- Data export: jsPDF, exceljs, xlsx
- Charts: Recharts

### Workshop Mobile (`mobile/`)
- React 18 + Vite + shadcn/ui + Tailwind
- State: TanStack Query v5 + AuthContext
- QR scanning: `html5-qrcode`, `react-qr-code`
- Toast: sonner
- Supabase types: `mobile/src/integrations/supabase/`
- PWA: Production only (disabled in dev for Codespaces)
- Theme: Yellow (`#F5B800`)

### Driver App (`drivermobileapp/`)
- React 18 + Vite + shadcn/ui + Tailwind
- State: **Zustand** + TanStack Query v5 + custom AuthContext
- Auth: Custom grace-period logic (1.5s delay before redirect during token refresh) + inactivity timeout
- Animations: Framer Motion
- Toast: `@radix-ui/react-toast`
- No shared types file — separate Supabase client
- PWA: Production only
- Theme: Blue (`#2563EB`)

### Load Planner (`loadplanner/`)
- React 18 + Vite + shadcn/ui + Tailwind
- State: TanStack Query v5 + AuthContext + GeofenceMonitorProvider
- Maps: Leaflet + react-leaflet + geofence monitoring
- Testing: **Vitest** (`loadplanner/vitest.config.ts`)
- Auth: ProtectedRoute HOC + MainLayout wrapper
- Public routes: `/track` (shareable tracking link), `/portal/:clientId/*` (client dashboard)
- Supabase types: `loadplanner/src/integrations/supabase/`
- Lazy routes: CalendarPage, DeliveriesDashboardPage, LiveTrackingPage, ReportsPage
- Charts: Recharts

### Monitor (`monitor/`)
- React 18 + Vite + shadcn/ui + Tailwind
- State: TanStack Query v5 + AuthContext + ThemeContext (dark/light toggle)
- 8 alert hooks: diesel, driver behavior, driver documents, faults, incidents, maintenance, trips, vehicle documents
- Trip alert cycle: auto-generates every 3 hours, 30s refetch for dashboard
- Realtime sync: investigation_status changes sync back to Dashboard
- Auth: Supabase Auth + ProtectedRoute HOC
- PWA: Always on, "MATA Fleet Command Center"
- Theme: Dark slate (`#1e293b`)

## Key Development Rules

1. **Always use `@/` imports** in all apps
2. **Regenerate types after DB changes** (Dashboard):
   ```bash
   npx supabase gen types typescript --project-id wxvhkljrbcpcgpgdqhsp > src/integrations/supabase/types.ts
   ```
   Other apps with separate types files need manual updates.
3. **Include all filter params in query keys** (TanStack Query)
4. **Clean up realtime subscriptions** in useEffect return
5. **Prefix RPC params with `p_`**
6. **driver_vehicle_assignments.driver_id** references `auth.users(id)`, NOT `drivers.id`. Use `user.id` (Auth UUID) for assignment queries, `drivers.id` for document lookups.
7. **Toast library**: Use `sonner` in all apps except Driver App (uses `@radix-ui/react-toast`)
8. **PWA in dev**: Workshop Mobile and Driver App disable PWA in dev (Codespaces conflict)

## Common Pitfalls

- Missing query key params → stale cache
- Uncleaned realtime subscriptions → memory leaks
- Mixed toast libraries (check which app you're in)
- Driver App uses Zustand — don't assume TanStack Query alone for state
- Load Planner has public routes (`/track`, `/portal`) — don't wrap these in ProtectedRoute
- Driver App auth has grace-period logic — token refresh nulls are transient, not logouts
- Dashboard Wialon proxy only works in Dashboard (`/wialon-api`)
- Each app has its own Supabase client instance — types may drift between apps