import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Load } from "./useTrips";

export type TruckStopOrderStatus =
    | "pending"
    | "approved"
    | "fulfilled"
    | "cancelled";

export interface TruckStopOrderDriver {
    id: string;
    name: string;
    contact: string;
}

export interface TruckStopOrderFleetVehicle {
    id: string;
    vehicle_id: string;
    type: string;
}

export interface TruckStopOrder {
    id: string;
    order_number: string;
    truck_stop: string;
    load_id: string;
    driver_id: string | null;
    fleet_vehicle_id: string | null;
    recipient_name: string | null;
    recipient_phone: string | null;
    cost_per_night: number | null;
    notes: string | null;
    status: TruckStopOrderStatus;
    created_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
    fulfilled_at: string | null;
    created_at: string;
    updated_at: string;
    // Joined data
    load?: Load | null;
    driver?: TruckStopOrderDriver | null;
    fleet_vehicle?: TruckStopOrderFleetVehicle | null;
}

export interface TruckStopOrderInsert {
    order_number: string;
    truck_stop: string;
    load_id: string;
    driver_id?: string | null;
    fleet_vehicle_id?: string | null;
    recipient_name?: string | null;
    recipient_phone?: string | null;
    cost_per_night?: number | null;
    notes?: string | null;
    status?: TruckStopOrderStatus;
}

// Generate unique truck stop order number
export function generateTruckStopOrderNumber(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
    return `TS-${year}${month}${day}-${random}`;
}

export function useTruckStopOrders() {
    return useQuery({
        queryKey: ["truck_stop_orders"],
        queryFn: async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any)
                .from("truck_stop_orders")
                .select(
                    `
          *,
          load:loads(
            id,
            load_id,
            origin,
            destination,
            loading_date,
            offloading_date,
            status,
            driver:drivers!loads_driver_id_fkey(id, name, contact),
            fleet_vehicle:fleet_vehicles(id, vehicle_id, type)
          ),
          driver:drivers(id, name, contact),
          fleet_vehicle:fleet_vehicles(id, vehicle_id, type)
        `,
                )
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as TruckStopOrder[];
        },
    });
}

export function useCreateTruckStopOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (order: TruckStopOrderInsert) => {
            const payload: TruckStopOrderInsert = {
                ...order,
                notes: order.notes?.trim() || null,
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any)
                .from("truck_stop_orders")
                .insert(payload)
                .select()
                .single();

            if (error) throw error;
            return data as TruckStopOrder;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["truck_stop_orders"] });
            toast({ title: "Truck stop order created successfully" });
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to create truck stop order",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export interface TruckStopOrderUpdate {
    id: string;
    truck_stop?: string;
    driver_id?: string | null;
    fleet_vehicle_id?: string | null;
    recipient_name?: string | null;
    recipient_phone?: string | null;
    cost_per_night?: number | null;
    notes?: string | null;
    status?: TruckStopOrderStatus;
}

export function useUpdateTruckStopOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updates }: TruckStopOrderUpdate) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any)
                .from("truck_stop_orders")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data as TruckStopOrder;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["truck_stop_orders"] });
            toast({ title: "Truck stop order updated successfully" });
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to update truck stop order",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export function useDeleteTruckStopOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any)
                .from("truck_stop_orders")
                .delete()
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["truck_stop_orders"] });
            toast({ title: "Truck stop order deleted successfully" });
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to delete truck stop order",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export function useApproveTruckStopOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any)
                .from("truck_stop_orders")
                .update({
                    status: "approved",
                    approved_at: new Date().toISOString(),
                })
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data as TruckStopOrder;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["truck_stop_orders"] });
            toast({ title: "Truck stop order approved" });
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to approve truck stop order",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export function useFulfillTruckStopOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any)
                .from("truck_stop_orders")
                .update({
                    status: "fulfilled",
                    fulfilled_at: new Date().toISOString(),
                })
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data as TruckStopOrder;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["truck_stop_orders"] });
            toast({ title: "Truck stop order marked as fulfilled" });
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to fulfill truck stop order",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}
