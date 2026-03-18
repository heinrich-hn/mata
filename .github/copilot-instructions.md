# Car Craft Co — Fleet Management System

> AI agent instructions for the **Matanuska** monorepo. Five separate apps share one Supabase backend.

---

## 1. Apps at a Glance

| App | Root | Stack | Dev command | Port | Purpose |
|-----|------|-------|-------------|------|---------|
| **Dashboard** | `src/` | Vite + React 18 + TS | `npm run dev` | default | Back-office (fleet, workshop, ops) |
| **Workshop Mobile** | `mobile/` | Vite + React + TS | `cd mobile && npm run dev` | default | Workshop staff (inspections, tyres, job cards) |
| **Driver App** | `mobile-app-nextjs/` | Next.js App Router | `cd mobile-app-nextjs && npm run dev` | 3001 | Drivers in the field (trips, diesel, expenses) |
| **Load Planner** | `loadplanner/` | Vite + React + TS + Vitest | `cd loadplanner && npm run dev` | 8089 | Operations planning (loads, tracking, clients) |
| **Monitor** | `monitor/` | Vite + React + TS | `cd monitor && npm run dev` | 5174 | Alerting & analytics dashboard |

**Only `loadplanner/` has a test runner** (`npm run test` / `npm run test:watch` via Vitest).  
Dashboard typecheck: `npm run typecheck`. Driver App typecheck: `cd mobile-app-nextjs && npm run type-check`.

---

## 2. Core Stack (all apps)

- **UI**: shadcn/ui + Tailwind CSS + Lucide icons
- **Backend**: Supabase (PostgreSQL + RLS + Realtime)
- **State**: TanStack Query v5 + React Context
- **Forms**: react-hook-form + zod
- **GPS/Telematics**: Wialon platform (Dashboard only — hooks in `src/hooks/useWialon*`)

---

## 3. Critical Rules

### Imports — always `@/`, never relative
```typescript
// ✅ correct
import { useVehicles } from "@/hooks/useVehicles";
// ❌ wrong
import { useVehicles } from "../../hooks/useVehicles";
```

### UI components — never edit `components/ui/`
Regenerate with the shadcn CLI instead:
```bash
npx shadcn-ui@latest add <component>
```

### After ANY database migration — regenerate types in ALL apps
```bash
# Dashboard
npx supabase gen types typescript --project-id wxvhkljrbcpcgpgdqhsp > src/integrations/supabase/types.ts

# Workshop Mobile
npx supabase gen types typescript --project-id wxvhkljrbcpcgpgdqhsp > mobile/src/integrations/supabase/types.ts

# Driver App
npx supabase gen types typescript --project-id wxvhkljrbcpcgpgdqhsp > mobile-app-nextjs/src/types/database.ts
```
> `loadplanner/` and `monitor/` have their own Supabase configs — check their `supabase/` dirs.

### Query keys — include ALL filter params
```typescript
queryKey: ["trips", { driverId, dateRange, status }]  // ✅
queryKey: ["trips"]                                    // ❌ stale cache bugs
```

### Real-time — always clean up
```typescript
useEffect(() => {
  const channel = supabase.channel("changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "trips" },
      () => queryClient.invalidateQueries({ queryKey: ["trips"] }))
    .subscribe();
  return () => { supabase.removeChannel(channel); };  // ← required
}, []);
```

### RPC params — prefix with `p_`
```typescript
supabase.rpc("reserve_inventory", { p_inventory_id: id, p_quantity: qty })
```

---

## 4. Layout Components

| App | Component | Import |
|-----|-----------|--------|
| Dashboard | `Layout` | `@/components/Layout` |
| Workshop Mobile | `WorkshopMobileLayout` | `@/components/mobile/WorkshopMobileLayout` |
| Driver App | `MobileShell` | `@/components/layout/mobile-shell` |
| Load Planner | `MainLayout` | wraps all protected routes in `App.tsx` |
| Monitor | `Layout` | local `@/components/Layout` |

---

## 5. Data Fetching Patterns

### Query
```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const { data = [], isLoading } = useQuery({
  queryKey: ["vehicles", filters],
  queryFn: async () => {
    const { data, error } = await supabase.from("vehicles").select("*").eq("active", true);
    if (error) throw error;
    return data;
  },
});
```

### Mutation
```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const mutation = useMutation({
  mutationFn: async (payload) => {
    const { data, error } = await supabase.from("table").insert([payload]).select().single();
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["table"] });
    toast({ title: "Success" });
  },
  onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
});
```

