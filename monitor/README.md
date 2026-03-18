# MAT Monitor — Satellite Alert & Analytics Dashboard

A dedicated monitoring micro-application that integrates with the main **MAT Fleet Management Dashboard**. It shares the same Supabase backend and authentication, providing a focused real-time interface for alerts, analytics and KPI tracking.

---

## Architecture Overview

```
┌──────────────────────────┐      Supabase Realtime       ┌────────────────────────┐
│   MAT Main Dashboard     │  ←── postgres_changes  ────► │   MAT Monitor          │
│   (src/)                 │                               │   (public/monitor/)    │
│                          │  ←── shared auth session ──► │                        │
│  - Fleet management      │  ←── same DB / RLS       ──► │  - Live alert feed     │
│  - Trip & load ops       │                               │  - Analytics charts    │
│  - Maintenance           │                               │  - Alert rule config   │
└──────────────────────────┘                               └────────────────────────┘
             │                                                         │
             └─────────────────── Supabase ──────────────────────────┘
                              (shared project)
```

Both apps use the **same Supabase project**, the same `sb-mat-auth-token` localStorage key, and the same database tables — so a session from the main dashboard is automatically recognised by the monitor.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Routing | React Router v6 |
| Server state | TanStack Query v5 |
| Realtime | Supabase Realtime (postgres_changes) |
| Charts | Recharts |
| Styling | Tailwind CSS (dark theme) |
| Auth UI | @supabase/auth-ui-react |
| Toasts | Sonner |

---

## Project Structure

```
public/monitor/
├── src/
│   ├── App.tsx                          # Root — QueryClient, AuthProvider, Router
│   ├── main.tsx
│   ├── index.css                        # Tailwind + dark theme CSS variables
│   ├── vite-env.d.ts
│   │
│   ├── types/index.ts                   # Alert, AlertConfig, KPI, Filter types
│   │
│   ├── integrations/supabase/client.ts  # Supabase client (shared session key)
│   ├── contexts/AuthContext.tsx         # Session state
│   │
│   ├── hooks/
│   │   ├── useAlertFilters.ts           # Time range + severity/category/status filters
│   │   ├── useAlerts.ts                 # Paginated fetch, counts, comments, mutations
│   │   ├── useAlertStream.ts            # Supabase Realtime subscription + toast push
│   │   ├── useAlertConfigs.ts           # CRUD for alert rule configurations
│   │   └── useAnalytics.ts             # KPI summary, trend, category, source queries
│   │
│   ├── components/
│   │   ├── Layout.tsx                   # Sidebar nav + realtime badge + user menu
│   │   ├── ProtectedRoute.tsx           # Auth guard
│   │   ├── RealtimeStatusBadge.tsx      # LIVE / Connecting / Offline pill
│   │   ├── alerts/
│   │   │   ├── AlertCard.tsx            # Single alert row with severity, actions
│   │   │   ├── AlertFilterBar.tsx       # Time range + severity + status filters
│   │   │   └── SeverityBadge.tsx        # Colour-coded severity pill
│   │   └── analytics/
│   │       ├── KPIScorecard.tsx         # 4-card KPI row (active/total/resolved/rate)
│   │       ├── AlertTrendChart.tsx      # Area chart — alert volume over time
│   │       ├── AlertCategoryChart.tsx   # Donut chart — alerts by category
│   │       ├── DailyBarChart.tsx        # Stacked bar — last 7 days by severity
│   │       └── AlertsBySourceTable.tsx  # Ranked table of top alert sources
│   │
│   └── pages/
│       ├── AuthPage.tsx                 # Sign-in screen (reuses main app credentials)
│       ├── AlertsPage.tsx               # Live alert feed with infinite scroll
│       ├── AlertDetailPage.tsx          # Full alert detail + comments thread
│       ├── AnalyticsPage.tsx            # Charts dashboard
│       ├── ConfigPage.tsx               # Alert rule CRUD
│       └── NotFoundPage.tsx
```

---

## Database Tables

Apply the migration before running:

