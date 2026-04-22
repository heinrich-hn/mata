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

interface DriverDocIssue {
    driverId: string;
    name: string;
    driverNumber: string;
    issues: string[];
}

type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

const REQUIRED_DOC_TYPES = ["license", "pdp", "medical"] as const;

const DOC_LABELS: Record<string, string> = {
    license: "Driver License",
    pdp: "PDP/International",
    passport: "Passport",
    medical: "Medical Certificate",
    retest: "Retest Certificate",
    defensive_driving: "Defensive Driving",
};

export default function DriverDocAlerts() {
    const [expanded, setExpanded] = useState(false);

    const { data: alertData, isLoading, isError } = useQuery({
        queryKey: ["driver-doc-alerts"],
        queryFn: async () => {
            const today = new Date().toISOString().split("T")[0];

            // Fetch all active drivers
            const { data: drivers, error: drvErr } = await supabase
                .from("drivers")
                .select("id, first_name, last_name, driver_number, license_expiry, status, active_document_types")
                .in("status", ["active"])
                .order("first_name");
            if (drvErr) throw drvErr;
            if (!drivers || drivers.length === 0) return [];

            const driverIds = drivers.map(d => d.id);

            // Fetch all driver_documents
            const { data: docs, error: docErr } = await supabase
                .from("driver_documents")
                .select("driver_id, document_type, expiry_date")
                .in("driver_id", driverIds);
            if (docErr) throw docErr;

            // Build map: driver_id -> { docType -> expiry_date }
            const driverDocsMap: Record<string, Record<string, string | null>> = {};
            (docs || []).forEach(doc => {
                if (!driverDocsMap[doc.driver_id]) driverDocsMap[doc.driver_id] = {};
                driverDocsMap[doc.driver_id][doc.document_type] = doc.expiry_date;
            });

            const issues: DriverDocIssue[] = [];

            drivers.forEach(d => {
                const driverIssues: string[] = [];
                const uploadedDocs = driverDocsMap[d.id] || {};
                const activeTypes: string[] = (d as { active_document_types?: string[] | null }).active_document_types || [];
                const isActive = (t: string) => activeTypes.includes(t);

                // Check required documents (only those marked active for this driver)
                REQUIRED_DOC_TYPES.forEach(docType => {
                    if (!isActive(docType)) return;
                    if (!(docType in uploadedDocs)) {
                        driverIssues.push(`Missing ${DOC_LABELS[docType] || docType}`);
                    } else {
                        const expiry = uploadedDocs[docType];
                        if (!expiry) {
                            driverIssues.push(`${DOC_LABELS[docType] || docType}: no expiry date`);
                        } else if (expiry < today) {
                            driverIssues.push(`${DOC_LABELS[docType] || docType} expired`);
                        }
                    }
                });

                // Check non-required docs that are uploaded but expired (only if active)
                Object.entries(uploadedDocs).forEach(([docType, expiry]) => {
                    if (REQUIRED_DOC_TYPES.includes(docType as typeof REQUIRED_DOC_TYPES[number])) return;
                    if (!isActive(docType)) return;
                    if (expiry && expiry < today) {
                        driverIssues.push(`${DOC_LABELS[docType] || docType} expired`);
                    }
                });

                // Check license_expiry on the driver record itself (only if license is tracked)
                if (isActive("license")) {
                    if (!d.license_expiry) {
                        driverIssues.push("No license expiry date on profile");
                    } else if (d.license_expiry < today) {
                        if (!driverIssues.some(i => i.includes("Driver License expired"))) {
                            driverIssues.push("License expired (profile)");
                        }
                    }
                }

                if (driverIssues.length > 0) {
                    issues.push({
                        driverId: d.id,
                        name: `${d.first_name} ${d.last_name}`.trim(),
                        driverNumber: d.driver_number,
                        issues: driverIssues,
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
        doc.text("Driver Document Issues Report", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${today}`, 14, 28);
        doc.text(`Total drivers with issues: ${alertData.length}`, 14, 34);

        // Summary counts
        const expiredTotal = alertData.filter(d => d.issues.some(i => i.includes("expired"))).length;
        const missingTotal = alertData.filter(d => d.issues.some(i => i.includes("Missing") || i.includes("no expiry"))).length;
        doc.text(`Expired: ${expiredTotal} drivers  |  Missing docs/dates: ${missingTotal} drivers`, 14, 40);

        // Table
        const rows = alertData.map(d => [
            d.driverNumber,
            d.name,
            d.issues.filter(i => i.includes("expired")).join(", ") || "—",
            d.issues.filter(i => i.includes("Missing") || i.includes("no expiry") || i.includes("No ")).join(", ") || "—",
        ]);

        autoTable(doc, {
            startY: 46,
            head: [["Driver #", "Name", "Expired", "Missing / No Date"]],
            body: rows,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [180, 80, 0], textColor: 255, fontStyle: "bold" },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 40 },
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

        doc.save(`driver-document-issues-${new Date().toISOString().split("T")[0]}.pdf`);
    };

    if (isLoading) {
        return (
            <Alert className="border-muted bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Checking driver documents...</AlertTitle>
            </Alert>
        );
    }

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Failed to check driver documents</AlertTitle>
                <AlertDescription className="text-xs">Could not fetch document status. Try refreshing the page.</AlertDescription>
            </Alert>
        );
    }

    if (!alertData || alertData.length === 0) return null;

    const expiredCount = alertData.filter(d =>
        d.issues.some(i => i.includes("expired"))
    ).length;
    const missingCount = alertData.filter(d =>
        d.issues.some(i => i.includes("Missing") || i.includes("no expiry"))
    ).length;

    return (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
            <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 !text-amber-600" />
                <AlertTitle className="flex items-center justify-between">
                    <span>
                        Document Issues — {alertData.length} driver{alertData.length !== 1 ? "s" : ""}
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
                                {missingCount} missing/no date
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
                    Drivers with missing or expired documentation require attention.
                </AlertDescription>
                <CollapsibleContent>
                    <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5">
                        {alertData.map(d => (
                            <div key={d.driverId} className="flex items-start gap-2 text-xs bg-amber-100/50 dark:bg-amber-900/20 rounded px-2 py-1.5">
                                <span className="font-mono font-bold whitespace-nowrap min-w-[70px]">{d.driverNumber}</span>
                                <span className="text-amber-700 dark:text-amber-300 min-w-[100px]">{d.name}</span>
                                <span className="text-amber-600 dark:text-amber-400">—</span>
                                <span className="text-amber-800 dark:text-amber-200">{d.issues.join(" • ")}</span>
                            </div>
                        ))}
                    </div>
                </CollapsibleContent>
            </Alert>
        </Collapsible>
    );
}

