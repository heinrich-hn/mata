import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Breakdown, BreakdownInsert } from "@/types/breakdown";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// NOTE: After running the breakdowns migration, regenerate types with:
// npx supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
// Then remove the `as any` casts below.

function generateBreakdownNumber(): string {
    const now = new Date();
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    return `BD-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// Use `as any` until types are regenerated after migration
const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export function useBreakdowns() {
    return useQuery<Breakdown[]>({
        queryKey: ["breakdowns"],
        queryFn: async () => {
            const { data, error } = await db
                .from("breakdowns")
                .select(`
          *,
          load:loads(id, load_id),
          fleet_vehicle:fleet_vehicles(id, vehicle_id, type),
          driver:drivers(id, name, contact)
        `)
                .order("breakdown_date", { ascending: false });

            if (error) throw error;
            return (data ?? []) as unknown as Breakdown[];
        },
    });
}

export function useCreateBreakdown() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (input: Omit<BreakdownInsert, 'breakdown_number'>) => {
            const breakdown_number = generateBreakdownNumber();
            const { data, error } = await db
                .from("breakdowns")
                .insert({ ...input, breakdown_number })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
            toast({
                title: "Breakdown Logged",
                description: "The breakdown has been recorded successfully.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to log breakdown.",
                variant: "destructive",
            });
        },
    });
}

export function useUpdateBreakdown() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...updates }: Partial<Breakdown> & { id: string }) => {
            const { data, error } = await db
                .from("breakdowns")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
            toast({
                title: "Breakdown Updated",
                description: "The breakdown has been updated successfully.",
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

export function useDeleteBreakdown() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await db
                .from("breakdowns")
                .delete()
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
            toast({
                title: "Breakdown Deleted",
                description: "The breakdown has been deleted.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete breakdown.",
                variant: "destructive",
            });
        },
    });
}

export function useSendBreakdownToMainApp() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (breakdown: Breakdown) => {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            // Call the sender edge function
            const response = await fetch(`${supabaseUrl}/functions/v1/send-breakdown`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${anonKey}`,
                },
                body: JSON.stringify({ breakdown_id: breakdown.id }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(err.error || `Failed to send: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
            toast({
                title: "Sent to Workshop",
                description: "Breakdown has been sent to the main app for inspection scheduling.",
            });
        },
        onError: (error) => {
            toast({
                title: "Send Failed",
                description: error.message || "Failed to send breakdown to main app.",
                variant: "destructive",
            });
        },
    });
}