```bash
# From repo root
supabase db push
# or apply manually:
psql $DATABASE_URL < supabase/migrations/20260304000000_add_monitor_tables.sql
```

| Table | Purpose |
|---|---|
| `alerts` | All triggered alerts with severity, status lifecycle |
| `alert_configurations` | User-defined alert rules (category, severity, cooldown, channels) |
| `alert_comments` | Comment thread per alert |
| `alert_subscriptions` | Web Push subscription endpoints per user |
| `analytics_events` | Raw event stream for analytics |
| `dashboard_kpi_snapshots` | Pre-aggregated KPI values (hourly/daily/weekly) |
| `monitor_audit_log` | User action audit trail |

Row-Level Security is enabled on all tables. Authenticated users can read all alerts and manage their own configs/subscriptions.

---

## Getting Started

### 1. Environment

```bash
cp .env.example .env
```

Fill in the same values as the main dashboard's `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...   # anon/public key
VITE_VAPID_PUBLIC_KEY=                 # optional — for Web Push
```

### 2. Install & run

```bash
npm install
npm run dev       # dev server on :5174 (or next available port)
npm run build     # production build → dist/
```

### 3. Enable Realtime

In the Supabase dashboard → **Database → Replication**, add these tables to the `supabase_realtime` publication:

- `alerts`
- `alert_comments`
- `dashboard_kpi_snapshots`

Or via SQL:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE alert_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE dashboard_kpi_snapshots;
```

---

## Pages & Features

### Alert Feed (`/alerts`)
- Live-updating list via Supabase Realtime
- Filter by time range (1H / 6H / 24H / 7D / 30D), severity, status, free-text search
- Acknowledge / Resolve actions inline
- Red badge on sidebar for active critical alerts
- Sonner toast popups for incoming critical/high alerts

### Alert Detail (`/alerts/:id`)
- Full metadata panel
- Acknowledge / Resolve buttons
- Comment thread with real-time updates

### Analytics (`/analytics`)
- KPI scorecard: Active, Total, Resolved, Resolution Rate with period-over-period trend
- Area chart: alert volume over time (auto-switches hourly ↔ daily)
- Donut chart: distribution by category
- Stacked bar: last 7 days by severity
- Source league table: ranked by total alerts with severity breakdown

### Alert Rules (`/config`)
- Create / edit / toggle / delete alert configurations
- Set category, severity, cooldown, notification channels (in-app, push, email)
- Rules consumed by the `alert-processor` Supabase Edge Function

---

## Cross-Dashboard Integration

The monitor app shares a session with the main dashboard because both apps use the same Supabase project and the same `storageKey: "sb-mat-auth-token"`. A user signed in on the main dashboard on the same origin will be automatically signed in on the monitor.

For cross-subdomain setups (e.g. `app.example.com` + `monitor.example.com`), implement a short-lived JWT relay:

1. Main dashboard generates a one-time token via `supabase.auth.admin.generateLink()`
2. Redirects to `monitor.example.com/auth?token=…`
3. Monitor calls `supabase.auth.verifyOtp({ token_hash, type })` to establish a session

---

## Deployment

### Vercel (recommended)

```bash
cd public/monitor
vercel --prod
```

Set the same env vars as above in the Vercel project settings.

### Docker

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### As a path on the main app

The `dist/` output can be served under `/monitor/` on the main Vite app by configuring the monitor's `vite.config.ts` with `base: "/monitor/"` and adding a rewrite rule in the main app's `vercel.json`.

---

## Real-time Push Notifications (Web Push)

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Set `VITE_VAPID_PUBLIC_KEY` in `.env`
3. Deploy the `alert-processor` Edge Function (see `supabase/functions/`) which:
   - Listens to new `alerts` inserts via a Database Webhook
   - Queries `alert_subscriptions` for matching users
   - Sends Web Push payloads via the `web-push` npm package

---

## Security

- All data access is protected by Supabase RLS policies
- The anon key is safe to expose client-side (Supabase design)
- Sensitive operations (bulk delete, admin-level RLS bypass) require the `service_role` key which must only be used server-side in Edge Functions
- Audit log records all acknowledge/resolve/comment actions
