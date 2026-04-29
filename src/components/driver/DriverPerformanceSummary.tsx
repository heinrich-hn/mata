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
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AlertTriangle, CheckCircle, Download, FileSpreadsheet, TrendingDown, TrendingUp, Users } from "lucide-react";
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

// Excel styling palette (mirrors src/lib/driverBehaviorExport.ts)
const XC = {
  navy: "FF1E3A5F",
  red: "FFDC2626",
  orange: "FFF97316",
  amber: "FFD97706",
  green: "FF16A34A",
  purple: "FF7E22CE",
  blue: "FF2563EB",
  altRow: "FFF3F4F6",
  white: "FFFFFFFF",
  darkText: "FF111827",
  grayText: "FF6B7280",
  totalBg: "FFD1FAE5",
  totalText: "FF065F46",
  subtitleBg: "FFE8EEF6",
  purpleLight: "FFF5F3FF",
} as const;

type XCell = ExcelJS.Cell;
const xlFill = (cell: XCell, argb: string) => {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
};
const xlFont = (cell: XCell, bold: boolean, size: number, argb: string) => {
  cell.font = { name: "Calibri", bold, size, color: { argb } };
};
const xlBorder = (cell: XCell, argb = "FFD9D9D9") => {
  const s = { style: "thin" as const, color: { argb } };
  cell.border = { top: s, bottom: s, left: s, right: s };
};

// Risk contribution = 100% − score%, where score% = (avg / 5) × 100.
// e.g. avg = 4 → score 80% → risk contribution 20%.
const riskPct = (avg: number | null | undefined): number | null =>
  avg != null ? Math.round(100 - (avg / 5) * 100) : null;
