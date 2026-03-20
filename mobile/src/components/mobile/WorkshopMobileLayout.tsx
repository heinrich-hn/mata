import MobileFollowUps from "@/components/mobile/MobileFollowUps";
import MobileInspectionsTab from "@/components/mobile/MobileInspectionsTab";
import MobileJobCards from "@/components/mobile/MobileJobCards";
import MobileMaintenance from "@/components/mobile/MobileMaintenance";
import MobileTyresTab from "@/components/mobile/MobileTyresTab";
import WorkshopMobileShell, { type WorkshopTab } from "@/components/mobile/WorkshopMobileShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ============================================================================
// Types & Constants
// ============================================================================
interface BadgeCounts {
  jobCards?: number;
  inspections?: number;
  maintenance?: number;
  tyres?: number;
  followUps?: number;
}

interface BadgeError {
  key: string;
  message: string;
}

const QUERY_CONFIG = {
  staleTime: 30000,
  gcTime: 300000,
  refetchInterval: 30000,
  retry: 2, // Retry failed queries twice
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
} as const;

// ============================================================================
// Custom Hooks
// ============================================================================
const useBadgeCount = <T,>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: { refetchInterval?: number; retry?: number }
) => {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey,
    queryFn,
    ...QUERY_CONFIG,
    ...options,
  });

  return { count: data, error, isLoading, refetch };
};

