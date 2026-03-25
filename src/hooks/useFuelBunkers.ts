import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Note: After applying the migration, regenerate types with:
// npx supabase gen types typescript --project-id wxvhkljrbcpcgpgdqhsp > src/integrations/supabase/types.ts

// Helper to bypass TypeScript strict typing for tables not yet in types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (tableName: string) => (supabase as any).from(tableName);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpcCall = (fnName: string, params: Record<string, unknown>) => (supabase as any).rpc(fnName, params);

// Types for Fuel Bunkers
export interface FuelBunker {
  id: string;
  name: string;
  location: string | null;
  fuel_type: string;
  capacity_liters: number;
  current_level_liters: number;
  unit_cost: number | null;
  min_level_alert: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FuelTransaction {
  id: string;
  bunker_id: string;
  transaction_type: "refill" | "dispense" | "adjustment";
  quantity_liters: number;
  unit_cost: number | null;
  total_cost: number | null;
  vehicle_id: string | null;
  vehicle_fleet_number: string | null;
  odometer_reading: number | null;
  driver_name: string | null;
  notes: string | null;
  reference_number: string | null;
  transaction_date: string;
  created_by: string | null;
  created_at: string;
  // Audit trail
  edit_history?: FuelTransactionEditEntry[];
  last_edited_by?: string | null;
  last_edited_at?: string | null;
  // Joined data
  bunker?: FuelBunker;
}

export interface FuelTransactionEditEntry {
  timestamp: string;
  edited_by: string;
  reason: string;
  changes: {
    field: string;
    old_value: string | number | null;
    new_value: string | number | null;
  }[];
}

export interface EditFuelTransactionData {
  transaction_id: string;
  quantity_liters?: number;
  unit_cost?: number;
  reference_number?: string;
  notes?: string;
  edited_by: string;
  edit_reason: string;
}

export interface CreateBunkerData {
  name: string;
  location?: string;
  fuel_type: string;
  capacity_liters: number;
  current_level_liters?: number;
  unit_cost?: number;
  min_level_alert?: number;
  notes?: string;
}

export interface DispenseFuelData {
  bunker_id: string;
  quantity_liters: number;
  vehicle_id?: string;
  vehicle_fleet_number?: string;
  odometer_reading?: number;
  driver_name?: string;
  notes?: string;
}

export interface RefillBunkerData {
  bunker_id: string;
  quantity_liters: number;
  unit_cost?: number;
  reference_number?: string;
  notes?: string;
}

export interface AdjustBunkerData {
  bunker_id: string;
  new_level: number;
  reason?: string;
  adjusted_by?: string;
}

// Daily Dip Record types
export interface DailyDipRecord {
  id: string;
  bunker_id: string;
  record_date: string;
  // Opening readings
  opening_dip_cm: number | null;
  opening_volume_liters: number;
  opening_pump_reading: number | null;
  // Closing readings
  closing_dip_cm: number | null;
  closing_volume_liters: number | null;
  closing_pump_reading: number | null;
  // Diesel additions during this dip period (refills while record is open)
  diesel_additions_liters: number;   // Total diesel added to bunker during this period
  // Calculated values
  tank_usage_liters: number | null;  // C = A - B + diesel_additions (opening - closing + additions)
  pump_issued_liters: number | null; // F = E - D (closing - opening pump)
  variance_liters: number | null;    // G = C - F (tank usage - pump issued)
  // Metadata
  recorded_by: string | null;
  notes: string | null;
  status: "open" | "closed" | "reconciled";
  created_at: string;
  updated_at: string;
  // Audit history for tracking changes
  edit_history?: DipRecordEditEntry[];
  last_edited_by?: string | null;
  last_edited_at?: string | null;
  // Joined data
  bunker?: FuelBunker;
}

// Edit history entry for audit trail
export interface DipRecordEditEntry {
  timestamp: string;
  edited_by: string;
  changes: {
    field: string;
    old_value: string | number | null;
    new_value: string | number | null;
  }[];
  reason?: string;
}

// Data for editing a dip record with audit trail
export interface EditDipRecordData {
  id: string;
  opening_dip_cm?: number | null;
  opening_volume_liters?: number;
  opening_pump_reading?: number | null;
  closing_dip_cm?: number | null;
  closing_volume_liters?: number | null;
  closing_pump_reading?: number | null;
  recorded_by?: string | null;
  notes?: string | null;
  edit_reason: string;
  edited_by: string;
}

export interface CreateDipRecordData {
  bunker_id: string;
  record_date: string;
  opening_dip_cm?: number;
  opening_volume_liters: number;
  opening_pump_reading?: number;
  recorded_by?: string;
  notes?: string;
}

export interface CloseDipRecordData {
  id: string;
  closing_dip_cm?: number;
  closing_volume_liters: number;
  closing_pump_reading?: number;
  notes?: string;
}

// Query key constants
const BUNKER_KEYS = {
  all: ["fuel-bunkers"] as const,
  active: ["fuel-bunkers", "active"] as const,
  transactions: ["fuel-transactions"] as const,
  bunkerTransactions: (bunkerId: string) => ["fuel-transactions", bunkerId] as const,
  dipRecords: ["dip-records"] as const,
  bunkerDipRecords: (bunkerId: string) => ["dip-records", bunkerId] as const,
};

// Hook to fetch all fuel bunkers
export const useFuelBunkers = (activeOnly = false) => {
  return useQuery({
    queryKey: activeOnly ? BUNKER_KEYS.active : BUNKER_KEYS.all,
    queryFn: async () => {
      let query = fromTable("fuel_bunkers")
        .select("*")
        .order("name");

      if (activeOnly) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FuelBunker[];
    },
  });
};

// Hook to fetch fuel transactions
export const useFuelTransactions = (bunkerId?: string, limit = 100) => {
  return useQuery({
    queryKey: bunkerId ? BUNKER_KEYS.bunkerTransactions(bunkerId) : BUNKER_KEYS.transactions,
    queryFn: async () => {
      let query = fromTable("fuel_transactions")
        .select(`
          *,
          bunker:fuel_bunkers(id, name, fuel_type, location)
        `)
        .order("transaction_date", { ascending: false })
        .limit(limit);

      if (bunkerId) {
        query = query.eq("bunker_id", bunkerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FuelTransaction[];
    },
  });
};

// Hook to create a new fuel bunker
export const useCreateFuelBunker = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBunkerData) => {
      const { data: bunker, error } = await fromTable("fuel_bunkers")
        .insert([{
          ...data,
          current_level_liters: data.current_level_liters || 0,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;
      return bunker as FuelBunker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.all });
      toast({ title: "Success", description: "Fuel bunker created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Hook to update a fuel bunker
export const useUpdateFuelBunker = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<FuelBunker> & { id: string }) => {
      const { data: bunker, error } = await fromTable("fuel_bunkers")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return bunker as FuelBunker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.all });
      toast({ title: "Success", description: "Fuel bunker updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Hook to delete a fuel bunker
export const useDeleteFuelBunker = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("fuel_bunkers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.all });
      toast({ title: "Success", description: "Fuel bunker deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Hook to dispense fuel from a bunker (auto-deduct)
export const useDispenseFuel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DispenseFuelData) => {
      const { data: result, error } = await rpcCall("dispense_fuel", {
        p_bunker_id: data.bunker_id,
        p_quantity_liters: data.quantity_liters,
        p_vehicle_id: data.vehicle_id || null,
        p_vehicle_fleet_number: data.vehicle_fleet_number || null,
        p_odometer_reading: data.odometer_reading || null,
        p_driver_name: data.driver_name || null,
        p_notes: data.notes || null,
      });

      if (error) throw error;

      const response = result as { success: boolean; error?: string; dispensed_liters?: number; new_bunker_level?: number; total_cost?: number };
      if (!response.success) {
        throw new Error(response.error || "Failed to dispense fuel");
      }

      return response;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.transactions });
      toast({
        title: "Fuel Dispensed",
        description: `${result.dispensed_liters}L dispensed. New bunker level: ${result.new_bunker_level}L`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Dispense Failed", description: error.message, variant: "destructive" });
    },
  });
};

// Hook to refill a bunker
export const useRefillBunker = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RefillBunkerData) => {
      const { data: result, error } = await rpcCall("refill_bunker", {
        p_bunker_id: data.bunker_id,
        p_quantity_liters: data.quantity_liters,
        p_unit_cost: data.unit_cost || null,
        p_reference_number: data.reference_number || null,
        p_notes: data.notes || null,
      });

      if (error) throw error;

      const response = result as { success: boolean; error?: string; added_liters?: number; new_bunker_level?: number; total_cost?: number };
      if (!response.success) {
        throw new Error(response.error || "Failed to refill bunker");
      }

      // Background calculation: Add refill amount to any open dip record for this bunker
      const addedLiters = response.added_liters ?? data.quantity_liters;
      const { data: openDipRecord } = await fromTable("daily_dip_records")
        .select("id, diesel_additions_liters")
        .eq("bunker_id", data.bunker_id)
        .eq("status", "open")
        .maybeSingle();

      if (openDipRecord) {
        const currentAdditions = (openDipRecord as { diesel_additions_liters: number }).diesel_additions_liters || 0;
        const { error: dipUpdateError } = await fromTable("daily_dip_records")
          .update({
            diesel_additions_liters: currentAdditions + addedLiters,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (openDipRecord as { id: string }).id);

        if (dipUpdateError) {
          console.error("Failed to update dip record with diesel addition:", dipUpdateError);
        }
      }

      return response;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.transactions });
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.dipRecords });
      toast({
        title: "Bunker Refilled",
        description: `${result.added_liters}L added. New level: ${result.new_bunker_level}L`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Refill Failed", description: error.message, variant: "destructive" });
    },
  });
};

