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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateInspectionPDF } from "@/lib/inspectionPdfExport";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, Download, FileText, LayoutList, Plus, Printer, Search, TriangleAlert } from "lucide-react";
import { Fragment, useCallback, useState } from "react";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from "react-router-dom";
import CorrectiveActionDialog from "../dialogs/CorrectiveActionDialog";
import { RootCauseAnalysisDialog } from "../dialogs/RootCauseAnalysisDialog";
import StartInspectionDialog from "../dialogs/StartInspectionDialog";
import { InspectionActionsMenu } from "./InspectionActionsMenu";

interface InspectionHistoryRecord {
  id: string;
  inspection_number: string;
  inspection_date: string;
  vehicle_registration: string;
  vehicle_make?: string;
  vehicle_model?: string;
  inspector_name: string;
  fault_count: number;
  corrective_action_status: string;
  linked_work_order?: string;
  inspection_type?: string;
  initiated_via?: string;
  notes?: string;
  status: string;
}

interface FaultDetail {
  fault_description: string;
  severity: string;
  corrective_action_status: string | null;
  corrective_action_notes: string | null;
}

export function InspectionHistory() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Dialog states
  const [selectedInspection, setSelectedInspection] = useState<InspectionHistoryRecord | null>(null);
  const [showCorrectiveAction, setShowCorrectiveAction] = useState(false);
  const [showRootCauseAnalysis, setShowRootCauseAnalysis] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showFaultDetails, setShowFaultDetails] = useState(false);
  const [selectedFaults, setSelectedFaults] = useState<FaultDetail[]>([]);
  const [faultsForCorrectiveAction, setFaultsForCorrectiveAction] = useState<Array<{
    id: string;
    fault_description: string;
    severity: string;
    corrective_action_status: string | null;
    corrective_action_notes: string | null;
  }>>([]);

  // Fetch inspection history
  const { data: inspections = [], isLoading, refetch } = useQuery<InspectionHistoryRecord[]>({
    queryKey: ["inspection_history", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("vehicle_inspections")
        .select(`
          id,
          inspection_number,
          inspection_date,
          vehicle_registration,
          vehicle_make,
          vehicle_model,
          inspector_name,
          notes,
          status,
          inspection_type,
          initiated_via
        `)
        .order("inspection_date", { ascending: false });

      if (searchTerm) {
        query = query.or(
          `inspection_number.ilike.%${searchTerm}%,vehicle_registration.ilike.%${searchTerm}%,inspector_name.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch fault counts for each inspection
      const inspectionsWithFaults = await Promise.all(
        (data || []).map(async (inspection) => {
          // Fetch actual faults (excluding NA/default entries)
          const { data: faults } = await supabase
            .from("inspection_faults")
            .select("id, fault_description, corrective_action_status")
            .eq("inspection_id", inspection.id);

          // Count only REAL faults (not NA/default)
          const realFaultCount = (faults || []).filter(f =>
            f.fault_description &&
            f.fault_description !== "NA" &&
            f.fault_description !== "N/A" &&
            f.fault_description.trim() !== ""
          ).length;

          // Check if any REAL faults have pending or no corrective action
          const hasPendingAction = (faults || []).some(f =>
            f.fault_description &&
            f.fault_description !== "NA" &&
            f.fault_description !== "N/A" &&
            f.fault_description.trim() !== "" &&
            (!f.corrective_action_status || f.corrective_action_status === 'pending')
          );

          // Determine corrective action status based on real faults
          let correctiveActionStatus = "";
          if (realFaultCount > 0) {
            correctiveActionStatus = hasPendingAction ? "PENDING" : "TAKEN";
          }

          // Fetch linked work orders
          const { data: workOrders } = await supabase
            .from("job_cards")
            .select("job_number")
            .eq("inspection_id", inspection.id)
            .limit(1)
            .maybeSingle();

          return {
            id: inspection.id,
            inspection_number: inspection.inspection_number,
            inspection_date: inspection.inspection_date,
            vehicle_registration: inspection.vehicle_registration,
            vehicle_make: inspection.vehicle_make || undefined,
            vehicle_model: inspection.vehicle_model || undefined,
            inspector_name: inspection.inspector_name,
            fault_count: realFaultCount, // Use real fault count, not total
            corrective_action_status: correctiveActionStatus,
            linked_work_order: workOrders?.job_number,
            inspection_type: inspection.inspection_type,
            initiated_via: inspection.initiated_via || undefined,
            notes: inspection.notes || undefined,
            status: inspection.status,
          };
        })
      );

      return inspectionsWithFaults;
    },
  });

  const handleInspectionCreated = (inspectionId: string) => {
    toast({
      title: "Inspection Started",
      description: "New inspection has been created successfully",
    });
    setShowStartDialog(false);
    // Redirect to the inspection details page to fill out the form
    navigate(`/inspections/${inspectionId}`);
  };

  // Action handlers
  const handleView = (inspection: InspectionHistoryRecord) => {
    navigate(`/inspections/${inspection.id}`);
  };

  const handleShare = (inspection: InspectionHistoryRecord) => {
    navigator.clipboard.writeText(
      `${window.location.origin}/inspections/${inspection.id}`
    );
    toast({
      title: "Link Copied",
      description: `Inspection ${inspection.inspection_number} link copied to clipboard`,
    });
  };

  const handleCreateWorkOrder = (inspection: InspectionHistoryRecord) => {
    // Navigate to job cards page with pre-filled inspection data
    navigate(`/job-cards?inspection_id=${inspection.id}`);
  };

  const handleViewFaults = async (inspection: InspectionHistoryRecord) => {
    // Fetch faults for this inspection
    const { data: faults, error } = await supabase
      .from("inspection_faults")
      .select("fault_description, severity, corrective_action_status, corrective_action_notes")
      .eq("inspection_id", inspection.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load faults",
        variant: "destructive",
      });
      return;
    }

    // Filter out NA/default faults
    const realFaults = (faults || []).filter(f =>
      f.fault_description &&
      f.fault_description !== "NA" &&
      f.fault_description !== "N/A" &&
      f.fault_description.trim() !== ""
    );

    if (realFaults.length === 0) {
      toast({
        title: "No Faults",
        description: "This inspection has no recorded faults",
      });
      return;
    }

    setSelectedFaults(realFaults);
    setShowFaultDetails(true);
  };

  const handleCorrectiveAction = async (inspection: InspectionHistoryRecord) => {
    setSelectedInspection(inspection);

    // Fetch faults for this inspection (only real faults)
    const { data: faults, error } = await supabase
      .from("inspection_faults")
      .select("id, fault_description, severity, corrective_action_status, corrective_action_notes")
      .eq("inspection_id", inspection.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load faults",
        variant: "destructive",
      });
      return;
    }

    // Filter out NA/default faults
    const realFaults = (faults || []).filter(f =>
      f.fault_description &&
      f.fault_description !== "NA" &&
      f.fault_description !== "N/A" &&
      f.fault_description.trim() !== ""
    );

    if (realFaults.length === 0) {
      toast({
        title: "No Faults Found",
        description: "This inspection has no recorded faults",
      });
      return;
    }

    setFaultsForCorrectiveAction(realFaults);
    setShowCorrectiveAction(true);
  };

  const handleRootCauseAnalysis = (inspection: InspectionHistoryRecord) => {
    setSelectedInspection(inspection);
    setShowRootCauseAnalysis(true);
  };

  const handleViewPDF = async (inspection: InspectionHistoryRecord) => {
    try {
      toast({
        title: "Generating PDF",
        description: `Creating PDF for ${inspection.inspection_number}...`,
      });

      // Fetch inspection items if available (adjust query based on actual schema)
      const { data: items } = await supabase
        .from("inspection_items")
        .select("item_name, status, notes")
        .eq("inspection_id", inspection.id);

      // Map items to include optional severity field
      const mappedItems = (items || []).map(item => ({
        ...item,
        severity: undefined, // Severity not in current schema
      }));

      // Generate the PDF
      await generateInspectionPDF(inspection, mappedItems);

      toast({
        title: "PDF Generated",
        description: `PDF for ${inspection.inspection_number} has been downloaded`,
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const handleArchive = async (inspection: InspectionHistoryRecord) => {
    try {
      const { error } = await supabase
        .from("vehicle_inspections")
        .update({ status: "cancelled" }) // Using cancelled as archived status
        .eq("id", inspection.id);

      if (error) throw error;

      toast({
        title: "Archived",
        description: `Inspection ${inspection.inspection_number} has been archived`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to archive inspection",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (inspection: InspectionHistoryRecord) => {
    setSelectedInspection(inspection);
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (!selectedInspection) return;

    try {
      const { error } = await supabase
        .from("vehicle_inspections")
        .delete()
        .eq("id", selectedInspection.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: `Inspection ${selectedInspection.inspection_number} has been deleted`,
      });
      refetch();
      setShowDeleteAlert(false);
      setSelectedInspection(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete inspection",
        variant: "destructive",
      });
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sortedInspections = [...inspections].sort((a, b) => {
    if (!sortColumn) return 0;

    const aValue = a[sortColumn as keyof InspectionHistoryRecord];
    const bValue = b[sortColumn as keyof InspectionHistoryRecord];

    if (aValue === undefined || bValue === undefined) return 0;

    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const filteredInspections = searchTerm
    ? sortedInspections
    : sortedInspections;

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      default: return "secondary";
    }
  };

  const exportInspectionsToExcel = useCallback(async () => {
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Car Craft Co Fleet Management';
      wb.created = new Date();

      const hFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F3864' } };
      const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Calibri' };
      const hAlign: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
      const bdr: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'D9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
        left: { style: 'thin', color: { argb: 'D9D9D9' } },
        right: { style: 'thin', color: { argb: 'D9D9D9' } },
      };
      const zFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F6FC' } };
      const bodyFont: Partial<ExcelJS.Font> = { size: 9, name: 'Calibri' };

      const styleHeader = (ws: ExcelJS.Worksheet, rowNum: number) => {
        const r = ws.getRow(rowNum);
        r.eachCell(c => { c.fill = hFill; c.font = hFont; c.alignment = hAlign; c.border = bdr; });
        r.height = 28;
      };
      const autoWidth = (ws: ExcelJS.Worksheet) => {
        ws.columns.forEach(col => {
          let m = 12;
          col.eachCell?.({ includeEmpty: false }, c => {
            const l = c.value ? String(c.value).length + 2 : 0;
            if (l > m) m = l;
          });
          col.width = Math.min(m, 40);
        });
      };

      const ws = wb.addWorksheet('Inspections');
      ws.mergeCells('A1:I1');
      const tc = ws.getCell('A1');
      tc.value = 'VEHICLE INSPECTIONS REPORT';
      tc.font = { bold: true, size: 16, color: { argb: '1F3864' }, name: 'Calibri' };
      ws.getRow(1).height = 32;

      ws.mergeCells('A2:I2');
      const sc = ws.getCell('A2');
      sc.value = `Generated: ${new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })} \u2022 Car Craft Co Fleet Management`;
      sc.font = { italic: true, size: 9, color: { argb: '666666' }, name: 'Calibri' };

      const headers = ['Report #', 'Date', 'Vehicle Reg', 'Make', 'Model', 'Inspector', 'Faults', 'Corrective Action', 'Linked WO'];
      ws.getRow(4).values = headers;
      styleHeader(ws, 4);

      filteredInspections.forEach((insp, i) => {
        const row = ws.getRow(i + 5);
        row.values = [
          insp.inspection_number,
          insp.inspection_date ? new Date(insp.inspection_date).toLocaleDateString('en-ZA') : '',
          insp.vehicle_registration,
          insp.vehicle_make || '',
          insp.vehicle_model || '',
          insp.inspector_name,
          insp.fault_count,
          insp.corrective_action_status || '',
          insp.linked_work_order || '',
        ];
        row.eachCell(c => { c.border = bdr; c.font = bodyFont; c.alignment = { vertical: 'middle' }; });
        if (i % 2 === 1) row.eachCell(c => { c.fill = zFill; });

        const faultCell = row.getCell(7);
        if (insp.fault_count > 0) {
          faultCell.font = { ...bodyFont, color: { argb: 'DC2626' }, bold: true };
        } else {
          faultCell.font = { ...bodyFont, color: { argb: '16A34A' } };
        }

        const caCell = row.getCell(8);
        const caStatus = insp.corrective_action_status?.toLowerCase();
        if (caStatus === 'taken') {
          caCell.font = { ...bodyFont, color: { argb: '16A34A' }, bold: true };
        } else if (caStatus === 'pending') {
          caCell.font = { ...bodyFont, color: { argb: 'D97706' }, bold: true };
        }
      });

      ws.autoFilter = { from: 'A4', to: `I${filteredInspections.length + 4}` };
      ws.views = [{ state: 'frozen', ySplit: 4 }];
      autoWidth(ws);

      const sWs = wb.addWorksheet('Summary');
      sWs.mergeCells('A1:B1');
      sWs.getCell('A1').value = 'INSPECTION SUMMARY';
      sWs.getCell('A1').font = { bold: true, size: 16, color: { argb: '1F3864' }, name: 'Calibri' };
      sWs.getRow(1).height = 32;

      sWs.getRow(3).values = ['Metric', 'Count'];
      styleHeader(sWs, 3);

      const totalFaults = filteredInspections.reduce((sum, i) => sum + (i.fault_count || 0), 0);
      const summaryRows: [string, number][] = [
        ['Total Inspections', filteredInspections.length],
        ['With Faults', filteredInspections.filter(i => i.fault_count > 0).length],
        ['No Faults', filteredInspections.filter(i => i.fault_count === 0).length],
        ['Total Faults Found', totalFaults],
        ['With Linked Work Order', filteredInspections.filter(i => i.linked_work_order).length],
      ];

      summaryRows.forEach((r, i) => {
        const row = sWs.getRow(4 + i);
        row.values = [r[0], r[1]];
        row.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
        row.getCell(2).font = { size: 10, name: 'Calibri' };
        row.eachCell(c => { c.border = bdr; });
        if (i % 2 === 1) row.eachCell(c => { c.fill = zFill; });
      });
      sWs.getColumn(1).width = 30;
      sWs.getColumn(2).width = 15;

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Inspections_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Export Successful', description: `${filteredInspections.length} inspections exported to Excel.` });
    } catch (error) {
      console.error('Export failed:', error);
      toast({ title: 'Export Failed', description: 'Unable to export inspections.', variant: 'destructive' });
    }
  }, [filteredInspections, toast]);

  const exportInspectionsToPDF = useCallback(() => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Vehicle Inspections Report', 14, 18);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const totalFaults = filteredInspections.reduce((sum, i) => sum + (i.fault_count || 0), 0);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })} | Total: ${filteredInspections.length} inspections | Faults: ${totalFaults}`, 14, 25);

      autoTable(doc, {
        startY: 32,
        head: [['Report #', 'Date', 'Vehicle', 'Make/Model', 'Inspector', 'Faults', 'Corrective Action', 'Linked WO']],
        body: filteredInspections.map(insp => [
          insp.inspection_number,
          insp.inspection_date ? new Date(insp.inspection_date).toLocaleDateString('en-ZA') : '-',
          insp.vehicle_registration,
          [insp.vehicle_make, insp.vehicle_model].filter(Boolean).join(' ') || '-',
          insp.inspector_name,
          insp.fault_count.toString(),
          insp.corrective_action_status || '',
          insp.linked_work_order || '-',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [31, 56, 100], fontSize: 8, font: 'helvetica' },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 },
        styles: { overflow: 'linebreak', cellWidth: 'wrap' },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 22 },
          2: { cellWidth: 28 },
          3: { cellWidth: 35 },
          4: { cellWidth: 30 },
          5: { cellWidth: 16 },
          6: { cellWidth: 30 },
          7: { cellWidth: 25 },
        },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${i} of ${pageCount} | Car Craft Co Fleet Management`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
      }

      doc.save(`Inspections_${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'PDF Generated', description: `${filteredInspections.length} inspections exported as PDF.` });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({ title: 'Export Failed', description: 'Unable to generate PDF.', variant: 'destructive' });
    }
  }, [filteredInspections, toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={exportInspectionsToExcel} className="h-9 gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportInspectionsToPDF} className="h-9 gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            PDF
          </Button>
          <Button onClick={() => setShowStartDialog(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Start New Inspection
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon">
            <ArrowDownUp className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <LayoutList className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Action</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("inspection_number")}
                >
                  Report Number {sortColumn === "inspection_number" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("inspection_date")}
                >
                  Date {sortColumn === "inspection_date" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Inspector</TableHead>
                <TableHead className="text-center">Fault</TableHead>
                <TableHead className="text-center">Corrective Action</TableHead>
                <TableHead>Linked WO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading inspections...
                  </TableCell>
                </TableRow>
              ) : filteredInspections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No inspections found
                  </TableCell>
                </TableRow>
              ) : (
                filteredInspections.map((inspection) => (
                  <Fragment key={inspection.id}>
                    <TableRow>
                      <TableCell>
                        <InspectionActionsMenu
                          inspectionId={inspection.id}
                          inspectionNumber={inspection.inspection_number}
                          onView={() => handleView(inspection)}
                          onShare={() => handleShare(inspection)}
                          onCreateWorkOrder={() => handleCreateWorkOrder(inspection)}
                          onCorrectiveAction={() => handleCorrectiveAction(inspection)}
                          onRootCauseAnalysis={() => handleRootCauseAnalysis(inspection)}
                          onViewPDF={() => handleViewPDF(inspection)}
                          onArchive={() => handleArchive(inspection)}
                          onDelete={() => handleDelete(inspection)}
                          hasFaultsNeedingAction={inspection.fault_count > 0 && inspection.corrective_action_status === "PENDING"}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {inspection.inspection_number}
                        {inspection.initiated_via === "breakdown" && (
                          <Badge className="ml-2 bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] px-1.5 py-0">
                            Breakdown
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{new Date(inspection.inspection_date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}</div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(inspection.inspection_date).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{inspection.vehicle_registration}</div>
                          {(inspection.vehicle_make || inspection.vehicle_model) && (
                            <div className="text-muted-foreground text-xs">
                              {inspection.vehicle_make} {inspection.vehicle_model}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>Zimbabwe</TableCell>
                      <TableCell>{inspection.inspector_name}</TableCell>
                      <TableCell className="text-center">
                        {inspection.fault_count > 0 ? (
                          <Badge
                            variant="destructive"
                            className="gap-1 cursor-pointer hover:bg-red-700 transition-colors"
                            onClick={() => handleViewFaults(inspection)}
                            title="Click to view faults"
                          >
                            <TriangleAlert className="h-3 w-3" />
                            {inspection.fault_count}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground cursor-default"
                          >
                            None
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {inspection.corrective_action_status === "TAKEN" ? (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                            TAKEN
                          </Badge>
                        ) : inspection.corrective_action_status === "PENDING" ? (
                          <Badge variant="default" className="bg-yellow-600 hover:bg-yellow-700">
                            PENDING
                          </Badge>
                        ) : null /* Show nothing when there are no faults */}
                      </TableCell>
                      <TableCell>
                        {inspection.linked_work_order ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="text-blue-600 hover:text-blue-800 p-0 h-auto"
                            onClick={() => {
                              navigate(`/job-cards?search=${inspection.linked_work_order}`);
                            }}
                          >
                            {inspection.linked_work_order}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expandable details row */}
                    {inspection.inspection_type && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={9} className="py-2">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Inspection Checklist:</span>
                              <span className="text-muted-foreground">
                                {inspection.inspection_type}
                              </span>
                              <Button variant="ghost" size="sm" className="h-6 px-2">
                                <Printer className="h-3 w-3" />
                              </Button>
                            </div>
                            {inspection.notes && (
                              <div className="flex items-start gap-2 flex-1">
                                <span className="font-medium">Note:</span>
                                <span className="text-muted-foreground">{inspection.notes}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filteredInspections.length > 0 && (
          <div className="flex items-center justify-center py-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                More
              </Button>
              <span className="text-sm text-muted-foreground">
                [ {Math.min(25, filteredInspections.length)} / {filteredInspections.length} ]
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Start Inspection Dialog */}
      <StartInspectionDialog
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        onInspectionCreated={handleInspectionCreated}
      />

      {/* Corrective Action Dialog */}
      {selectedInspection && faultsForCorrectiveAction.length > 0 && (
        <CorrectiveActionDialog
          open={showCorrectiveAction}
          onOpenChange={setShowCorrectiveAction}
          faults={faultsForCorrectiveAction}
          inspectionId={selectedInspection.id}
          onCompleted={() => {
            refetch();
            setShowCorrectiveAction(false);
          }}
        />
      )}

      {/* Root Cause Analysis Dialog */}
      {selectedInspection && (
        <RootCauseAnalysisDialog
          open={showRootCauseAnalysis}
          onOpenChange={setShowRootCauseAnalysis}
          inspectionId={selectedInspection.id}
          inspectionNumber={selectedInspection.inspection_number}
          onCompleted={() => {
            refetch();
            setShowRootCauseAnalysis(false);
          }}
        />
      )}

      {/* Fault Details Dialog */}
      <AlertDialog open={showFaultDetails} onOpenChange={setShowFaultDetails}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-destructive" />
              Fault Details
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 mt-4">
                {selectedFaults.map((fault, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <p className="font-medium">{fault.fault_description}</p>
                      <Badge variant={getSeverityVariant(fault.severity)}>
                        {fault.severity}
                      </Badge>
                    </div>
                    {fault.corrective_action_status && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Status:</span>
                        <Badge variant={fault.corrective_action_status === "fixed" ? "default" : "secondary"}>
                          {fault.corrective_action_status}
                        </Badge>
                      </div>
                    )}
                    {fault.corrective_action_notes && (
                      <div className="text-sm">
                        <span className="font-medium">Notes:</span>
                        <p className="text-muted-foreground mt-1">{fault.corrective_action_notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowFaultDetails(false)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete inspection{" "}
              <span className="font-semibold">{selectedInspection?.inspection_number}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}