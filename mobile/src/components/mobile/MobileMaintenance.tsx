import { MobileQuickComplete } from "@/components/maintenance/MobileQuickComplete";
import { AddScheduleDialog } from "@/components/maintenance/AddScheduleDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { MaintenanceSchedule } from "@/types/maintenance";
import { cn } from "@/lib/utils";
import { isReeferFleet } from "@/utils/fleetCategories";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// Types & Constants
// ============================================================================
type UrgencyType = "overdue" | "today" | "upcoming" | "scheduled";

const URGENCY_CONFIG = {
  overdue: {
    label: "Overdue",
    badgeVariant: "destructive" as const,
    bgColor: "bg-red-50/50 dark:bg-red-900/20",
    borderColor: "border-l-red-500",
    dot: "bg-red-500",
    statColor: "text-red-700 dark:text-red-200",
    statBg: "bg-red-50 dark:bg-red-800/40",
    statGradient: "from-red-50 to-red-100/60 dark:from-red-900/30 dark:to-red-800/40",
  },
  today: {
    label: "Today",
    badgeVariant: "default" as const,
    bgColor: "bg-orange-50/50 dark:bg-orange-900/20",
    borderColor: "border-l-orange-500",
    dot: "bg-orange-500",
    statColor: "text-orange-700 dark:text-orange-200",
    statBg: "bg-orange-50 dark:bg-orange-800/40",
    statGradient: "from-orange-50 to-orange-100/60 dark:from-orange-900/30 dark:to-orange-800/40",
  },
  upcoming: {
    label: "Soon",
    badgeVariant: "outline" as const,
    bgColor: "dark:bg-yellow-900/20",
    borderColor: "border-l-yellow-500",
    dot: "bg-yellow-500",
    statColor: "text-yellow-700 dark:text-yellow-200",
    statBg: "bg-yellow-50 dark:bg-yellow-800/40",
    statGradient: "from-yellow-50 to-yellow-100/60 dark:from-yellow-900/30 dark:to-yellow-800/40",
  },
  scheduled: {
    label: "Scheduled",
    badgeVariant: "outline" as const,
    bgColor: "",
    borderColor: "border-l-gray-300 dark:border-l-gray-500",
    dot: "bg-gray-500 dark:bg-gray-400",
    statColor: "text-gray-700 dark:text-gray-200",
    statBg: "bg-gray-50 dark:bg-gray-700/50",
    statGradient: "from-gray-50 to-gray-100/60 dark:from-gray-800/40 dark:to-gray-700/50",
  },
} as const;