// Hook to adjust bunker level (for audits)
export const useAdjustBunkerLevel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AdjustBunkerData) => {
      const { data: result, error } = await rpcCall("adjust_bunker_level", {
        p_bunker_id: data.bunker_id,
        p_new_level: data.new_level,
        p_reason: data.reason || null,
        p_adjusted_by: data.adjusted_by || null,
      });

      if (error) throw error;

      const response = result as { success: boolean; error?: string; old_level?: number; new_level?: number; adjustment?: number };
      if (!response.success) {
        throw new Error(response.error || "Failed to adjust bunker level");
      }

      return response;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.transactions });
      toast({
        title: "Level Adjusted",
        description: `Level changed from ${result.old_level}L to ${result.new_level}L`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Adjustment Failed", description: error.message, variant: "destructive" });
    },
  });
};

// Hook to edit a refill transaction with audit trail + blended price recalculation
export const useEditFuelTransaction = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EditFuelTransactionData) => {
      const { data: result, error } = await rpcCall("edit_refill_transaction", {
        p_transaction_id: data.transaction_id,
        p_quantity_liters: data.quantity_liters ?? null,
        p_unit_cost: data.unit_cost ?? null,
        p_reference_number: data.reference_number ?? null,
        p_notes: data.notes ?? null,
        p_edited_by: data.edited_by,
        p_edit_reason: data.edit_reason,
      });

      if (error) throw error;

      const response = result as { success: boolean; error?: string; changes_count?: number; new_blended_price?: number };
      if (!response.success) {
        throw new Error(response.error || "Failed to edit transaction");
      }

      return response;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.transactions });
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.dipRecords });
      toast({
        title: "Transaction Updated",
        description: `${result.changes_count} field(s) updated. New blended price: $${result.new_blended_price?.toFixed(4)}/L`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Edit Failed", description: error.message, variant: "destructive" });
    },
  });
};

