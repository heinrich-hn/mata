import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetNumbers } from "@/hooks/useFleetNumbers";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { Progress } from "@/components/ui/progress";
import { Award, BarChart3, CheckCircle2, DollarSign, FileDown, Package, Star, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as XLSX from "xlsx";

type Tyre = Database["public"]["Tables"]["tyres"]["Row"];

const FleetTyreReports = () => {
  const [selectedFleet, setSelectedFleet] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState("all");
  const [reportType, setReportType] = useState("overview");

  // Get unique fleet numbers dynamically from database
  const { data: dynamicFleetNumbers = [] } = useFleetNumbers();
  const fleetNumbers = ["all", ...dynamicFleetNumbers];

  // Fetch installed tyres from fleet_tyre_positions joined with tyre details
  const { data: installedTyres = [] } = useQuery({
    queryKey: ["installed_tyres_reports", selectedFleet],
    queryFn: async () => {
      // First get fleet_tyre_positions with their tyre IDs
      let query = supabase
        .from("fleet_tyre_positions")
        .select("*");

      // Filter by fleet if selected
      if (selectedFleet !== "all") {
        query = query.eq("fleet_number", selectedFleet);
      }

      const { data: positions, error: posError } = await query;
      if (posError) throw posError;

      // Get unique tyre codes that are valid UUIDs
      const tyreCodes = (positions || [])
        .map(p => p.tyre_code)
        .filter((code): code is string => 
          code !== null && 
          code.trim() !== '' && 
          !code.startsWith('NEW_CODE_')
        );

      if (tyreCodes.length === 0) return [];

      // Fetch tyre details for all installed tyres
      const { data: tyresData, error: tyresError } = await supabase
        .from("tyres")
        .select("*")
        .in("id", tyreCodes);

      if (tyresError) throw tyresError;

      // Merge position data with tyre details
      const tyreMap = new Map((tyresData || []).map(t => [t.id, t]));
      
      return (positions || [])
        .filter(p => p.tyre_code && tyreMap.has(p.tyre_code))
        .map(p => ({
          ...tyreMap.get(p.tyre_code)!,
          fleet_number: p.fleet_number,
          fleet_position: p.position,
          registration_no: p.registration_no,
        }));
    },
  });

  // Use installedTyres for all analytics (tyres currently on vehicles)
  const tyres = installedTyres as (Tyre & { fleet_number: string; fleet_position: string; registration_no: string })[];

  // Fleet Health Summary calculations - using 'condition' field which matches Vehicle Store
  // Maps: excellent->Excellent, good->Good, fair->Warning, poor/needs_replacement->Critical
  const healthStats = {
    excellent: tyres.filter((t) => t.condition === 'excellent').length,
    good: tyres.filter((t) => t.condition === 'good').length,
    warning: tyres.filter((t) => t.condition === 'fair').length,
    critical: tyres.filter((t) => t.condition === 'poor' || t.condition === 'needs_replacement').length,
  };

  // Cost analysis
  const totalPurchaseCost = tyres.reduce((sum, t) => sum + (t.purchase_cost_zar || 0), 0);
  const avgCostPerTyre = totalPurchaseCost / (tyres.length || 1);
  const avgKmPerTyre = tyres.reduce((sum, t) => sum + (t.km_travelled || 0), 0) / (tyres.length || 1);
  const costPerKm = avgCostPerTyre / (avgKmPerTyre || 1);

  // Position wear patterns - using fleet_position from fleet_tyre_positions
  const positionGroups = tyres.reduce((acc, tyre) => {
    const pos = tyre.fleet_position || 'unknown';
    if (!acc[pos]) {
      acc[pos] = { tyres: [], totalKm: 0 };
    }
    acc[pos].tyres.push(tyre);
    acc[pos].totalKm += tyre.km_travelled || 0;
    return acc;
  }, {} as Record<string, { tyres: typeof tyres, totalKm: number }>);

  const _positionWearData = Object.entries(positionGroups).map(([position, data]) => ({
    position,
    avgKm: data.totalKm / data.tyres.length,
    tyresUsed: data.tyres.length,
    avgDays: 0, // Not available without history data
  }));

  // Brand distribution for pie chart
  const brandDistribution = useMemo(() => {
    const counts = tyres.reduce((acc, t) => {
      const brand = t.brand || 'Unknown';
      acc[brand] = (acc[brand] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
    return Object.entries(counts).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }));
  }, [tyres]);

  // Brand cost summary with Cost/KM and Cost/MM analysis
  const brandSummary = useMemo(() => {
    const brandMap = new Map<string, {
      count: number;
      totalCost: number;
      totalKm: number;
      totalMmWorn: number;
      tyresWithKm: number;
      tyresWithTread: number;
    }>();

    tyres.forEach(t => {
      const brand = t.brand || 'Unknown';
      const existing = brandMap.get(brand) || { 
        count: 0, totalCost: 0, totalKm: 0, totalMmWorn: 0, tyresWithKm: 0, tyresWithTread: 0 
      };
      
      existing.count += 1;
      existing.totalCost += (t.purchase_cost_zar || 0);
      
      if (t.km_travelled && t.km_travelled > 0) {
        existing.totalKm += t.km_travelled;
        existing.tyresWithKm += 1;
      }
      
      if (t.initial_tread_depth && t.current_tread_depth) {
        const worn = t.initial_tread_depth - t.current_tread_depth;
        if (worn > 0) {
          existing.totalMmWorn += worn;
          existing.tyresWithTread += 1;
        }
      }
      
      brandMap.set(brand, existing);
    });

    return Array.from(brandMap.entries())
      .map(([brand, data]) => ({
        brand,
        count: data.count,
        totalCost: data.totalCost,
        avgCostPerTyre: data.count > 0 ? data.totalCost / data.count : 0,
        totalKm: data.totalKm,
        avgCostPerKm: data.totalKm > 0 ? data.totalCost / data.totalKm : null,
        totalMmWorn: data.totalMmWorn,
        // KM per MM worn - efficiency metric (higher = better, more km per mm of tread lost)
        kmPerMm: data.totalMmWorn > 0 ? data.totalKm / data.totalMmWorn : null,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [tyres]);

  // Grand totals for KPI cards
  const grandTotals = useMemo(() => ({
    totalTyres: tyres.length,
    totalCost: tyres.reduce((sum, t) => sum + (t.purchase_cost_zar || 0), 0),
    totalKm: tyres.reduce((sum, t) => sum + (t.km_travelled || 0), 0),
    totalMmWorn: tyres.reduce((sum, t) => {
      if (t.initial_tread_depth && t.current_tread_depth) {
        const worn = t.initial_tread_depth - t.current_tread_depth;
        return sum + Math.max(0, worn);
      }
      return sum;
    }, 0),
    brandCount: brandDistribution.length,
  }), [tyres, brandDistribution]);

  // Get unique positions for recommendations filter
  const positions = useMemo(() => {
    const posSet = new Set<string>();
    tyres.forEach((t) => {
      // Extract position part from fleet_position (e.g., "V1" from "01-ABC123-V1")
      const pos = t.fleet_position?.split('-')?.[2];
      if (pos) posSet.add(pos);
    });
    return ["all", ...Array.from(posSet)];
  }, [tyres]);

  // Recommendation engine analysis
  const recommendations = useMemo(() => {
    interface TyreGroup {
      brand: string;
      model: string;
      size: string;
      tyres: Tyre[];
      totalKm: number;
      totalCost: number;
      failures: number;
    }

    interface TyreRecommendation {
      brand: string;
      model: string;
      size: string;
      expectedLifespan: number;
      costPerKm: number;
      suitabilityScore: number;
      avgKmTravelled: number;
      tyreCount: number;
      avgCost: number;
      failureRate: number;
    }

    // Group tyres by brand/model/size
    const tyreGroups = tyres.reduce<Record<string, TyreGroup>>((acc, tyre) => {
      // Filter by fleet if selected (already filtered in query, but double-check)
      if (selectedFleet !== "all" && tyre.fleet_number !== selectedFleet) {
        return acc;
      }
      // Filter by position if selected
      if (selectedPosition !== "all") {
        const tyrePos = tyre.fleet_position?.split('-')?.[2];
        if (tyrePos !== selectedPosition) return acc;
      }

      const key = `${tyre.brand}-${tyre.model}-${tyre.size}`;
      if (!acc[key]) {
        acc[key] = {
          brand: tyre.brand,
          model: tyre.model,
          size: tyre.size,
          tyres: [],
          totalKm: 0,
          totalCost: 0,
          failures: 0,
        };
      }

      acc[key].tyres.push(tyre);
      acc[key].totalKm += tyre.km_travelled || 0;
      acc[key].totalCost += tyre.purchase_cost_zar || 0;
      if (tyre.condition === 'poor' || tyre.condition === 'needs_replacement') {
        acc[key].failures++;
      }

      return acc;
    }, {});

    // Calculate recommendations with suitability scores
    const recs: TyreRecommendation[] = Object.values(tyreGroups).map((group) => {
      const avgKm = group.totalKm / group.tyres.length;
      const avgCost = group.totalCost / group.tyres.length;
      const costPerKm = avgCost / (avgKm || 1);
      const failureRate = group.failures / group.tyres.length;

      // Suitability score (0-10)
      // Higher KM = better, Lower cost/km = better, Lower failure rate = better
      const kmScore = Math.min((avgKm / 100000) * 4, 4); // Max 4 points for 100k+ km
      const costScore = Math.max(3 - (costPerKm * 1000), 0); // Max 3 points for low cost/km
      const reliabilityScore = (1 - failureRate) * 3; // Max 3 points for no failures

      const suitabilityScore = Math.min(kmScore + costScore + reliabilityScore, 10);

      return {
        brand: group.brand,
        model: group.model,
        size: group.size,
        expectedLifespan: Math.round(avgKm),
        costPerKm: costPerKm,
        suitabilityScore: Math.round(suitabilityScore * 10) / 10,
        avgKmTravelled: Math.round(avgKm),
        tyreCount: group.tyres.length,
        avgCost: Math.round(avgCost),
        failureRate: Math.round(failureRate * 100),
      };
    });

    return recs.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  }, [tyres, selectedFleet, selectedPosition]);

  // Helper to render suitability badge
  const getSuitabilityBadge = (score: number) => {
    if (score >= 8) return <Badge className="bg-green-500">Excellent</Badge>;
    if (score >= 6) return <Badge variant="default">Good</Badge>;
    if (score >= 4) return <Badge variant="secondary">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  // Export to PDF - aligned with Google Sheets integration
  const exportToPDF = () => {
    const doc = new jsPDF();
    const title = `Fleet Tyre Report - ${selectedFleet === 'all' ? 'All Fleets' : selectedFleet}`;

    doc.setFontSize(16);
    doc.text(title, 20, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);

    let yPos = 45;
    
    // Fleet Statistics
    doc.setFontSize(12);
    doc.text("Fleet Tyre Statistics", 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.text(`Total Tyres Installed: ${grandTotals.totalTyres}`, 20, yPos);
    yPos += 6;
    doc.text(`Total Brands: ${grandTotals.brandCount}`, 20, yPos);
    
    yPos += 12;
    doc.setFontSize(12);
    doc.text("Condition Summary", 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.text(`Excellent: ${healthStats.excellent}`, 20, yPos);
    doc.text(`Good: ${healthStats.good}`, 70, yPos);
    doc.text(`Fair/Warning: ${healthStats.warning}`, 120, yPos);
    yPos += 6;
    doc.text(`Poor/Critical: ${healthStats.critical}`, 20, yPos);

    yPos += 12;
    doc.setFontSize(12);
    doc.text("Investment Summary (USD)", 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.text(`Total Investment: $${grandTotals.totalCost.toFixed(2)}`, 20, yPos);
    yPos += 6;
    doc.text(`Avg Cost/Tyre: $${avgCostPerTyre.toFixed(2)}`, 20, yPos);
    
    yPos += 12;
    doc.setFontSize(12);
    doc.text("Cost Efficiency Metrics", 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.text(`Total KM Tracked: ${grandTotals.totalKm.toLocaleString()}`, 20, yPos);
    yPos += 6;
    doc.text(`Total MM Worn: ${grandTotals.totalMmWorn.toFixed(1)}`, 20, yPos);
    yPos += 6;
    const avgCostPerKmTotal = grandTotals.totalKm > 0 ? grandTotals.totalCost / grandTotals.totalKm : 0;
    doc.text(`Avg Cost/KM: $${avgCostPerKmTotal.toFixed(4)}`, 20, yPos);
    yPos += 6;
    const kmPerMmTotal = grandTotals.totalMmWorn > 0 ? grandTotals.totalKm / grandTotals.totalMmWorn : 0;
    doc.text(`KM per MM Worn: ${kmPerMmTotal.toFixed(0)} (higher = better efficiency)`, 20, yPos);
    
    // Brand Summary Table
    yPos += 15;
    doc.setFontSize(12);
    doc.text("Brand Performance Summary", 20, yPos);
    yPos += 10;
    doc.setFontSize(9);
    
    // Table header
    doc.text("Brand", 20, yPos);
    doc.text("Count", 60, yPos);
    doc.text("Total Cost", 85, yPos);
    doc.text("KM", 120, yPos);
    doc.text("Cost/KM", 145, yPos);
    doc.text("KM/MM", 175, yPos);
    yPos += 6;
    
    // Table data (top 10 brands)
    brandSummary.slice(0, 10).forEach((b) => {
      doc.text(b.brand.substring(0, 15), 20, yPos);
      doc.text(String(b.count), 60, yPos);
      doc.text(`$${b.totalCost.toFixed(0)}`, 85, yPos);
      doc.text(b.totalKm.toLocaleString(), 120, yPos);
      doc.text(b.avgCostPerKm !== null ? `$${b.avgCostPerKm.toFixed(4)}` : 'N/A', 145, yPos);
      doc.text(b.kmPerMm !== null ? b.kmPerMm.toFixed(0) : 'N/A', 175, yPos);
      yPos += 5;
    });

    doc.save(`fleet-tyre-report-${selectedFleet}-${Date.now()}.pdf`);
  };

  // Export to Excel - aligned with Google Sheets integration
  const exportToExcel = () => {
    // Sheet 1: Individual Tyres
    const tyresData = tyres.map((t) => {
      const mmWorn = (t.initial_tread_depth && t.current_tread_depth) 
        ? Math.max(0, t.initial_tread_depth - t.current_tread_depth)
        : 0;
      const costPerKm = (t.purchase_cost_zar && t.km_travelled && t.km_travelled > 0)
        ? t.purchase_cost_zar / t.km_travelled
        : null;
      
      return {
        'Tyre Code': t.serial_number || t.id,
        'Fleet': t.fleet_number,
        'Position': t.fleet_position,
        'Registration': t.registration_no,
        'Brand': t.brand,
        'Model': t.model,
        'Size': t.size,
        'Type': t.type || '-',
        'Initial Tread (mm)': t.initial_tread_depth,
        'Current Tread (mm)': t.current_tread_depth,
        'MM Worn': mmWorn.toFixed(1),
        'Condition': t.condition || 'unknown',
        'KM Travelled': t.km_travelled || 0,
        'Cost (USD)': t.purchase_cost_zar || 0,
        'Cost/KM': costPerKm !== null ? costPerKm.toFixed(4) : 'N/A',
      };
    });

    // Sheet 2: Brand Summary (matches Google Sheets format)
    const brandData = brandSummary.map((d) => ({
      'Brand': d.brand,
      'Count': d.count,
      'Total Value (USD)': d.totalCost.toFixed(2),
      'Cost/Tyre': d.avgCostPerTyre.toFixed(2),
      'Total KM': d.totalKm,
      'Cost/KM': d.avgCostPerKm !== null ? d.avgCostPerKm.toFixed(4) : 'N/A',
      'Total MM Worn': d.totalMmWorn.toFixed(1),
      'KM/MM (Efficiency)': d.kmPerMm !== null ? d.kmPerMm.toFixed(0) : 'N/A',
    }));

    // Add grand total row
    brandData.push({
      'Brand': 'GRAND TOTAL',
      'Count': grandTotals.totalTyres,
      'Total Value (USD)': grandTotals.totalCost.toFixed(2),
      'Cost/Tyre': grandTotals.totalTyres > 0 ? (grandTotals.totalCost / grandTotals.totalTyres).toFixed(2) : '0.00',
      'Total KM': grandTotals.totalKm,
      'Cost/KM': grandTotals.totalKm > 0 ? (grandTotals.totalCost / grandTotals.totalKm).toFixed(4) : 'N/A',
      'Total MM Worn': grandTotals.totalMmWorn.toFixed(1),
      'KM/MM (Efficiency)': grandTotals.totalMmWorn > 0 ? (grandTotals.totalKm / grandTotals.totalMmWorn).toFixed(0) : 'N/A',
    });

    const workbook = XLSX.utils.book_new();
    
    // Add tyres worksheet
    const tyresSheet = XLSX.utils.json_to_sheet(tyresData);
    XLSX.utils.book_append_sheet(workbook, tyresSheet, "Installed Tyres");
    
    // Add brand summary worksheet
    const brandSheet = XLSX.utils.json_to_sheet(brandData);
    XLSX.utils.book_append_sheet(workbook, brandSheet, "Brand Summary");
    
    XLSX.writeFile(workbook, `fleet-tyres-${selectedFleet}-${Date.now()}.xlsx`);
  };

  // Get badge for tyre condition (matches Vehicle Store values)
  const getConditionBadge = (condition: string | null) => {
    const displayMap: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
      excellent: { label: "Excellent", variant: "default" },
      good: { label: "Good", variant: "secondary" },
      fair: { label: "Fair", variant: "outline" },
      poor: { label: "Poor", variant: "destructive" },
      needs_replacement: { label: "Needs Replacement", variant: "destructive" },
    };
    const info = displayMap[condition || ''] || { label: condition || 'Unknown', variant: "outline" as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fleet Tyre Analytics & Reports</CardTitle>
              <CardDescription>Comprehensive analytics, cost analysis, and reporting</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={selectedFleet} onValueChange={setSelectedFleet}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select fleet" />
                </SelectTrigger>
                <SelectContent>
                  {fleetNumbers.map(fn => (
                    <SelectItem key={fn} value={fn}>
                      {fn === "all" ? "All Fleets" : `Fleet ${fn}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={exportToPDF} variant="outline" size="sm">
                <FileDown className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button onClick={exportToExcel} variant="outline" size="sm">
                <FileDown className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={reportType} onValueChange={setReportType}>
            <TabsList className="flex overflow-x-auto w-full lg:grid lg:grid-cols-5">
              <TabsTrigger value="overview">
                <BarChart3 className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="brands">
                <Package className="w-4 h-4 mr-2" />
                Brand Analysis
              </TabsTrigger>
              <TabsTrigger value="health">
                <TrendingUp className="w-4 h-4 mr-2" />
                Health
              </TabsTrigger>
              <TabsTrigger value="recommendations">
                <Award className="w-4 h-4 mr-2" />
                Recommendations
              </TabsTrigger>
              <TabsTrigger value="cost">
                <DollarSign className="w-4 h-4 mr-2" />
                Cost
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab - KPI Summary */}
            <TabsContent value="overview" className="space-y-6 mt-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Tyres</span>
                      <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{grandTotals.totalTyres}</span>
                      <span className="text-xs text-emerald-600/70">{grandTotals.brandCount} brands</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Investment</span>
                      <span className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">${grandTotals.totalCost.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wider">Avg Cost/KM</span>
                      <span className="text-2xl font-bold text-violet-700 dark:text-violet-300 mt-1">
                        {grandTotals.totalKm > 0 ? `$${(grandTotals.totalCost / grandTotals.totalKm).toFixed(3)}` : 'N/A'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">KM per MM Worn</span>
                      <span className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                        {grandTotals.totalMmWorn > 0 ? `${(grandTotals.totalKm / grandTotals.totalMmWorn).toLocaleString(undefined, {maximumFractionDigits: 0})} km` : 'N/A'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-rose-200 dark:border-rose-800">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider">Total KM</span>
                      <span className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">{grandTotals.totalKm.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Brand Distribution Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Brand Distribution</CardTitle>
                    <CardDescription>Tyre count by brand</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {brandDistribution.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 opacity-30 mb-3" />
                        <p>No tyre data available</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={brandDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={90}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {brandDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Health Status Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Fleet Health Status</CardTitle>
                    <CardDescription>Tyre condition overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tyres.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 opacity-30 mb-3" />
                        <p>No tyre data available</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={[
                          { status: 'Excellent', count: healthStats.excellent, fill: '#10b981' },
                          { status: 'Good', count: healthStats.good, fill: '#3b82f6' },
                          { status: 'Warning', count: healthStats.warning, fill: '#f59e0b' },
                          { status: 'Critical', count: healthStats.critical, fill: '#ef4444' },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="status" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" name="Tyres">
                            {[
                              { status: 'Excellent', fill: '#10b981' },
                              { status: 'Good', fill: '#3b82f6' },
                              { status: 'Warning', fill: '#f59e0b' },
                              { status: 'Critical', fill: '#ef4444' },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Brand Analysis Tab */}
            <TabsContent value="brands" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Brand Cost Analysis</CardTitle>
                  <CardDescription>Detailed cost breakdown by brand with Cost/KM and Cost/MM metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brand</TableHead>
                        <TableHead className="text-center">Count</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead className="text-right">Avg/Tyre</TableHead>
                        <TableHead className="text-right">Total KM</TableHead>
                        <TableHead className="text-right">Cost/KM</TableHead>
                        <TableHead className="text-right">KM/MM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brandSummary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            <div className="flex flex-col items-center gap-3">
                              <Package className="h-12 w-12 opacity-30" />
                              <p>No tyre data available</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        brandSummary.map((data) => (
                          <TableRow key={data.brand} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-semibold">{data.brand}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{data.count}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">
                              ${data.totalCost.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              ${data.avgCostPerTyre.toFixed(0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {data.totalKm.toLocaleString()} km
                            </TableCell>
                            <TableCell className="text-right">
                              {data.avgCostPerKm !== null ? (
                                <span className={data.avgCostPerKm < 0.05 ? 'text-green-600 font-medium' : data.avgCostPerKm > 0.1 ? 'text-red-500' : ''}>
                                  ${data.avgCostPerKm.toFixed(4)}
                                </span>
                              ) : <span className="text-muted-foreground">N/A</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {data.kmPerMm !== null ? (
                                <span className={data.kmPerMm > 5000 ? 'text-green-600 font-medium' : data.kmPerMm < 2000 ? 'text-red-500' : ''}>
                                  {data.kmPerMm.toLocaleString(undefined, {maximumFractionDigits: 0})} km
                                </span>
                              ) : <span className="text-muted-foreground">N/A</span>}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health" className="space-y-4 mt-4">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Excellent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{healthStats.excellent}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Good</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-success">{healthStats.good}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Warning</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-warning">{healthStats.warning}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Critical</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-destructive">{healthStats.critical}</div>
                  </CardContent>
                </Card>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tyre Code</TableHead>
                    <TableHead>Brand/Model</TableHead>
                    <TableHead>Fleet Position</TableHead>
                    <TableHead>Tread Depth</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>KM Travelled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tyres.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No tyres found for selected fleet
                      </TableCell>
                    </TableRow>
                  ) : (
                    tyres.slice(0, 10).map((tyre) => (
                      <TableRow key={tyre.id}>
                        <TableCell className="font-mono">{tyre.serial_number || tyre.id}</TableCell>
                        <TableCell>{tyre.brand} {tyre.model}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tyre.fleet_position || '-'}</Badge>
                        </TableCell>
                        <TableCell>{tyre.current_tread_depth} mm</TableCell>
                        <TableCell>{getConditionBadge(tyre.condition)}</TableCell>
                        <TableCell>{tyre.km_travelled?.toLocaleString() || 0} km</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tyre Recommendation Engine</CardTitle>
                  <CardDescription>Data-driven recommendations based on fleet performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Position Filter */}
                  <div className="flex gap-4">
                    <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by position" />
                      </SelectTrigger>
                      <SelectContent>
                        {positions.map((pos: string) => (
                          <SelectItem key={pos} value={pos}>
                            {pos === "all" ? "All Positions" : `Position ${pos}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Recommendations List */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Top Recommendations</h3>

                    {recommendations.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          No data available. Ensure tyres have KM data recorded.
                        </CardContent>
                      </Card>
                    ) : (
                      recommendations.slice(0, 10).map((rec, index) => (
                        <Card key={`${rec.brand}-${rec.model}-${index}`} className={index === 0 ? "border-primary" : ""}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  {index === 0 && (
                                    <Star className="w-5 h-5 text-primary fill-primary" />
                                  )}
                                  <div>
                                    <p className="font-bold text-lg">{rec.brand} {rec.model}</p>
                                    <p className="text-sm text-muted-foreground">{rec.size}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                      <TrendingUp className="w-3 h-3" />
                                      Expected Lifespan
                                    </p>
                                    <p className="font-semibold">{rec.expectedLifespan.toLocaleString()} km</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                      <DollarSign className="w-3 h-3" />
                                      Cost/KM
                                    </p>
                                    <p className="font-semibold">${rec.costPerKm.toFixed(4)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Reliability
                                    </p>
                                    <p className="font-semibold">{100 - rec.failureRate}%</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Data Points</p>
                                    <p className="font-semibold">{rec.tyreCount} tyres</p>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span>Suitability Score</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{rec.suitabilityScore}/10</span>
                                      {getSuitabilityBadge(rec.suitabilityScore)}
                                    </div>
                                  </div>
                                  <Progress value={rec.suitabilityScore * 10} className="h-2" />
                                </div>

                                <div className="mt-3 flex gap-2 text-xs">
                                  <Badge variant="outline">Avg Cost: ${rec.avgCost}</Badge>
                                  <Badge variant="outline">Based on {rec.tyreCount} tyres</Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cost" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${totalPurchaseCost.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">All tyres</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Avg Cost/Tyre</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${avgCostPerTyre.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Purchase price</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Avg KM/Tyre</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{avgKmPerTyre.toFixed(0)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Kilometers</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cost/KM</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${costPerKm.toFixed(4)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Per kilometer</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>


          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default FleetTyreReports;