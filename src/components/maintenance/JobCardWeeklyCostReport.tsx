import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, endOfWeek, format, isWithinInterval, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  addStyledSheet,
  addSummarySheet,
  createWorkbook,
  saveWorkbook,
  statusColours,
} from "@/utils/excelStyles";
import {
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Truck
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface PeriodData {
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  laborCost: number;
  partsCost: number;
  inventoryPartsCost: number;
  externalPartsCost: number;
  servicesCost: number;
  totalCost: number;
  jobCardsCount: number;
  completedJobCards: number;
}

interface FleetCostData {
  fleetNumber: string;
  vehicleId: string;
  laborCost: number;
  partsCost: number;
  servicesCost: number;
  totalCost: number;
  jobCardsCount: number;
}

interface JobCardWithCosts {
  id: string;
  job_number: string;
  title: string;
  status: string;
  created_at: string | null;
  vehicle_id: string | null;
  fleet_number: string | null;
  laborCost: number;
  partsCost: number;
  servicesCost: number;
  totalCost: number;
}

export default function JobCardWeeklyCostReport() {
  const [periodsToShow, setPeriodsToShow] = useState<string>("4");
  const [viewMode, setViewMode] = useState<"period" | "fleet" | "details">("period");
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");

  // Fetch job cards
  const { data: jobCards = [], isLoading: loadingJobCards } = useQuery({
    queryKey: ["job-cards-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select(`
          id,
          job_number,
          title,
          status,
          created_at,
          vehicle_id
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch vehicles for fleet numbers
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number");

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch labor entries
  const { data: laborEntries = [], isLoading: loadingLabor } = useQuery({
    queryKey: ["labor-entries-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labor_entries")
        .select("*");

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch parts requests
  const { data: partsRequests = [], isLoading: loadingParts } = useQuery({
    queryKey: ["parts-requests-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts_requests")
        .select("*")
        .not("status", "in", '("cancelled","rejected")');

      if (error) throw error;
      return data || [];
    },
  });

  const vehicleMap = useMemo(() => {
    return new Map(vehicles.map(v => [v.id, v]));
  }, [vehicles]);

  // Calculate job cards with costs
  const jobCardsWithCosts = useMemo((): JobCardWithCosts[] => {
    return jobCards.map(jc => {
      const jcLabor = laborEntries.filter(le => le.job_card_id === jc.id);
      const jcParts = partsRequests.filter(pr => pr.job_card_id === jc.id);

      const laborCost = jcLabor.reduce((sum, le) => sum + (le.total_cost || 0), 0);
      const partsCost = jcParts
        .filter(pr => !pr.is_service)
        .reduce((sum, pr) => sum + (pr.total_price || 0), 0);
      const servicesCost = jcParts
        .filter(pr => pr.is_service)
        .reduce((sum, pr) => sum + (pr.total_price || 0), 0);

      const vehicle = jc.vehicle_id ? vehicleMap.get(jc.vehicle_id) : null;

      return {
        ...jc,
        fleet_number: vehicle?.fleet_number || "Unknown",
        laborCost,
        partsCost,
        servicesCost,
        totalCost: laborCost + partsCost + servicesCost,
      };
    });
  }, [jobCards, laborEntries, partsRequests, vehicleMap]);

  // Calculate period data (weekly or monthly)
  const periodData = useMemo((): PeriodData[] => {
    const periods: PeriodData[] = [];
    const numPeriods = parseInt(periodsToShow);
    const today = new Date();

    for (let i = 0; i < numPeriods; i++) {
      let periodStart: Date;
      let periodEnd: Date;
      let periodLabel: string;

      if (periodType === "weekly") {
        periodStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
        periodEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
        periodLabel = `${format(periodStart, "MMM d")} - ${format(periodEnd, "MMM d, yyyy")}`;
      } else {
        periodStart = startOfMonth(subMonths(today, i));
        periodEnd = endOfMonth(subMonths(today, i));
        periodLabel = format(periodStart, "MMMM yyyy");
      }

      const periodJobCards = jobCardsWithCosts.filter(jc => {
        if (!jc.created_at) return false;
        const createdDate = parseISO(jc.created_at);
        return isWithinInterval(createdDate, { start: periodStart, end: periodEnd });
      });

      const laborCost = periodJobCards.reduce((sum, jc) => sum + jc.laborCost, 0);
      const partsCost = periodJobCards.reduce((sum, jc) => sum + jc.partsCost, 0);
      const servicesCost = periodJobCards.reduce((sum, jc) => sum + jc.servicesCost, 0);

      // Calculate inventory vs external parts
      const periodPartsRequests = partsRequests.filter(pr => {
        const jobCard = jobCardsWithCosts.find(jc => jc.id === pr.job_card_id);
        if (!jobCard?.created_at) return false;
        const createdDate = parseISO(jobCard.created_at);
        return isWithinInterval(createdDate, { start: periodStart, end: periodEnd }) && !pr.is_service;
      });

      const inventoryPartsCost = periodPartsRequests
        .filter(pr => pr.is_from_inventory)
        .reduce((sum, pr) => sum + (pr.total_price || 0), 0);
      const externalPartsCost = periodPartsRequests
        .filter(pr => !pr.is_from_inventory)
        .reduce((sum, pr) => sum + (pr.total_price || 0), 0);

      periods.push({
        periodStart,
        periodEnd,
        periodLabel,
        laborCost,
        partsCost,
        inventoryPartsCost,
        externalPartsCost,
        servicesCost,
        totalCost: laborCost + partsCost + servicesCost,
        jobCardsCount: periodJobCards.length,
        completedJobCards: periodJobCards.filter(jc => jc.status === "completed").length,
      });
    }

    return periods;
  }, [jobCardsWithCosts, partsRequests, periodsToShow, periodType]);

  // Calculate fleet data
  const fleetData = useMemo((): FleetCostData[] => {
    const fleetMap = new Map<string, FleetCostData>();

    jobCardsWithCosts.forEach(jc => {
      const fleetNumber = jc.fleet_number || "Unknown";
      const existing = fleetMap.get(fleetNumber) || {
        fleetNumber,
        vehicleId: jc.vehicle_id || "",
        laborCost: 0,
        partsCost: 0,
        servicesCost: 0,
        totalCost: 0,
        jobCardsCount: 0,
      };

      fleetMap.set(fleetNumber, {
        ...existing,
        laborCost: existing.laborCost + jc.laborCost,
        partsCost: existing.partsCost + jc.partsCost,
        servicesCost: existing.servicesCost + jc.servicesCost,
        totalCost: existing.totalCost + jc.totalCost,
        jobCardsCount: existing.jobCardsCount + 1,
      });
    });

    return Array.from(fleetMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [jobCardsWithCosts]);

  // Summary stats
  const summary = useMemo(() => {
    const totalCost = periodData.reduce((sum, w) => sum + w.totalCost, 0);
    const totalLaborCost = periodData.reduce((sum, w) => sum + w.laborCost, 0);
    const totalPartsCost = periodData.reduce((sum, w) => sum + w.partsCost, 0);
    const totalServicesCost = periodData.reduce((sum, w) => sum + w.servicesCost, 0);
    const totalJobCards = periodData.reduce((sum, w) => sum + w.jobCardsCount, 0);
    const avgPeriodCost = periodData.length > 0 ? totalCost / periodData.length : 0;

    // Calculate trend (compare last 2 periods)
    let trend = 0;
    if (periodData.length >= 2) {
      const lastPeriod = periodData[0]?.totalCost || 0;
      const previousPeriod = periodData[1]?.totalCost || 0;
      trend = previousPeriod > 0 ? ((lastPeriod - previousPeriod) / previousPeriod) * 100 : 0;
    }

    return {
      totalCost,
      totalLaborCost,
      totalPartsCost,
      totalServicesCost,
      totalJobCards,
      avgPeriodCost,
      trend,
    };
  }, [periodData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Export to Excel
  const exportToExcel = async () => {
    const wb = createWorkbook();

    // Period sheet
    addStyledSheet(wb, "Period Costs", {
      title: `JOB CARD ${periodType.toUpperCase()} COST REPORT`,
      headers: ["Period", "Labor Cost", "Parts Cost", "Inventory Parts", "External Parts", "Services Cost", "Total Cost", "Job Cards", "Completed"],
      rows: periodData.map(w => [
        w.periodLabel,
        w.laborCost.toFixed(2),
        w.partsCost.toFixed(2),
        w.inventoryPartsCost.toFixed(2),
        w.externalPartsCost.toFixed(2),
        w.servicesCost.toFixed(2),
        w.totalCost.toFixed(2),
        w.jobCardsCount,
        w.completedJobCards,
      ]),
    });

    // Fleet sheet
    addStyledSheet(wb, "Fleet Costs", {
      title: "JOB CARD COSTS BY FLEET",
      headers: ["Fleet Number", "Labor Cost", "Parts Cost", "Services Cost", "Total Cost", "Job Cards"],
      rows: fleetData.map(f => [
        f.fleetNumber,
        f.laborCost.toFixed(2),
        f.partsCost.toFixed(2),
        f.servicesCost.toFixed(2),
        f.totalCost.toFixed(2),
        f.jobCardsCount,
      ]),
    });

    // Details sheet
    addStyledSheet(wb, "Job Details", {
      title: "JOB CARD COST DETAILS",
      headers: ["Job Number", "Title", "Fleet", "Status", "Created", "Labor Cost", "Parts Cost", "Services Cost", "Total Cost"],
      rows: jobCardsWithCosts.map(jc => [
        jc.job_number,
        jc.title,
        jc.fleet_number || "",
        jc.status,
        jc.created_at ? format(parseISO(jc.created_at), "yyyy-MM-dd") : "",
        jc.laborCost.toFixed(2),
        jc.partsCost.toFixed(2),
        jc.servicesCost.toFixed(2),
        jc.totalCost.toFixed(2),
      ]),
      cellStyler: (row, col) => {
        if (col === 4) return statusColours[String(row[3]).toLowerCase()];
        return undefined;
      },
    });

    // Summary sheet
    addSummarySheet(wb, "Summary", {
      title: "COST REPORT SUMMARY",
      rows: [
        ["Total Cost", formatCurrency(summary.totalCost)],
        ["Labor Cost", formatCurrency(summary.totalLaborCost)],
        ["Parts Cost", formatCurrency(summary.totalPartsCost)],
        ["Services Cost", formatCurrency(summary.totalServicesCost)],
        ["Total Job Cards", summary.totalJobCards],
        [`Avg ${periodType === "weekly" ? "Weekly" : "Monthly"} Cost`, formatCurrency(summary.avgPeriodCost)],
        ["Trend (vs Previous Period)", `${summary.trend >= 0 ? "+" : ""}${summary.trend.toFixed(1)}%`],
      ],
    });

    const filename = `job_card_costs_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    await saveWorkbook(wb, filename);
    toast.success("Exported to Excel");
  };

  // Export to PDF
  const exportToPdf = () => {
    const doc = new jsPDF("landscape", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Job Card Cost Report", pageWidth / 2, 15, { align: "center" });

    // Subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${format(new Date(), "PPpp")}`, pageWidth / 2, 22, { align: "center" });

    // Summary line
    doc.setFontSize(9);
    const summaryText = `Total: ${formatCurrency(summary.totalCost)} | Labor: ${formatCurrency(summary.totalLaborCost)} | Parts: ${formatCurrency(summary.totalPartsCost)} | Services: ${formatCurrency(summary.totalServicesCost)} | Job Cards: ${summary.totalJobCards}`;
    doc.text(summaryText, pageWidth / 2, 28, { align: "center" });

    if (viewMode === "period") {
      const tableHeaders = ["Period", "Labor", "Parts", "Inventory", "External", "Services", "Total", "Jobs", "Done"];
      const tableData = periodData.map(w => [
        w.periodLabel,
        formatCurrency(w.laborCost),
        formatCurrency(w.partsCost),
        formatCurrency(w.inventoryPartsCost),
        formatCurrency(w.externalPartsCost),
        formatCurrency(w.servicesCost),
        formatCurrency(w.totalCost),
        w.jobCardsCount.toString(),
        w.completedJobCards.toString(),
      ]);

      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: 33,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
    } else if (viewMode === "fleet") {
      const tableHeaders = ["Fleet", "Labor Cost", "Parts Cost", "Services Cost", "Total Cost", "Job Cards"];
      const tableData = fleetData.map(f => [
        f.fleetNumber,
        formatCurrency(f.laborCost),
        formatCurrency(f.partsCost),
        formatCurrency(f.servicesCost),
        formatCurrency(f.totalCost),
        f.jobCardsCount.toString(),
      ]);

      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: 33,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
    } else {
      const tableHeaders = ["Job #", "Title", "Fleet", "Status", "Created", "Labor", "Parts", "Services", "Total"];
      const tableData = jobCardsWithCosts.slice(0, 50).map(jc => [
        jc.job_number,
        jc.title.length > 30 ? jc.title.substring(0, 27) + "..." : jc.title,
        jc.fleet_number || "-",
        jc.status,
        jc.created_at ? format(parseISO(jc.created_at), "dd MMM") : "-",
        formatCurrency(jc.laborCost),
        formatCurrency(jc.partsCost),
        formatCurrency(jc.servicesCost),
        formatCurrency(jc.totalCost),
      ]);

      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: 33,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 50 },
          2: { cellWidth: 20 },
          3: { cellWidth: 22 },
          4: { cellWidth: 20 },
        },
      });
    }

    // Footer with page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    doc.save(`job_card_cost_report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("Exported to PDF");
  };

  const isLoading = loadingJobCards || loadingLabor || loadingParts;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            Loading cost data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Costs</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.totalJobCards} job cards
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Labor Costs</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalLaborCost)}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.totalCost > 0
                    ? ((summary.totalLaborCost / summary.totalCost) * 100).toFixed(1)
                    : 0}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Parts Costs</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPartsCost)}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.totalCost > 0
                    ? ((summary.totalPartsCost / summary.totalCost) * 100).toFixed(1)
                    : 0}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{periodType === "weekly" ? "Weekly" : "Monthly"} Trend</p>
                <p className={`text-2xl font-bold ${summary.trend >= 0 ? "text-red-600" : "text-green-600"}`}>
                  {summary.trend >= 0 ? "+" : ""}{summary.trend.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg: {formatCurrency(summary.avgPeriodCost)}/{periodType === "weekly" ? "week" : "month"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">Cost Analysis</CardTitle>
            <CardDescription>Analyze maintenance costs by week, fleet, or individual job cards</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-muted p-0.5">
              <button
                onClick={() => setPeriodType("weekly")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${periodType === "weekly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setPeriodType("monthly")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${periodType === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Monthly
              </button>
            </div>

            <Select value={periodsToShow} onValueChange={setPeriodsToShow}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodType === "weekly" ? (
                  <>
                    <SelectItem value="4">Last 4 weeks</SelectItem>
                    <SelectItem value="8">Last 8 weeks</SelectItem>
                    <SelectItem value="12">Last 12 weeks</SelectItem>
                    <SelectItem value="26">Last 26 weeks</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="3">Last 3 months</SelectItem>
                    <SelectItem value="6">Last 6 months</SelectItem>
                    <SelectItem value="12">Last 12 months</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>

            <Select value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="period">{periodType === "weekly" ? "Weekly" : "Monthly"} View</SelectItem>
                <SelectItem value="fleet">By Fleet</SelectItem>
                <SelectItem value="details">Job Details</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export to Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPdf}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export to PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "period" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Labor</TableHead>
                  <TableHead className="text-right">Parts</TableHead>
                  <TableHead className="text-right">Services</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Job Cards</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodData.map((period, idx) => (
                  <TableRow key={idx} className={idx === 0 ? "bg-primary/5" : ""}>
                    <TableCell className="font-medium">
                      {period.periodLabel}
                      {idx === 0 && <Badge variant="outline" className="ml-2">Current</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(period.laborCost)}</TableCell>
                    <TableCell className="text-right">
                      <div>{formatCurrency(period.partsCost)}</div>
                      <div className="text-xs text-muted-foreground">
                        Inv: {formatCurrency(period.inventoryPartsCost)} / Ext: {formatCurrency(period.externalPartsCost)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(period.servicesCost)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(period.totalCost)}</TableCell>
                    <TableCell className="text-center">{period.jobCardsCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={period.completedJobCards === period.jobCardsCount && period.jobCardsCount > 0 ? "default" : "secondary"}>
                        {period.completedJobCards}/{period.jobCardsCount}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {periodData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No job card data found for the selected period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {viewMode === "fleet" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fleet Number</TableHead>
                  <TableHead className="text-right">Labor Cost</TableHead>
                  <TableHead className="text-right">Parts Cost</TableHead>
                  <TableHead className="text-right">Services Cost</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-center">Job Cards</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fleetData.map((fleet, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        {fleet.fleetNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(fleet.laborCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(fleet.partsCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(fleet.servicesCost)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(fleet.totalCost)}</TableCell>
                    <TableCell className="text-center">{fleet.jobCardsCount}</TableCell>
                  </TableRow>
                ))}
                {fleetData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No fleet cost data found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {viewMode === "details" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Fleet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Labor</TableHead>
                  <TableHead className="text-right">Parts</TableHead>
                  <TableHead className="text-right">Services</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobCardsWithCosts.slice(0, 50).map((jc) => (
                  <TableRow key={jc.id}>
                    <TableCell className="font-medium">{jc.job_number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{jc.title}</TableCell>
                    <TableCell>{jc.fleet_number || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={jc.status === "completed" ? "default" : "secondary"}>
                        {jc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(jc.laborCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(jc.partsCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(jc.servicesCost)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(jc.totalCost)}</TableCell>
                  </TableRow>
                ))}
                {jobCardsWithCosts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No job cards found
                    </TableCell>
                  </TableRow>
                )}
                {jobCardsWithCosts.length > 50 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-2">
                      Showing first 50 of {jobCardsWithCosts.length} job cards. Export to see all.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