// Hook to get bunkers with low fuel alerts
export const useLowFuelAlerts = () => {
  return useQuery({
    queryKey: ["fuel-bunkers", "low-alerts"],
    queryFn: async () => {
      const { data, error } = await fromTable("fuel_bunkers")
        .select("*")
        .eq("is_active", true)
        .not("min_level_alert", "is", null);

      if (error) throw error;

      // Filter to bunkers below alert level
      return (data || []).filter(
        (b: FuelBunker) => b.min_level_alert && b.current_level_liters < b.min_level_alert
      ) as FuelBunker[];
    },
  });
};

// ==================== Daily Dip Records ====================

// Hook to fetch daily dip records
export const useDailyDipRecords = (bunkerId?: string, limit = 50) => {
  return useQuery({
    queryKey: bunkerId ? BUNKER_KEYS.bunkerDipRecords(bunkerId) : BUNKER_KEYS.dipRecords,
    queryFn: async () => {
      let query = fromTable("daily_dip_records")
        .select(`
          *,
          bunker:fuel_bunkers(id, name, fuel_type, location)
        `)
        .order("record_date", { ascending: false })
        .limit(limit);

      if (bunkerId) {
        query = query.eq("bunker_id", bunkerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DailyDipRecord[];
    },
  });
};

// Hook to get today's dip record for a bunker
export const useTodaysDipRecord = (bunkerId: string) => {
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["dip-records", bunkerId, today],
    queryFn: async () => {
      const { data, error } = await fromTable("daily_dip_records")
        .select(`
          *,
          bunker:fuel_bunkers(id, name, fuel_type, location)
        `)
        .eq("bunker_id", bunkerId)
        .eq("record_date", today)
        .maybeSingle();

      if (error) throw error;
      return data as DailyDipRecord | null;
    },
    enabled: !!bunkerId,
  });
};

