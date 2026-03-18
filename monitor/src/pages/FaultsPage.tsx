import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, CheckCircle, Gauge, Timer, Wrench } from 'lucide-react';
import { useState } from 'react';

// Types for combined display
interface VehicleFault {
  id: string;
  fault_number: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'identified' | 'acknowledged' | 'resolved';
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
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'acknowledged' | 'resolved';
  due_date: string;
  interval_km?: number | null;
  last_odometer?: number | null;
  current_odometer?: number | null;
  type: 'maintenance';
  vehicle_id?: string | null;
  assigned_to?: string | null;
  vehicles?: {
    fleet_number: string | null;
    registration_number: string;
    make: string;
    model: string;
  } | null;
}

type CombinedIssue = VehicleFault | MaintenanceOverdue;
type TabValue = 'faults' | 'maintenance';

// Define types for the raw data
interface RawMaintenanceSchedule {
  id: string;
  vehicle_id: string | null;
  service_type: string | null;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  title: string | null;
  description: string | null;
  notes: string | null;
  schedule_type: string | null;
  frequency: string | null;
  frequency_value: number | null;
  start_date: string | null;
  end_date: string | null;
  last_completed_date: string | null;
  estimated_duration_hours: string | null;
  priority: string | null;
  category: string | null;
  maintenance_type: string | null;
  assigned_to: string | null;
  assigned_team: string | null;
  created_by: string | null;
  alert_before_hours: number[] | null;
  notification_channels: unknown;
  notification_recipients: unknown;
  auto_create_job_card: boolean | null;
  related_template_id: string | null;
  odometer_based: boolean | null;
  odometer_interval_km: number | null;
  last_odometer_reading: number | null;
}

