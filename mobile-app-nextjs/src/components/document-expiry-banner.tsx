"use client";

import { Badge } from "@/components/ui/badge";
import type { DocumentAlert } from "@/hooks/use-driver-documents";
import { AlertTriangle, Clock, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface DocumentExpiryBannerProps {
  alerts: DocumentAlert[];
  expiredCount: number;
  expiringCount: number;
}

export function DocumentExpiryBanner({ alerts, expiredCount, expiringCount }: DocumentExpiryBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || alerts.length === 0) return null;

  const hasExpired = expiredCount > 0;

  return (
    <Link href="/profile/documents" className="block">
      <div
        className={`rounded-2xl border shadow-sm p-4 animate-fade-up ${
          hasExpired
            ? "border-destructive/30 bg-destructive/5"
            : "border-amber-500/30 bg-amber-500/5"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              hasExpired ? "bg-destructive/10" : "bg-amber-500/10"
            }`}
          >
            {hasExpired ? (
              <ShieldAlert className="w-5 h-5 text-destructive" strokeWidth={2} />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500" strokeWidth={2} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className={`text-sm font-semibold ${hasExpired ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                {hasExpired ? "Document Expired" : "Documents Expiring Soon"}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDismissed(true);
                }}
                className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            <div className="mt-2 space-y-1.5">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.documentType} className="flex items-center gap-2">
                  <Clock
                    className={`w-3.5 h-3.5 shrink-0 ${
                      alert.status === "expired" ? "text-destructive" : "text-amber-500"
                    }`}
                    strokeWidth={2}
                  />
                  <span className="text-xs text-foreground font-medium truncate">
                    {alert.shortLabel}
                  </span>
                  <Badge
                    variant={alert.status === "expired" ? "destructive" : "secondary"}
                    className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                  >
                    {alert.status === "expired"
                      ? `Expired ${Math.abs(alert.daysUntilExpiry)}d ago`
                      : `${alert.daysUntilExpiry}d left`}
                  </Badge>
                </div>
              ))}
              {alerts.length > 3 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  +{alerts.length - 3} more document{alerts.length - 3 > 1 ? "s" : ""}
                </p>
              )}
            </div>

            <div className="mt-2 flex gap-2">
              {expiredCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {expiredCount} expired
                </Badge>
              )}
              {expiringCount > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                  {expiringCount} expiring
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