const formatRiskPct = (avg: number | null | undefined): string => {
  const p = riskPct(avg);
  return p != null ? `${p}%` : "—";
};

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
          risk_score_total: acc.risk_score_total + d.risk_score_total,
          risk_score_count: acc.risk_score_count + d.risk_score_count,
          max_risk_score: Math.max(acc.max_risk_score, d.max_risk_score ?? 0),
        }),
        { total_events: 0, total_points: 0, open_events: 0, resolved_events: 0, critical_events: 0, risk_score_total: 0, risk_score_count: 0, max_risk_score: 0 }
      );
      return {
        driver_name: "All Drivers",
        ...totals,
        avg_risk_score: totals.risk_score_count > 0 ? totals.risk_score_total / totals.risk_score_count : null,
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
      "Avg Risk",
      "Risk %",
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
      d.avg_risk_score != null ? `${d.avg_risk_score.toFixed(1)}/5` : "—",
      formatRiskPct(d.avg_risk_score),
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
        10: { halign: "center", fontStyle: "bold", textColor: [126, 34, 206] },
        11: { halign: "center", fontStyle: "bold", textColor: [126, 34, 206] },
      },
      didDrawPage: () => {
        // Footer drawn after loop below; this hook only ensures pagination runs.
      },
    });

    // ----- Risk Score by Event Type (per driver) -----
    const riskRows: string[][] = [];
    reportSummaries.forEach((d) => {
      Object.entries(d.risk_by_event_type)
        .sort((a, b) => b[1].avg - a[1].avg)
        .forEach(([eventType, stats]) => {
          riskRows.push([
            d.driver_name,
            eventType,
            String(stats.count),
            `${stats.avg.toFixed(1)}/5`,
            formatRiskPct(stats.avg),
          ]);
        });
    });

    if (riskRows.length > 0) {
      const startY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(126, 34, 206);
      doc.text("Risk Score by Event Type", 14, startY);
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: startY + 3,
        head: [["Driver", "Event Type", "Debriefed Events", "Avg Risk", "Risk %"]],
        body: riskRows,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
        headStyles: {
          fillColor: [126, 34, 206],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: { textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [250, 245, 255] },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 60 },
          2: { halign: "center" },
          3: { halign: "center", fontStyle: "bold", textColor: [126, 34, 206] },
          4: { halign: "center", fontStyle: "bold", textColor: [126, 34, 206] },
        },
      });
    }

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

  const handleExportExcel = async () => {
    if (!driverSummaries || driverSummaries.length === 0) return;

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
        risk_score_total: acc.risk_score_total + d.risk_score_total,
        risk_score_count: acc.risk_score_count + d.risk_score_count,
      }),
      {
        total_events: 0, total_points: 0, open_events: 0, resolved_events: 0,
        critical_events: 0, high_events: 0, medium_events: 0, low_events: 0,
        risk_score_total: 0, risk_score_count: 0,
      },
    );
    const overallAvgRisk = totals.risk_score_count > 0
      ? totals.risk_score_total / totals.risk_score_count
      : null;
    const generatedAt = new Date().toLocaleString("en-GB", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const scopeLabel = selectedDriver === "all"
      ? `All Drivers (${reportSummaries.length})`
      : selectedDriver;

    const wb = new ExcelJS.Workbook();
    wb.creator = "MATA Fleet Management";
    wb.created = new Date();

    // ───── Summary sheet ─────
    const summary = wb.addWorksheet("Summary", { properties: { tabColor: { argb: XC.navy } } });
    summary.columns = [
      { width: 32 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 },
    ];

    const titleRow = summary.addRow(["Driver Performance Summary"]);
    summary.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
    xlFill(titleRow.getCell(1), XC.navy);
    xlFont(titleRow.getCell(1), true, 16, XC.white);
    titleRow.height = 26;
    titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const subRow = summary.addRow([`Scope: ${scopeLabel}    •    Generated: ${generatedAt}`]);
    summary.mergeCells(`A${subRow.number}:E${subRow.number}`);
    xlFill(subRow.getCell(1), XC.subtitleBg);
    xlFont(subRow.getCell(1), false, 10, XC.grayText);
    subRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    subRow.height = 18;

    summary.addRow([]);

    const statsHeader = summary.addRow(["Metric", "Value", "", "", ""]);
    [1, 2].forEach(i => {
      xlFill(statsHeader.getCell(i), XC.navy);
      xlFont(statsHeader.getCell(i), true, 11, XC.white);
      xlBorder(statsHeader.getCell(i));
      statsHeader.getCell(i).alignment = { horizontal: "left", indent: 1 };
    });

    const stats: Array<[string, string | number, string?]> = [
      ["Total Events", totals.total_events],
      ["Critical Events", totals.critical_events, XC.red],
      ["High Severity", totals.high_events, XC.orange],
      ["Medium Severity", totals.medium_events, XC.amber],
      ["Low Severity", totals.low_events, XC.blue],
      ["Open Events", totals.open_events, XC.orange],
      ["Resolved Events", totals.resolved_events, XC.green],
      ["Total Points", totals.total_points],
      ["Average Risk Score", overallAvgRisk != null ? `${overallAvgRisk.toFixed(2)} / 5` : "—", XC.purple],
      ["Risk Contribution", formatRiskPct(overallAvgRisk), XC.purple],
    ];
    stats.forEach((s, idx) => {
      const r = summary.addRow([s[0], s[1]]);
      const labelCell = r.getCell(1);
      const valCell = r.getCell(2);
      labelCell.alignment = { horizontal: "left", indent: 1 };
      valCell.alignment = { horizontal: "left", indent: 1 };
      if (idx % 2 === 1) {
        xlFill(labelCell, XC.altRow);
        xlFill(valCell, XC.altRow);
      }
      xlFont(labelCell, false, 10, XC.darkText);
      xlFont(valCell, true, 11, s[2] ?? XC.darkText);
      xlBorder(labelCell); xlBorder(valCell);
    });

    // ───── Driver Leaderboard sheet ─────
    const lb = wb.addWorksheet("Driver Leaderboard", { properties: { tabColor: { argb: XC.purple } } });
    const lbHeaders = [
      "#", "Driver", "Total", "Critical", "High", "Medium", "Low",
      "Open", "Resolved", "Points", "Avg Risk", "Risk %",
    ];
    lb.columns = [
      { width: 5 }, { width: 28 }, { width: 9 }, { width: 10 }, { width: 9 }, { width: 10 },
      { width: 9 }, { width: 9 }, { width: 11 }, { width: 10 }, { width: 11 }, { width: 10 },
    ];
    const lbHead = lb.addRow(lbHeaders);
    lbHead.height = 22;
    lbHead.eachCell(cell => {
      xlFill(cell, XC.navy);
      xlFont(cell, true, 10, XC.white);
      cell.alignment = { vertical: "middle", horizontal: "center" };
      xlBorder(cell);
    });

    reportSummaries.forEach((d, i) => {
      const pct = riskPct(d.avg_risk_score);
      const r = lb.addRow([
        i + 1,
        d.driver_name,
        d.total_events,
        d.critical_events,
        d.high_events,
        d.medium_events,
        d.low_events,
        d.open_events,
        d.resolved_events,
        d.total_points,
        d.avg_risk_score != null ? Number(d.avg_risk_score.toFixed(2)) : "—",
        pct != null ? `${pct}%` : "—",
      ]);
      const isAlt = i % 2 === 1;
      r.eachCell((cell, colNumber) => {
        if (isAlt) xlFill(cell, XC.altRow);
        cell.alignment = { vertical: "middle", horizontal: colNumber === 2 ? "left" : "center" };
        xlFont(cell, colNumber === 1 || colNumber === 10 || colNumber === 11 || colNumber === 12, 10, XC.darkText);
        xlBorder(cell);
      });
      // Color critical / risk columns
      if (d.critical_events > 0) xlFont(r.getCell(4), true, 10, XC.red);
      if (d.avg_risk_score != null) {
        xlFont(r.getCell(11), true, 10, XC.purple);
        xlFont(r.getCell(12), true, 10, XC.purple);
      }
    });

    // Totals row
    const totalsRow = lb.addRow([
      "", "TOTAL",
      totals.total_events,
      totals.critical_events,
      totals.high_events,
      totals.medium_events,
      totals.low_events,
      totals.open_events,
      totals.resolved_events,
      totals.total_points,
      overallAvgRisk != null ? Number(overallAvgRisk.toFixed(2)) : "—",
      formatRiskPct(overallAvgRisk),
    ]);
    totalsRow.eachCell((cell, colNumber) => {
      xlFill(cell, XC.totalBg);
      xlFont(cell, true, 11, XC.totalText);
      cell.alignment = { vertical: "middle", horizontal: colNumber === 2 ? "left" : "center" };
      xlBorder(cell);
    });

    lb.views = [{ state: "frozen", ySplit: 1 }];

    // ───── Risk by Event Type sheet ─────
    const rbet = wb.addWorksheet("Risk by Event Type", { properties: { tabColor: { argb: XC.purple } } });
    rbet.columns = [
      { width: 28 }, { width: 32 }, { width: 18 }, { width: 14 }, { width: 12 },
    ];
    const rbetHead = rbet.addRow(["Driver", "Event Type", "Debriefed Events", "Avg Risk", "Risk %"]);
    rbetHead.height = 22;
    rbetHead.eachCell(cell => {
      xlFill(cell, XC.purple);
      xlFont(cell, true, 10, XC.white);
      cell.alignment = { vertical: "middle", horizontal: "center" };
      xlBorder(cell);
    });

    let rbetIdx = 0;
    reportSummaries.forEach(d => {
      const entries = Object.entries(d.risk_by_event_type).sort((a, b) => b[1].avg - a[1].avg);
      entries.forEach(([eventType, stats]) => {
        const pct = riskPct(stats.avg);
        const r = rbet.addRow([
          d.driver_name,
          eventType,
          stats.count,
          Number(stats.avg.toFixed(2)),
          pct != null ? `${pct}%` : "—",
        ]);
        const isAlt = rbetIdx % 2 === 1;
        r.eachCell((cell, colNumber) => {
          if (isAlt) xlFill(cell, XC.purpleLight);
          cell.alignment = { vertical: "middle", horizontal: colNumber <= 2 ? "left" : "center" };
          xlFont(cell, colNumber >= 4, 10, colNumber >= 4 ? XC.purple : XC.darkText);
          xlBorder(cell);
        });
        rbetIdx++;
      });
    });
    if (rbetIdx === 0) {
      const r = rbet.addRow(["No debriefed events with risk scores", "", "", "", ""]);
      rbet.mergeCells(`A${r.number}:E${r.number}`);
      r.getCell(1).alignment = { horizontal: "center" };
      xlFont(r.getCell(1), false, 10, XC.grayText);
    }
    rbet.views = [{ state: "frozen", ySplit: 1 }];

    // ───── Save ─────
    const buffer = await wb.xlsx.writeBuffer();
    const fileScope = selectedDriver === "all" ? "all-drivers" : selectedDriver.replace(/\s+/g, "-").toLowerCase();
    const filename = `driver-performance-${fileScope}-${new Date().toISOString().split("T")[0]}.xlsx`;
    saveAs(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename,
    );
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
                onClick={handleExportExcel}
                disabled={driverSummaries.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
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
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {selectedDriverData?.avg_risk_score != null
                  ? `${selectedDriverData.avg_risk_score.toFixed(1)}/5`
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Avg Risk Score{selectedDriverData?.avg_risk_score != null && (
                  <span className="ml-1 font-semibold text-purple-600">({formatRiskPct(selectedDriverData.avg_risk_score)})</span>
                )}
              </p>
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

      {/* Risk Score by Event Type (selected driver) */}
      {selectedDriver !== "all" && selectedDriverData && "risk_by_event_type" in selectedDriverData && (
        (() => {
          const breakdown = (selectedDriverData as { risk_by_event_type?: Record<string, { total: number; count: number; avg: number }> }).risk_by_event_type ?? {};
          const entries = Object.entries(breakdown);
          if (entries.length === 0) return null;
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-purple-600" />
                  Risk Score by Event Type
                </CardTitle>
                <CardDescription>Average risk score (1-5) assigned during debriefing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {entries
                    .sort((a, b) => b[1].avg - a[1].avg)
                    .map(([type, stats]) => (
                      <div key={type} className="flex items-center justify-between p-3 rounded-lg border bg-purple-50/40">
                        <div>
                          <p className="font-medium text-sm">{type}</p>
                          <p className="text-xs text-muted-foreground">{stats.count} debriefed event{stats.count === 1 ? "" : "s"}</p>
                        </div>
                        <Badge variant="outline" className="text-sm font-bold border-purple-500 text-purple-700">
                          {stats.avg.toFixed(1)}/5
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          );
        })()
      )}

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
                  <div className="flex flex-col items-end gap-1">
                    {driver.avg_risk_score != null && (
                      <Badge variant="outline" className="text-xs border-purple-500 text-purple-700">
                        Risk {driver.avg_risk_score.toFixed(1)}/5 · {formatRiskPct(driver.avg_risk_score)}
                      </Badge>
                    )}
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverPerformanceSummary;
