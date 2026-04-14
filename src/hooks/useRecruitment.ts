import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import {
CandidateStatus,
DriverCandidate,
DriverCandidateInsert,
DriverCandidateUpdate,
EvaluationResult,
EvaluationStep,
} from '@/types/recruitment';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

// Database row type
type DbDriverCandidate = Database['public']['Tables']['driver_candidates']['Row'];

// Transform database row to our domain type
const transformDbCandidate = (row: DbDriverCandidate): DriverCandidate => ({
  id: row.id,
  candidate_number: row.candidate_number,
  first_name: row.first_name,
  last_name: row.last_name,
  phone: row.phone,
  email: row.email || undefined,
  license_number: row.license_number,
  license_class: row.license_class,
  license_expiry: row.license_expiry,
  years_experience: row.years_experience || 0,
  previous_employer: row.previous_employer || undefined,
  address: row.address || undefined,
  city: row.city || undefined,
  application_date: row.application_date,
  status: row.status as CandidateStatus,
  current_step: row.current_step as EvaluationStep,
  interview_result: row.interview_result as unknown as EvaluationResult | undefined,
  yard_test_result: row.yard_test_result as unknown as EvaluationResult | undefined,
  road_test_result: row.road_test_result as unknown as EvaluationResult | undefined,
  notes: row.notes || undefined,
  rejection_reason: row.rejection_reason || undefined,
  created_at: row.created_at || new Date().toISOString(),
  updated_at: row.updated_at || new Date().toISOString(),
});