// ============================================================================
// Error Toast Component
// ============================================================================
const ErrorToast = ({ errors, onDismiss }: { errors: BadgeError[]; onDismiss: () => void }) => {
  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <Card className="border-destructive/50 bg-destructive/10 backdrop-blur">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <span className="h-5 w-5 rounded-full bg-destructive/15 flex items-center justify-center text-destructive text-xs font-bold flex-shrink-0 mt-0.5">!</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Some data failed to load</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {errors.length} badge count{errors.length !== 1 ? 's' : ''} couldn't be updated
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full flex-shrink-0"
              onClick={onDismiss}
            >
              <span className="text-xs font-semibold">Retry</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================
const WorkshopMobileLayout = () => {
  const [activeTab, setActiveTab] = useState<WorkshopTab>("job-cards");
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());

  // Job cards badge count (active jobs)
  const { count: activeJobCount = 0, error: jobError, refetch: refetchJobs } = useBadgeCount(
    ["mobile-badge-jobs"],
    async () => {
      const { count, error } = await supabase
        .from("job_cards")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "in_progress", "in progress"]);

      if (error) throw error;
      return count || 0;
    }
  );

  // Maintenance badge count (overdue + upcoming within 7 days, including reefer hours & KM-based)
  const { count: urgentMaintenanceCount = 0, error: maintenanceError, refetch: refetchMaintenance } = useBadgeCount(
    ["mobile-badge-maintenance"],
    async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Fetch all active schedules
      const { data: schedules, error } = await supabase
        .from("maintenance_schedules")
        .select("id, vehicle_id, next_due_date, odometer_based, odometer_interval_km, last_odometer_reading")
        .eq("is_active", true);

      if (error) throw error;
      if (!schedules || schedules.length === 0) return 0;

      // Date-based count (overdue + upcoming 7 days)
      let count = schedules.filter(s => {
        if (s.odometer_based) return false; // handled separately
        const due = new Date(s.next_due_date);
        return due <= sevenDaysFromNow;
      }).length;

      // Check odometer/hours-based schedules
      const odometerSchedules = schedules.filter(s => s.odometer_based && s.vehicle_id && s.odometer_interval_km);
      if (odometerSchedules.length > 0) {
        const vehicleIds = [...new Set(odometerSchedules.map(s => s.vehicle_id as string))];
        const { data: vehicles } = await supabase
          .from("vehicles")
          .select("id, fleet_number, current_odometer")
          .in("id", vehicleIds);

        const fleetMap: Record<string, string> = {};
        (vehicles || []).forEach(v => { if (v.fleet_number) fleetMap[v.id] = v.fleet_number; });

        for (const s of odometerSchedules) {
          const fleetNumber = fleetMap[s.vehicle_id as string] || "";
          const lastReading = (s.last_odometer_reading as number) || 0;
          const interval = s.odometer_interval_km as number;
          const nextService = lastReading + interval;

          if (/F$/i.test(fleetNumber.trim())) {
            // Reefer: check hours
            const { data: reeferData } = await supabase
              .from("reefer_diesel_records")
              .select("operating_hours")
              .eq("reefer_unit", fleetNumber)
              .not("operating_hours", "is", null)
              .order("date", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (reeferData?.operating_hours && reeferData.operating_hours >= nextService) count++;
          } else {
            // Truck: check KM from trips or current_odometer
            const { data: trip } = await supabase
              .from("trips")
              .select("ending_km")
              .eq("fleet_vehicle_id", s.vehicle_id as string)
              .not("ending_km", "is", null)
              .order("ending_km", { ascending: false })
              .limit(1)
              .maybeSingle();

            const tripKm = (trip?.ending_km as number) || 0;
            const vehicleOdo = (vehicles?.find(v => v.id === s.vehicle_id)?.current_odometer as number) || 0;
            const currentKm = Math.max(tripKm, vehicleOdo);

            if (currentKm >= nextService) count++;
          }
        }
      }

      // Also add date-based overdue for odometer schedules (they still have next_due_date)
      count += schedules.filter(s => {
        if (!s.odometer_based) return false;
        const due = new Date(s.next_due_date);
        due.setHours(0, 0, 0, 0);
        return due < today; // date overdue too
      }).length;

      return count;
    }
  );

  // Faults badge count (unresolved inspection faults + active vehicle faults)
  const { count: openFaultsCount = 0, error: faultsError, refetch: refetchFaults } = useBadgeCount(
    ["mobile-badge-faults"],
    async () => {
      // Count unresolved inspection faults
      const { count: inspectionFaultCount, error: inspErr } = await supabase
        .from("vehicle_inspections")
        .select("*", { count: "exact", head: true })
        .eq("has_fault", true)
        .is("fault_resolved", false);

      if (inspErr) throw inspErr;

      // Count active vehicle faults (identified + acknowledged)
      const { count: vehicleFaultCount, error: vfErr } = await supabase
        .from("vehicle_faults")
        .select("*", { count: "exact", head: true })
        .in("status", ["identified", "acknowledged"]);

      if (vfErr) throw vfErr;

      return (inspectionFaultCount || 0) + (vehicleFaultCount || 0);
    }
  );

  // Tyre alerts count
  const { count: tyreAlertCount = 0, error: tyresError, refetch: refetchTyres } = useBadgeCount(
    ["mobile-badge-tyres"],
    async (): Promise<number> => {
      try {
        // Check for tyres mounted for more than 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { count: oldTyresCount, error: oldTyresError } = await supabase
          .from("tyre_positions")
          .select("*", { count: "exact", head: true })
          .eq("active", true)
          .lt("mounted_at", sixMonthsAgo.toISOString());

        if (!oldTyresError && oldTyresCount && oldTyresCount > 0) {
          return oldTyresCount;
        }

        return 0;
      } catch {
        return 0;
      }
    },
    { refetchInterval: 60000, retry: 1 }
  );

  // Follow-ups badge count (pending external follow-ups)
  const { count: pendingFollowUpsCount = 0, error: followUpsError, refetch: refetchFollowUps } = useBadgeCount(
    ["mobile-badge-followups"],
    async () => {
      const { count, error } = await supabase
        .from("action_items")
        .select("*", { count: "exact", head: true })
        .eq("related_entity_type", "job_card")
        .eq("category", "external_follow_up")
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    }
  );

  // Collect active errors
  const activeErrors = useMemo<BadgeError[]>(() => {
    const errors = [];
    if (jobError && !dismissedErrors.has("jobs")) {
      errors.push({ key: "jobs", message: "Failed to load job counts" });
    }
    if (maintenanceError && !dismissedErrors.has("maintenance")) {
      errors.push({ key: "maintenance", message: "Failed to load maintenance counts" });
    }
    if (faultsError && !dismissedErrors.has("faults")) {
      errors.push({ key: "faults", message: "Failed to load fault counts" });
    }
    if (tyresError && !dismissedErrors.has("tyres")) {
      errors.push({ key: "tyres", message: "Failed to load tyre alerts" });
    }
    if (followUpsError && !dismissedErrors.has("followups")) {
      errors.push({ key: "followups", message: "Failed to load follow-up counts" });
    }
    return errors;
  }, [jobError, maintenanceError, faultsError, tyresError, followUpsError, dismissedErrors]);

  // Retry all failed queries
  const retryAllFailed = useCallback(() => {
    if (jobError) refetchJobs();
    if (maintenanceError) refetchMaintenance();
    if (faultsError) refetchFaults();
    if (tyresError) refetchTyres();
    if (followUpsError) refetchFollowUps();
    setDismissedErrors(new Set());
  }, [jobError, maintenanceError, faultsError, tyresError, followUpsError, refetchJobs, refetchMaintenance, refetchFaults, refetchTyres, refetchFollowUps]);

  // Dismiss errors
  const dismissErrors = useCallback(() => {
    setDismissedErrors(new Set(activeErrors.map(e => e.key)));
  }, [activeErrors]);

  // Memoized badge counts for the shell component
  const badgeCounts = useMemo<BadgeCounts>(() => ({
    jobCards: activeJobCount > 0 ? activeJobCount : undefined,
    inspections: openFaultsCount > 0 ? openFaultsCount : undefined,
    maintenance: urgentMaintenanceCount > 0 ? urgentMaintenanceCount : undefined,
    tyres: tyreAlertCount > 0 ? tyreAlertCount : undefined,
    followUps: pendingFollowUpsCount > 0 ? pendingFollowUpsCount : undefined,
  }), [activeJobCount, openFaultsCount, urgentMaintenanceCount, tyreAlertCount, pendingFollowUpsCount]);

  // Render content based on active tab
  const renderContent = useCallback(() => {
    switch (activeTab) {
      case "job-cards":
        return <MobileJobCards />;
      case "inspections":
        return <MobileInspectionsTab />;
      case "maintenance":
        return <MobileMaintenance />;
      case "tyres":
        return <MobileTyresTab />;
      case "follow-ups":
        return <MobileFollowUps />;
      default:
        return <MobileJobCards />;
    }
  }, [activeTab]);

  return (
    <>
      <WorkshopMobileShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        badgeCounts={badgeCounts}
      >
        {renderContent()}
      </WorkshopMobileShell>

      <ErrorToast errors={activeErrors} onDismiss={dismissErrors} />

      {/* Retry All Button - shown when there are errors */}
      {activeErrors.length > 0 && (
        <Button
          className="fixed bottom-24 left-1/2 -translate-x-1/2 h-10 px-4 rounded-full shadow-lg bg-background border text-sm z-20"
          variant="outline"
          onClick={retryAllFailed}
        >
          Retry All
        </Button>
      )}
    </>
  );
};

export default WorkshopMobileLayout;