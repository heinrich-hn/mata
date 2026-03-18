// src/hooks/useCRAReports.ts
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CRAReport {
  id: string;
  cra_number: string;
  discovery_date: string;
  discovered_by: string;
  issue_category: string;
  issue_description: string;
  root_cause: string;
  contributing_factors: string | null;
  corrective_actions_taken: string;
  preventive_measures: string;
  risk_assessment: string | null;
  testing_results: string | null;
  verification_method: string | null;
  verification_date: string | null;
  verified_by: string | null;
  follow_up_requirements: string | null;
  status: string;
  vehicle_id: string;
  work_order_id: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useCRAReports() {
  return useQuery({
    queryKey: ['cra_reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cra_reports')
        .select(`
          *,
          vehicles:vehicle_id (
            id,
            fleet_number,
            registration_number
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });
}

export function useCRAReport(id: string | undefined) {
  return useQuery({
    queryKey: ['cra_report', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('cra_reports')
        .select(`
          *,
          vehicles:vehicle_id (
            id,
            fleet_number,
            registration_number
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
}

export function useCreateCRAReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<CRAReport, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: newReport, error } = await supabase
        .from('cra_reports')
        .insert([{
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return newReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cra_reports'] });
      toast({
        title: "Success",
        description: "CRA Report created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}

export function useUpdateCRAReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CRAReport> }) => {
      const { error } = await supabase
        .from('cra_reports')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cra_reports'] });
      toast({
        title: "Success",
        description: "CRA Report updated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}

export function useDeleteCRAReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cra_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cra_reports'] });
      toast({
        title: "Success",
        description: "CRA Report deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}

export function useSubmitCRAReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cra_reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cra_reports'] });
      toast({
        title: "Success",
        description: "CRA Report submitted for review"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}

export function useApproveCRAReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, approvedBy }: { id: string; approvedBy: string }) => {
      const { error } = await supabase
        .from('cra_reports')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: approvedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cra_reports'] });
      toast({
        title: "Success",
        description: "CRA Report approved"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}