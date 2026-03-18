import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface Supplier {
  id: string;
  supplier_number: string;
  name: string;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  tax_id: string | null;
  payment_terms: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_branch: string | null;
  swift_code: string | null;
  notes: string | null;
  status: 'active' | 'inactive' | 'suspended';
  rating: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type SupplierInsert = Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'supplier_number'> & {
  supplier_number?: string;
};

export type SupplierUpdate = Partial<SupplierInsert> & { id: string };

// Generate supplier number
const generateSupplierNumber = (() => {
  let counter = 1;
  return () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const sequential = counter.toString().padStart(4, '0');
    counter++;
    return `SUP-${year}${month}-${sequential}`;
  };
})();

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useActiveSuppliers() {
  return useQuery({
    queryKey: ['suppliers', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplier: SupplierInsert) => {
      const supplierNumber = supplier.supplier_number || generateSupplierNumber();

      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          ...supplier,
          supplier_number: supplierNumber,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: 'Supplier Created',
        description: `${data.name} has been added successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create supplier: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: SupplierUpdate) => {
      const { data, error } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: 'Supplier Updated',
        description: `${data.name} has been updated successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update supplier: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting status to inactive
      const { error } = await supabase
        .from('suppliers')
        .update({ status: 'inactive' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: 'Supplier Deleted',
        description: 'Supplier has been deactivated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete supplier: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}