import MobileFollowUps from "@/components/mobile/MobileFollowUps";
import MobileInspectionsTab from "@/components/mobile/MobileInspectionsTab";
import MobileJobCards from "@/components/mobile/MobileJobCards";
import MobileMaintenance from "@/components/mobile/MobileMaintenance";
import MobileTyresTab from "@/components/mobile/MobileTyresTab";
import WorkshopMobileShell, { type WorkshopTab } from "@/components/mobile/WorkshopMobileShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const WorkshopMobileLayout = () => {
  const [activeTab, setActiveTab] = useState<WorkshopTab>("job-cards");

  // Badge counts with proper error handling
  const { data: activeJobCount = 0 } = useQuery({
    queryKey: ["mobile-badge-jobs"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("job_cards")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "in_progress", "in progress"]);

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: overdueMaintenanceCount = 0 } = useQuery({
    queryKey: ["mobile-badge-maintenance"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count, error } = await supabase
        .from("maintenance_schedules")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .lt("next_due_date", today);

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: openFaultsCount = 0 } = useQuery({
    queryKey: ["mobile-badge-faults"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("vehicle_inspections")
        .select("*", { count: "exact", head: true })
        .eq("has_fault", true)
        .is("fault_resolved", false);

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Tyre alerts count - simplified version without complex chaining
  const { data: tyreAlertCount = 0 } = useQuery({
    queryKey: ["mobile-badge-tyres"],
    queryFn: async (): Promise<number> => {
      try {
        // Option 1: Check if there are any active tyre positions that need attention
        // Since we don't have pressure data, we'll check for tyres that have been mounted for too long
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { count: oldTyresCount, error: oldTyresError } = await supabase
          .from("tyre_positions")
          .select("*", { count: "exact", head: true })
          .eq("active", true)
          .lt("mounted_at", sixMonthsAgo.toISOString());

        if (!oldTyresError) {
          return oldTyresCount || 0;
        }

        // Option 2: Check tyre_catalogue for low stock
        const { count: lowStockCount, error: lowStockError } = await supabase
          .from("tyre_catalogue")
          .select("*", { count: "exact", head: true })
          .lt("stock_quantity", 5); // Adjust threshold as needed

        if (!lowStockError) {
          return lowStockCount || 0;
        }

        return 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: 30000,
    retry: false,
  });

  const { data: pendingFollowUpsCount = 0 } = useQuery({
    queryKey: ["mobile-badge-followups"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("action_items")
        .select("*", { count: "exact", head: true })
        .eq("related_entity_type", "job_card")
        .eq("category", "external_follow_up")
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const renderContent = () => {
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
  };

  return (
    <WorkshopMobileShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      badgeCounts={{
        jobCards: activeJobCount > 0 ? activeJobCount : undefined,
        inspections: openFaultsCount > 0 ? openFaultsCount : undefined,
        maintenance: overdueMaintenanceCount > 0 ? overdueMaintenanceCount : undefined,
        tyres: tyreAlertCount > 0 ? tyreAlertCount : undefined,
        followUps: pendingFollowUpsCount > 0 ? pendingFollowUpsCount : undefined,
      }}
    >
      {renderContent()}
    </WorkshopMobileShell>
  );
};

export default WorkshopMobileLayout;