// ============================================================================
// Sub-components
// ============================================================================
const ScheduleCard = ({
  schedule,
  vehicle,
  urgency,
  onComplete
}: {
  schedule: MaintenanceSchedule;
  vehicle?: { fleet_number: string | null; registration_number: string | null };
  urgency: UrgencyType;
  onComplete: (id: string) => void;
}) => {
  const dueDate = new Date(schedule.next_due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const urgencyConfig = URGENCY_CONFIG[urgency];

  const getUrgencyBadge = () => {
    switch (urgency) {
      case "overdue":
        return (
          <Badge variant="destructive" className="text-[11px] px-1.5 py-0.5">
            {Math.abs(diffDays)}d overdue
          </Badge>
        );
      case "today":
        return (
          <Badge className="bg-orange-500 text-white text-[11px] px-1.5 py-0.5">
            Due today
          </Badge>
        );
      case "upcoming":
        return (
          <Badge variant="outline" className="text-[11px] px-1.5 py-0.5 border-yellow-300 text-yellow-700">
            In {diffDays}d
          </Badge>
        );
      default:
        return (
          <span className="text-[11px] text-muted-foreground">
            In {diffDays}d
          </span>
        );
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onComplete(schedule.id);
    }
  }, [onComplete, schedule.id]);

  return (
    <div
      className={cn(
        "border-l-4 rounded-xl border border-border/40 bg-card px-3 py-2 flex items-center gap-2 active:scale-[0.98] transition-all",
        urgencyConfig.borderColor,
        urgencyConfig.bgColor
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold leading-tight truncate">
            {schedule.title || schedule.service_type}
          </p>
          {getUrgencyBadge()}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          {vehicle && (
            <span className="font-medium">
              {vehicle.fleet_number || vehicle.registration_number}
            </span>
          )}
          <span>{dueDate.toLocaleDateString()}</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px] rounded-lg px-2.5 flex-shrink-0 font-semibold"
        onClick={(e) => {
          e.stopPropagation();
          onComplete(schedule.id);
        }}
        onKeyDown={handleKeyDown}
      >
        Done
      </Button>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================
const MobileMaintenance = () => {
  const [quickCompleteOpen, setQuickCompleteOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Fetch schedules
  const {
    data: schedules = [],
    refetch,
    isLoading,
    error
  } = useQuery({
    queryKey: ["maintenance-schedules-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("is_active", true)
        .order("next_due_date", { ascending: true });

      if (error) throw error;
      return (data || []).map(s => ({
        ...s,
        schedule_type: s.schedule_type as MaintenanceSchedule["schedule_type"],
      })) as MaintenanceSchedule[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // Fetch vehicles for lookup
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-lookup-maintenance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number, current_odometer");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300000,
  });

  // Create vehicle map for O(1) lookups
  const vehicleMap = useMemo(
    () => new Map(vehicles.map(v => [v.id, v])),
    [vehicles]
  );

  // Build fleet number → vehicle id map for reefer detection
  const fleetMap = useMemo(() => {
    const m: Record<string, string> = {};
    vehicles.forEach(v => { if (v.fleet_number) m[v.id] = v.fleet_number; });
    return m;
  }, [vehicles]);

  // Fetch latest KM from trips for non-reefer vehicles with odometer-based schedules
  const odometerVehicleIds = useMemo(() => {
    return [...new Set(
      schedules
        .filter(s => s.odometer_based && s.vehicle_id && !isReeferFleet(fleetMap[s.vehicle_id] || ""))
        .map(s => s.vehicle_id)
    )];
  }, [schedules, fleetMap]);

  const { data: vehicleKmMap = {} } = useQuery({
    queryKey: ["vehicle-km-map", odometerVehicleIds],
    queryFn: async () => {
      if (odometerVehicleIds.length === 0) return {};
      const map: Record<string, number> = {};

      // Get max ending_km per vehicle from trips
      const { data: trips } = await supabase
        .from("trips")
        .select("fleet_vehicle_id, ending_km")
        .in("fleet_vehicle_id", odometerVehicleIds)
        .not("ending_km", "is", null)
        .order("ending_km", { ascending: false });

      (trips || []).forEach(t => {
        const vid = t.fleet_vehicle_id as string;
        const km = t.ending_km as number;
        if (vid && km && (!map[vid] || km > map[vid])) map[vid] = km;
      });

      // Fallback to vehicles.current_odometer
      vehicles.forEach(v => {
        const odo = (v.current_odometer as number) || 0;
        if (odometerVehicleIds.includes(v.id) && odo > (map[v.id] || 0)) {
          map[v.id] = odo;
        }
      });

      return map;
    },
    enabled: odometerVehicleIds.length > 0,
    staleTime: 60000,
  });

  // Fetch latest reefer hours from reefer_diesel_records
  const reeferFleetNumbers = useMemo(() => {
    return [...new Set(
      schedules
        .filter(s => s.odometer_based && s.vehicle_id && isReeferFleet(fleetMap[s.vehicle_id] || ""))
        .map(s => fleetMap[s.vehicle_id])
        .filter(Boolean)
    )];
  }, [schedules, fleetMap]);

  const { data: reeferHoursMap = {} } = useQuery({
    queryKey: ["reefer-hours-map", reeferFleetNumbers],
    queryFn: async () => {
      if (reeferFleetNumbers.length === 0) return {};
      const hoursMap: Record<string, number> = {};

      for (const fleetNumber of reeferFleetNumbers) {
        const { data } = await supabase
          .from("reefer_diesel_records")
          .select("operating_hours")
          .eq("reefer_unit", fleetNumber)
          .not("operating_hours", "is", null)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.operating_hours) {
          hoursMap[fleetNumber] = data.operating_hours;
        }
      }

      return hoursMap;
    },
    enabled: reeferFleetNumbers.length > 0,
    staleTime: 60000,
  });

  // Get today at midnight for date comparisons
  const getToday = useCallback(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // Calculate schedule urgency (date-based, KM-based for trucks, hours-based for reefers)
  const getScheduleUrgency = useCallback((schedule: MaintenanceSchedule): UrgencyType => {
    const today = getToday();
    const fleetNumber = schedule.vehicle_id ? fleetMap[schedule.vehicle_id] || "" : "";
    const isReefer = isReeferFleet(fleetNumber);

    // Hours-based overdue (reefers)
    if (schedule.odometer_based && isReefer && fleetNumber && schedule.odometer_interval_km) {
      const currentHours = reeferHoursMap[fleetNumber] || 0;
      const lastReading = (schedule.last_odometer_reading as number) || 0;
      const nextServiceHours = lastReading + (schedule.odometer_interval_km as number);
      if (currentHours >= nextServiceHours) return "overdue";
    }

    // KM-based overdue (trucks)
    if (schedule.odometer_based && !isReefer && schedule.vehicle_id && schedule.odometer_interval_km) {
      const currentKm = vehicleKmMap[schedule.vehicle_id] || 0;
      const lastReading = (schedule.last_odometer_reading as number) || 0;
      const nextServiceKm = lastReading + (schedule.odometer_interval_km as number);
      if (currentKm >= nextServiceKm) return "overdue";
    }

    // Date-based urgency
    const dueDate = new Date(schedule.next_due_date);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "overdue";
    if (diffDays === 0) return "today";
    if (diffDays <= 7) return "upcoming";
    return "scheduled";
  }, [getToday, fleetMap, reeferHoursMap, vehicleKmMap]);

  // Memoized grouped schedules
  const groupedSchedules = useMemo(() => {
    const groups = {
      overdue: [] as MaintenanceSchedule[],
      today: [] as MaintenanceSchedule[],
      upcoming: [] as MaintenanceSchedule[],
      scheduled: [] as MaintenanceSchedule[],
    };

    schedules.forEach(schedule => {
      const urgency = getScheduleUrgency(schedule);
      groups[urgency].push(schedule);
    });

    return groups;
  }, [schedules, getScheduleUrgency]);

  const { overdue, today: todaySchedules, upcoming, scheduled } = groupedSchedules;

  // Fetch completed count for current month
  const { data: _completedCount = 0 } = useQuery({
    queryKey: ["maintenance-completed-count"],
    queryFn: async () => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const { count, error } = await supabase
        .from("maintenance_schedule_history")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("completed_date", startOfMonth);

      if (error) throw error;
      return count || 0;
    },
    staleTime: 60000,
  });

  // Handlers
  const handleQuickComplete = useCallback((scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setQuickCompleteOpen(true);
  }, []);

  const handleCompleteSuccess = useCallback(() => {
    setQuickCompleteOpen(false);
    refetch();
  }, [refetch]);

  const handleAddSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  // Error state
  if (error) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl font-bold text-destructive">!</span>
            </div>
            <h3 className="font-bold mb-2">Failed to load maintenance schedules</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Please try again later"}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-3 pb-safe-bottom">
      {/* Tabs */}
      <Tabs defaultValue="urgent" className="w-full">
        <TabsList className="sticky top-0 z-10 grid w-full grid-cols-3 h-11 rounded-xl bg-muted/80 backdrop-blur-sm p-1">
          <TabsTrigger
            value="urgent"
            className="text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target"
          >
            Urgent ({overdue.length + todaySchedules.length})
          </TabsTrigger>
          <TabsTrigger
            value="upcoming"
            className="text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target"
          >
            Upcoming ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target"
          >
            All ({schedules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="urgent" className="mt-2 space-y-1.5">
          {isLoading ? (
            <ScheduleCardSkeleton count={3} />
          ) : overdue.length === 0 && todaySchedules.length === 0 ? (
            <EmptyState
              title="All caught up!"
              message="No urgent maintenance tasks"
              variant="success"
            />
          ) : (
            <>
              {overdue.map(schedule => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  vehicle={vehicleMap.get(schedule.vehicle_id)}
                  urgency="overdue"
                  onComplete={handleQuickComplete}
                />
              ))}
              {todaySchedules.map(schedule => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  vehicle={vehicleMap.get(schedule.vehicle_id)}
                  urgency="today"
                  onComplete={handleQuickComplete}
                />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-2 space-y-1.5">
          {isLoading ? (
            <ScheduleCardSkeleton count={3} />
          ) : upcoming.length === 0 ? (
            <EmptyState
              title="No upcoming tasks"
              message="No maintenance tasks due in the next 7 days"
            />
          ) : (
            upcoming.map(schedule => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                vehicle={vehicleMap.get(schedule.vehicle_id)}
                urgency="upcoming"
                onComplete={handleQuickComplete}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-2 space-y-1.5">
          {isLoading ? (
            <ScheduleCardSkeleton count={3} />
          ) : schedules.length === 0 ? (
            <EmptyState
              title="No maintenance schedules"
              message="Create your first maintenance schedule to get started"
              action={
                <Button onClick={() => setAddDialogOpen(true)} className="mt-4 rounded-xl font-semibold">
                  Add Schedule
                </Button>
              }
            />
          ) : (
            [...overdue, ...todaySchedules, ...upcoming, ...scheduled].map(schedule => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                vehicle={vehicleMap.get(schedule.vehicle_id)}
                urgency={getScheduleUrgency(schedule)}
                onComplete={handleQuickComplete}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* FAB - New Schedule */}
      <Button
        className="fixed bottom-24 right-4 h-12 px-4 rounded-xl shadow-lg active:scale-95 transition-transform z-20 touch-target font-semibold text-sm gap-1"
        onClick={() => setAddDialogOpen(true)}
        aria-label="Add maintenance schedule"
      >
        <span className="text-base">+</span> New
      </Button>

      {/* Dialogs */}
      <MobileQuickComplete
        open={quickCompleteOpen}
        onOpenChange={setQuickCompleteOpen}
        scheduleId={selectedScheduleId}
        onSuccess={handleCompleteSuccess}
      />

      <AddScheduleDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
};

// ============================================================================
// Helper Components
// ============================================================================
const ScheduleCardSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const EmptyState = ({
  title,
  message,
  action,
  variant
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
  variant?: "success";
}) => (
  <div className="text-center py-8 px-4">
    <div className={cn(
      "w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center",
      variant === "success"
        ? "bg-gradient-to-br from-emerald-50 to-emerald-100"
        : "bg-gradient-to-br from-muted to-muted/60"
    )}>
      <span className={cn(
        "text-base font-bold",
        variant === "success" ? "text-emerald-600" : "text-muted-foreground"
      )}>
        {variant === "success" ? "✓" : "0"}
      </span>
    </div>
    <h3 className="font-semibold text-sm mb-1">{title}</h3>
    <p className="text-xs text-muted-foreground">{message}</p>
    {action}
  </div>
);

export default MobileMaintenance;