import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Types
export interface QuoteAttachment {
  file_url: string;
  file_name: string;
  vendor_name: string;
  price: number | null;
  uploaded_at: string;
}

export interface PartsRequest {
  id: string;
  job_card_id: string | null;
  part_name: string;
  part_number: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  vendor_id: string | null;
  inventory_id: string | null;
  is_from_inventory: boolean | null;
  is_service: boolean | null;
  service_description: string | null;
  unit_price: number | null;
  total_price: number | null;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  // Workflow tracking fields
  ir_number: string | null;
  sage_requisition_number: string | null;
  sage_requisition_date: string | null;
  sage_requisition_by: string | null;
  cash_manager_reference: string | null;
  cash_manager_approval_date: string | null;
  cash_manager_approved_by: string | null;
  ordered_at: string | null;
  ordered_by: string | null;
  expected_delivery_date: string | null;
  received_date: string | null;
  received_by: string | null;
  received_quantity: number | null;
  // Procurement workflow fields
  procurement_started: boolean | null;
  allocated_to_job_card: boolean | null;
  allocated_at: string | null;
  urgency_level: 'urgent' | '1-week' | '2-weeks' | null;
  quotes: QuoteAttachment[] | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined data
  job_card?: {
    id: string;
    job_number: string;
    title: string;
    status: string;
    vehicle_id: string | null;
  };
  vendor?: {
    id: string;
    vendor_name: string;
    contact_person: string | null;
    phone: string | null;
  };
  inventory?: {
    id: string;
    name: string;
    part_number: string;
    quantity: number;
  };
}

export interface LowStockItem {
  id: string;
  name: string;
  part_number: string;
  quantity: number;
  min_quantity: number;
  category: string;
  unit_price: number | null;
  supplier: string | null;
  location: string | null;
  shortage: number;
}

export interface Vendor {
  id: string;
  vendor_id: string | null;
  vendor_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
}

export interface CreateProcurementRequest {
  part_name: string;
  part_number?: string;
  quantity: number;
  vendor_id?: string;
  notes?: string;
  unit_price?: number;
  requested_by?: string;
  is_from_inventory?: boolean;
  inventory_id?: string;
}

// Query keys
const PROCUREMENT_KEYS = {
  all: ["procurement-requests"] as const,
  pending: ["procurement-requests", "pending"] as const,
  approved: ["procurement-requests", "approved"] as const,
  cashManager: ["procurement-requests", "cash-manager"] as const,
  openRequests: ["procurement-requests", "open"] as const,
  lowStock: ["low-stock-items"] as const,
  vendors: ["vendors"] as const,
};

/**
 * Hook to fetch ALL procurement requests with proper filtering.
 * Fulfilled inventory items are EXCLUDED as they don't need procurement.
 */
export const useProcurementRequests = (status?: string) => {
  return useQuery({
    queryKey: status ? [...PROCUREMENT_KEYS.all, status] : PROCUREMENT_KEYS.all,
    queryFn: async () => {
      let query = supabase
        .from("parts_requests")
        .select(`
          *,
          job_card:job_cards(id, job_number, title, status, vehicle_id),
          vendor:vendors(id, vendor_name, contact_person, phone),
          inventory:inventory(id, name, part_number, quantity)
        `)
        // EXCLUDE fulfilled inventory items - they don't need procurement
        // EXCLUDE items already allocated to job cards from inventory
        .not('status', 'eq', 'fulfilled')
        .or('allocated_to_job_card.is.null,allocated_to_job_card.eq.false')
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as PartsRequest[];
    },
  });
};

/**
 * Hook to fetch pending requests that need attention.
 * Only returns items that are NOT fulfilled inventory items.
 */
export const usePendingRequests = () => {
  return useQuery({
    queryKey: PROCUREMENT_KEYS.pending,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts_requests")
        .select(`
          *,
          job_card:job_cards(id, job_number, title, status, vehicle_id),
          vendor:vendors(id, vendor_name, contact_person, phone),
          inventory:inventory(id, name, part_number, quantity)
        `)
        .in("status", ["pending", "requested", "ordered"])
         // EXCLUDE fulfilled inventory items (shouldn't be in pending anyway, but just in case)
         // EXCLUDE items already allocated to job cards from inventory
         .not('status', 'eq', 'fulfilled')
         .or('allocated_to_job_card.is.null,allocated_to_job_card.eq.false')
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as PartsRequest[];
    },
  });
};

