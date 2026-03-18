import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DocumentAlertMetadata {
  expiry_date?: string;
  [key: string]: unknown;
}

interface DocumentAlert {
  status: string;
  metadata: DocumentAlertMetadata;
}

export function useDocumentCounts() {
  return useQuery({
    queryKey: ["document-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("metadata")
        .eq("category", "maintenance_due")
        .eq("metadata->>issue_type", "document_expiry")
        .eq("status", "active"); // Only count active alerts

      if (error) throw error;

      const now = new Date();
      const counts = {
        total: data?.length || 0,
        active: data?.length || 0,
        expired: 0,
        expiringSoon: 0,
      };

      (data as DocumentAlert[] || []).forEach((alert: DocumentAlert) => {
        const expiryDate = alert.metadata?.expiry_date;
        if (expiryDate) {
          const expDate = new Date(expiryDate);
          if (expDate < now) {
            counts.expired++;
          } else {
            const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 30) {
              counts.expiringSoon++;
            }
          }
        }
      });

      return counts;
    },
    refetchInterval: 30000,
  });
}