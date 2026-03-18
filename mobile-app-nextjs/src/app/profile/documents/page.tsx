"use client";

import { MobileShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import {
  DOCUMENT_TYPES,
  getExpiryStatus,
  useDriverDocuments,
  type DriverDocument,
} from "@/hooks/use-driver-documents";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Hash,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

// Define the document type based on DOCUMENT_TYPES
type DocumentTypeValue = typeof DOCUMENT_TYPES[number]["value"];

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

// Map document types to icons
const DOC_ICONS: Record<DocumentTypeValue, typeof FileText> = {
  license: ShieldCheck,
  pdp: ShieldCheck,
  passport: FileText,
  medical: CheckCircle2,
  retest: Clock,
  defensive_driving: ShieldCheck,
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  // Fetch driver record by email
  const { data: driver, isLoading: driverLoading } = useQuery<Driver | null>({
    queryKey: ["driver-by-email-docs", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("drivers")
        .select("id, first_name, last_name, email")
        .eq("email", user.email)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching driver:", error);
        return null;
      }
      return data as Driver | null;
    },
    enabled: !!user?.email,
  });

  const { documents, isLoading: docsLoading, alerts, expiredCount, expiringCount } =
    useDriverDocuments(driver?.id);

  const isLoading = driverLoading || docsLoading;

  const getStatusBadge = (expiryDate: string | null | undefined): ReactNode => {
    if (!expiryDate) {
      return (
        <Badge variant="outline" className="text-[10px]">
          No date
        </Badge>
      );
    }
    
    const { status, daysUntil } = getExpiryStatus(expiryDate);
    switch (status) {
      case "expired":
        return (
          <Badge variant="destructive" className="text-[10px]">
            Expired {Math.abs(daysUntil)}d ago
          </Badge>
        );
      case "expiring":
        return (
          <Badge
            variant="secondary"
            className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
          >
            {daysUntil}d left
          </Badge>
        );
      case "valid":
        return (
          <Badge
            variant="secondary"
            className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
          >
            Valid
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            No date
          </Badge>
        );
    }
  };

  // Helper function to format date safely
  const formatDate = (dateString: string | null | undefined): string | null => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return null;
    }
  };

  return (
    <MobileShell>
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="p-2 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
            aria-label="Go back to profile"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">My Documents</h1>
            <p className="text-xs text-muted-foreground">
              License, PDP, Passport & more
            </p>
          </div>
          {alerts.length > 0 && (
            <div className="flex items-center gap-1">
              {expiredCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {expiredCount}
                </Badge>
              )}
              {expiringCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400"
                >
                  {expiringCount}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Alert summary */}
        {alerts.length > 0 && (
          <div
            className={`rounded-2xl border p-4 ${
              expiredCount > 0
                ? "border-destructive/30 bg-destructive/5"
                : "border-amber-500/30 bg-amber-500/5"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {expiredCount > 0 ? (
                <ShieldAlert className="w-4 h-4 text-destructive" strokeWidth={2} />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500" strokeWidth={2} />
              )}
              <p
                className={`text-sm font-semibold ${
                  expiredCount > 0
                    ? "text-destructive"
                    : "text-amber-700 dark:text-amber-400"
                }`}
              >
                {expiredCount > 0
                  ? `${expiredCount} document${expiredCount > 1 ? "s" : ""} expired`
                  : `${expiringCount} document${expiringCount > 1 ? "s" : ""} expiring soon`}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Please contact your fleet manager to update your documents before they expire.
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Loading documents...</p>
          </div>
        )}

        {/* No driver found */}
        {!isLoading && !driver && (
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
              <p className="font-medium">No Driver Profile Found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your account is not linked to a driver profile. Contact your fleet administrator.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Document Cards */}
        {!isLoading && driver && (
          <div className="space-y-3">
            {DOCUMENT_TYPES.map((docType) => {
              const doc = documents.find((d: DriverDocument) => d.document_type === docType.value);
              const Icon = DOC_ICONS[docType.value as DocumentTypeValue] || FileText;
              const { status } = getExpiryStatus(doc?.expiry_date ?? null);
              const formattedDate = formatDate(doc?.expiry_date);

              return (
                <Card
                  key={docType.value}
                  className={`overflow-hidden ${
                    status === "expired"
                      ? "border-destructive/30"
                      : status === "expiring"
                      ? "border-amber-500/30"
                      : ""
                  }`}
                >
                  <CardContent className="p-0">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2.5 rounded-xl shrink-0 ${
                            status === "expired"
                              ? "bg-destructive/10"
                              : status === "expiring"
                              ? "bg-amber-500/10"
                              : status === "valid"
                              ? "bg-emerald-500/10"
                              : "bg-muted"
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 ${
                              status === "expired"
                                ? "text-destructive"
                                : status === "expiring"
                                ? "text-amber-500"
                                : status === "valid"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }`}
                            strokeWidth={1.5}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{docType.label}</p>
                            {doc ? getStatusBadge(doc.expiry_date) : (
                              <Badge variant="outline" className="text-[10px]">
                                Not uploaded
                              </Badge>
                            )}
                          </div>

                          {doc ? (
                            <div className="mt-2 space-y-1.5">
                              {doc.document_number && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Hash className="w-3 h-3" />
                                  <span className="truncate">{doc.document_number}</span>
                                </div>
                              )}
                              {formattedDate && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3 shrink-0" />
                                  <span>Expires: {formattedDate}</span>
                                </div>
                              )}
                              {/* Use a conditional with proper type checking */}
                              {doc.file_url && typeof doc.file_url === 'string' && doc.file_url.trim() !== '' && (
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  View document
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1">
                              No document uploaded yet
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        {!isLoading && driver && (
          <p className="text-center text-xs text-muted-foreground pt-2 pb-4">
            Documents are managed by your fleet administrator.
            <br />
            Contact them to update or upload new documents.
          </p>
        )}
      </div>
    </MobileShell>
  );
}