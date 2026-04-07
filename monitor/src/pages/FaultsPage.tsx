import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useOverdueMaintenance } from '@/hooks/useOverdueMaintenance';
import { useFleetBreakdowns, type FleetBreakdown } from '@/hooks/useFleetBreakdowns';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CalendarDays, ChevronDown, Gauge, MapPin, Timer, Truck, Wrench } from 'lucide-react';
import { useState } from 'react';
import { ExportMenu } from '@/components/ExportMenu';
import { exportFaults, exportMaintenance, exportBreakdowns } from '@/lib/monitorExport';
import { cn } from '@/lib/utils';

// Types for combined display
interface VehicleFault {
  id: string;
  fault_number: string;
  fault_description: string;
  reported_by: string;
  reported_date: string;
  resolved_date?: string | null;
  resolution_notes?: string | null;
  type: 'fault';
  vehicles?: {
    fleet_number: string | null;
    registration_number: string;
    make: string;
    model: string;
  } | null;
}

interface MaintenanceOverdue {
  id: string;
  title: string;
  description?: string | null;
  due_date: string;
  interval_km?: number | null;
  last_odometer?: number | null;
  current_odometer?: number | null;
  type: 'maintenance';
  vehicle_id?: string | null;
  assigned_to?: string | null;
  is_reefer?: boolean;
  overdue_type?: 'date' | 'km' | 'hours';
  overdue_amount?: number;
  vehicles?: {
    fleet_number: string | null;
    registration_number: string;
    make: string;
    model: string;
  } | null;
}

type TabValue = 'faults' | 'maintenance' | 'breakdowns';

export default function FaultsPage() {
  const [activeTab, setActiveTab] = useState<TabValue>('faults');

  // Fetch vehicle faults
  const { data: faults = [], isLoading: faultsLoading } = useQuery({
    queryKey: ['faults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_faults')
        .select(`
          *,
          vehicles (
            fleet_number,
            registration_number,
            make,
            model
          )
        `)
        .order('reported_date', { ascending: false });

      if (error) throw error;
      return (data || []).map(f => ({ ...f, type: 'fault' as const }));
    },
  });

  // Fetch ALL overdue maintenance — date, km, AND reefer hours
  const { data: overdueRaw = [], isLoading: maintenanceLoading } = useOverdueMaintenance();

  // Fetch fleet breakdowns
  const { data: breakdowns = [], isLoading: breakdownsLoading } = useFleetBreakdowns();

  const maintenance: MaintenanceOverdue[] = overdueRaw.map(item => ({
    id: item.id,
    title: item.title,
    description: item.description,
    due_date: item.due_date,
    interval_km: item.interval_km,
    last_odometer: item.last_odometer,
    current_odometer: item.current_odometer,
    vehicle_id: item.vehicle_id,
    assigned_to: item.assigned_to,
    type: 'maintenance' as const,
    vehicles: item.vehicles ?? null,
    is_reefer: item.is_reefer,
    overdue_type: item.overdue_type,
    overdue_amount: item.overdue_amount,
  }));

  const isLoading = faultsLoading || maintenanceLoading || breakdownsLoading;

  const getDaysOverdue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const stats = {
    total: faults.length + maintenance.length + breakdowns.length,
    faults: faults.length,
    maintenance: maintenance.length,
    breakdowns: breakdowns.length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading faults & maintenance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="monitor-page">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Faults & Maintenance</h1>
        <p className="text-sm text-slate-500 mt-1">Vehicle issues, overdue maintenance, and breakdowns</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200/60 bg-gradient-to-br from-blue-50/40 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Issues</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.total}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100">
                <Wrench className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200/60 bg-gradient-to-br from-rose-50/40 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Active Faults</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.faults}</p>
              </div>
              <div className="p-2 rounded-lg bg-rose-100">
                <Wrench className="h-5 w-5 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/40 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Maintenance Overdue</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.maintenance}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-100">
                <CalendarDays className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50/40 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Breakdowns</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.breakdowns}</p>
              </div>
              <div className="p-2 rounded-lg bg-violet-100">
                <AlertTriangle className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
          <div className="flex items-center justify-between">
            <TabsList className="w-auto bg-slate-100 border border-slate-200 p-0.5">
              <TabsTrigger value="faults" className="flex-none text-xs border-b-2 border-transparent data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 data-[state=active]:border-rose-500">
                Faults ({stats.faults})
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="flex-none text-xs border-b-2 border-transparent data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:border-amber-500">
                Maintenance ({stats.maintenance})
              </TabsTrigger>
              <TabsTrigger value="breakdowns" className="flex-none text-xs border-b-2 border-transparent data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:border-violet-500">
                Breakdowns ({stats.breakdowns})
              </TabsTrigger>
            </TabsList>
            <ExportMenu
              disabled={
                (activeTab === 'faults' && faults.length === 0) ||
                (activeTab === 'maintenance' && maintenance.length === 0) ||
                (activeTab === 'breakdowns' && breakdowns.length === 0)
              }
              onExport={(target) => {
                if (activeTab === 'faults') exportFaults(faults, target);
                else if (activeTab === 'maintenance') exportMaintenance(maintenance, target);
                else exportBreakdowns(breakdowns, target);
              }}
            />
          </div>

          <TabsContent value="faults" className="mt-4">
            {renderFaultsList(faults)}
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4">
            {renderMaintenanceList(maintenance, getDaysOverdue)}
          </TabsContent>

          <TabsContent value="breakdowns" className="mt-4">
            {renderBreakdownsList(breakdowns)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Collapsible vehicle group ──────────────────────────────────────────────

function VehicleGroup({
  fleetNumber,
  vehicleInfo,
  count,
  accentColor,
  children,
}: {
  fleetNumber: string;
  vehicleInfo: string;
  count: number;
  accentColor: 'rose' | 'amber' | 'violet';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(count === 1);

  const colors = {
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', icon: 'text-rose-500', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-700', icon: 'text-violet-500', badge: 'bg-violet-100 text-violet-700 border-violet-200' },
  }[accentColor];

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
          open ? colors.bg : 'hover:bg-slate-50'
        )}
      >
        <div className={cn('p-1.5 rounded-md', colors.bg)}>
          <Truck className={cn('h-4 w-4', colors.icon)} />
        </div>
        <span className="font-semibold text-[0.8125rem] text-slate-900">{fleetNumber}</span>
        {vehicleInfo && (
          <span className="text-xs text-slate-400">{vehicleInfo}</span>
        )}
        <Badge className={cn('ml-auto text-[0.6875rem]', colors.badge)}>
          {count} {count === 1 ? 'item' : 'items'}
        </Badge>
        <ChevronDown className={cn(
          'h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0',
          open && 'rotate-180'
        )} />
      </button>

      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {children}
        </div>
      )}
    </Card>
  );
}