// Hook to create/open a new daily dip record
export const useCreateDipRecord = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDipRecordData) => {
      // Check if record already exists for this date
      const { data: existing } = await fromTable("daily_dip_records")
        .select("id")
        .eq("bunker_id", data.bunker_id)
        .eq("record_date", data.record_date)
        .maybeSingle();

      if (existing) {
        throw new Error("A dip record already exists for this date");
      }

      const { data: record, error } = await fromTable("daily_dip_records")
        .insert([{
          bunker_id: data.bunker_id,
          record_date: data.record_date,
          opening_dip_cm: data.opening_dip_cm,
          opening_volume_liters: data.opening_volume_liters,
          opening_pump_reading: data.opening_pump_reading,
          diesel_additions_liters: 0,
          recorded_by: data.recorded_by,
          notes: data.notes,
          status: "open",
        }])
        .select()
        .single();

      if (error) throw error;

      // Sync bunker's current level to the opening dip measurement (physical reading)
      const { error: bunkerUpdateError } = await fromTable("fuel_bunkers")
        .update({
          current_level_liters: data.opening_volume_liters,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.bunker_id);

      if (bunkerUpdateError) {
        console.error("Failed to sync bunker level from opening dip record:", bunkerUpdateError);
      }

      return record as DailyDipRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.dipRecords });
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.all });
      toast({ title: "Success", description: "Daily dip record opened and bunker level synced" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Hook to close a daily dip record with closing readings
export const useCloseDipRecord = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CloseDipRecordData) => {
      // First get the opening readings and bunker info
      const { data: existing, error: fetchError } = await fromTable("daily_dip_records")
        .select("*, bunker:fuel_bunkers(id, name)")
        .eq("id", data.id)
        .single();

      if (fetchError) throw fetchError;
      if (!existing) throw new Error("Dip record not found");

      const record = existing as DailyDipRecord;

      // Calculate values
      // Diesel additions (refills during this open period) must be accounted for
      const dieselAdditions = record.diesel_additions_liters || 0;

      // C = A - B + Additions (Tank Usage = Opening - Closing + Diesel Added)
      // Without additions, refills would make closing > opening, appearing as a "gain"
      const tankUsage = record.opening_volume_liters - data.closing_volume_liters + dieselAdditions;

      // F = E - D (Pump Issued = Closing Pump - Opening Pump)
      let pumpIssued: number | null = null;
      if (record.opening_pump_reading !== null && data.closing_pump_reading !== null) {
        pumpIssued = data.closing_pump_reading - record.opening_pump_reading;
      }

      // G = C - F (Variance = Tank Usage - Pump Issued)
      let variance: number | null = null;
      if (pumpIssued !== null) {
        variance = tankUsage - pumpIssued;
      }

      const { data: updated, error } = await fromTable("daily_dip_records")
        .update({
          closing_dip_cm: data.closing_dip_cm,
          closing_volume_liters: data.closing_volume_liters,
          closing_pump_reading: data.closing_pump_reading,
          tank_usage_liters: tankUsage,
          pump_issued_liters: pumpIssued,
          variance_liters: variance,
          notes: data.notes || record.notes,
          status: "closed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;

      // Update the bunker's current level to match the closing volume from dip reading
      const { error: bunkerUpdateError } = await fromTable("fuel_bunkers")
        .update({
          current_level_liters: data.closing_volume_liters,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.bunker_id);

      if (bunkerUpdateError) {
        console.error("Failed to update bunker level from dip record:", bunkerUpdateError);
        // Don't throw - the dip record was saved, just log the bunker sync failure
      }

      return updated as DailyDipRecord;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.dipRecords });
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.all });

      // Provide feedback on variance
      const variance = result.variance_liters;
      if (variance !== null) {
        const absVariance = Math.abs(variance);
        if (absVariance <= 10) {
          toast({
            title: "Record Closed - Acceptable Variance",
            description: `Variance: ${variance}L (within acceptable range)`
          });
        } else if (variance > 0) {
          toast({
            title: "⚠️ Record Closed - Positive Variance",
            description: `Variance: +${variance}L - Tank lost more fuel than pump recorded. Check for leaks.`,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Record Closed - Negative Variance",
            description: `Variance: ${variance}L - Likely due to thermal expansion or meter calibration.`
          });
        }
      } else {
        toast({ title: "Success", description: "Daily dip record closed" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Hook to update/edit a dip record with audit trail
export const useEditDipRecord = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EditDipRecordData) => {
      // First get the existing record to track changes
      const { data: existing, error: fetchError } = await fromTable("daily_dip_records")
        .select("*")
        .eq("id", data.id)
        .single();

      if (fetchError) throw fetchError;
      if (!existing) throw new Error("Dip record not found");

      const existingRecord = existing as DailyDipRecord;

      // Build list of changes for audit trail
      const changes: { field: string; old_value: string | number | null; new_value: string | number | null }[] = [];

      const fieldsToCheck: (keyof EditDipRecordData)[] = [
        'opening_dip_cm', 'opening_volume_liters', 'opening_pump_reading',
        'closing_dip_cm', 'closing_volume_liters', 'closing_pump_reading',
        'recorded_by', 'notes'
      ];

      fieldsToCheck.forEach(field => {
        if (data[field] !== undefined) {
          const oldValue = existingRecord[field as keyof DailyDipRecord];
          const newValue = data[field];
          if (oldValue !== newValue) {
            changes.push({
              field,
              old_value: oldValue as string | number | null,
              new_value: newValue as string | number | null,
            });
          }
        }
      });

      if (changes.length === 0) {
        throw new Error("No changes detected");
      }

      // Create edit history entry
      const editEntry: DipRecordEditEntry = {
        timestamp: new Date().toISOString(),
        edited_by: data.edited_by,
        changes,
        reason: data.edit_reason,
      };

      // Get existing edit history or initialize
      const existingHistory = (existingRecord.edit_history || []) as DipRecordEditEntry[];
      const updatedHistory = [...existingHistory, editEntry];

      // Prepare update data
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        edit_history: updatedHistory,
        last_edited_by: data.edited_by,
        last_edited_at: new Date().toISOString(),
      };

      // Apply field updates
      if (data.opening_dip_cm !== undefined) updateData.opening_dip_cm = data.opening_dip_cm;
      if (data.opening_volume_liters !== undefined) updateData.opening_volume_liters = data.opening_volume_liters;
      if (data.opening_pump_reading !== undefined) updateData.opening_pump_reading = data.opening_pump_reading;
      if (data.closing_dip_cm !== undefined) updateData.closing_dip_cm = data.closing_dip_cm;
      if (data.closing_volume_liters !== undefined) updateData.closing_volume_liters = data.closing_volume_liters;
      if (data.closing_pump_reading !== undefined) updateData.closing_pump_reading = data.closing_pump_reading;
      if (data.recorded_by !== undefined) updateData.recorded_by = data.recorded_by;
      if (data.notes !== undefined) updateData.notes = data.notes;

      // Recalculate derived values if closing values are present
      const openingVolume = (data.opening_volume_liters ?? existingRecord.opening_volume_liters) as number;
      const closingVolume = (data.closing_volume_liters ?? existingRecord.closing_volume_liters) as number | null;
      const openingPump = (data.opening_pump_reading ?? existingRecord.opening_pump_reading) as number | null;
      const closingPump = (data.closing_pump_reading ?? existingRecord.closing_pump_reading) as number | null;
      const dieselAdditions = existingRecord.diesel_additions_liters || 0;

      if (closingVolume !== null) {
        updateData.tank_usage_liters = openingVolume - closingVolume + dieselAdditions;

        if (openingPump !== null && closingPump !== null) {
          updateData.pump_issued_liters = closingPump - openingPump;
          updateData.variance_liters = (openingVolume - closingVolume + dieselAdditions) - (closingPump - openingPump);
        }
      }

      const { data: record, error } = await fromTable("daily_dip_records")
        .update(updateData)
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;

      // If closing volume was updated, sync bunker's current level
      if (data.closing_volume_liters !== undefined && data.closing_volume_liters !== null) {
        const { error: bunkerUpdateError } = await fromTable("fuel_bunkers")
          .update({
            current_level_liters: data.closing_volume_liters,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRecord.bunker_id);

        if (bunkerUpdateError) {
          console.error("Failed to sync bunker level from edited dip record:", bunkerUpdateError);
        }
      }

      return { record: record as DailyDipRecord, changes };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.dipRecords });
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.all });
      toast({
        title: "Record Updated",
        description: `${result.changes.length} field(s) updated with audit trail`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });
};

// Legacy hook - use useEditDipRecord instead for audit trail
export const useUpdateDipRecord = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<DailyDipRecord> & { id: string }) => {
      const { data: record, error } = await fromTable("daily_dip_records")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return record as DailyDipRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.dipRecords });
      toast({ title: "Success", description: "Dip record updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Hook to delete a dip record with confirmation
export const useDeleteDipRecord = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, deleted_by, reason }: { id: string; deleted_by: string; reason: string }) => {
      // First get the record for logging purposes
      const { data: existing } = await fromTable("daily_dip_records")
        .select("*, bunker:fuel_bunkers(name)")
        .eq("id", id)
        .single();

      const { error } = await fromTable("daily_dip_records")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return {
        record: existing as DailyDipRecord & { bunker: { name: string } },
        deleted_by,
        reason
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: BUNKER_KEYS.dipRecords });
      toast({
        title: "Record Deleted",
        description: `Dip record for ${result.record?.bunker?.name || 'bunker'} deleted by ${result.deleted_by}`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });
};