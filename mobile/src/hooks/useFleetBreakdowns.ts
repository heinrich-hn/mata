import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface FleetBreakdown {
    id: string;
    source_app: string;
    source_breakdown_id: string | null;
    source_breakdown_number: string | null;
    vehicle_registration: string | null;
    vehicle_fleet_number: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_id: string | null;
    driver_name: string | null;
    breakdown_date: string;
    location: string | null;
    description: string;
    severity: string;
    category: string;
    load_number: string | null;
    status: string;
    linked_inspection_id: string | null;
    linked_job_card_id: string | null;
    workshop_notes: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    call_out_departure_time: string | null;
    call_out_start_time: string | null;
    call_out_completed_time: string | null;
    call_out_mechanic: string | null;
    created_at: string;
    updated_at: string;
}

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export function useFleetBreakdowns() {
    return useQuery<FleetBreakdown[]>({
        queryKey: ["fleet-breakdowns"],
        queryFn: async () => {
            const { data, error } = await db
                .from("fleet_breakdowns")
                .select("*")
                .in("status", ["pending_review", "reported"])
                .order("breakdown_date", { ascending: false });

            if (error) throw error;
            return (data ?? []) as FleetBreakdown[];
        },
    });
}

export function useScheduleBreakdownForInspection() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (breakdown: FleetBreakdown) => {
            // 1. Create a vehicle_inspections record
            const inspectionNumber = `INS-BD-${Date.now()}`;
            const { data: inspection, error: inspError } = await supabase
                .from("vehicle_inspections")
                .insert({
                    inspection_number: inspectionNumber,
                    inspection_date: new Date().toISOString(),
                    inspection_type: "breakdown",
                    inspector_name: "Workshop",
                    initiated_via: "breakdown",
                    status: "pending" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
                    vehicle_id: breakdown.vehicle_id,
                    vehicle_registration: breakdown.vehicle_registration,
                    vehicle_make: breakdown.vehicle_make,
                    vehicle_model: breakdown.vehicle_model,
                    notes: `Breakdown: ${breakdown.description}${breakdown.location ? ` @ ${breakdown.location}` : ""}`,
                })
                .select("id")
                .single();

            if (inspError) throw inspError;

            // 2. Link the inspection back to the breakdown
            const { data, error } = await db
                .from("fleet_breakdowns")
                .update({
                    status: "scheduled_for_inspection",
                    linked_inspection_id: inspection.id,
                    reviewed_at: new Date().toISOString(),
                })
                .eq("id", breakdown.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fleet-breakdowns"] });
            queryClient.invalidateQueries({ queryKey: ["inspection_history"] });
            toast({
                title: "Scheduled for Inspection",
                description: "Breakdown has been scheduled and an inspection record created.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to schedule inspection.",
                variant: "destructive",
            });
        },
    });
}

export interface CallOutData {
    id: string;
    departureTime: string;
    startTime: string;
    completedTime: string;
    mechanic: string;
    notes?: string;
}

export function useCallOutBreakdown() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (data: CallOutData) => {
            const { data: result, error } = await db
                .from("fleet_breakdowns")
                .update({
                    status: "resolved",
                    call_out_departure_time: data.departureTime,
                    call_out_start_time: data.startTime,
                    call_out_completed_time: data.completedTime,
                    call_out_mechanic: data.mechanic,
                    workshop_notes: data.notes ?? null,
                    reviewed_at: new Date().toISOString(),
                })
                .eq("id", data.id)
                .select()
                .single();

            if (error) throw error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fleet-breakdowns"] });
            toast({
                title: "Call Out Completed",
                description: "Breakdown has been resolved via call out.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to record call out.",
                variant: "destructive",
            });
        },
    });
}

export function useDismissBreakdown() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
            const { data, error } = await db
                .from("fleet_breakdowns")
                .update({
                    status: "dismissed",
                    workshop_notes: notes ?? null,
                    reviewed_at: new Date().toISOString(),
                })
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fleet-breakdowns"] });
            toast({
                title: "Breakdown Dismissed",
                description: "The breakdown has been dismissed.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to dismiss breakdown.",
                variant: "destructive",
            });
        },
    });
}
