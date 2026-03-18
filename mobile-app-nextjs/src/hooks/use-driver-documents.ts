"use client";

import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Define types locally
export type DriverDocumentType =
  | 'license'
  | 'pdp'
  | 'passport'
  | 'medical'
  | 'retest'
  | 'defensive_driving';

export interface DriverDocument {
  id: string;
  driver_id: string;
  document_type: DriverDocumentType;
  document_number?: string | null;
  issuing_authority?: string | null;
  issue_date?: string | null;
  expiry_date: string | null;
  /** Legacy column name — prefer file_url */
  document_url?: string | null;
  /** Actual DB column used for the stored file link */
  file_url?: string | null;
  verified: boolean;
  verified_at?: string | null;
  verified_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export const DOCUMENT_TYPES: { value: DriverDocumentType; label: string; shortLabel: string }[] = [
  { value: "license", label: "Driver License", shortLabel: "License" },
  { value: "pdp", label: "Professional Driving Permit", shortLabel: "PDP" },
  { value: "passport", label: "Passport", shortLabel: "Passport" },
  { value: "medical", label: "Medical Certificate", shortLabel: "Medical" },
  { value: "retest", label: "Retest Certificate", shortLabel: "Retest" },
  { value: "defensive_driving", label: "Defensive Driving Permit", shortLabel: "Defensive" },
];

export type ExpiryStatus = "valid" | "expiring" | "expired" | "unknown";

export interface DocumentAlert {
  documentType: DriverDocumentType;
  label: string;
  shortLabel: string;
  expiryDate: string;
  status: ExpiryStatus;
  daysUntilExpiry: number;
}

export function getExpiryStatus(expiryDate: string | null): { status: ExpiryStatus; daysUntil: number } {
  if (!expiryDate) return { status: "unknown", daysUntil: 0 };
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return { status: "expired", daysUntil };
  if (daysUntil <= 30) return { status: "expiring", daysUntil };
  return { status: "valid", daysUntil };
}

export function useDriverDocuments(driverId?: string | null) {
  const supabase = createClient();

  const {
    data: documents = [],
    isLoading,
    refetch,
  } = useQuery<DriverDocument[]>({
    queryKey: ["driver-documents", driverId],
    queryFn: async () => {
      if (!driverId) return [];
      const { data, error } = await supabase
        .from("driver_documents")
        .select("*")
        .eq("driver_id", driverId)
        .order("document_type");

      if (error) throw error;
      return (data || []) as DriverDocument[];
    },
    enabled: !!driverId,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  // Get a specific document by type
  const getDocument = (type: DriverDocumentType): DriverDocument | undefined => {
    return documents.find((d) => d.document_type === type);
  };

  // Build alerts for documents that are expired or expiring within 30 days
  const alerts: DocumentAlert[] = documents
    .filter((doc) => doc.expiry_date)
    .map((doc) => {
      const docType = DOCUMENT_TYPES.find((t) => t.value === doc.document_type);
      const { status, daysUntil } = getExpiryStatus(doc.expiry_date);
      return {
        documentType: doc.document_type,
        label: docType?.label || doc.document_type,
        shortLabel: docType?.shortLabel || doc.document_type,
        expiryDate: doc.expiry_date!,
        status,
        daysUntilExpiry: daysUntil,
      };
    })
    .filter((a) => a.status === "expired" || a.status === "expiring")
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  // Count by severity
  const expiredCount = alerts.filter((a) => a.status === "expired").length;
  const expiringCount = alerts.filter((a) => a.status === "expiring").length;

  return {
    documents,
    isLoading,
    refetch,
    getDocument,
    alerts,
    expiredCount,
    expiringCount,
    hasAlerts: alerts.length > 0,
  };
}