export const useRecruitment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCandidate, setSelectedCandidate] = useState<DriverCandidate | null>(null);

  // Fetch all candidates from Supabase
  const {
    data: candidates = [],
    isLoading,
    error,
    refetch,
  } = useQuery<DriverCandidate[]>({
    queryKey: ['driver_candidates'],
    queryFn: async (): Promise<DriverCandidate[]> => {
      const { data, error } = await supabase
        .from('driver_candidates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(transformDbCandidate);
    },
    staleTime: 30000,
  });

  // Create candidate mutation
  const createCandidateMutation = useMutation({
    mutationFn: async (candidate: DriverCandidateInsert): Promise<DriverCandidate> => {
      // Database trigger will auto-generate candidate_number
      const { data, error } = await supabase
        .from('driver_candidates')
        .insert([{
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          phone: candidate.phone,
          email: candidate.email || null,
          license_number: candidate.license_number,
          license_class: candidate.license_class,
          license_expiry: candidate.license_expiry,
          years_experience: candidate.years_experience || 0,
          previous_employer: candidate.previous_employer || null,
          address: candidate.address || null,
          city: candidate.city || null,
          application_date: candidate.application_date || new Date().toISOString().split('T')[0],
          status: candidate.status || 'new',
          current_step: candidate.current_step || 'interview',
          notes: candidate.notes || null,
          candidate_number: '',
        }])
        .select()
        .single();

      if (error) throw error;
      return transformDbCandidate(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['driver_candidates'] });
      toast({
        title: 'Candidate Added',
        description: `${data.first_name} ${data.last_name} (${data.candidate_number}) has been added to the recruitment pipeline.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add candidate',
        variant: 'destructive',
      });
    },
  });

  // Update candidate mutation
  const updateCandidateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: DriverCandidateUpdate }): Promise<DriverCandidate> => {
      const { data, error } = await supabase
        .from('driver_candidates')
        .update({
          ...updates,
          interview_result: updates.interview_result ? JSON.parse(JSON.stringify(updates.interview_result)) : undefined,
          yard_test_result: updates.yard_test_result ? JSON.parse(JSON.stringify(updates.yard_test_result)) : undefined,
          road_test_result: updates.road_test_result ? JSON.parse(JSON.stringify(updates.road_test_result)) : undefined,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return transformDbCandidate(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['driver_candidates'] });
      toast({
        title: 'Candidate Updated',
        description: `${data.first_name} ${data.last_name}'s record has been updated.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update candidate',
        variant: 'destructive',
      });
    },
  });

  // Delete candidate mutation
  const deleteCandidateMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('driver_candidates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver_candidates'] });
      toast({
        title: 'Candidate Removed',
        description: 'The candidate has been removed from the recruitment pipeline.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove candidate',
        variant: 'destructive',
      });
    },
  });

  // Update evaluation result
  const updateEvaluation = useCallback(
    async (candidateId: string, step: EvaluationStep, result: EvaluationResult) => {
      const candidate = candidates.find(c => c.id === candidateId);
      if (!candidate) return;

      const updates: DriverCandidateUpdate = {};

      // Set the evaluation result for the specific step
      switch (step) {
        case 'interview':
          updates.interview_result = result;
          break;
        case 'yard_test':
          updates.yard_test_result = result;
          break;
        case 'road_test':
          updates.road_test_result = result;
          break;
      }

      // Update current step and status based on result
      if (result.status === 'passed') {
        if (step === 'interview') {
          updates.current_step = 'yard_test';
          updates.status = 'in_progress';
        } else if (step === 'yard_test') {
          updates.current_step = 'road_test';
          updates.status = 'in_progress';
        } else if (step === 'road_test') {
          updates.status = 'hired';
        }
      } else if (result.status === 'failed') {
        updates.status = 'rejected';
        updates.rejection_reason = `Failed ${step.replace('_', ' ')}`;
      }

      await updateCandidateMutation.mutateAsync({ id: candidateId, updates });
    },
    [candidates, updateCandidateMutation]
  );

  // Get candidates by status
  const getCandidatesByStatus = useCallback(
    (status: CandidateStatus) => {
      return candidates.filter(c => c.status === status);
    },
    [candidates]
  );

  // Get candidates at specific evaluation step
  const getCandidatesAtStep = useCallback(
    (step: EvaluationStep) => {
      return candidates.filter(c => c.current_step === step && c.status === 'in_progress');
    },
    [candidates]
  );

  // Get candidate full name helper
  const getCandidateFullName = (candidate: DriverCandidate): string => {
    return `${candidate.first_name} ${candidate.last_name}`;
  };

  // Statistics
  const stats = {
    total: candidates.length,
    new: candidates.filter(c => c.status === 'new').length,
    inProgress: candidates.filter(c => c.status === 'in_progress').length,
    atInterview: candidates.filter(c => c.current_step === 'interview' && c.status !== 'rejected' && c.status !== 'hired').length,
    atYardTest: candidates.filter(c => c.current_step === 'yard_test' && c.status !== 'rejected' && c.status !== 'hired').length,
    atRoadTest: candidates.filter(c => c.current_step === 'road_test' && c.status !== 'rejected' && c.status !== 'hired').length,
    hired: candidates.filter(c => c.status === 'hired').length,
    rejected: candidates.filter(c => c.status === 'rejected').length,
  };

  return {
    candidates,
    isLoading,
    error,
    refetch,
    stats,
    selectedCandidate,
    setSelectedCandidate,
    createCandidate: createCandidateMutation.mutate,
    createCandidateAsync: createCandidateMutation.mutateAsync,
    isCreating: createCandidateMutation.isPending,
    updateCandidate: (id: string, updates: DriverCandidateUpdate) =>
      updateCandidateMutation.mutate({ id, updates }),
    updateCandidateAsync: (id: string, updates: DriverCandidateUpdate) =>
      updateCandidateMutation.mutateAsync({ id, updates }),
    isUpdating: updateCandidateMutation.isPending,
    deleteCandidate: deleteCandidateMutation.mutate,
    deleteCandidateAsync: deleteCandidateMutation.mutateAsync,
    isDeleting: deleteCandidateMutation.isPending,
    updateEvaluation,
    getCandidatesByStatus,
    getCandidatesAtStep,
    getCandidateFullName,
  };
};