### Toast — prefer shadcn `useToast`
```typescript
import { useToast } from "@/hooks/use-toast";
const { toast } = useToast();
// Sonner (`import { toast } from "sonner"`) exists in some legacy components — don't mix
```

### Styling
```typescript
import { cn } from "@/lib/utils";
<div className={cn("base-class", condition && "conditional-class")} />
```

---

## 6. Directory Structure

### Dashboard (`src/`)
```
src/
├── components/
│   ├── ui/               # shadcn primitives — DON'T EDIT
│   ├── dialogs/          # Modal dialogs
│   ├── [feature]/        # tyres/, inspections/, analytics/, map/, wialon/, …
│   └── [Feature].tsx     # Top-level feature components
├── pages/                # 30 route pages — each wrapped in <Layout>
├── hooks/                # 50+ hooks: useVehicles, useLoads, useWialon*, useRealtime*…
├── contexts/             # AuthContext (session), others
├── integrations/supabase/# client.ts + types.ts (regenerate after migrations)
├── constants/            # fleetTyreConfig.ts, static configs
├── types/                # fleet.ts, tyre.ts, operations.ts, wialon-global.d.ts…
├── utils/                # helpers
└── lib/                  # shared utilities (cn, etc.)
```

### Workshop Mobile (`mobile/src/`)
```
mobile/src/
├── components/
│   ├── ui/               # DON'T EDIT
│   ├── dialogs/
│   └── mobile/           # WorkshopMobileLayout
├── pages/                # Auth, Inspections, TyreManagement, JobCards
├── hooks/
├── contexts/
└── integrations/supabase/
```

### Driver App (`mobile-app-nextjs/src/`)
```
mobile-app-nextjs/src/
├── app/                  # Next.js App Router
│   ├── diesel/ expenses/ login/ profile/ trip/
├── components/
│   ├── layout/           # MobileShell
│   └── ui/               # DON'T EDIT
├── lib/supabase/         # client.ts, middleware.ts, server.ts (@supabase/ssr)
└── types/                # database.ts (regenerate after migrations)
```

