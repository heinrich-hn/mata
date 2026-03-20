import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// NOTE: After running the fleet_breakdowns migration, regenerate types with:
// npx supabase gen types typescript --project-id wxvhkljrbcpcgpgdqhsp > src/integrations/supabase/types.ts
// Then remove the `as any` cast below.

// Use `as any` until types are regenerated after migration
const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

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
    created_at: string;
    updated_at: string;
}

export function useFleetBreakdowns() {
    return useQuery<FleetBreakdown[]>({
        queryKey: ["fleet-breakdowns"],
        queryFn: async () => {
            const { data, error } = await db
                .from("fleet_breakdowns")
                .select("*")
                .order("breakdown_date", { ascending: false });

            if (error) throw error;
            return (data ?? []) as FleetBreakdown[];
        },
    });
}

export function useUpdateFleetBreakdown() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...updates }: Partial<FleetBreakdown> & { id: string }) => {
            const { data, error } = await db
                .from("fleet_breakdowns")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fleet-breakdowns"] });
            toast({
                title: "Breakdown Updated",
                description: "The breakdown record has been updated.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to update breakdown.",
                variant: "destructive",
            });
        },
    });
}

export function useScheduleBreakdownForInspection() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await db
                .from("fleet_breakdowns")
                .update({
                    status: "scheduled_for_inspection",
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
                title: "Scheduled for Inspection",
                description: "Breakdown has been scheduled for workshop inspection.",
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
