import type { ChecklistResponse } from "@/constants/incidentChecklist";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface IncidentChecklistData {
  id: string;
  incident_id: string;
  responses: ChecklistResponse[];
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch checklist for an incident
export const useIncidentChecklist = (incidentId: string | undefined) => {
  return useQuery({
    queryKey: ["incident-checklist", incidentId],
    queryFn: async (): Promise<IncidentChecklistData | null> => {
      if (!incidentId) return null;

      const { data, error } = await supabase
        .from("incident_checklists")
        .select("*")
        .eq("incident_id", incidentId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No checklist exists yet
          return null;
        }
        throw error;
      }

      return {
        ...data,
        responses: (data.responses as unknown as ChecklistResponse[]) || [],
      };
    },
    enabled: !!incidentId,
  });
};

// Create or update checklist
export const useSaveIncidentChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      incidentId,
      responses,
      completedBy,
    }: {
      incidentId: string;
      responses: ChecklistResponse[];
      completedBy?: string;
    }) => {
      // Check if all items are answered
      const allAnswered = responses.length === 23 && responses.every(r => r.response !== null);

      const checklistData = {
        incident_id: incidentId,
        responses: responses as unknown as Json,
        completed_at: allAnswered ? new Date().toISOString() : null,
        completed_by: allAnswered ? completedBy : null,
      };

      // Try to upsert
      const { data, error } = await supabase
        .from("incident_checklists")
        .upsert(checklistData, {
          onConflict: "incident_id",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["incident-checklist", variables.incidentId] });
    },
  });
};

// Update a single checklist response
export const useUpdateChecklistItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      incidentId,
      itemId,
      response,
      notes,
      completedBy,
      existingResponses,
    }: {
      incidentId: string;
      itemId: number;
      response: boolean | null;
      notes?: string;
      completedBy: string;
      existingResponses: ChecklistResponse[];
    }) => {
      // Update or add the response
      const updatedResponses = [...existingResponses];
      const existingIndex = updatedResponses.findIndex(r => r.item_id === itemId);

      const newResponse: ChecklistResponse = {
        item_id: itemId,
        response,
        notes,
        completed_at: new Date().toISOString(),
        completed_by: completedBy,
      };

      if (existingIndex >= 0) {
        updatedResponses[existingIndex] = newResponse;
      } else {
        updatedResponses.push(newResponse);
      }

      // Check if all items are answered
      const allAnswered = updatedResponses.length === 23 && updatedResponses.every(r => r.response !== null);

      const { data, error } = await supabase
        .from("incident_checklists")
        .upsert({
          incident_id: incidentId,
          responses: updatedResponses as unknown as Json,
          completed_at: allAnswered ? new Date().toISOString() : null,
          completed_by: allAnswered ? completedBy : null,
        }, {
          onConflict: "incident_id",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["incident-checklist", variables.incidentId] });
    },
  });
};

// Delete checklist (reset)
export const useDeleteIncidentChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase
        .from("incident_checklists")
        .delete()
        .eq("incident_id", incidentId);

      if (error) throw error;
    },
    onSuccess: (_, incidentId) => {
      queryClient.invalidateQueries({ queryKey: ["incident-checklist", incidentId] });
    },
  });
};