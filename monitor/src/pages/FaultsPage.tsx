import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useOverdueMaintenance } from '@/hooks/useOverdueMaintenance';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Gauge, Timer, Wrench } from 'lucide-react';
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
type TabValue = 'faults' | 'maintenance';

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

  const isLoading = faultsLoading || maintenanceLoading;

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Total Issues</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
              </div>
              <Wrench className="h-8 w-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Active Faults</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.faults}</p>
              </div>
              <Wrench className="h-8 w-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Maintenance Overdue</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.maintenance}</p>
              </div>
              <CalendarDays className="h-8 w-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <TabsList className="bg-slate-100 border border-slate-200">
          <TabsTrigger value="faults" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
            Faults ({stats.faults})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
            Maintenance ({stats.maintenance})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faults" className="mt-4">
          {renderFaultsList(faults)}
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          {renderMaintenanceList(maintenance, getDaysOverdue)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper component to render faults list
function renderFaultsList(issues: VehicleFault[]) {
  if (!issues.length) {
    return (
      <Card className="border-slate-200">
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
          <Card key={issue.id} className="border border-slate-200 hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="h-4 w-4 text-slate-500" />
                      <span className="font-mono text-xs font-medium text-slate-600">
                        {issue.fault_number}
                      </span>
                    </div>

                    <h3 className="font-medium text-slate-900 mb-1">{issue.fault_description}</h3>
                    
                    {/* Fleet number as primary header */}
                    <p className="text-sm font-medium text-slate-900 mb-1">
                      {fleetNumber}
                    </p>
                    
                    {/* Vehicle details as secondary info */}
                    {vehicleDetails && (
                      <p className="text-xs text-slate-500">
                        {vehicleDetails}
                      </p>
                    )}
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
      <Card className="border-slate-200">
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
          <Card key={issue.id} className="border border-slate-200 hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <CalendarDays className="h-4 w-4 text-slate-500" />
                      <span className="font-semibold text-sm text-slate-900">{issue.title}</span>
                      <Badge className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600 border-slate-200">
                        {overdueLabel}
                      </Badge>
                    </div>

                    {issue.description && (
                      <p className="text-sm text-slate-600 mb-2">{issue.description}</p>
                    )}

                    {/* Fleet number as primary header - same for all vehicles */}
                    <p className="text-sm font-medium text-slate-900 mb-1">
                      {fleetNumber}
                    </p>
                    
                    {/* Vehicle details as secondary info - same for all vehicles */}
                    {vehicleDetails && (
                      <p className="text-xs text-slate-500">
                        {vehicleDetails}
                      </p>
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