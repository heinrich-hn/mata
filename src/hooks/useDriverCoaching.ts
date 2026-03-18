import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Use the exact Supabase Update type for better type safety
type CoachingData = Database["public"]["Tables"]["driver_behavior_events"]["Update"];

export const useDriverCoaching = () => {
  const queryClient = useQueryClient();

  const saveCoachingSession = useMutation({
    mutationFn: async ({ eventId, coachingData }: { eventId: string; coachingData: CoachingData }) => {
      const { data, error } = await supabase
        .from("driver_behavior_events")
        .update(coachingData)
        .eq("id", eventId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-behavior-events"] });
    },
  });

  return {
    saveCoachingSession: (eventId: string, coachingData: CoachingData) =>
      saveCoachingSession.mutateAsync({ eventId, coachingData }),
    isLoading: saveCoachingSession.isPending,
  };
};