interface VehicleInfo {
  id: string;
  fleet_number: string | null;
  registration_number: string;
  make: string;
  model: string;
}

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
        .in('status', ['identified', 'acknowledged'])
        .order('reported_date', { ascending: false });

      if (error) throw error;
      return (data || []).map(f => ({ ...f, type: 'fault' as const }));
    },
  });

  // Fetch overdue maintenance - WITHOUT JOIN
  const { data: maintenance = [], isLoading: maintenanceLoading } = useQuery({
    queryKey: ['maintenance-overdue'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format

      // Get all active maintenance schedules that are overdue - NO JOIN
      const { data: schedules, error } = await supabase
        .from('maintenance_schedules')
        .select('*')
        .eq('is_active', true)
        .lt('next_due_date', today)
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error fetching maintenance:', error);
        return [];
      }

      if (!schedules || schedules.length === 0) {
        return [];
      }

      // Get unique vehicle IDs
      const vehicleIds = schedules
        .map((s: RawMaintenanceSchedule) => s.vehicle_id)
        .filter((id): id is string => id !== null);

      // Fetch vehicle data separately
      let vehiclesMap: Record<string, VehicleInfo> = {};

      if (vehicleIds.length > 0) {
        const { data: vehicles, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('id, fleet_number, registration_number, make, model')
          .in('id', vehicleIds);

        if (vehiclesError) {
          console.error('Error fetching vehicles:', vehiclesError);
        } else if (vehicles) {
          vehiclesMap = vehicles.reduce((acc, v) => {
            acc[v.id] = v;
            return acc;
          }, {} as Record<string, VehicleInfo>);
        }
      }

      // For each schedule, get current odometer reading if needed
      const schedulesWithData = await Promise.all(
        (schedules as RawMaintenanceSchedule[]).map(async (schedule) => {
          let currentOdometer = null;

          if (schedule.odometer_based && schedule.vehicle_id) {
            const { data: trips } = await supabase
              .from('trips')
              .select('ending_km')
              .eq('vehicle_id', schedule.vehicle_id)
              .order('departure_date', { ascending: false })
              .limit(1);

            if (trips && trips.length > 0) {
              currentOdometer = trips[0].ending_km;
            }
          }

          const vehicle = schedule.vehicle_id ? vehiclesMap[schedule.vehicle_id] : null;

          return {
            id: schedule.id,
            title: schedule.title || schedule.service_type || 'Maintenance',
            description: schedule.description,
            priority: (schedule.priority as 'critical' | 'high' | 'medium' | 'low') || 'medium',
            status: 'active' as const,
            due_date: schedule.next_due_date,
            interval_km: schedule.odometer_interval_km,
            last_odometer: schedule.last_odometer_reading,
            current_odometer: currentOdometer,
            vehicle_id: schedule.vehicle_id,
            assigned_to: schedule.assigned_to,
            type: 'maintenance' as const,
            vehicles: vehicle ? {
              fleet_number: vehicle.fleet_number,
              registration_number: vehicle.registration_number,
              make: vehicle.make,
              model: vehicle.model,
            } : null,
          };
        })
      );

      return schedulesWithData;
    },
  });

  const isLoading = faultsLoading || maintenanceLoading;

  // Combine and filter issues
  const allIssues: CombinedIssue[] = (() => {
    if (activeTab === 'faults') return faults;
    if (activeTab === 'maintenance') return maintenance;
    return [...faults, ...maintenance];
  })();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'low': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

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
    critical: allIssues.filter(i =>
      (i.type === 'fault' && i.severity === 'critical') ||
      (i.type === 'maintenance' && i.priority === 'critical')
    ).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Faults & Maintenance</h1>
            <p className="text-sm text-muted-foreground">
              Track vehicle issues and overdue maintenance
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="destructive" className="text-xs">
            {stats.critical} critical
          </Badge>
          <Badge variant="outline" className="text-xs">
            {stats.total} total
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Issues</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Wrench className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Faults</p>
                <p className="text-2xl font-bold text-red-500">{stats.faults}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Maintenance Overdue</p>
                <p className="text-2xl font-bold text-orange-500">{stats.maintenance}</p>
              </div>
              <CalendarDays className="h-8 w-8 text-orange-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <TabsList>
          <TabsTrigger value="faults">Faults ({stats.faults})</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance ({stats.maintenance})</TabsTrigger>
        </TabsList>

        <TabsContent value="faults" className="mt-4">
          {renderIssuesList(faults, getSeverityColor, getDaysOverdue)}
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          {renderIssuesList(maintenance, getSeverityColor, getDaysOverdue)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper component to render issues list
function renderIssuesList(
  issues: CombinedIssue[],
  getSeverityColor: (severity: string) => string,
  getDaysOverdue: (dueDate: string) => number
) {
  if (!issues.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No issues found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {issues.map((issue) => {
        if (issue.type === 'fault') {
          // Render fault with consistent styling matching maintenance
          return (
            <Card key={issue.id} className="border-l-4 border-l-red-500">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="h-4 w-4 text-red-500" />
                        <span className="font-mono font-semibold">
                          {issue.fault_number}
                        </span>
                        <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                          {issue.severity}
                        </Badge>
                        <Badge variant="destructive" className="text-xs">
                          {issue.status}
                        </Badge>
                      </div>

                      <h3 className="font-semibold mb-1">{issue.fault_description}</h3>
                      <p className="text-sm text-muted-foreground">
                        {issue.vehicles?.fleet_number && `${issue.vehicles.fleet_number} • `}
                        {issue.vehicles?.registration_number} ({issue.vehicles?.make} {issue.vehicles?.model})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t text-sm text-muted-foreground">
                    <span>Reported by {issue.reported_by}</span>
                    <span>{new Date(issue.reported_date).toLocaleDateString()}</span>
                  </div>

                  {issue.resolution_notes && issue.status === 'resolved' && (
                    <div className="mt-2 p-2 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                          <span>Resolved</span>
                        </div>
                        <div className="font-medium text-emerald-600">
                          Resolution: {issue.resolution_notes}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        } else {
          // Render maintenance overdue
          const daysOverdue = getDaysOverdue(issue.due_date);
          const severity = issue.priority;

          return (
            <Card key={issue.id} className="border-l-4 border-l-orange-500">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="h-4 w-4 text-orange-500" />
                        <span className="font-semibold">{issue.title}</span>
                        <Badge variant="outline" className={getSeverityColor(severity)}>
                          {severity}
                        </Badge>
                        <Badge variant="destructive" className="text-xs">
                          {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                        </Badge>
                      </div>

                      {issue.description && (
                        <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>
                      )}

                      <p className="text-sm text-muted-foreground">
                        {issue.vehicles?.fleet_number && `${issue.vehicles.fleet_number} • `}
                        {issue.vehicles?.registration_number} ({issue.vehicles?.make} {issue.vehicles?.model})
                      </p>

                      {/* Show tracking info if available */}
                      {issue.interval_km && issue.last_odometer && issue.current_odometer && (
                        <div className="mt-3 p-2 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                              <Gauge className="h-3 w-3" />
                              <span>Last: {issue.last_odometer.toLocaleString()} km</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              <span>Current: {issue.current_odometer.toLocaleString()} km</span>
                            </div>
                            <div className="flex items-center gap-1 font-medium text-orange-500">
                              <AlertTriangle className="h-3 w-3" />
                              <span>{Math.abs(issue.current_odometer - (issue.last_odometer + issue.interval_km)).toLocaleString()} km over</span>
                            </div>
                          </div>
                          <Progress
                            value={Math.min(100, ((issue.current_odometer - issue.last_odometer) / issue.interval_km) * 100)}
                            className="h-1 mt-2 [&>div]:bg-orange-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t text-sm text-muted-foreground">
                    <span>Assigned to: {issue.assigned_to || 'Unassigned'}</span>
                    <span>Due: {new Date(issue.due_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
      })}
    </div>
  );
}