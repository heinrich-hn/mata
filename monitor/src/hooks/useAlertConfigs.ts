import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AlertConfiguration } from "@/types";

export function useAlertConfigs() {
  return useQuery({
    queryKey: ["alert-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_configurations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AlertConfiguration[];
    },
    staleTime: 60_000,
  });
}

export function useCreateAlertConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<AlertConfiguration, "id" | "created_by" | "created_at" | "updated_at">
    ) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("alert_configurations").insert({
        ...payload,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-configs"] });
    },
  });
}

export function useUpdateAlertConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<AlertConfiguration> & { id: string }) => {
      const { error } = await supabase
        .from("alert_configurations")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-configs"] });
    },
  });
}

export function useDeleteAlertConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alert_configurations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-configs"] });
    },
  });
}
