import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useOverdueMaintenance } from '@/hooks/useOverdueMaintenance';
import { useFleetBreakdowns, type FleetBreakdown } from '@/hooks/useFleetBreakdowns';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CalendarDays, Gauge, MapPin, Timer, Truck, Wrench } from 'lucide-react';
import { useState } from 'react';

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

type CombinedIssue = VehicleFault | MaintenanceOverdue;
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

  // Combine and filter issues
  const allIssues: CombinedIssue[] = (() => {
    if (activeTab === 'faults') return faults;
    if (activeTab === 'maintenance') return maintenance;
    return [...faults, ...maintenance];
  })();

  const getDaysOverdue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const stats = {
    total: allIssues.length,
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
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200/80 bg-gradient-to-br from-blue-50/55 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-blue-700/80">Total Issues</p>
                <p className="text-xl font-bold text-blue-700 mt-0.5">{stats.total}</p>
              </div>
              <Wrench className="h-7 w-7 text-blue-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200/80 bg-gradient-to-br from-rose-50/55 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-rose-700/80">Active Faults</p>
                <p className="text-xl font-bold text-rose-700 mt-0.5">{stats.faults}</p>
              </div>
              <Wrench className="h-7 w-7 text-rose-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/55 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-amber-700/80">Maintenance Overdue</p>
                <p className="text-xl font-bold text-amber-700 mt-0.5">{stats.maintenance}</p>
              </div>
              <CalendarDays className="h-7 w-7 text-amber-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-200/80 bg-gradient-to-br from-violet-50/55 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-violet-700/80">Breakdowns</p>
                <p className="text-xl font-bold text-violet-700 mt-0.5">{stats.breakdowns}</p>
              </div>
              <AlertTriangle className="h-7 w-7 text-violet-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <TabsList className="w-full sm:w-auto bg-slate-100 border border-slate-200 p-0.5">
          <TabsTrigger value="faults" className="flex-1 sm:flex-none text-xs border-b-2 border-transparent data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 data-[state=active]:border-rose-500">
            Faults ({stats.faults})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex-1 sm:flex-none text-xs border-b-2 border-transparent data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:border-amber-500">
            Maintenance ({stats.maintenance})
          </TabsTrigger>
          <TabsTrigger value="breakdowns" className="flex-1 sm:flex-none text-xs border-b-2 border-transparent data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:border-violet-500">
            Breakdowns ({stats.breakdowns})
          </TabsTrigger>
        </TabsList>

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
  );
}