/**
 * Hook to fetch low stock items from inventory
 */
export const useLowStockItems = () => {
  return useQuery({
    queryKey: PROCUREMENT_KEYS.lowStock,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("name");

      if (error) throw error;

      // Filter to items below min_quantity
      const lowStock = (data || [])
        .filter((item) => item.quantity < item.min_quantity)
        .map((item) => ({
          ...item,
          shortage: item.min_quantity - item.quantity,
        }));

      return lowStock as LowStockItem[];
    },
  });
};

/**
 * Hook to fetch vendors for selection
 */
export const useVendors = () => {
  return useQuery({
    queryKey: PROCUREMENT_KEYS.vendors,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("vendor_name");

      if (error) throw error;
      return (data || []) as Vendor[];
    },
  });
};

/**
 * Hook to create a new procurement request
 */
export const useCreateProcurementRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProcurementRequest) => {
      const { data: request, error } = await supabase
        .from("parts_requests")
        .insert([{
          part_name: data.part_name,
          part_number: data.part_number || null,
          quantity: data.quantity,
          vendor_id: data.vendor_id || null,
          notes: data.notes || null,
          unit_price: data.unit_price || null,
          total_price: data.unit_price ? data.unit_price * data.quantity : null,
          requested_by: data.requested_by || null,
          is_from_inventory: data.is_from_inventory || false,
          inventory_id: data.inventory_id || null,
          status: "pending",
        }])
        .select()
        .single();

      if (error) throw error;
      return request as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      toast({ title: "Success", description: "Procurement request created" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to update request status
 */
export const useUpdateRequestStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      vendor_id,
      approved_by,
      rejection_reason
    }: {
      id: string;
      status: string;
      vendor_id?: string;
      approved_by?: string;
      rejection_reason?: string;
    }) => {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (vendor_id) updateData.vendor_id = vendor_id;

      if (status === "approved") {
        updateData.approved_by = approved_by;
        updateData.approved_at = new Date().toISOString();
      }

      if (status === "rejected") {
        updateData.rejected_by = approved_by;
        updateData.rejected_at = new Date().toISOString();
        updateData.rejection_reason = rejection_reason;
      }

      const { data, error } = await supabase
        .from("parts_requests")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as PartsRequest;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      toast({
        title: "Status Updated",
        description: `Request ${variables.status}`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to assign vendor to request
 */
export const useAssignVendor = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      vendorId,
      unitPrice
    }: {
      requestId: string;
      vendorId: string;
      unitPrice?: number;
    }) => {
      // Get the request to calculate total
      const { data: existing } = await supabase
        .from("parts_requests")
        .select("quantity")
        .eq("id", requestId)
        .single();

      const updateData: Record<string, unknown> = {
        vendor_id: vendorId,
        status: "ordered",
        updated_at: new Date().toISOString(),
      };

      if (unitPrice && existing) {
        updateData.unit_price = unitPrice;
        updateData.total_price = unitPrice * existing.quantity;
      }

      const { data, error } = await supabase
        .from("parts_requests")
        .update(updateData)
        .eq("id", requestId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      toast({ title: "Vendor Assigned", description: "Order placed with vendor" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to mark request as received and update inventory
 */
export const useReceiveOrder = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      updateInventory = true
    }: {
      requestId: string;
      updateInventory?: boolean;
    }) => {
      // Get the request details
      const { data: request, error: fetchError } = await supabase
        .from("parts_requests")
        .select("*, inventory:inventory(id, quantity)")
        .eq("id", requestId)
        .single();

      if (fetchError) throw fetchError;
      if (!request) throw new Error("Request not found");

      // Update request status
      const { data, error } = await supabase
        .from("parts_requests")
        .update({
          status: "received",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .select()
        .single();

      if (error) throw error;

      // If linked to inventory, update stock level
      if (updateInventory && request.inventory_id && request.inventory) {
        const newQuantity = (request.inventory as { quantity: number }).quantity + request.quantity;

        await supabase
          .from("inventory")
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.inventory_id);
      }

      return data as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.lowStock });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Order Received", description: "Inventory updated" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to create replenishment request for low stock item
 */
export const useCreateReplenishmentRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: LowStockItem & { quantity_to_order?: number; vendor_id?: string }) => {
      const quantityToOrder = item.quantity_to_order || item.shortage;

      const { data, error } = await supabase
        .from("parts_requests")
        .insert([{
          part_name: item.name,
          part_number: item.part_number,
          quantity: quantityToOrder,
          vendor_id: item.vendor_id || null,
          inventory_id: item.id,
          is_from_inventory: true,
          unit_price: item.unit_price,
          total_price: item.unit_price ? item.unit_price * quantityToOrder : null,
          status: "pending",
          notes: `Auto-generated replenishment request. Current stock: ${item.quantity}, Min required: ${item.min_quantity}`,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      toast({ title: "Request Created", description: "Replenishment request submitted" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Statistics hook - only counts items that need procurement
 */
export const useProcurementStats = () => {
  return useQuery({
    queryKey: ["procurement-stats"],
    queryFn: async () => {
      const { data: requests, error } = await supabase
        .from("parts_requests")
        .select("status, total_price, is_from_inventory")
        // Exclude fulfilled inventory items from stats
        .or('status.neq.fulfilled,and(status.eq.fulfilled,is_from_inventory.eq.false)');

      if (error) throw error;

      const stats = {
        pending: 0,
        approved: 0,
        ordered: 0,
        received: 0,
        rejected: 0,
        sage_pending: 0,
        cash_manager_pending: 0,
        totalValue: 0,
        pendingValue: 0,
      };

      // Type for database response
      type DbRequest = { status: string | null; total_price: number | null };

      ((requests || []) as DbRequest[]).forEach((req) => {
        const status = req.status?.toLowerCase() || "pending";
        if (status in stats) {
          stats[status as keyof typeof stats]++;
        }
        if (status === "approved") {
          stats.sage_pending++;
        }
        if (req.total_price) {
          stats.totalValue += req.total_price;
          if (["pending", "approved", "ordered"].includes(status)) {
            stats.pendingValue += req.total_price;
          }
        }
      });

      return stats;
    },
  });
};

// Interface for updating procurement request
export interface UpdateProcurementRequest {
  id: string;
  part_name?: string;
  part_number?: string | null;
  quantity?: number;
  vendor_id?: string | null;
  notes?: string | null;
  unit_price?: number | null;
  requested_by?: string | null;
  sage_requisition_number?: string | null;
  sage_requisition_date?: string | null;
  sage_requisition_by?: string | null;
  cash_manager_reference?: string | null;
  cash_manager_approval_date?: string | null;
  cash_manager_approved_by?: string | null;
  ordered_at?: string | null;
  ordered_by?: string | null;
  expected_delivery_date?: string | null;
  received_date?: string | null;
  received_by?: string | null;
  received_quantity?: number | null;
  status?: string;
  ir_number?: string | null;
  quotes?: QuoteAttachment[];
  procurement_started?: boolean | null;
  allocated_to_job_card?: boolean | null;
}

/**
 * Hook to update/edit a procurement request
 */
export const useUpdateProcurementRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProcurementRequest) => {
      const { id, ...updateFields } = data;

      // Recalculate total_price if quantity or unit_price changed
      if (updateFields.quantity !== undefined || updateFields.unit_price !== undefined) {
        const { data: existing } = await supabase
          .from("parts_requests")
          .select("quantity, unit_price")
          .eq("id", id)
          .single();

        if (existing) {
          const newQty = updateFields.quantity ?? existing.quantity;
          const newPrice = updateFields.unit_price ?? existing.unit_price;
          if (newPrice !== null) {
            (updateFields as Record<string, unknown>).total_price = newPrice * newQty;
          }
        }
      }

      const { data: updated, error } = await supabase
        .from("parts_requests")
        .update({
          ...(updateFields as Record<string, unknown>),
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq("id", id)
        .select(`
          *,
          job_card:job_cards(id, job_number, title, status, vehicle_id),
          vendor:vendors(id, vendor_name, contact_person, phone),
          inventory:inventory(id, name, part_number, quantity)
        `)
        .single();

      if (error) throw error;
      return updated as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.openRequests });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.cashManager });
      queryClient.invalidateQueries({ queryKey: ["procurement-stats"] });
      toast({ title: "Success", description: "Request updated successfully" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to delete a procurement request
 */
export const useDeleteProcurementRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("parts_requests")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: ["procurement-stats"] });
      toast({ title: "Deleted", description: "Request deleted successfully" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to update Sage requisition details
 */
export const useUpdateSageRequisition = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      sage_requisition_number,
      sage_requisition_by,
    }: {
      id: string;
      sage_requisition_number: string;
      sage_requisition_by?: string;
    }) => {
      const { data, error } = await supabase
        .from("parts_requests")
        .update({
          sage_requisition_number,
          sage_requisition_date: new Date().toISOString(),
          sage_requisition_by: sage_requisition_by || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: ["procurement-stats"] });
      toast({ title: "Sage Requisition Added", description: "Requisition number recorded" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to update Cash Manager approval
 */
export const useUpdateCashManagerApproval = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      cash_manager_reference,
      cash_manager_approved_by,
    }: {
      id: string;
      cash_manager_reference: string;
      cash_manager_approved_by?: string;
    }) => {
      const { data, error } = await supabase
        .from("parts_requests")
        .update({
          cash_manager_reference,
          cash_manager_approval_date: new Date().toISOString(),
          cash_manager_approved_by: cash_manager_approved_by || null,
          status: "approved", // Auto-update status when Cash Manager approves
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: ["procurement-stats"] });
      toast({ title: "Cash Manager Approved", description: "Approval recorded" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to mark as ordered with vendor
 */
export const useMarkAsOrdered = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      vendor_id,
      unit_price,
      expected_delivery_date,
      ordered_by,
    }: {
      id: string;
      vendor_id: string;
      unit_price?: number;
      expected_delivery_date?: string;
      ordered_by?: string;
    }) => {
      // Get the request to calculate total
      const { data: existing } = await supabase
        .from("parts_requests")
        .select("quantity")
        .eq("id", id)
        .single();

      const updateData: Record<string, unknown> = {
        vendor_id,
        status: "ordered",
        ordered_at: new Date().toISOString(),
        ordered_by: ordered_by || null,
        expected_delivery_date: expected_delivery_date || null,
        updated_at: new Date().toISOString(),
      };

      if (unit_price && existing) {
        updateData.unit_price = unit_price;
        updateData.total_price = unit_price * existing.quantity;
      }

      const { data, error } = await supabase
        .from("parts_requests")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: ["procurement-stats"] });
      toast({ title: "Order Placed", description: "Order placed with vendor" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to mark as received with inventory update
 */
export const useMarkAsReceived = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      received_quantity,
      received_by,
      updateInventory = true,
    }: {
      id: string;
      received_quantity?: number;
      received_by?: string;
      updateInventory?: boolean;
    }) => {
      // Get the request details
      const { data: request, error: fetchError } = await supabase
        .from("parts_requests")
        .select("*, inventory:inventory(id, quantity)")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;
      if (!request) throw new Error("Request not found");

      const actualQty = received_quantity ?? request.quantity;

      // Update request status
      const { data, error } = await supabase
        .from("parts_requests")
        .update({
          status: "received",
          received_date: new Date().toISOString(),
          received_by: received_by || null,
          received_quantity: actualQty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // If linked to inventory, update stock level
      if (updateInventory && request.inventory_id && request.inventory) {
        const currentQty = (request.inventory as { quantity: number }).quantity;
        const newQuantity = currentQty + actualQty;

        await supabase
          .from("inventory")
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.inventory_id);

        // Log the transaction (if table exists)
        try {
          await supabase
            .from("inventory_transactions")
            .insert([{
              inventory_id: request.inventory_id,
              parts_request_id: id,
              transaction_type: "procurement_received",
              quantity_change: actualQty,
              quantity_before: currentQty,
              quantity_after: newQuantity,
              notes: `Received from procurement request`,
              performed_by: received_by || null,
            }]);
        } catch {
          // Ignore if inventory_transactions table doesn't exist
        }
      }

      return data as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.lowStock });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-stats"] });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.cashManager });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.openRequests });
      toast({ title: "Order Received", description: "Items received and inventory updated" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to fetch open requests (not yet in procurement, not fulfilled/allocated)
 * These are items that need to be started in procurement
 */
export const useOpenRequests = () => {
  return useQuery({
    queryKey: PROCUREMENT_KEYS.openRequests,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts_requests")
        .select(`
          *,
          job_card:job_cards(id, job_number, title, status, vehicle_id),
          vendor:vendors(id, vendor_name, contact_person, phone),
          inventory:inventory(id, name, part_number, quantity)
        `)
        // Only items that haven't started procurement AND are not fulfilled inventory items
        .or("procurement_started.is.null,procurement_started.eq.false")
        .not("status", "in", '("fulfilled","rejected")')
        .or("allocated_to_job_card.is.null,allocated_to_job_card.eq.false")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as PartsRequest[];
    },
  });
};

/**
 * Hook to fetch Cash Manager requests (procurement started, not yet fulfilled/allocated)
 */
export const useCashManagerRequests = () => {
  return useQuery({
    queryKey: PROCUREMENT_KEYS.cashManager,
    queryFn: async () => {
      // Use intermediate variable to avoid excessively deep type instantiation with complex joins
      const { data, error } = await supabase
        .from("parts_requests")
        .select("*, job_card:job_cards(id, job_number, title, status, vehicle_id), vendor:vendors(id, vendor_name, contact_person, phone), inventory:inventory(id, name, part_number, quantity)")
        .eq("procurement_started", true)
        .not("status", "eq", "fulfilled")
        // Also exclude items already allocated to job cards from inventory
        .or('allocated_to_job_card.is.null,allocated_to_job_card.eq.false')
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as PartsRequest[];
    },
  });
};

/**
 * Hook to start procurement process (create IR + quotes)
 */
export const useStartProcurement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ir_number,
      urgency_level,
      quotes,
      inventory_id,
      is_from_inventory,
      vendor_id,
      unit_price,
    }: {
      id: string;
      ir_number: string;
      urgency_level?: 'urgent' | '1-week' | '2-weeks' | null;
      quotes?: QuoteAttachment[];
      inventory_id?: string | null;
      is_from_inventory?: boolean;
      vendor_id?: string | null;
      unit_price?: number | null;
    }) => {
      const updateData: Record<string, unknown> = {
        ir_number,
        procurement_started: true,
        updated_at: new Date().toISOString(),
      };

      if (urgency_level !== undefined) {
        updateData.urgency_level = urgency_level;
      }

      if (quotes && quotes.length > 0) {
        updateData.quotes = quotes;
      }

      if (inventory_id !== undefined) {
        updateData.inventory_id = inventory_id;
        updateData.is_from_inventory = is_from_inventory ?? !!inventory_id;
      }

      if (vendor_id !== undefined) {
        updateData.vendor_id = vendor_id;
      }

      if (unit_price !== undefined && unit_price !== null) {
        updateData.unit_price = unit_price;
        // Get quantity for total_price calculation
        const { data: existing } = await supabase
          .from("parts_requests")
          .select("quantity")
          .eq("id", id)
          .single();
        if (existing) {
          updateData.total_price = unit_price * existing.quantity;
        }
      }

      const { data, error } = await supabase
        .from("parts_requests")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.openRequests });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.cashManager });
      queryClient.invalidateQueries({ queryKey: ["procurement-stats"] });
      toast({ title: "Procurement Started", description: "IR created and moved to Cash Manager" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to allocate received item to job card
 */
export const useAllocateToJobCard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("parts_requests")
        .update({
          allocated_to_job_card: true,
          allocated_at: new Date().toISOString(),
          status: "fulfilled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as PartsRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.openRequests });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.cashManager });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.lowStock });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-stats"] });
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast({ title: "Allocated", description: "Item allocated to job card and marked as fulfilled" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

/**
 * Hook to create a new inventory item and link it to a parts request
 */
export const useCreateInventoryAndLink = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      name,
      part_number,
      category,
      min_quantity,
      location,
      supplier,
      unit_price,
    }: {
      requestId: string;
      name: string;
      part_number?: string;
      category?: string;
      min_quantity?: number;
      location?: string;
      supplier?: string;
      unit_price?: number;
    }) => {
      // Create inventory item
      const { data: inventoryItem, error: invError } = await supabase
        .from("inventory")
        .insert([{
          name,
          part_number: part_number || null,
          category: category || "General",
          quantity: 0,
          min_quantity: min_quantity || 1,
          location: location || null,
          supplier: supplier || null,
          unit_price: unit_price || null,
        }])
        .select()
        .single();

      if (invError) throw invError;

      // Link to parts request
      const { data, error } = await supabase
        .from("parts_requests")
        .update({
          inventory_id: inventoryItem.id,
          is_from_inventory: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .select()
        .single();

      if (error) throw error;
      return { request: data as unknown as PartsRequest, inventoryItem };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Success", description: "New inventory item created and linked" });
      requestGoogleSheetsSync('workshop');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};