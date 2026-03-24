import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Note: After applying the migration, regenerate types with:
// npx supabase gen types typescript --project-id wxvhkljrbcpcgpgdqhsp > src/integrations/supabase/types.ts

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (tableName: string) => (supabase as any).from(tableName);

// ── Types ──────────────────────────────────────────────

export interface BulkDieselSupplier {
    id: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    location: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface BulkDieselOrder {
    id: string;
    supplier_id: string;
    order_date: string;
    quantity_liters: number;
    price_per_liter: number;
    total_cost: number;
    delivery_date: string | null;
    reference_number: string | null;
    bunker_id: string | null;
    notes: string | null;
    created_at: string;
    // joined
    supplier?: BulkDieselSupplier;
}

export interface BulkDieselPriceEntry {
    id: string;
    supplier_id: string;
    price_per_liter: number;
    effective_date: string;
    notes: string | null;
    created_at: string;
}

// ── Suppliers ──────────────────────────────────────────

export function useBulkDieselSuppliers(activeOnly = true) {
    return useQuery({
        queryKey: ["bulk_diesel_suppliers", { activeOnly }],
        queryFn: async () => {
            let query = fromTable("bulk_diesel_suppliers")
                .select("*")
                .order("name");

            if (activeOnly) {
                query = query.eq("is_active", true);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as BulkDieselSupplier[];
        },
    });
}

export function useCreateBulkDieselSupplier() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (supplier: {
            name: string;
            contact_person?: string;
            phone?: string;
            email?: string;
            location?: string;
            notes?: string;
        }) => {
            const { data, error } = await fromTable("bulk_diesel_suppliers")
                .insert(supplier)
                .select()
                .single();
            if (error) throw error;
            return data as BulkDieselSupplier;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bulk_diesel_suppliers"] });
            toast({ title: "Supplier Created", description: "New bulk diesel supplier has been added." });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });
}

export function useUpdateBulkDieselSupplier() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...updates }: Partial<BulkDieselSupplier> & { id: string }) => {
            const { data, error } = await fromTable("bulk_diesel_suppliers")
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq("id", id)
                .select()
                .single();
            if (error) throw error;
            return data as BulkDieselSupplier;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bulk_diesel_suppliers"] });
            toast({ title: "Supplier Updated", description: "Supplier details updated successfully." });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });
}

export function useDeleteBulkDieselSupplier() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await fromTable("bulk_diesel_suppliers").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bulk_diesel_suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["bulk_diesel_orders"] });
            queryClient.invalidateQueries({ queryKey: ["bulk_diesel_price_entries"] });
            toast({ title: "Supplier Deleted", description: "Bulk diesel supplier has been removed." });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });
}

// ── Orders ─────────────────────────────────────────────

export function useBulkDieselOrders(supplierId?: string) {
    return useQuery({
        queryKey: ["bulk_diesel_orders", supplierId],
        queryFn: async () => {
            let query = fromTable("bulk_diesel_orders")
                .select("*, supplier:bulk_diesel_suppliers(*)")
                .order("order_date", { ascending: false });

            if (supplierId) {
                query = query.eq("supplier_id", supplierId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as BulkDieselOrder[];
        },
    });
}

export function useCreateBulkDieselOrder() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (order: {
            supplier_id: string;
            order_date: string;
            quantity_liters: number;
            price_per_liter: number;
            delivery_date?: string;
            reference_number?: string;
            bunker_id?: string;
            notes?: string;
        }) => {
            const { data, error } = await fromTable("bulk_diesel_orders")
                .insert(order)
                .select()
                .single();
            if (error) throw error;
            return data as BulkDieselOrder;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bulk_diesel_orders"] });
            toast({ title: "Order Recorded", description: "Bulk diesel order has been recorded." });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });
}

// ── Price Entries ──────────────────────────────────────

export function useBulkDieselPriceEntries(
    supplierIds: string[],
    dateFrom?: string,
    dateTo?: string
) {
    return useQuery({
        queryKey: ["bulk_diesel_price_entries", supplierIds, dateFrom, dateTo],
        queryFn: async () => {
            if (supplierIds.length === 0) return [];

            let query = fromTable("bulk_diesel_price_entries")
                .select("*")
                .in("supplier_id", supplierIds)
                .order("effective_date", { ascending: true });

            if (dateFrom) {
                query = query.gte("effective_date", dateFrom);
            }
            if (dateTo) {
                query = query.lte("effective_date", dateTo);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as BulkDieselPriceEntry[];
        },
        enabled: supplierIds.length > 0,
    });
}

export function useCreateBulkDieselPriceEntry() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (entry: {
            supplier_id: string;
            price_per_liter: number;
            effective_date: string;
            notes?: string;
        }) => {
            const { data, error } = await fromTable("bulk_diesel_price_entries")
                .upsert(entry, { onConflict: "supplier_id,effective_date" })
                .select()
                .single();
            if (error) throw error;
            return data as BulkDieselPriceEntry;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bulk_diesel_price_entries"] });
            toast({ title: "Price Recorded", description: "Supplier price entry saved." });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });
}

export function useDeleteBulkDieselPriceEntry() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await fromTable("bulk_diesel_price_entries").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bulk_diesel_price_entries"] });
            toast({ title: "Price Deleted", description: "Price entry has been removed." });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });
}
