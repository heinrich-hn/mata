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
}

type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

const REQUIRED_DOC_CATEGORIES = ["license_disk", "roadworthy", "insurance"];

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

            // Build a map of vehicle -> uploaded doc categories
            const vehicleDocsMap: Record<string, Set<string>> = {};
            const vehicleExpiredDocs: Record<string, string[]> = {};

            (docs || []).forEach(doc => {
                if (!doc.vehicle_id) return;
                if (!vehicleDocsMap[doc.vehicle_id]) vehicleDocsMap[doc.vehicle_id] = new Set();
                if (doc.document_category) vehicleDocsMap[doc.vehicle_id].add(doc.document_category);

                // Check expiry from metadata
                const meta = doc.metadata as Record<string, unknown> | null;
                if (meta?.expiry_date && typeof meta.expiry_date === "string" && meta.expiry_date < today) {
                    if (!vehicleExpiredDocs[doc.vehicle_id]) vehicleExpiredDocs[doc.vehicle_id] = [];
                    vehicleExpiredDocs[doc.vehicle_id].push(doc.document_category || "document");
                }
            });

            const issues: VehicleDocIssue[] = [];

            vehicles.forEach(v => {
                const vehicleIssues: string[] = [];
                const uploadedDocs = vehicleDocsMap[v.id] || new Set();

                // Check missing required documents
                REQUIRED_DOC_CATEGORIES.forEach(cat => {
                    if (!uploadedDocs.has(cat)) {
                        vehicleIssues.push(`Missing ${formatDocCategory(cat)}`);
                    }
                });

                // Check built-in expiry fields
                if (!v.license_disk_expiry) {
                    vehicleIssues.push("No license disk expiry date set");
                } else if (v.license_disk_expiry < today) {
                    vehicleIssues.push("License disk expired");
                }

                if (!v.insurance_expiry) {
                    vehicleIssues.push("No insurance expiry date set");
                } else if (v.insurance_expiry < today) {
                    vehicleIssues.push("Insurance expired");
                }

                if (!v.mot_expiry) {
                    vehicleIssues.push("No COF/MOT expiry date set");
                } else if (v.mot_expiry < today) {
                    vehicleIssues.push("COF/MOT expired");
                }

                // Check expired uploaded docs
                const expiredDocs = vehicleExpiredDocs[v.id] || [];
                expiredDocs.forEach(cat => {
                    vehicleIssues.push(`${formatDocCategory(cat)} document expired`);
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
        staleTime: 5 * 60 * 1000,
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
        roadworthy: "Roadworthy",
        insurance: "Insurance",
        mot: "COF/MOT",
        cof: "COF",
        permit: "Permit",
    };
    return map[cat] || cat.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}
