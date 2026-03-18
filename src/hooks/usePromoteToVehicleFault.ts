import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type FaultSeverity = Database["public"]["Enums"]["fault_severity"];

interface PromoteToVehicleFaultParams {
  inspectionFaultId: string;
  inspectionId: string;
  vehicleId: string;
  faultDescription: string;
  severity: FaultSeverity;
  reportedBy: string;
  component?: string;
  faultCategory?: string;
}

export const usePromoteToVehicleFault = () => {
  const promoteToVehicleFault = async (params: PromoteToVehicleFaultParams) => {
    try {
      // Check if already promoted
      const { data: existing } = await supabase
        .from("vehicle_faults")
        .select("id")
        .eq("inspection_fault_id", params.inspectionFaultId)
        .maybeSingle();

      if (existing) {
        toast.info("This fault has already been promoted to vehicle faults");
        return existing.id;
      }

      // Generate fault number
      const { data: latestFault } = await supabase
        .from("vehicle_faults")
        .select("fault_number")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let faultNumber = "VF-0001";
      if (latestFault?.fault_number) {
        const lastNumber = parseInt(latestFault.fault_number.split("-")[1]);
        faultNumber = `VF-${String(lastNumber + 1).padStart(4, "0")}`;
      }

      // Create vehicle fault
      const { data: vehicleFault, error } = await supabase
        .from("vehicle_faults")
        .insert({
          fault_number: faultNumber,
          vehicle_id: params.vehicleId,
          inspection_fault_id: params.inspectionFaultId,
          inspection_id: params.inspectionId,
          fault_description: params.faultDescription,
          severity: params.severity,
          fault_category: params.faultCategory || "inspection",
          component: params.component || "general",
          reported_by: params.reportedBy,
          status: "identified",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Promoted to Vehicle Fault: ${faultNumber}`);
      return vehicleFault.id;
    } catch (error) {
      console.error("Error promoting to vehicle fault:", error);
      toast.error("Failed to promote to vehicle fault");
      return null;
    }
  };

  return { promoteToVehicleFault };
};