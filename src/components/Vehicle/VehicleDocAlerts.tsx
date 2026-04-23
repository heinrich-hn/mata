import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AlertTriangle, ChevronDown, Download, FileWarning, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";

interface VehicleDocIssue {
    vehicleId: string;
    fleetNumber: string;
    registration: string;
    issues: string[];
}

interface VehicleRow {
    id: string;
    fleet_number: string | null;
    registration_number: string;
    license_disk_expiry: string | null;
    insurance_expiry: string | null;
    mot_expiry: string | null;
    active_document_types: string[] | null;
}

type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };


export default function VehicleDocAlerts() {
    const [expanded, setExpanded] = useState(false);

    const { data: alertData, isLoading, isError } = useQuery({
        queryKey: ["vehicle-doc-alerts"],
        queryFn: async () => {
            const today = new Date().toISOString().split("T")[0];

            // Fetch all active vehicles
            const { data: rawVehicles, error: vErr } = await supabase
                .from("vehicles")
                .select("*")
                .eq("active", true)
                .order("fleet_number");
            if (vErr) throw vErr;
            const vehicles = (rawVehicles || []) as unknown as VehicleRow[];
            if (vehicles.length === 0) return [];

            // Fetch all work_documents for these vehicles
            const vehicleIds = vehicles.map(v => v.id);
            const { data: docs, error: dErr } = await supabase
                .from("work_documents")
                .select("vehicle_id, document_category, metadata")
                .in("vehicle_id", vehicleIds);
            if (dErr) throw dErr;

            // Build per-vehicle, per-category document status.
            // hasValidExpiry: at least one doc has expiry_date >= today.
            // allExpired: every doc that has an expiry_date has it < today
            //   (a doc with no expiry date is NOT treated as expired).
            type CatStatus = { hasDoc: boolean; hasValidExpiry: boolean; allExpired: boolean };
            const vehicleDocStatus: Record<string, Record<string, CatStatus>> = {};

            (docs || []).forEach(doc => {
                if (!doc.vehicle_id || !doc.document_category) return;
                const vid = doc.vehicle_id;
                const cat = doc.document_category;
                if (!vehicleDocStatus[vid]) vehicleDocStatus[vid] = {};
                if (!vehicleDocStatus[vid][cat]) {
                    vehicleDocStatus[vid][cat] = { hasDoc: false, hasValidExpiry: false, allExpired: true };
                }

                vehicleDocStatus[vid][cat].hasDoc = true;
                const meta = doc.metadata as Record<string, unknown> | null;
                const expiryDate = meta?.expiry_date as string | undefined;

                if (!expiryDate) {
                    // No expiry stored — don't count as expired
                    vehicleDocStatus[vid][cat].allExpired = false;
                } else if (expiryDate >= today) {
                    vehicleDocStatus[vid][cat].hasValidExpiry = true;
                    vehicleDocStatus[vid][cat].allExpired = false;
                }
                // else: expired doc — allExpired stays true unless a later iteration clears it
            });

            // Determine status combining an inline vehicle field with uploaded work_documents.
            // A category is 'ok' if either source has a valid (non-expired) date.
            type DocStatus = "ok" | "expired" | "missing" | "no-date";
            const getCategoryStatus = (
                catDocs: CatStatus | undefined,
                inlineExpiry: string | null
            ): DocStatus => {
                const inlineValid = !!inlineExpiry && inlineExpiry >= today;
                const inlineExpired = !!inlineExpiry && inlineExpiry < today;

                if (inlineValid || catDocs?.hasValidExpiry) return "ok";

                const hasAnyDoc = catDocs?.hasDoc ?? false;
                if (!hasAnyDoc && !inlineExpiry) return "missing";
                if (inlineExpired || catDocs?.allExpired) return "expired";
                return "no-date";
            };

            const issues: VehicleDocIssue[] = [];

            vehicles.forEach(v => {
                const vehicleIssues: string[] = [];
                const activeTypes = v.active_document_types || [];
                const isActive = (cat: string) => activeTypes.includes(cat);
                const docStatus = vehicleDocStatus[v.id] || {};

                // License disk — cross-check work_documents + v.license_disk_expiry
                if (isActive("license_disk")) {
                    const status = getCategoryStatus(docStatus["license_disk"], v.license_disk_expiry);
                    if (status === "missing") vehicleIssues.push("Missing License Disk");
                    else if (status === "expired") vehicleIssues.push("License disk expired");
                    else if (status === "no-date") vehicleIssues.push("No license disk expiry date set");
                }

                // Insurance — cross-check work_documents + v.insurance_expiry
                if (isActive("insurance")) {
                    const status = getCategoryStatus(docStatus["insurance"], v.insurance_expiry);
                    if (status === "missing") vehicleIssues.push("Missing Insurance");
                    else if (status === "expired") vehicleIssues.push("Insurance expired");
                    else if (status === "no-date") vehicleIssues.push("No insurance expiry date set");
                }

                // COF — check work_documents only (no inline vehicle field)
                if (isActive("cof")) {
                    const cofDoc = docStatus["cof"];
                    if (!cofDoc?.hasDoc) vehicleIssues.push("Missing COF");
                    else if (cofDoc.allExpired) vehicleIssues.push("COF expired");
                }

                // All other active categories — flag only if an uploaded doc is fully expired
                // Note: "roadworthy" is excluded because COF serves as the roadworthy certificate.
                const handledCats = new Set(["license_disk", "insurance", "mot", "cof", "roadworthy"]);
                activeTypes.forEach(cat => {
                    if (handledCats.has(cat)) return;
                    const catDoc = docStatus[cat];
                    if (catDoc?.hasDoc && catDoc.allExpired) {
                        vehicleIssues.push(`${formatDocCategory(cat)} document expired`);
                    }
                });

                if (vehicleIssues.length > 0) {
                    issues.push({
                        vehicleId: v.id,
                        fleetNumber: v.fleet_number || "—",
                        registration: v.registration_number,
                        issues: vehicleIssues,
                    });
                }
            });

            return issues;
        },
        // Mutations elsewhere invalidate this query, so a short staleTime is safe
        // and avoids re-running the aggregation on every focus/remount.
        staleTime: 60 * 1000,
    });

    const handleExportPDF = () => {
        if (!alertData || alertData.length === 0) return;
        const doc = new jsPDF() as JsPDFWithAutoTable;
        const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

        // Header
        doc.setFontSize(16);
        doc.setTextColor(180, 80, 0);
        doc.text("Vehicle Document Issues Report", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${today}`, 14, 28);
        doc.text(`Total vehicles with issues: ${alertData.length}`, 14, 34);

        // Summary counts
        const expiredTotal = alertData.filter(v => v.issues.some(i => i.includes("expired"))).length;
        const missingTotal = alertData.filter(v => v.issues.some(i => i.includes("Missing") || i.includes("No "))).length;
        doc.text(`Expired: ${expiredTotal} vehicles  |  Missing docs/dates: ${missingTotal} vehicles`, 14, 40);

        // Table
        const rows = alertData.map(v => [
            v.fleetNumber,
            v.registration,
            v.issues.filter(i => i.includes("expired")).join(", ") || "—",
            v.issues.filter(i => i.includes("Missing") || i.includes("No ")).join(", ") || "—",
        ]);

        autoTable(doc, {
            startY: 46,
            head: [["Fleet #", "Registration", "Expired", "Missing / No Date"]],
            body: rows,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [180, 80, 0], textColor: 255, fontStyle: "bold" },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 35 },
            },
            alternateRowStyles: { fillColor: [255, 248, 235] },
        });

        // Footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
            doc.text("MATA Fleet Management", 14, doc.internal.pageSize.getHeight() - 10);
        }

        doc.save(`vehicle-document-issues-${new Date().toISOString().split("T")[0]}.pdf`);
    };

    if (isLoading) {
        return (
            <Alert className="border-muted bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Checking vehicle documents...</AlertTitle>
            </Alert>
        );
    }

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Failed to check vehicle documents</AlertTitle>
                <AlertDescription className="text-xs">Could not fetch document status. Try refreshing the page.</AlertDescription>
            </Alert>
        );
    }

    if (!alertData || alertData.length === 0) return null;

    const expiredCount = alertData.filter(v =>
        v.issues.some(i => i.includes("expired"))
    ).length;
    const missingCount = alertData.filter(v =>
        v.issues.some(i => i.includes("Missing") || i.includes("No "))
    ).length;

    return (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
            <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 !text-amber-600" />
                <AlertTitle className="flex items-center justify-between">
                    <span>
                        Document Issues — {alertData.length} vehicle{alertData.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                        {expiredCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                                <ShieldAlert className="h-3 w-3 mr-1" />
                                {expiredCount} expired
                            </Badge>
                        )}
                        {missingCount > 0 && (
                            <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">
                                <FileWarning className="h-3 w-3 mr-1" />
                                {missingCount} missing docs
                            </Badge>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
                            onClick={(e) => { e.stopPropagation(); handleExportPDF(); }}
                        >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                        </Button>
                        <CollapsibleTrigger className="ml-1 p-1 hover:bg-amber-100 rounded transition-colors">
                            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                    </div>
                </AlertTitle>
                <AlertDescription className="text-xs mt-1">
                    Vehicles with missing or expired documentation require attention.
                </AlertDescription>
                <CollapsibleContent>
                    <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5">
                        {alertData.map(v => (
                            <div key={v.vehicleId} className="flex items-start gap-2 text-xs bg-amber-100/50 dark:bg-amber-900/20 rounded px-2 py-1.5">
                                <span className="font-mono font-bold whitespace-nowrap min-w-[60px]">{v.fleetNumber}</span>
                                <span className="text-amber-700 dark:text-amber-300">{v.registration}</span>
                                <span className="text-amber-600 dark:text-amber-400">—</span>
                                <span className="text-amber-800 dark:text-amber-200">{v.issues.join(" • ")}</span>
                            </div>
                        ))}
                    </div>
                </CollapsibleContent>
            </Alert>
        </Collapsible>
    );
}

function formatDocCategory(cat: string): string {
    const map: Record<string, string> = {
        license_disk: "License Disk",
        insurance: "Insurance",
        cof: "COF",
        permit: "Permit",
    };
    return map[cat] || cat.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}
