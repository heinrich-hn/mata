import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { useDriverPerformanceSummary } from "@/hooks/useDriverBehaviorEvents";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AlertTriangle, CheckCircle, Download, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
Bar,
BarChart,
CartesianGrid,
Cell,
Legend,
Pie,
PieChart,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";

const SEVERITY_COLORS = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#eab308",
  low: "#3b82f6",
};

type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

const DriverPerformanceSummary = () => {
  const { data: driverSummaries = [], isLoading } = useDriverPerformanceSummary();
  const [selectedDriver, setSelectedDriver] = useState<string>("all");

  // Chart data for severity distribution
  const severityChartData = useMemo(() => {
    const filtered = selectedDriver === "all"
      ? driverSummaries
      : driverSummaries.filter(d => d.driver_name === selectedDriver);

    const totals = filtered.reduce(
      (acc, driver) => ({
        critical: acc.critical + driver.critical_events,
        high: acc.high + driver.high_events,
        medium: acc.medium + driver.medium_events,
        low: acc.low + driver.low_events,
      }),
      { critical: 0, high: 0, medium: 0, low: 0 }
    );

    return [
      { name: "Critical", value: totals.critical, color: SEVERITY_COLORS.critical },
      { name: "High", value: totals.high, color: SEVERITY_COLORS.high },
      { name: "Medium", value: totals.medium, color: SEVERITY_COLORS.medium },
      { name: "Low", value: totals.low, color: SEVERITY_COLORS.low },
    ].filter(item => item.value > 0);
  }, [driverSummaries, selectedDriver]);

  // Bar chart data for events per driver
  const driverBarData = useMemo(() => {
    return driverSummaries.slice(0, 10).map(driver => ({
      name: driver.driver_name.split(" ")[0], // First name only for chart
      fullName: driver.driver_name,
      total: driver.total_events,
      critical: driver.critical_events,
      high: driver.high_events,
      medium: driver.medium_events,
      low: driver.low_events,
      points: driver.total_points,
    }));
  }, [driverSummaries]);

  // Selected driver details
  const selectedDriverData = useMemo(() => {
    if (selectedDriver === "all") {
      const totals = driverSummaries.reduce(
        (acc, d) => ({
          total_events: acc.total_events + d.total_events,
          total_points: acc.total_points + d.total_points,
          open_events: acc.open_events + d.open_events,
          resolved_events: acc.resolved_events + d.resolved_events,
          critical_events: acc.critical_events + d.critical_events,
        }),
        { total_events: 0, total_points: 0, open_events: 0, resolved_events: 0, critical_events: 0 }
      );
      return {
        driver_name: "All Drivers",
        ...totals,
        driver_count: driverSummaries.length,
      };
    }
    return driverSummaries.find(d => d.driver_name === selectedDriver);
  }, [driverSummaries, selectedDriver]);

  const handleExportPDF = () => {
    if (!driverSummaries || driverSummaries.length === 0) return;

    const doc = new jsPDF("landscape", "mm", "a4") as JsPDFWithAutoTable;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const generatedAt = new Date().toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Filtered data based on current selector
    const reportSummaries = selectedDriver === "all"
      ? driverSummaries
      : driverSummaries.filter(d => d.driver_name === selectedDriver);

    const totals = reportSummaries.reduce(
      (acc, d) => ({
        total_events: acc.total_events + d.total_events,
        total_points: acc.total_points + d.total_points,
        open_events: acc.open_events + d.open_events,
        resolved_events: acc.resolved_events + d.resolved_events,
        critical_events: acc.critical_events + d.critical_events,
        high_events: acc.high_events + d.high_events,
        medium_events: acc.medium_events + d.medium_events,
        low_events: acc.low_events + d.low_events,
      }),
      {
        total_events: 0,
        total_points: 0,
        open_events: 0,
        resolved_events: 0,
        critical_events: 0,
        high_events: 0,
        medium_events: 0,
        low_events: 0,
      },
    );

    // ----- Header band -----
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Driver Performance Summary", 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("MATA Fleet Management", pageWidth - 14, 14, { align: "right" });

    // ----- Sub-header -----
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    const scopeLabel = selectedDriver === "all"
      ? `All Drivers (${reportSummaries.length})`
      : selectedDriver;
    doc.text(`Scope: ${scopeLabel}`, 14, 30);
    doc.text(`Generated: ${generatedAt}`, pageWidth - 14, 30, { align: "right" });

    // ----- Summary cards -----
    const cardY = 36;
    const cardH = 18;
    const cardGap = 4;
    const cardW = (pageWidth - 28 - cardGap * 4) / 5;
    const cards: Array<{ label: string; value: number; fill: [number, number, number]; text: [number, number, number] }> = [
      { label: "Total Events", value: totals.total_events, fill: [241, 245, 249], text: [15, 23, 42] },
      { label: "Critical", value: totals.critical_events, fill: [254, 226, 226], text: [185, 28, 28] },
      { label: "Total Points", value: totals.total_points, fill: [254, 243, 199], text: [180, 83, 9] },
      { label: "Open", value: totals.open_events, fill: [255, 237, 213], text: [194, 65, 12] },
      { label: "Resolved", value: totals.resolved_events, fill: [220, 252, 231], text: [21, 128, 61] },
    ];
    cards.forEach((c, i) => {
      const x = 14 + i * (cardW + cardGap);
      doc.setFillColor(c.fill[0], c.fill[1], c.fill[2]);
      doc.roundedRect(x, cardY, cardW, cardH, 2, 2, "F");
      doc.setTextColor(c.text[0], c.text[1], c.text[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(String(c.value), x + cardW / 2, cardY + 9, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(c.label, x + cardW / 2, cardY + 15, { align: "center" });
    });

    // ----- Severity breakdown row -----
    const sevY = cardY + cardH + 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Severity Breakdown", 14, sevY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const sevText = `Critical: ${totals.critical_events}    High: ${totals.high_events}    Medium: ${totals.medium_events}    Low: ${totals.low_events}`;
    doc.text(sevText, 14, sevY + 5);

    // ----- Driver table -----
    const tableHead = [[
      "#",
      "Driver",
      "Total",
      "Critical",
      "High",
      "Medium",
      "Low",
      "Open",
      "Resolved",
      "Points",
    ]];
    const tableBody = reportSummaries.map((d, i) => [
      String(i + 1),
      d.driver_name,
      String(d.total_events),
      String(d.critical_events),
      String(d.high_events),
      String(d.medium_events),
      String(d.low_events),
      String(d.open_events),
      String(d.resolved_events),
      String(d.total_points),
    ]);

    autoTable(doc, {
      startY: sevY + 10,
      head: tableHead,
      body: tableBody,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: { textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 55 },
        2: { halign: "center", fontStyle: "bold" },
        3: { halign: "center", textColor: [185, 28, 28] },
        4: { halign: "center", textColor: [194, 65, 12] },
        5: { halign: "center", textColor: [161, 98, 7] },
        6: { halign: "center", textColor: [29, 78, 216] },
        7: { halign: "center" },
        8: { halign: "center", textColor: [21, 128, 61] },
        9: { halign: "center", fontStyle: "bold" },
      },
      didDrawPage: () => {
        // Footer drawn after loop below; this hook only ensures pagination runs.
      },
    });

    // ----- Footer on every page -----
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "normal");
      doc.text("MATA Fleet Management \u2022 Driver Performance Summary", 14, pageHeight - 6);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6, { align: "right" });
    }

    const fileScope = selectedDriver === "all" ? "all-drivers" : selectedDriver.replace(/\s+/g, "-").toLowerCase();
    doc.save(`driver-performance-${fileScope}-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center items-center h-48">
            <div className="animate-pulse text-muted-foreground">Loading performance data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (driverSummaries.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            No driver behavior events found.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Driver Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Driver Performance Summary
              </CardTitle>
              <CardDescription>
                View behavior events and points by driver
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers ({driverSummaries.length})</SelectItem>
                  {driverSummaries.map(driver => (
                    <SelectItem key={driver.driver_name} value={driver.driver_name}>
                      {driver.driver_name} ({driver.total_events})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={driverSummaries.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Summary Stats */}
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{selectedDriverData?.total_events || 0}</p>
              <p className="text-xs text-muted-foreground">Total Events</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{selectedDriverData?.critical_events || 0}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{selectedDriverData?.total_points || 0}</p>
              <p className="text-xs text-muted-foreground">Total Points</p>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{selectedDriverData?.open_events || 0}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{selectedDriverData?.resolved_events || 0}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Severity Distribution Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Event Severity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {severityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={severityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {severityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Events"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No events to display
              </div>
            )}
          </CardContent>
        </Card>

        {/* Events per Driver Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Events by Driver (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driverBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={driverBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    labelFormatter={(label) => {
                      const driver = driverBarData.find(d => d.name === label);
                      return driver?.fullName || label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="critical" stackId="a" fill={SEVERITY_COLORS.critical} name="Critical" />
                  <Bar dataKey="high" stackId="a" fill={SEVERITY_COLORS.high} name="High" />
                  <Bar dataKey="medium" stackId="a" fill={SEVERITY_COLORS.medium} name="Medium" />
                  <Bar dataKey="low" stackId="a" fill={SEVERITY_COLORS.low} name="Low" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No drivers to display
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Driver Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Driver Risk Ranking
          </CardTitle>
          <CardDescription>Drivers sorted by total behavior events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {driverSummaries.slice(0, 8).map((driver, index) => (
              <div
                key={driver.driver_name}
                className={`flex items-center justify-between p-3 rounded-lg border ${index === 0 ? "bg-red-50 dark:bg-red-950/20 border-red-200" :
                    index === 1 ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200" :
                      index === 2 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200" :
                        "bg-muted/30"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? "bg-red-200 text-red-800" :
                      index === 1 ? "bg-orange-200 text-orange-800" :
                        index === 2 ? "bg-amber-200 text-amber-800" :
                          "bg-gray-200 text-gray-800"
                    }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{driver.driver_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {driver.open_events} open · {driver.resolved_events} resolved
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold">{driver.total_events} events</p>
                    <p className="text-xs text-muted-foreground">{driver.total_points} points</p>
                  </div>
                  <div className="flex gap-1">
                    {driver.critical_events > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {driver.critical_events} critical
                      </Badge>
                    )}
                    {driver.resolved_events === driver.total_events && driver.total_events > 0 && (
                      <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        All resolved
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverPerformanceSummary;
