import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateOocReportPDF, type OocReportExportData } from "@/lib/oocReportExport";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Ban,
    Car,
    CheckCircle2,
    ExternalLink,
    FileDown,
    MapPin,
    Pencil,
    RotateCcw,
    Search,
    Trash2,
    Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OutOfCommissionReportDialog } from "@/components/inspections/OutOfCommissionReportDialog";

interface OocReport {
    id: string;
    inspection_id: string;
    vehicle_id: string | null;
    vehicle_id_or_license: string;
    make_model: string | null;
    reason_out_of_commission: string;
    location: string | null;
    mechanic_name: string;
    report_date: string;
    created_at: string | null;
    parts_required: unknown;
    immediate_plan: unknown;
    additional_notes_safety_concerns: string | null;
    year: string | null;
    mechanic_signature: string | null;
    closed_at: string | null;
    closed_by: string | null;
    closure_notes: string | null;
    // Joined data
    inspection_number: string | null;
    open_fault_count: number;
    total_fault_count: number;
    all_faults_resolved: boolean;
}

type ViewMode = "active" | "closed";

export function OutOfCommissionList() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("active");
    const { toast } = useToast();
    const { userName } = useAuth();
    const queryClient = useQueryClient();

    // Delete state
    const [deleteReport, setDeleteReport] = useState<OocReport | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Edit state
    const [editingReport, setEditingReport] = useState<OocReport | null>(null);

    // Close / Re-open state
    const [closingReport, setClosingReport] = useState<OocReport | null>(null);
    const [closureNotes, setClosureNotes] = useState("");
    const [closedByName, setClosedByName] = useState("");
    const [isClosing, setIsClosing] = useState(false);
    const [reopenReport, setReopenReport] = useState<OocReport | null>(null);
    const [isReopening, setIsReopening] = useState(false);

    // Fetch all OOC reports with their inspection fault status
    const { data: reports = [], isLoading } = useQuery<OocReport[]>({
        queryKey: ["out-of-commission-reports"],
        queryFn: async () => {
            // First get all OOC reports with inspection info
            const { data: oocData, error: oocError } = await supabase
                .from("out_of_commission_reports")
                .select(`
          id,
          inspection_id,
          vehicle_id,
          vehicle_id_or_license,
          make_model,
          reason_out_of_commission,
          location,
          mechanic_name,
          mechanic_signature,
          year,
          report_date,
          created_at,
          parts_required,
          immediate_plan,
          additional_notes_safety_concerns,
          closed_at,
          closed_by,
          closure_notes,
          vehicle_inspections!inner (
            inspection_number
          )
        `)
                .order("report_date", { ascending: false });

            if (oocError) throw oocError;
            if (!oocData || oocData.length === 0) return [];

            // Get fault status for each inspection
            const inspectionIds = [...new Set(oocData.map((r) => r.inspection_id))];
            const { data: faultsData } = await supabase
                .from("inspection_faults")
                .select("inspection_id, corrective_action_status")
                .in("inspection_id", inspectionIds);

            const faultsByInspection = (faultsData || []).reduce<
                Record<string, { total: number; open: number }>
            >((acc, f) => {
                if (!acc[f.inspection_id]) acc[f.inspection_id] = { total: 0, open: 0 };
                acc[f.inspection_id].total++;
                const resolved = ["fixed", "completed", "no_need"];
                if (!resolved.includes(f.corrective_action_status || "")) {
                    acc[f.inspection_id].open++;
                }
                return acc;
            }, {});

            return oocData.map((r) => {
                const faultInfo = faultsByInspection[r.inspection_id] || { total: 0, open: 0 };
                const inspectionData = r.vehicle_inspections as unknown as { inspection_number: string } | null;
                return {
                    id: r.id,
                    inspection_id: r.inspection_id,
                    vehicle_id: r.vehicle_id,
                    vehicle_id_or_license: r.vehicle_id_or_license,
                    make_model: r.make_model,
                    reason_out_of_commission: r.reason_out_of_commission,
                    location: r.location,
                    mechanic_name: r.mechanic_name,
                    report_date: r.report_date,
                    created_at: r.created_at,
                    parts_required: r.parts_required,
                    immediate_plan: r.immediate_plan,
                    additional_notes_safety_concerns: r.additional_notes_safety_concerns,
                    year: r.year,
                    mechanic_signature: r.mechanic_signature,
                    closed_at: r.closed_at,
                    closed_by: r.closed_by,
                    closure_notes: r.closure_notes,
                    inspection_number: inspectionData?.inspection_number || null,
                    open_fault_count: faultInfo.open,
                    total_fault_count: faultInfo.total,
                    all_faults_resolved: faultInfo.total > 0 && faultInfo.open === 0,
                };
            });
        },
        refetchInterval: 30000,
    });

    // Active = not explicitly closed. Closed = closure recorded.
    const activeReports = useMemo(
        () => reports.filter((r) => !r.closed_at),
        [reports]
    );
    const closedReports = useMemo(
        () => reports.filter((r) => !!r.closed_at),
        [reports]
    );

    const visibleReports = viewMode === "active" ? activeReports : closedReports;

    const filteredReports = useMemo(() => {
        if (!search.trim()) return visibleReports;
        const q = search.toLowerCase();
        return visibleReports.filter(
            (r) =>
                r.vehicle_id_or_license.toLowerCase().includes(q) ||
                r.make_model?.toLowerCase().includes(q) ||
                r.reason_out_of_commission.toLowerCase().includes(q) ||
                r.location?.toLowerCase().includes(q) ||
                r.inspection_number?.toLowerCase().includes(q)
        );
    }, [visibleReports, search]);

    const handleDelete = async () => {
        if (!deleteReport) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from("out_of_commission_reports")
                .delete()
                .eq("id", deleteReport.id);
            if (error) throw error;
            toast({ title: "Report Deleted", description: "Out-of-commission report has been removed." });
            queryClient.invalidateQueries({ queryKey: ["out-of-commission-reports"] });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to delete report",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setDeleteReport(null);
        }
    };

    const handleEditClick = async (report: OocReport, e: React.MouseEvent) => {
        e.stopPropagation();
        // Fetch the full report data for editing
        const { data, error } = await supabase
            .from("out_of_commission_reports")
            .select("*")
            .eq("id", report.id)
            .single();
        if (error || !data) {
            toast({ title: "Error", description: "Could not load report for editing", variant: "destructive" });
            return;
        }
        setEditingReport({ ...report, ...data });
    };

    const openCloseDialog = (report: OocReport, e: React.MouseEvent) => {
        e.stopPropagation();
        setClosureNotes("");
        setClosedByName(userName || "");
        setClosingReport(report);
    };

    const handleCloseReport = async () => {
        if (!closingReport) return;
        if (!closedByName.trim()) {
            toast({
                title: "Name required",
                description: "Please enter the name of the person closing this report.",
                variant: "destructive",
            });
            return;
        }
        setIsClosing(true);
        try {
            const { error } = await supabase
                .from("out_of_commission_reports")
                .update({
                    closed_at: new Date().toISOString(),
                    closed_by: closedByName.trim(),
                    closure_notes: closureNotes.trim() || null,
                })
                .eq("id", closingReport.id);
            if (error) throw error;
            toast({
                title: "Report Closed",
                description: `${closingReport.vehicle_id_or_license} marked as back in service.`,
            });
            queryClient.invalidateQueries({ queryKey: ["out-of-commission-reports"] });
            setClosingReport(null);
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to close report",
                variant: "destructive",
            });
        } finally {
            setIsClosing(false);
        }
    };

    const handleReopenReport = async () => {
        if (!reopenReport) return;
        setIsReopening(true);
        try {
            const { error } = await supabase
                .from("out_of_commission_reports")
                .update({
                    closed_at: null,
                    closed_by: null,
                    closure_notes: null,
                })
                .eq("id", reopenReport.id);
            if (error) throw error;
            toast({
                title: "Report Re-opened",
                description: `${reopenReport.vehicle_id_or_license} is back on the active list.`,
            });
            queryClient.invalidateQueries({ queryKey: ["out-of-commission-reports"] });
            setReopenReport(null);
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to re-open report",
                variant: "destructive",
            });
        } finally {
            setIsReopening(false);
        }
    };

    const handleExportPDF = async (report: OocReport, e: React.MouseEvent) => {
        e.stopPropagation();

        // Fetch full report data for PDF
        const { data: fullReport, error: reportError } = await supabase
            .from("out_of_commission_reports")
            .select("*")
            .eq("id", report.id)
            .single();

        if (reportError || !fullReport) {
            toast({ title: "Error", description: "Could not load report data", variant: "destructive" });
            return;
        }

        // Fetch faults for the inspection
        const { data: faultsData } = await supabase
            .from("inspection_faults")
            .select("fault_description, severity, corrective_action_status")
            .eq("inspection_id", report.inspection_id);

        const exportData: OocReportExportData = {
            id: fullReport.id,
            vehicle_id_or_license: fullReport.vehicle_id_or_license,
            make_model: fullReport.make_model,
            year: fullReport.year,
            odometer_hour_meter: fullReport.odometer_hour_meter,
            location: fullReport.location,
            reason_out_of_commission: fullReport.reason_out_of_commission,
            immediate_plan: Array.isArray(fullReport.immediate_plan) ? fullReport.immediate_plan as string[] : null,
            parts_required: Array.isArray(fullReport.parts_required)
                ? (fullReport.parts_required as Array<{ partNameNumber: string; quantity: string; onHand: string; orderNeededBy: string }>)
                : null,
            additional_notes_safety_concerns: fullReport.additional_notes_safety_concerns,
            mechanic_name: fullReport.mechanic_name,
            mechanic_signature: fullReport.mechanic_signature,
            report_date: fullReport.report_date,
            report_time: fullReport.report_time,
            sign_off_date: fullReport.sign_off_date,
            inspection_number: report.inspection_number,
            faults: faultsData?.map(f => ({
                fault_description: f.fault_description,
                severity: f.severity,
                corrective_action_status: f.corrective_action_status,
            })),
        };

        generateOocReportPDF(exportData);
        toast({ title: "Success", description: "OOC report exported to PDF" });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading out-of-commission reports...</p>
            </div>
        );
    }

    const isClosedView = viewMode === "closed";

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Ban className="h-5 w-5 text-destructive" />
                    <h2 className="text-lg font-semibold">
                        {isClosedView
                            ? `Closed Reports (${closedReports.length})`
                            : `Out of Commission (${activeReports.length})`}
                    </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                        <TabsList>
                            <TabsTrigger value="active">
                                Active ({activeReports.length})
                            </TabsTrigger>
                            <TabsTrigger value="closed">
                                Closed ({closedReports.length})
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search vehicles..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
            </div>

            {filteredReports.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
                        <h3 className="text-lg font-medium">
                            {isClosedView ? "No closed reports" : "All vehicles operational"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {isClosedView
                                ? "Reports closed after the vehicle returns to service will appear here."
                                : reports.length > 0
                                    ? "All out-of-commission reports have been closed."
                                    : "No out-of-commission reports have been filed."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredReports.map((report) => {
                        const closed = !!report.closed_at;
                        return (
                            <Card
                                key={report.id}
                                className={`border-l-4 ${closed ? "border-l-emerald-500" : "border-l-destructive"} hover:shadow-md transition-shadow cursor-pointer`}
                                onClick={() => navigate(`/inspections/${report.inspection_id}`)}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Car className="h-4 w-4 text-muted-foreground" />
                                            {report.vehicle_id_or_license}
                                        </CardTitle>
                                        {closed ? (
                                            <Badge className="text-[10px] shrink-0 bg-emerald-600 hover:bg-emerald-600">
                                                Closed
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant={report.open_fault_count === 0 ? "secondary" : "destructive"}
                                                className="text-[10px] shrink-0"
                                            >
                                                {report.open_fault_count === 0
                                                    ? "Ready to close"
                                                    : `${report.open_fault_count} open fault${report.open_fault_count !== 1 ? "s" : ""}`}
                                            </Badge>
                                        )}
                                    </div>
                                    {report.make_model && (
                                        <p className="text-sm text-muted-foreground">{report.make_model}</p>
                                    )}
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason</p>
                                        <p className="text-sm mt-0.5 line-clamp-2">{report.reason_out_of_commission}</p>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        {report.location && (
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {report.location}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Wrench className="h-3 w-3" />
                                            {report.mechanic_name}
                                        </span>
                                    </div>

                                    {closed && (
                                        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-1.5 text-xs">
                                            <p className="font-medium text-emerald-700 dark:text-emerald-400">
                                                Back in service{" "}
                                                {report.closed_at && new Date(report.closed_at).toLocaleDateString("en-GB", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                                {report.closed_by ? ` · ${report.closed_by}` : ""}
                                            </p>
                                            {report.closure_notes && (
                                                <p className="text-muted-foreground line-clamp-2 mt-0.5">
                                                    {report.closure_notes}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2 border-t">
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(report.report_date).toLocaleDateString("en-GB", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {report.inspection_number && (
                                                <Badge variant="outline" className="text-[10px]">
                                                    {report.inspection_number}
                                                </Badge>
                                            )}
                                            {!closed && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700"
                                                    title={
                                                        report.all_faults_resolved
                                                            ? "Close report (vehicle back in service)"
                                                            : "Close report — open faults will be acknowledged"
                                                    }
                                                    onClick={(e) => openCloseDialog(report, e)}
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            {closed && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    title="Re-open report"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setReopenReport(report);
                                                    }}
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            {!closed && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    title="Edit Report"
                                                    onClick={(e) => handleEditClick(report, e)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                                title="Delete Report"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteReport(report);
                                                }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                title="Export PDF"
                                                onClick={(e) => handleExportPDF(report, e)}
                                            >
                                                <FileDown className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/inspections/${report.inspection_id}`);
                                                }}
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Delete confirmation dialog */}
            <AlertDialog open={!!deleteReport} onOpenChange={(open) => !open && setDeleteReport(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Out-of-Commission Report</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the report for{" "}
                            <strong>{deleteReport?.vehicle_id_or_license}</strong>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Close report dialog */}
            <Dialog open={!!closingReport} onOpenChange={(open) => !open && setClosingReport(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            Close Out-of-Commission Report
                        </DialogTitle>
                        <DialogDescription>
                            Mark <strong>{closingReport?.vehicle_id_or_license}</strong> as back in service.
                            The report will move to the Closed list and stay available for reporting.
                        </DialogDescription>
                    </DialogHeader>

                    {closingReport && !closingReport.all_faults_resolved && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                            Warning: This inspection still has {closingReport.open_fault_count} unresolved
                            fault{closingReport.open_fault_count !== 1 ? "s" : ""}. Closing the report
                            acknowledges the vehicle is back in service regardless.
                        </div>
                    )}

                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Closed by <span className="text-destructive">*</span></Label>
                            <Input
                                value={closedByName}
                                onChange={(e) => setClosedByName(e.target.value)}
                                placeholder="Full name"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Closure notes (optional)</Label>
                            <Textarea
                                value={closureNotes}
                                onChange={(e) => setClosureNotes(e.target.value)}
                                placeholder="Repairs completed, parts replaced, etc."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setClosingReport(null)}
                            disabled={isClosing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCloseReport}
                            disabled={isClosing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isClosing ? "Closing..." : "Mark as Back in Service"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Re-open confirmation dialog */}
            <AlertDialog open={!!reopenReport} onOpenChange={(open) => !open && setReopenReport(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Re-open Out-of-Commission Report</AlertDialogTitle>
                        <AlertDialogDescription>
                            Move the report for <strong>{reopenReport?.vehicle_id_or_license}</strong> back
                            to the active list? The previous closure details will be cleared.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isReopening}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReopenReport} disabled={isReopening}>
                            {isReopening ? "Re-opening..." : "Re-open"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit dialog */}
            {editingReport && (
                <OutOfCommissionReportDialog
                    open={!!editingReport}
                    onOpenChange={(open) => !open && setEditingReport(null)}
                    inspectionId={editingReport.inspection_id}
                    vehicleId={editingReport.vehicle_id}
                    vehicleRegistration={editingReport.vehicle_id_or_license}
                    vehicleMake={editingReport.make_model?.split(" ")[0] || ""}
                    vehicleModel={editingReport.make_model?.split(" ").slice(1).join(" ") || ""}
                    odometerReading={null}
                    inspectorName={editingReport.mechanic_name}
                    onComplete={() => setEditingReport(null)}
                    editReport={{
                        id: editingReport.id,
                        year: editingReport.year || null,
                        location: editingReport.location,
                        reason_out_of_commission: editingReport.reason_out_of_commission,
                        immediate_plan: editingReport.immediate_plan,
                        parts_required: editingReport.parts_required,
                        additional_notes_safety_concerns: editingReport.additional_notes_safety_concerns,
                        mechanic_name: editingReport.mechanic_name,
                        mechanic_signature: editingReport.mechanic_signature || null,
                    }}
                />
            )}
        </div>
    );
}