### Load Planner (`loadplanner/src/`)
```
loadplanner/src/
├── components/           # feature components + ui/ (DON'T EDIT)
├── pages/                # 16 pages: loads, fleet, drivers, clients, tracking, reports…
├── hooks/                # useAuth (local, not context), domain hooks
└── integrations/supabase/
```
> Load Planner differences: auth via `useAuth` hook (not `AuthContext`); `GeofenceMonitorProvider` wraps app; heavy pages use `React.lazy`; QueryClient has `staleTime: 30s`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`.

### Monitor (`monitor/src/`)
```
monitor/src/
├── components/           # Layout, alert cards, charts
├── pages/                # Alerts, Analytics, Config, DieselAlerts, TripAlerts, Faults, Documents
├── hooks/                # useDieselAlerts, useFaultAlerts, useMaintenanceAlerts, useTripAlerts…
└── contexts/             # ThemeProvider (dark/light mode)
```

---

## 7. Routing

### Dashboard — React Router v6
- All routes except `/auth` require `<ProtectedRoute>`
- Merged/redirected: `/faults`→`/inspections`, `/inventory`→`/procurement`, `/reports`→`/trip-management`, `/gps-tracking`→`/unified-map`, `/wialon-reports`→`/unified-map`
- Future flags enabled: `v7_startTransition`, `v7_relativeSplatPath`

### Load Planner — React Router v6
- Public routes: `/login`, `/track` (shareable tracking), `/portal/:clientId/*` (client portal)
- All others protected via `MainLayout`

---

## 8. Auth

### Dashboard / Workshop / Monitor
- `src/contexts/AuthContext.tsx` — Supabase `onAuthStateChange` + `getSession()`
- Exposes: `user`, `session`, `loading`, `userName`
- `userName`: `user_metadata.name` → email prefix → `'User'`
- Role/access control: `useUserAccess` hook + `users`/`roles`/`access_areas` tables (not in context)

### Driver App
- Supabase SSR via `@supabase/ssr` — `lib/supabase/client.ts`, `server.ts`, `middleware.ts`
- Always add `"use client"` directive to Driver App page components

### Load Planner
- Local `useAuth` hook (`loadplanner/src/hooks/useAuth`) — not the shared AuthContext

---

## 9. Key Domain Areas & Tables

| Domain | Key Tables |
|--------|-----------|
| Vehicles | `vehicles`, `fleet_vehicle`, `wialon_vehicles` |
| Tyres | `tyres`, `tyre_inventory`, `tyre_positions`, `tyre_inspections`, `tyre_lifecycle_events` |
| Inspections | `vehicle_inspections`, `inspection_items`, `inspection_faults`, `vehicle_faults` |
| Job Cards | `job_cards`, `tasks`, `labor_entries`, `work_orders` |
| Trips & Loads | `trips`, `loads`, `diesel_records`, `cost_entries` |
| Tracking | `delivery_tracking`, `geofences`, `geofence_events`, `driver_behavior` |
| Fuel | `fuel_bunkers`, `fuel_transactions`, `diesel_suppliers` |
| Procurement | `inventory`, `parts_requests`, `inventory_transactions`, `vendors` |
| Drivers | `driver_vehicle_assignments`, `driver_documents`, `driver_candidates` |
| Clients | `clients`, `invoices`, `car_reports` |
| Maintenance | `maintenance_schedules`, `maintenance_alerts` |
| Incidents | `incidents`, `incident_documents`, `incident_timeline` |
| Alerting (Monitor) | `alert_configurations`, `alerts`, `analytics_events`, `dashboard_kpi_snapshots`, `monitor_audit_log` |

---

## 10. Inventory RPC Workflow

RPC functions are prefixed `p_`:
- `check_inventory_availability` → `reserve_inventory` → (approve) → `deduct_inventory`
- `release_inventory_reservation` (on cancel/reject)

Key components: `InventorySearchDialog.tsx`, `EnhancedRequestPartsDialog.tsx`

---

## 11. QR Code System (Dashboard)

| Type | Encodes | Component |
|------|---------|-----------|
| Vehicle | Fleet + registration | `TyreQRCodeSystem.tsx` |
| Tyre | TIN | `PositionQRScanner.tsx` |
| Position | Vehicle + position | `PositionQRScanner.tsx` |

---

## 12. Wialon GPS Integration (Dashboard only)

- Hooks: `useWialonVehicles`, `useWialonSensors`, `useWialonReports`, `useWialonLoadIntegration`
- Global types: `src/types/wialon-global.d.ts`
- Map page: `src/pages/UnifiedMapPage.tsx` + `src/components/map/` + `src/components/wialon/`

---

## 13. Migration Workflow

1. Create SQL file in `supabase/migrations/` (timestamp prefix)
2. Apply via Supabase dashboard or CLI
3. Regenerate types in all affected apps (see §3)
4. Update TypeScript interfaces in `src/types/`
5. Test RLS policies — silent failures are common if policies don't match auth state

---

## 14. Common Pitfalls

1. **Relative imports** — always use `@/`
2. **Editing `components/ui/`** — use shadcn CLI instead
3. **Missing query key params** — causes stale cache bugs
4. **RLS silent failures** — queries return empty instead of error when policy doesn't match
5. **Forgetting `removeChannel()`** — memory leak in real-time subscriptions
6. **Mixing toast libraries** — use `useToast` from `@/hooks/use-toast`; avoid mixing with Sonner
7. **Driver App missing `"use client"`** — required for all interactive Next.js page components
8. **Load Planner auth** — uses local `useAuth` hook, not `AuthContext`
9. **Type regeneration** — must run after every migration in ALL apps
10. **RPC param prefix** — always `p_` (e.g., `p_inventory_id`, `p_quantity`)

---

## 15. Page Templates

### Dashboard page
```typescript
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";

export default function FeaturePage() {
  const { toast } = useToast();
  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Feature</h1>
      </div>
    </Layout>
  );
}
```

### Workshop Mobile page
```typescript
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WorkshopMobileLayout } from "@/components/mobile/WorkshopMobileLayout";

export default function FeaturePage() {
  const { toast } = useToast();
  return (
    <WorkshopMobileLayout>
      <div className="p-4">
        <h1 className="text-2xl font-bold">Feature</h1>
      </div>
    </WorkshopMobileLayout>
  );
}
```

### Driver App page
```typescript
"use client";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { MobileShell } from "@/components/layout/mobile-shell";

export default function FeaturePage() {
  const { toast } = useToast();
  return (
    <MobileShell>
      <div className="p-4">
        <h1 className="text-2xl font-bold">Feature</h1>
      </div>
    </MobileShell>
  );
}
```

### Load Planner page (lazy-loaded)
```typescript
// In App.tsx — wrap heavy pages:
const FeaturePage = React.lazy(() => import("@/pages/FeaturePage"));
// <Suspense fallback={<div>Loading…</div>}><FeaturePage /></Suspense>

// FeaturePage.tsx
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
// No layout wrapper needed — MainLayout wraps all protected routes in App.tsx

export default function FeaturePage() {
  const { toast } = useToast();
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Feature</h1>
    </div>
  );
}
```
