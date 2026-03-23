import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveFlaggedCostEntries } from "@/lib/resolveAlerts";
import type { Alert, AlertFilters, AlertComment } from "@/types";

// ─── Fetch paginated alerts ───────────────────────────────────────────────────

export function useAlerts(filters: AlertFilters) {
  return useInfiniteQuery({
    queryKey: ["alerts", filters],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("alerts")
        .select("*", { count: "exact" })
        .gte("triggered_at", filters.startDate.toISOString())
        .lte("triggered_at", filters.endDate.toISOString())
        .order("triggered_at", { ascending: false })
        .range(pageParam as number, (pageParam as number) + 49);

      if (filters.severities.length > 0) {
        query = query.in("severity", filters.severities);
      }
      if (filters.categories.length > 0) {
        query = query.in("category", filters.categories);
      }
      if (filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      }
      if (filters.sourceTypes.length > 0) {
        query = query.in("source_type", filters.sourceTypes);
      }
      if (filters.searchQuery.trim()) {
        query = query.or(
          `title.ilike.%${filters.searchQuery}%,message.ilike.%${filters.searchQuery}%`
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        alerts: (data ?? []) as Alert[],
        count: count ?? 0,
        nextOffset: (pageParam as number) + 50,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.alerts.length === 50 ? last.nextOffset : undefined,
    staleTime: 30_000,
  });
}

// ─── Fetch single alert ───────────────────────────────────────────────────────

export function useAlert(alertId: string) {
  return useQuery({
    queryKey: ["alert", alertId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("id", alertId)
        .single();
      if (error) throw error;
      return data as Alert;
    },
    enabled: !!alertId,
  });
}

// ─── Alert counts by severity ─────────────────────────────────────────────────

export function useAlertCounts(filters: AlertFilters) {
  return useQuery({
    queryKey: ["alert-counts", filters.startDate, filters.endDate, filters.statuses],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("severity")
        .gte("triggered_at", filters.startDate.toISOString())
        .lte("triggered_at", filters.endDate.toISOString())
        .in("status", filters.statuses.length > 0 ? filters.statuses : ["active"]);

      if (error) throw error;

      const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
      (data ?? []).forEach((row) => {
        const sev = row.severity as keyof typeof counts;
        if (sev in counts) counts[sev]++;
        counts.total++;
      });
      return counts;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ─── Alert comments ───────────────────────────────────────────────────────────

export function useAlertComments(alertId: string) {
  return useQuery({
    queryKey: ["alert-comments", alertId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_comments")
        .select("*")
        .eq("alert_id", alertId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AlertComment[];
    },
    enabled: !!alertId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      alertId,
      note,
    }: {
      alertId: string;
      note?: string;
    }) => {
      // Fetch the alert to check if it's a flagged cost alert
      const { data: alert } = await supabase
        .from("alerts")
        .select("category, source_id, metadata")
        .eq("id", alertId)
        .single();

      // If this is a flagged cost alert, also resolve the underlying cost entries
      if (alert?.category === "fuel_anomaly" && alert.source_id) {
        const metadata = alert.metadata as Record<string, unknown> | null;
        if (metadata?.issue_type === "flagged_costs") {
          await resolveFlaggedCostEntries(alert.source_id);
        }
      }

      const { error } = await supabase
        .from("alerts")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolution_note: note ?? null,
        })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert-counts"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-summary"] });
      queryClient.invalidateQueries({ queryKey: ["all-trips-recent"] });
      queryClient.invalidateQueries({ queryKey: ["trip-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["trip-alert-counts"] });
    },
  });
}

export function useAddAlertComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      alertId,
      userId,
      comment,
    }: {
      alertId: string;
      userId: string;
      comment: string;
    }) => {
      const { error } = await supabase.from("alert_comments").insert({
        alert_id: alertId,
        user_id: userId,
        comment,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["alert-comments", vars.alertId] });
    },
  });
}

export function useCreateManualAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      message: string;
      severity: string;
      category: string;
      source_label?: string;
    }) => {
      const { error } = await supabase.from("alerts").insert({
        source_type: "manual",
        title: payload.title,
        message: payload.message,
        category: payload.category,
        severity: payload.severity,
        source_label: payload.source_label ?? "Manual",
        metadata: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert-counts"] });
    },
  });
}

// Note: useAcknowledgeAlert has been removed as it's no longer needed