// Helper component to render faults list
function renderFaultsList(issues: VehicleFault[]) {
  if (!issues.length) {
    return (
      <Card className="monitor-soft-panel">
        <CardContent className="py-12 text-center">
          <p className="text-slate-500 text-sm">No active faults found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => {
        // Get fleet number - always show this as the primary identifier
        const fleetNumber = issue.vehicles?.fleet_number || 'N/A';
        const vehicleDetails = issue.vehicles?.registration_number
          ? `${issue.vehicles.registration_number} (${issue.vehicles.make} ${issue.vehicles.model})`
          : '';

        return (
          <Card key={issue.id} className="monitor-soft-entry border-l-2 border-l-rose-400 hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="h-4 w-4 text-rose-600" />
                      <h3 className="font-semibold text-slate-900">{fleetNumber}</h3>
                      {vehicleDetails && (
                        <span className="text-xs text-slate-500">{vehicleDetails}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <Wrench className="h-3 w-3 text-slate-400" />
                      <span className="font-mono text-xs font-medium text-slate-600">
                        {issue.fault_number}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600">{issue.fault_description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>Reported by {issue.reported_by}</span>
                  <span>{new Date(issue.reported_date).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Helper component to render maintenance list
function renderMaintenanceList(
  issues: MaintenanceOverdue[],
  getDaysOverdue: (dueDate: string) => number
) {
  if (!issues.length) {
    return (
      <Card className="monitor-soft-panel">
        <CardContent className="py-12 text-center">
          <p className="text-slate-500 text-sm">No overdue maintenance found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => {
        const unit = issue.overdue_type === 'hours' ? 'hrs' : issue.overdue_type === 'km' ? 'km' : 'days';
        const overdueLabel = issue.overdue_amount != null
          ? `${Math.round(issue.overdue_amount).toLocaleString()} ${unit} overdue`
          : `${getDaysOverdue(issue.due_date)} days overdue`;

        // Get fleet number - always show this as the primary identifier
        const fleetNumber = issue.vehicles?.fleet_number || 'N/A';
        const vehicleDetails = issue.vehicles?.registration_number
          ? `${issue.vehicles.registration_number} (${issue.vehicles.make} ${issue.vehicles.model})`
          : '';

        return (
          <Card key={issue.id} className="monitor-soft-entry border-l-2 border-l-amber-400 hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="h-4 w-4 text-amber-600" />
                      <h3 className="font-semibold text-slate-900">{fleetNumber}</h3>
                      {vehicleDetails && (
                        <span className="text-xs text-slate-500">{vehicleDetails}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <CalendarDays className="h-3 w-3 text-slate-400" />
                      <span className="font-medium text-sm text-slate-700">{issue.title}</span>
                      <Badge className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 border-amber-200">
                        {overdueLabel}
                      </Badge>
                    </div>

                    {issue.description && (
                      <p className="text-sm text-slate-600 mb-2">{issue.description}</p>
                    )}

                    {/* Show tracking info if available - handles both km and hours */}
                    {issue.interval_km && issue.last_odometer != null && issue.current_odometer != null && (
                      <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <div className="flex items-center gap-1">
                            <Gauge className="h-3 w-3 text-slate-400" />
                            <span>Last: {issue.last_odometer.toLocaleString()} {issue.is_reefer ? 'hrs' : 'km'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Timer className="h-3 w-3 text-slate-400" />
                            <span>Current: {issue.current_odometer.toLocaleString()} {issue.is_reefer ? 'hrs' : 'km'}</span>
                          </div>
                          <div className="flex items-center gap-1 font-medium text-slate-600">
                            <span>{Math.abs(issue.current_odometer - (issue.last_odometer + issue.interval_km)).toLocaleString()} {issue.is_reefer ? 'hrs' : 'km'} over</span>
                          </div>
                        </div>
                        <Progress
                          value={Math.min(100, ((issue.current_odometer - issue.last_odometer) / issue.interval_km) * 100)}
                          className="h-1 mt-2 bg-slate-200 [&>div]:bg-slate-600"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>Assigned to: {issue.assigned_to || 'Unassigned'}</span>
                  <span>Due: {new Date(issue.due_date).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Helper to render breakdowns list
function renderBreakdownsList(breakdowns: FleetBreakdown[]) {
  if (!breakdowns.length) {
    return (
      <Card className="monitor-soft-panel">
        <CardContent className="py-12 text-center">
          <p className="text-slate-500 text-sm">No breakdowns received from Load Planner.</p>
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

  return (
    <div className="space-y-3">
      {breakdowns.map((bd) => {
        const status = statusConfig(bd.status);
        const borderColor = bd.severity === 'critical' || bd.severity === 'high'
          ? 'border-l-rose-400'
          : bd.severity === 'medium'
            ? 'border-l-amber-400'
            : 'border-l-violet-400';

        return (
          <Card key={bd.id} className={`monitor-soft-entry border-l-2 ${borderColor} hover:shadow-md transition-shadow duration-200`}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="h-4 w-4 text-violet-600" />
                      <h3 className="font-semibold text-slate-900">
                        {bd.vehicle_fleet_number || bd.vehicle_registration || 'Unknown Vehicle'}
                      </h3>
                      {bd.vehicle_fleet_number && bd.vehicle_registration && (
                        <span className="text-xs text-slate-500">{bd.vehicle_registration}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <AlertTriangle className="h-3 w-3 text-slate-400" />
                      {bd.source_breakdown_number && (
                        <span className="font-mono text-xs font-medium text-slate-600">
                          {bd.source_breakdown_number}
                        </span>
                      )}
                      <Badge className={`text-xs px-1.5 py-0.5 ${severityColor(bd.severity)} capitalize`}>
                        {bd.severity}
                      </Badge>
                      <Badge className={`text-xs px-1.5 py-0.5 ${status.cls}`}>
                        {status.label}
                      </Badge>
                    </div>

                    <p className="text-sm text-slate-600 mb-1">{bd.description}</p>

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      {bd.driver_name && (
                        <span>{bd.driver_name}</span>
                      )}
                      {bd.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {bd.location}
                        </span>
                      )}
                      {bd.load_number && (
                        <span>Load: {bd.load_number}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <Badge variant="outline" className="text-xs capitalize">{bd.category.replace('_', ' ')}</Badge>
                  <span>{format(new Date(bd.breakdown_date), 'dd MMM yyyy HH:mm')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}