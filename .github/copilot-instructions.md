
## Mata - Multi-App Fleet Management System

5 integrated apps with shared Supabase backend:
- **Dashboard** (`src/`) - Main fleet management interface 
- **Workshop Mobile** (`mobile/`) - Workshop operations
- **Driver App** (`drivermobileapp/`) - Field operations (Vite + React)
- **Load Planner** (`loadplanner/`) - Operations planning
- **Monitor** (`monitor/`) - Alerting & analytics

## Key Development Rules
1. Always use `@/` imports
2. Regenerate types after DB changes:
```bash
npx supabase gen types typescript --project-id wxvhkljrbcpcgpgdqhsp > src/integrations/supabase/types.ts
```
3. Include all filter params in query keys
4. Clean up realtime subscriptions
5. Prefix RPC params with `p_`

## Tech Stack
- UI: shadcn/ui + Tailwind
- Backend: Supabase
- State: TanStack Query v5
- Forms: react-hook-form + zod
- GPS: Wialon (Dashboard only)

## Common Pitfalls
- Missing query key params
- Uncleaned realtime subscriptions
- Mixed toast libraries (use `useToast`)
- Incorrect auth implementation in Load Planner

For detailed documentation, check each app's README or contact the team lead.