import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { endOfWeek, format, getISOWeek, isWithinInterval, parseISO, startOfWeek, subWeeks } from "date-fns";
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
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  Truck,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface JobCardWithCosts {
  id: string;
  job_number: string;
  title: string;
  status: string;
  created_at: string | null;
  vehicle_id: string | null;
  fleet_number: string | null;
  registration_number: string | null;
  laborCost: number;
  partsCost: number;
  inventoryPartsCost: number;
  externalPartsCost: number;
  servicesCost: number;
  totalCost: number;
}

interface WeekData {
  weekNumber: number;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  laborCost: number;
  partsCost: number;
  inventoryPartsCost: number;
  externalPartsCost: number;
  servicesCost: number;
  totalCost: number;
  jobCards: JobCardWithCosts[];
  completedJobCards: number;
}

interface JobCardWeeklyCostReportProps {
  filter?: "all" | "exclude-tyre" | "tyre-only";
}

export default function JobCardWeeklyCostReport({ filter = "all" }: JobCardWeeklyCostReportProps) {
  const [weeksToShow, setWeeksToShow] = useState<string>("8");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [costTypeFilter, setCostTypeFilter] = useState<string>("all");
  const [fleetFilter, setFleetFilter] = useState<string>("all");

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
          vehicle_id,
          inspection_id
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

  // Fetch inspections for tyre filtering
  const { data: inspections = [] } = useQuery({
    queryKey: ["inspections-for-cost-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("id, inspection_type");

      if (error) throw error;
      return data || [];
    },
  });

  const inspectionTypeMap = useMemo(() => {
    return new Map(inspections.map(i => [i.id, i.inspection_type]));
  }, [inspections]);

  const vehicleMap = useMemo(() => {
    return new Map(vehicles.map(v => [v.id, v]));
  }, [vehicles]);

  // Filter job cards by tyre/non-tyre based on prop
  const filteredByType = useMemo(() => {
    if (filter === "all") return jobCards;
    return jobCards.filter(jc => {
      const inspType = jc.inspection_id ? inspectionTypeMap.get(jc.inspection_id) : null;
      const isTyre = inspType === "tyre";
      return filter === "tyre-only" ? isTyre : !isTyre;
    });
  }, [jobCards, inspectionTypeMap, filter]);

  // Calculate job cards with costs
  const jobCardsWithCosts = useMemo((): JobCardWithCosts[] => {
    return filteredByType.map(jc => {
      const jcLabor = laborEntries.filter(le => le.job_card_id === jc.id);
      const jcParts = partsRequests.filter(pr => pr.job_card_id === jc.id);

      const laborCost = jcLabor.reduce((sum, le) => sum + (le.total_cost || 0), 0);

      const partItems = jcParts.filter(pr => !pr.is_service);
      const partsCost = partItems.reduce((sum, pr) => sum + (pr.total_price || 0), 0);
      const inventoryPartsCost = partItems
        .filter(pr => pr.is_from_inventory)
        .reduce((sum, pr) => sum + (pr.total_price || 0), 0);
      const externalPartsCost = partItems
        .filter(pr => !pr.is_from_inventory)
        .reduce((sum, pr) => sum + (pr.total_price || 0), 0);
      const servicesCost = jcParts
        .filter(pr => pr.is_service)
        .reduce((sum, pr) => sum + (pr.total_price || 0), 0);

      const vehicle = jc.vehicle_id ? vehicleMap.get(jc.vehicle_id) : null;

      return {
        ...jc,
        fleet_number: vehicle?.fleet_number || "Unknown",
        registration_number: vehicle?.registration_number || null,
        laborCost,
        partsCost,
        inventoryPartsCost,
        externalPartsCost,
        servicesCost,
        totalCost: laborCost + partsCost + servicesCost,
      };
    });

  }, [filteredByType, laborEntries, partsRequests, vehicleMap]);

  // Get unique fleet numbers for filter
  const uniqueFleets = useMemo(() => {
    const fleets = [...new Set(jobCardsWithCosts.map(jc => jc.fleet_number).filter(Boolean))].sort();
    return fleets as string[];
  }, [jobCardsWithCosts]);

  // Apply filters to job cards
  const filteredJobCards = useMemo(() => {
    return jobCardsWithCosts.filter(jc => {
      // Only include cards with costs or that are completed/active
      const hasCost = jc.totalCost > 0;
      const isActive = jc.status === "pending" || jc.status === "in_progress" || jc.status === "in progress";
      const isCompleted = jc.status === "completed";
      if (!hasCost && !isActive && !isCompleted) return false;

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !jc.title.toLowerCase().includes(term) &&
          !jc.job_number.toLowerCase().includes(term) &&
          !(jc.fleet_number || "").toLowerCase().includes(term)
        ) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        const normalizedStatus = jc.status?.toLowerCase().replace(" ", "_");
        if (statusFilter === "active" && normalizedStatus !== "pending" && normalizedStatus !== "in_progress") return false;
        if (statusFilter === "completed" && normalizedStatus !== "completed") return false;
        if (statusFilter === "with_costs" && jc.totalCost <= 0) return false;
      }

      // Cost type filter
      if (costTypeFilter !== "all") {
        if (costTypeFilter === "labor" && jc.laborCost <= 0) return false;
        if (costTypeFilter === "parts" && jc.partsCost <= 0) return false;
        if (costTypeFilter === "services" && jc.servicesCost <= 0) return false;
      }

      // Fleet filter
      if (fleetFilter !== "all" && jc.fleet_number !== fleetFilter) return false;

      return true;
    });
  }, [jobCardsWithCosts, searchTerm, statusFilter, costTypeFilter, fleetFilter]);

  // Calculate week data with embedded job cards
  const weekData = useMemo((): WeekData[] => {
    const weeks: WeekData[] = [];
    const numWeeks = parseInt(weeksToShow);
    const today = new Date();

    for (let i = 0; i < numWeeks; i++) {
      const periodStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
      const periodEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
      const weekNumber = getISOWeek(periodStart);
      const periodLabel = `Week ${weekNumber} — ${format(periodStart, "MMM d")} to ${format(periodEnd, "MMM d, yyyy")}`;

      const weekJobCards = filteredJobCards.filter(jc => {
        if (!jc.created_at) return false;
        const createdDate = parseISO(jc.created_at);
        return isWithinInterval(createdDate, { start: periodStart, end: periodEnd });
      });

      const laborCost = weekJobCards.reduce((sum, jc) => sum + jc.laborCost, 0);
      const partsCost = weekJobCards.reduce((sum, jc) => sum + jc.partsCost, 0);
      const inventoryPartsCost = weekJobCards.reduce((sum, jc) => sum + jc.inventoryPartsCost, 0);
      const externalPartsCost = weekJobCards.reduce((sum, jc) => sum + jc.externalPartsCost, 0);
      const servicesCost = weekJobCards.reduce((sum, jc) => sum + jc.servicesCost, 0);

      weeks.push({
        weekNumber,
        periodStart,
        periodEnd,
        periodLabel,
        laborCost,
        partsCost,
        inventoryPartsCost,
        externalPartsCost,
        servicesCost,
        totalCost: laborCost + partsCost + servicesCost,
        jobCards: weekJobCards.sort((a, b) => b.totalCost - a.totalCost),
        completedJobCards: weekJobCards.filter(jc => jc.status === "completed").length,
      });
    }

    return weeks;
  }, [filteredJobCards, weeksToShow]);

  // Summary stats
  const summary = useMemo(() => {
    const totalCost = weekData.reduce((sum, w) => sum + w.totalCost, 0);
    const totalLaborCost = weekData.reduce((sum, w) => sum + w.laborCost, 0);
    const totalPartsCost = weekData.reduce((sum, w) => sum + w.partsCost, 0);
    const totalServicesCost = weekData.reduce((sum, w) => sum + w.servicesCost, 0);
    const totalJobCards = weekData.reduce((sum, w) => sum + w.jobCards.length, 0);
    const avgWeeklyCost = weekData.length > 0 ? totalCost / weekData.length : 0;

    let trend = 0;
    if (weekData.length >= 2) {
      const lastWeek = weekData[0]?.totalCost || 0;
      const previousWeek = weekData[1]?.totalCost || 0;
      trend = previousWeek > 0 ? ((lastWeek - previousWeek) / previousWeek) * 100 : 0;
    }

    return {
      totalCost,
      totalLaborCost,
      totalPartsCost,
      totalServicesCost,
      totalJobCards,
      avgWeeklyCost,
      trend,
    };
  }, [weekData]);

  // Toggle week expansion
  const toggleWeek = (weekIdx: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekIdx)) next.delete(weekIdx);
      else next.add(weekIdx);
      return next;
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    if (s === "completed") return <Badge className="bg-green-500 text-white">Completed</Badge>;
    if (s === "in_progress" || s === "in progress") return <Badge className="bg-blue-500 text-white">In Progress</Badge>;
    if (s === "pending") return <Badge variant="secondary">Pending</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  // Export to Excel
  const exportToExcel = async () => {
    const wb = createWorkbook();

    addStyledSheet(wb, "Weekly Costs", {
      title: "JOB CARD WEEKLY COST REPORT",
      headers: ["Week", "Period", "Labor Cost", "Parts Cost", "Inventory Parts", "External Parts", "Services Cost", "Total Cost", "Job Cards", "Completed"],
      rows: weekData.map(w => [
        `Week ${w.weekNumber}`,
        `${format(w.periodStart, "MMM d")} - ${format(w.periodEnd, "MMM d")}`,
        w.laborCost.toFixed(2),
        w.partsCost.toFixed(2),
        w.inventoryPartsCost.toFixed(2),
        w.externalPartsCost.toFixed(2),
        w.servicesCost.toFixed(2),
        w.totalCost.toFixed(2),
        w.jobCards.length,
        w.completedJobCards,
      ]),
    });

    addStyledSheet(wb, "Job Details", {
      title: "JOB CARD COST DETAILS",
      headers: ["Week", "Job Number", "Title", "Fleet", "Status", "Created", "Labor Cost", "Parts Cost", "Services Cost", "Total Cost"],
      rows: weekData.flatMap(w =>
        w.jobCards.map(jc => [
          `Week ${w.weekNumber}`,
          jc.job_number,
          jc.title,
          jc.fleet_number || "",
          jc.status,
          jc.created_at ? format(parseISO(jc.created_at), "yyyy-MM-dd") : "",
          jc.laborCost.toFixed(2),
          jc.partsCost.toFixed(2),
          jc.servicesCost.toFixed(2),
          jc.totalCost.toFixed(2),
        ])
      ),
      cellStyler: (row, col) => {
        if (col === 5) return statusColours[String(row[4]).toLowerCase()];
        return undefined;
      },
    });

    addSummarySheet(wb, "Summary", {
      title: "COST REPORT SUMMARY",
      rows: [
        ["Total Cost", formatCurrency(summary.totalCost)],
        ["Labor Cost", formatCurrency(summary.totalLaborCost)],
        ["Parts Cost", formatCurrency(summary.totalPartsCost)],
        ["Services Cost", formatCurrency(summary.totalServicesCost)],
        ["Total Job Cards", summary.totalJobCards],
        ["Avg Weekly Cost", formatCurrency(summary.avgWeeklyCost)],
        ["Trend (vs Previous Week)", `${summary.trend >= 0 ? "+" : ""}${summary.trend.toFixed(1)}%`],
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

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Job Card Weekly Cost Report", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${format(new Date(), "PPpp")}`, pageWidth / 2, 22, { align: "center" });

    doc.setFontSize(9);
    const summaryText = `Total: ${formatCurrency(summary.totalCost)} | Labor: ${formatCurrency(summary.totalLaborCost)} | Parts: ${formatCurrency(summary.totalPartsCost)} | Services: ${formatCurrency(summary.totalServicesCost)} | Job Cards: ${summary.totalJobCards}`;
    doc.text(summaryText, pageWidth / 2, 28, { align: "center" });

    // Week summary table
    const tableHeaders = ["Week", "Labor", "Parts", "Services", "Total", "Jobs", "Done"];
    const tableData = weekData.map(w => [
      `Wk ${w.weekNumber}: ${format(w.periodStart, "MMM d")} - ${format(w.periodEnd, "MMM d")}`,
      formatCurrency(w.laborCost),
      formatCurrency(w.partsCost),
      formatCurrency(w.servicesCost),
      formatCurrency(w.totalCost),
      w.jobCards.length.toString(),
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

    // Add detail pages per week
    weekData.forEach(week => {
      if (week.jobCards.length === 0) return;
      doc.addPage();

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Week ${week.weekNumber} — ${format(week.periodStart, "MMM d")} to ${format(week.periodEnd, "MMM d, yyyy")}`, 14, 15);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total: ${formatCurrency(week.totalCost)} | ${week.jobCards.length} job cards | ${week.completedJobCards} completed`, 14, 22);

      autoTable(doc, {
        head: [["Job #", "Title", "Fleet", "Status", "Labor", "Parts", "Services", "Total"]],
        body: week.jobCards.map(jc => [
          jc.job_number,
          jc.title.length > 35 ? jc.title.substring(0, 32) + "..." : jc.title,
          jc.fleet_number || "-",
          jc.status,
          formatCurrency(jc.laborCost),
          formatCurrency(jc.partsCost),
          formatCurrency(jc.servicesCost),
          formatCurrency(jc.totalCost),
        ]),
        startY: 27,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
    });

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
    <div className="space-y-4">
      {/* Compact toolbar: stats + filters + export in one block */}
      <div className="flex flex-col gap-3">
        {/* Inline summary stats */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground text-xs">Total</span>
            <span className="font-semibold">{formatCurrency(summary.totalCost)}</span>
            <span className="text-muted-foreground text-[11px]">({summary.totalJobCards} cards, {weekData.length} wks)</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground text-xs">Labor</span>
            <span className="font-semibold text-blue-600">{formatCurrency(summary.totalLaborCost)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground text-xs">Parts</span>
            <span className="font-semibold text-green-600">{formatCurrency(summary.totalPartsCost)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground text-xs">Trend</span>
            <span className={`font-semibold ${summary.trend >= 0 ? "text-red-600" : "text-green-600"}`}>
              {summary.trend >= 0 ? "+" : ""}{summary.trend.toFixed(1)}%
            </span>
            <span className="text-muted-foreground text-[11px]">({formatCurrency(summary.avgWeeklyCost)}/wk)</span>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="relative flex-1 min-w-0 sm:min-w-[180px] sm:max-w-[260px]">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>

          <Select value={weeksToShow} onValueChange={setWeeksToShow}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <Calendar className="w-3 h-3 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">Last 4 weeks</SelectItem>
              <SelectItem value="8">Last 8 weeks</SelectItem>
              <SelectItem value="12">Last 12 weeks</SelectItem>
              <SelectItem value="26">Last 26 weeks</SelectItem>
              <SelectItem value="52">Last 52 weeks</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="completed">Completed Only</SelectItem>
              <SelectItem value="with_costs">With Costs</SelectItem>
            </SelectContent>
          </Select>

          <Select value={costTypeFilter} onValueChange={setCostTypeFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="Cost Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cost Types</SelectItem>
              <SelectItem value="labor">Labor</SelectItem>
              <SelectItem value="parts">Parts</SelectItem>
              <SelectItem value="services">Services</SelectItem>
            </SelectContent>
          </Select>

          {uniqueFleets.length > 0 && (
            <Select value={fleetFilter} onValueChange={setFleetFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Fleet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fleets</SelectItem>
                {uniqueFleets.map(fleet => (
                  <SelectItem key={fleet} value={fleet}>{fleet}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs px-2.5">
                <Download className="w-3 h-3" />
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
      </div>

      {/* Week-by-Week Accordion */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Weekly Breakdown</h3>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpandedWeeks(new Set(weekData.map((_, i) => i)))}
            >
              Expand All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpandedWeeks(new Set())}
            >
              Collapse All
            </Button>
          </div>
        </div>

        {weekData.map((week, idx) => {
          const isExpanded = expandedWeeks.has(idx);
          const hasCards = week.jobCards.length > 0;
          const isCurrent = idx === 0;

          return (
            <div
              key={idx}
              className="border border-border rounded-xl overflow-hidden transition-shadow duration-200 shadow-sm hover:shadow-md"
            >
              {/* Week Header */}
              <button
                type="button"
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors duration-150 ${isCurrent
                  ? "bg-gradient-to-r from-blue-50/80 to-indigo-50/60 hover:from-blue-100/80 hover:to-indigo-100/60 dark:from-blue-950/20 dark:to-indigo-950/20 dark:hover:from-blue-950/30 dark:hover:to-indigo-950/30"
                  : "bg-gradient-to-r from-slate-50/80 to-gray-50/60 hover:from-slate-100/80 hover:to-gray-100/60 dark:from-slate-950/20 dark:to-gray-950/20 dark:hover:from-slate-950/30 dark:hover:to-gray-950/30"
                  }`}
                onClick={() => toggleWeek(idx)}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${isCurrent
                    ? "bg-blue-100 dark:bg-blue-900/50"
                    : "bg-slate-100 dark:bg-slate-900/50"
                    }`}>
                    <Calendar className={`h-4 w-4 ${isCurrent ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
                      }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground leading-none">
                        Week {week.weekNumber}
                      </p>
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Current</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(week.periodStart, "MMM d")} – {format(week.periodEnd, "MMM d, yyyy")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Cost breakdown pills */}
                  <div className="hidden md:flex items-center gap-2">
                    {week.laborCost > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                        <Wrench className="inline h-3 w-3 mr-0.5" />
                        {formatCurrency(week.laborCost)}
                      </span>
                    )}
                    {week.partsCost > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                        Parts {formatCurrency(week.partsCost)}
                      </span>
                    )}
                    {week.servicesCost > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
                        Services {formatCurrency(week.servicesCost)}
                      </span>
                    )}
                  </div>

                  <div className="text-right min-w-[100px]">
                    <p className="font-bold text-sm">{formatCurrency(week.totalCost)}</p>
                    <p className="text-xs text-muted-foreground">
                      {week.jobCards.length} {week.jobCards.length === 1 ? "card" : "cards"} · {week.completedJobCards} done
                    </p>
                  </div>

                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {/* Week Content */}
              {isExpanded && (
                <div className="border-t border-border/60 bg-background">
                  {!hasCards ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No job cards for this week</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">Job #</TableHead>
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
                          {week.jobCards.map(jc => (
                            <TableRow key={jc.id}>
                              <TableCell className="font-mono text-sm">#{jc.job_number}</TableCell>
                              <TableCell className="max-w-[250px]">
                                <p className="font-medium truncate">{jc.title}</p>
                                {jc.created_at && (
                                  <p className="text-xs text-muted-foreground">
                                    Created {format(parseISO(jc.created_at), "MMM d, yyyy")}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                {jc.fleet_number && jc.fleet_number !== "Unknown" ? (
                                  <div className="flex items-center gap-1.5">
                                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                    <Badge variant="outline" className="text-xs">{jc.fleet_number}</Badge>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(jc.status)}</TableCell>
                              <TableCell className="text-right">
                                {jc.laborCost > 0 ? (
                                  <span className="text-blue-600">{formatCurrency(jc.laborCost)}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {jc.partsCost > 0 ? (
                                  <div>
                                    <span className="text-green-600">{formatCurrency(jc.partsCost)}</span>
                                    {(jc.inventoryPartsCost > 0 || jc.externalPartsCost > 0) && (
                                      <div className="text-[10px] text-muted-foreground">
                                        {jc.inventoryPartsCost > 0 && <span>Inv: {formatCurrency(jc.inventoryPartsCost)}</span>}
                                        {jc.inventoryPartsCost > 0 && jc.externalPartsCost > 0 && " / "}
                                        {jc.externalPartsCost > 0 && <span>Ext: {formatCurrency(jc.externalPartsCost)}</span>}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {jc.servicesCost > 0 ? (
                                  <span className="text-purple-600">{formatCurrency(jc.servicesCost)}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {jc.totalCost > 0 ? formatCurrency(jc.totalCost) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Week totals row */}
                          <TableRow className="bg-muted/30 font-semibold">
                            <TableCell colSpan={4} className="text-right text-sm">
                              Week {week.weekNumber} Total
                            </TableCell>
                            <TableCell className="text-right text-blue-600">
                              {week.laborCost > 0 ? formatCurrency(week.laborCost) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {week.partsCost > 0 ? formatCurrency(week.partsCost) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-purple-600">
                              {week.servicesCost > 0 ? formatCurrency(week.servicesCost) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(week.totalCost)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {weekData.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                No data found for the selected period
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div >
  );
}
