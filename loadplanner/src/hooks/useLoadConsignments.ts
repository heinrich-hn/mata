import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Load } from './useTrips';

export interface LoadConsignment {
  id: string;
  consignment_number: string;
  source_load_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_reference: string | null;

  // Load details
  origin: string;
  destination: string;
  cargo_type: string | null;
  quantity: number | null;
  weight: number | null;
  loading_date: string | null;
  offloading_date: string | null;
  special_handling: string[] | null;

  // Financials
  agreed_rate: number | null;
  rate_currency: string;
  rate_type: 'per_load' | 'per_km' | 'per_ton' | null;
  total_distance_km: number | null;
  total_amount: number | null;

  // Supplier vehicle
  supplier_vehicle_id: string | null;
  supplier_vehicle_reg: string | null;
  supplier_driver_name: string | null;
  supplier_driver_phone: string | null;
  supplier_driver_license: string | null;

  // Tracking
  status: 'pending' | 'assigned' | 'in-transit' | 'delivered' | 'completed' | 'cancelled';
  pod_received: boolean;
  pod_url: string | null;
  invoice_received: boolean;
  invoice_number: string | null;
  invoice_amount: number | null;
  invoice_date: string | null;
  payment_due_date: string | null;
  payment_status: 'unpaid' | 'partial' | 'paid';
  payment_date: string | null;

  // Timestamps
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;

  // Metadata
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;

  // Joined fields
  source_load?: Load;
}

export type LoadConsignmentInsert = Omit<LoadConsignment, 'id' | 'created_at' | 'updated_at' | 'consignment_number'> & {
  consignment_number?: string;
};

export type LoadConsignmentUpdate = Partial<LoadConsignmentInsert> & { id: string };

// Generate consignment number
const generateConsignmentNumber = (() => {
  let counter = 1;
  return () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const sequential = counter.toString().padStart(4, '0');
    counter++;
    return `CN-${year}${month}${day}-${sequential}`;
  };
})();

export function useLoadConsignments(options?: { supplierId?: string; status?: string }) {
  return useQuery({
    queryKey: ['load-consignments', options],
    queryFn: async () => {
      let query = supabase
        .from('load_consignments')
        .select(`
          *,
          source_load:loads(*)
        `)
        .order('created_at', { ascending: false });

      if (options?.supplierId) {
        query = query.eq('supplier_id', options.supplierId);
      }

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as (LoadConsignment & { source_load: Load | null })[];
    },
  });
}

export function useCreateLoadConsignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (consignment: LoadConsignmentInsert) => {
      const consignmentNumber = consignment.consignment_number || generateConsignmentNumber();

      const { data, error } = await supabase
        .from('load_consignments')
        .insert({
          ...consignment,
          consignment_number: consignmentNumber,
        })
        .select()
        .single();

      if (error) throw error;
      return data as LoadConsignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['load-consignments'] });
      toast({
        title: 'Consignment Created',
        description: 'Load consignment has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create consignment: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateLoadConsignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: LoadConsignmentUpdate) => {
      const { data, error } = await supabase
        .from('load_consignments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as LoadConsignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['load-consignments'] });
      toast({
        title: 'Consignment Updated',
        description: 'Load consignment has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update consignment: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteLoadConsignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('load_consignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['load-consignments'] });
      toast({
        title: 'Consignment Deleted',
        description: 'Load consignment has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete consignment: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}