// ── Grouping helper ───────────────────────────────────────────────────────

function groupByFleetNumber<T>(items: T[], getFleet: (item: T) => string, getVehicleInfo: (item: T) => string) {
  const map = new Map<string, { vehicleInfo: string; items: T[] }>();
  for (const item of items) {
    const key = getFleet(item);
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(key, { vehicleInfo: getVehicleInfo(item), items: [item] });
    }
  }
  return Array.from(map.entries());
}

// ── Entry card (consistent across all tabs) ───────────────────────────────

function EntryRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 hover:bg-slate-50/70 transition-colors">
      {children}
    </div>
  );
}

// ── Faults ────────────────────────────────────────────────────────────────

function renderFaultsList(issues: VehicleFault[]) {
  if (!issues.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-[0.8125rem] text-slate-400">No active faults found.</p>
        </CardContent>
      </Card>
    );
  }

  const groups = groupByFleetNumber(
    issues,
    i => i.vehicles?.fleet_number || 'N/A',
    i => i.vehicles ? `${i.vehicles.registration_number} · ${i.vehicles.make} ${i.vehicles.model}` : '',
  );

  return (
    <div className="space-y-3">
      {groups.map(([fleet, { vehicleInfo, items }]) => (
        <VehicleGroup key={fleet} fleetNumber={fleet} vehicleInfo={vehicleInfo} count={items.length} accentColor="rose">
          {items.map(issue => (
            <EntryRow key={issue.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Wrench className="h-3 w-3 text-slate-400 flex-shrink-0" />
                    <span className="font-mono text-xs font-medium text-slate-500">{issue.fault_number}</span>
                  </div>
                  <p className="text-[0.8125rem] text-slate-700">{issue.fault_description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">{new Date(issue.reported_date).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-400 mt-0.5">by {issue.reported_by}</p>
                </div>
              </div>
            </EntryRow>
          ))}
        </VehicleGroup>
      ))}
    </div>
  );
}

// ── Maintenance ───────────────────────────────────────────────────────────

function renderMaintenanceList(
  issues: MaintenanceOverdue[],
  getDaysOverdue: (dueDate: string) => number
) {
  if (!issues.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-[0.8125rem] text-slate-400">No overdue maintenance found.</p>
        </CardContent>
      </Card>
    );
  }

  const groups = groupByFleetNumber(
    issues,
    i => i.vehicles?.fleet_number || 'N/A',
    i => i.vehicles ? `${i.vehicles.registration_number} · ${i.vehicles.make} ${i.vehicles.model}` : '',
  );

  return (
    <div className="space-y-3">
      {groups.map(([fleet, { vehicleInfo, items }]) => (
        <VehicleGroup key={fleet} fleetNumber={fleet} vehicleInfo={vehicleInfo} count={items.length} accentColor="amber">
          {items.map(issue => {
            const unit = issue.overdue_type === 'hours' ? 'hrs' : issue.overdue_type === 'km' ? 'km' : 'days';
            const overdueLabel = issue.overdue_amount != null
              ? `${Math.round(issue.overdue_amount).toLocaleString()} ${unit} overdue`
              : `${getDaysOverdue(issue.due_date)} days overdue`;

            return (
              <EntryRow key={issue.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <CalendarDays className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-[0.8125rem] text-slate-700">{issue.title}</span>
                      <Badge className="text-[0.6875rem] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">
                        {overdueLabel}
                      </Badge>
                    </div>

                    {issue.description && (
                      <p className="text-[0.8125rem] text-slate-500 mt-0.5">{issue.description}</p>
                    )}

                    {issue.interval_km && issue.last_odometer != null && issue.current_odometer != null && (
                      <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Gauge className="h-3 w-3 text-slate-400" />
                            Last: {issue.last_odometer.toLocaleString()} {issue.is_reefer ? 'hrs' : 'km'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3 text-slate-400" />
                            Now: {issue.current_odometer.toLocaleString()} {issue.is_reefer ? 'hrs' : 'km'}
                          </span>
                          <span className="font-medium text-slate-600">
                            {Math.abs(issue.current_odometer - (issue.last_odometer + issue.interval_km)).toLocaleString()} {issue.is_reefer ? 'hrs' : 'km'} over
                          </span>
                        </div>
                        <Progress
                          value={Math.min(100, ((issue.current_odometer - issue.last_odometer) / issue.interval_km) * 100)}
                          className="h-1 mt-2 bg-slate-200 [&>div]:bg-slate-600"
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">Due {new Date(issue.due_date).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{issue.assigned_to || 'Unassigned'}</p>
                  </div>
                </div>
              </EntryRow>
            );
          })}
        </VehicleGroup>
      ))}
    </div>
  );
}

// ── Breakdowns ────────────────────────────────────────────────────────────

function renderBreakdownsList(breakdowns: FleetBreakdown[]) {
  if (!breakdowns.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-[0.8125rem] text-slate-400">No breakdowns received from Load Planner.</p>
        </CardContent>
      </Card>
    );
  }

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const statusConfig = (status: string) => {
    switch (status) {
      case 'pending_review':
        return { label: 'Pending Review', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'scheduled_for_inspection':
        return { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'inspection_created':
        return { label: 'Inspection Created', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
      case 'resolved':
        return { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      case 'dismissed':
        return { label: 'Dismissed', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
      default:
        return { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
  };

  const groups = groupByFleetNumber(
    breakdowns,
    bd => bd.vehicle_fleet_number || bd.vehicle_registration || 'Unknown',
    bd => bd.vehicle_fleet_number && bd.vehicle_registration ? bd.vehicle_registration : '',
  );

  return (
    <div className="space-y-3">
      {groups.map(([fleet, { vehicleInfo, items }]) => (
        <VehicleGroup key={fleet} fleetNumber={fleet} vehicleInfo={vehicleInfo} count={items.length} accentColor="violet">
          {items.map(bd => {
            const status = statusConfig(bd.status);
            return (
              <EntryRow key={bd.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <AlertTriangle className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      {bd.source_breakdown_number && (
                        <span className="font-mono text-xs font-medium text-slate-500">
                          {bd.source_breakdown_number}
                        </span>
                      )}
                      <Badge className={cn('text-[0.6875rem] px-1.5 py-0 capitalize', severityColor(bd.severity))}>
                        {bd.severity}
                      </Badge>
                      <Badge className={cn('text-[0.6875rem] px-1.5 py-0', status.cls)}>
                        {status.label}
                      </Badge>
                    </div>

                    <p className="text-[0.8125rem] text-slate-700 mt-0.5">{bd.description}</p>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                      {bd.driver_name && <span>{bd.driver_name}</span>}
                      {bd.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {bd.location}
                        </span>
                      )}
                      {bd.load_number && <span>Load: {bd.load_number}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">{format(new Date(bd.breakdown_date), 'dd MMM yyyy')}</p>
                    <Badge variant="outline" className="text-[0.6875rem] capitalize mt-1">{bd.category.replace('_', ' ')}</Badge>
                  </div>
                </div>
              </EntryRow>
            );
          })}
        </VehicleGroup>
      ))}
    </div>
  );
}