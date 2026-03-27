import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  addStyledSheet,
  addSummarySheet,
  createWorkbook,
  saveWorkbook,
  healthColours,
  colLetter,
  addTitle,
  addSubtitle,
  generatedSubtitle,
  styleHeaderRow,
  styleBodyRow,
  autoFitColumns,
  thinBorder,
  altRowFill,
} from "@/utils/excelStyles";

// Type definitions for tyre data
interface TyreExportData {
  serial_number: string;
  brand: string;
  model: string;
  size: string;
  type?: string;
  position?: string;
  current_fleet_position?: string | null;
  current_tread_depth?: number | null;
  initial_tread_depth?: number | null;
  pressure_rating?: number | null;
  tread_depth_health?: string | null;
  status?: string;
  installation_date?: string | null;
  purchase_date?: string | null;
  dot_code?: string | null;
  notes?: string | null;
  vehicles?: {
    id?: string;
    registration_number?: string;
    fleet_number?: string;
  } | null;
}

interface VehicleTyreExportData extends TyreExportData {
  positionLabel?: string;
}

/**
 * Export all fleet tyres to Excel
 */
export async function exportAllTyresToExcel(tyres: TyreExportData[], filename?: string): Promise<void> {
  const headers = [
    "Serial Number", "Brand", "Model", "Size", "Type", "DOT Code",
    "Fleet Position", "Vehicle Fleet #", "Vehicle Reg", "Status",
    "Initial Tread (mm)", "Current Tread (mm)", "Tread Health",
    "Pressure Rating (PSI)", "Installation Date", "Purchase Date", "Notes",
  ];

  const rows = tyres.map((t) => [
    t.serial_number || "-", t.brand || "-", t.model || "-", t.size || "-",
    t.type || "-", t.dot_code || "-", t.current_fleet_position || "-",
    t.vehicles?.fleet_number || "-", t.vehicles?.registration_number || "-",
    t.status || "-", t.initial_tread_depth ?? "", t.current_tread_depth ?? "",
    t.tread_depth_health || "-", t.pressure_rating ?? "",
    t.installation_date || "-", t.purchase_date || "-", t.notes || "-",
  ]);

  const wb = createWorkbook();

  addStyledSheet(wb, "All Tyres", {
    title: "FLEET TYRE REPORT",
    headers,
    rows,
    cellStyler: (row, col) => {
      if (col === 13) return healthColours[String(row[12]).toLowerCase()];
      return undefined;
    },
  });

  // Summary sheet
  const installed = tyres.filter((t) => t.current_fleet_position).length;
  const critical = tyres.filter((t) => t.tread_depth_health === "critical").length;
  addSummarySheet(wb, "Summary", {
    title: "FLEET TYRE SUMMARY",
    rows: [
      ["Total Tyres", tyres.length],
      ["Installed on Vehicles", installed],
      ["In Stock / Bay", tyres.length - installed],
      ["Critical Tread Health", critical],
      ["Warning Tread Health", tyres.filter((t) => t.tread_depth_health === "warning").length],
    ],
  });

  const exportFilename = filename || `Fleet_Tyres_${new Date().toISOString().split("T")[0]}.xlsx`;
  await saveWorkbook(wb, exportFilename);
}

/**
 * Export all fleet tyres to PDF
 */
export function exportAllTyresToPDF(tyres: TyreExportData[], filename?: string): void {
  const doc = new jsPDF("landscape", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Fleet Tyre Report", pageWidth / 2, 15, { align: "center" });

  // Subtitle with date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, pageWidth / 2, 22, { align: "center" });

  // Summary stats
  const totalTyres = tyres.length;
  const installedTyres = tyres.filter((t) => t.current_fleet_position).length;
  const inStockTyres = totalTyres - installedTyres;
  const criticalTyres = tyres.filter((t) => t.tread_depth_health === "critical").length;

  doc.setFontSize(9);
  const summaryText = `Total: ${totalTyres} | Installed: ${installedTyres} | In Stock: ${inStockTyres} | Critical: ${criticalTyres}`;
  doc.text(summaryText, pageWidth / 2, 28, { align: "center" });

  // Table data
  const tableHeaders = [
    "Serial #",
    "Brand",
    "Model",
    "Size",
    "Fleet Position",
    "Vehicle",
    "Status",
    "Tread (mm)",
    "Health",
  ];

  const tableData = tyres.map((tyre) => [
    tyre.serial_number?.substring(0, 15) || "-",
    tyre.brand || "-",
    tyre.model || "-",
    tyre.size || "-",
    tyre.current_fleet_position?.substring(0, 20) || "-",
    tyre.vehicles?.fleet_number || "-",
    tyre.status || "-",
    tyre.current_tread_depth?.toString() || "-",
    tyre.tread_depth_health || "-",
  ]);

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 33,
    styles: {
      fontSize: 7,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 22 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 45 },
      5: { cellWidth: 20 },
      6: { cellWidth: 22 },
      7: { cellWidth: 20 },
      8: { cellWidth: 22 },
    },
    didParseCell: (data) => {
      // Color-code health column
      if (data.section === "body" && data.column.index === 8) {
        const health = data.cell.raw as string;
        if (health === "excellent") {
          data.cell.styles.textColor = [34, 197, 94];
        } else if (health === "good") {
          data.cell.styles.textColor = [59, 130, 246];
        } else if (health === "warning") {
          data.cell.styles.textColor = [234, 179, 8];
        } else if (health === "critical") {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const exportFilename = filename || `Fleet_Tyres_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(exportFilename);
}

/**
 * Export vehicle-specific tyres to Excel
 */
export async function exportVehicleTyresToExcel(
  tyres: VehicleTyreExportData[],
  vehicleInfo: { fleetNumber: string; registration: string },
  filename?: string
): Promise<void> {
  const headers = [
    "Position", "Position Label", "Serial Number", "Brand", "Model",
    "Size", "Type", "DOT Code", "Status", "Initial Tread (mm)",
    "Current Tread (mm)", "Tread Health", "Pressure Rating (PSI)",
    "Installation Date", "Notes",
  ];

  const rows = tyres.map((t, i) => [
    t.position || `P${i + 1}`, t.positionLabel || "-",
    t.serial_number || "-", t.brand || "-", t.model || "-",
    t.size || "-", t.type || "-", t.dot_code || "-", t.status || "-",
    t.initial_tread_depth ?? "", t.current_tread_depth ?? "",
    t.tread_depth_health || "-", t.pressure_rating ?? "",
    t.installation_date || "-", t.notes || "-",
  ]);

  const wb = createWorkbook();

  addStyledSheet(wb, `${vehicleInfo.fleetNumber} Tyres`, {
    title: `VEHICLE TYRE REPORT — ${vehicleInfo.fleetNumber}`,
    subtitle: generatedSubtitle(`Registration: ${vehicleInfo.registration}`),
    headers,
    rows,
    cellStyler: (row, col) => {
      if (col === 12) return healthColours[String(row[11]).toLowerCase()];
      return undefined;
    },
  });

  const exportFilename = filename || `Tyres_${vehicleInfo.fleetNumber}_${vehicleInfo.registration}_${new Date().toISOString().split("T")[0]}.xlsx`;
  await saveWorkbook(wb, exportFilename);
}

/**
 * Export vehicle-specific tyres to PDF
 */
export function exportVehicleTyresToPDF(
  tyres: VehicleTyreExportData[],
  vehicleInfo: { fleetNumber: string; registration: string },
  filename?: string
): void {
  const doc = new jsPDF("portrait", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Vehicle Tyre Report", pageWidth / 2, 15, { align: "center" });

  // Vehicle info
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${vehicleInfo.fleetNumber} - ${vehicleInfo.registration}`, pageWidth / 2, 25, { align: "center" });

  // Subtitle with date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, pageWidth / 2, 32, { align: "center" });

  // Summary stats
  const totalPositions = tyres.length;
  const installedTyres = tyres.filter((t) => t.serial_number).length;
  const criticalTyres = tyres.filter((t) => t.tread_depth_health === "critical").length;
  const warningTyres = tyres.filter((t) => t.tread_depth_health === "warning").length;

  doc.setFontSize(9);
  const summaryText = `Positions: ${totalPositions} | Installed: ${installedTyres} | Warning: ${warningTyres} | Critical: ${criticalTyres}`;
  doc.text(summaryText, pageWidth / 2, 38, { align: "center" });

  // Table data
  const tableHeaders = [
    "Position",
    "Serial #",
    "Brand/Model",
    "Size",
    "Tread (mm)",
    "Health",
  ];

  const tableData = tyres.map((tyre) => [
    tyre.position || "-",
    tyre.serial_number?.substring(0, 15) || "Empty",
    tyre.serial_number ? `${tyre.brand || "-"} ${tyre.model || ""}` : "-",
    tyre.size || "-",
    tyre.current_tread_depth?.toString() || "-",
    tyre.tread_depth_health || "-",
  ]);

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 44,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 35 },
      2: { cellWidth: 45 },
      3: { cellWidth: 30 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
    },
    didParseCell: (data) => {
      // Color-code health column
      if (data.section === "body" && data.column.index === 5) {
        const health = data.cell.raw as string;
        if (health === "excellent") {
          data.cell.styles.textColor = [34, 197, 94];
        } else if (health === "good") {
          data.cell.styles.textColor = [59, 130, 246];
        } else if (health === "warning") {
          data.cell.styles.textColor = [234, 179, 8];
        } else if (health === "critical") {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Style empty positions
      if (data.section === "body" && data.column.index === 1) {
        const serial = data.cell.raw as string;
        if (serial === "Empty") {
          data.cell.styles.textColor = [156, 163, 175];
          data.cell.styles.fontStyle = "italic";
        }
      }
    },
  });

  // Add tyre diagram legend at the bottom
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150;

  if (finalY < 250) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Health Legend:", 14, finalY + 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    // Legend items
    doc.setTextColor(34, 197, 94);
    doc.text("Excellent: >8mm", 14, finalY + 22);

    doc.setTextColor(59, 130, 246);
    doc.text("Good: 5-8mm", 50, finalY + 22);

    doc.setTextColor(234, 179, 8);
    doc.text("Warning: 3-5mm", 80, finalY + 22);

    doc.setTextColor(239, 68, 68);
    doc.text("Critical: <3mm", 115, finalY + 22);

    doc.setTextColor(0, 0, 0);
  }

  const exportFilename = filename || `Tyres_${vehicleInfo.fleetNumber}_${vehicleInfo.registration}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(exportFilename);
}

/**
 * Export holding bay tyres to Excel
 */
export async function exportBayTyresToExcel(
  tyres: TyreExportData[],
  bayType: "holding-bay" | "retread-bay" | "scrap",
  filename?: string
): Promise<void> {
  const bayNames = {
    "holding-bay": "Holding Bay",
    "retread-bay": "Retread Bay",
    "scrap": "Scrap & Sold"
  };

  const headers = [
    "Serial Number", "Brand", "Model", "Size", "Type", "DOT Code",
    "Status", "Initial Tread (mm)", "Current Tread (mm)", "Tread Health",
    "Pressure Rating (PSI)", "Purchase Date", "Notes",
  ];

  const rows = tyres.map((t) => [
    t.serial_number || "-", t.brand || "-", t.model || "-", t.size || "-",
    t.type || "-", t.dot_code || "-", t.status || "-",
    t.initial_tread_depth ?? "", t.current_tread_depth ?? "",
    t.tread_depth_health || "-", t.pressure_rating ?? "",
    t.purchase_date || "-", t.notes || "-",
  ]);

  const wb = createWorkbook();

  addStyledSheet(wb, bayNames[bayType], {
    title: `${bayNames[bayType].toUpperCase()} TYRE REPORT`,
    subtitle: generatedSubtitle(`Total Tyres: ${tyres.length}`),
    headers,
    rows,
    cellStyler: (row, col) => {
      if (col === 10) return healthColours[String(row[9]).toLowerCase()];
      return undefined;
    },
  });

  const exportFilename = filename || `${bayNames[bayType].replace(" ", "_")}_Tyres_${new Date().toISOString().split("T")[0]}.xlsx`;
  await saveWorkbook(wb, exportFilename);
}

/**
 * Export holding bay tyres to PDF
 */
export function exportBayTyresToPDF(
  tyres: TyreExportData[],
  bayType: "holding-bay" | "retread-bay" | "scrap",
  filename?: string
): void {
  const bayNames = {
    "holding-bay": "Holding Bay",
    "retread-bay": "Retread Bay",
    "scrap": "Scrap & Sold"
  };

  const doc = new jsPDF("landscape", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${bayNames[bayType]} Tyre Report`, pageWidth / 2, 15, { align: "center" });

  // Subtitle with date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, pageWidth / 2, 22, { align: "center" });

  // Summary
  doc.setFontSize(9);
  doc.text(`Total Tyres: ${tyres.length}`, pageWidth / 2, 28, { align: "center" });

  // Table data
  const tableHeaders = [
    "Serial #",
    "Brand",
    "Model",
    "Size",
    "Type",
    "Status",
    "Tread (mm)",
    "Health",
  ];

  const tableData = tyres.map((tyre) => [
    tyre.serial_number?.substring(0, 18) || "-",
    tyre.brand || "-",
    tyre.model || "-",
    tyre.size || "-",
    tyre.type || "-",
    tyre.status || "-",
    tyre.current_tread_depth?.toString() || "-",
    tyre.tread_depth_health || "-",
  ]);

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 33,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 7) {
        const health = data.cell.raw as string;
        if (health === "excellent") {
          data.cell.styles.textColor = [34, 197, 94];
        } else if (health === "good") {
          data.cell.styles.textColor = [59, 130, 246];
        } else if (health === "warning") {
          data.cell.styles.textColor = [234, 179, 8];
        } else if (health === "critical") {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const exportFilename = filename || `${bayNames[bayType].replace(" ", "_")}_Tyres_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(exportFilename);
}

// Type definition for brand summary data
export interface BrandSummaryData {
  brand: string;
  bayCount: number;
  installedCount: number;
  totalQty: number;
  totalCost: number;
  avgCostPerTyre: number;
  avgCostPerKm: number | null;
  avgCostPerMm: number | null;
  totalKm: number;
  totalMmWorn: number;
}

/**
 * Export brand summary to Excel
 */
export async function exportBrandSummaryToExcel(
  brandData: BrandSummaryData[],
  grandTotals: {
    bayCount: number;
    installedCount: number;
    totalQty: number;
    totalCost: number;
    totalKm: number;
    totalMmWorn: number;
  },
  filename?: string
): Promise<void> {
  const headers = [
    "Brand", "In Stock", "Installed", "Total Qty", "Total Value (USD)",
    "Avg Cost/Tyre (USD)", "Avg Cost/KM (USD)", "Avg Cost/MM (USD)",
    "Total KM Travelled", "Total MM Worn",
  ];

  const dataRows: (string | number)[][] = brandData.map((d) => [
    d.brand, d.bayCount, d.installedCount, d.totalQty,
    d.totalCost.toFixed(2), d.avgCostPerTyre.toFixed(2),
    d.avgCostPerKm !== null ? d.avgCostPerKm.toFixed(4) : "N/A",
    d.avgCostPerMm !== null ? d.avgCostPerMm.toFixed(2) : "N/A",
    d.totalKm, Number(d.totalMmWorn.toFixed(1)),
  ]);

  // Grand total row
  dataRows.push([
    "GRAND TOTAL", grandTotals.bayCount, grandTotals.installedCount,
    grandTotals.totalQty, grandTotals.totalCost.toFixed(2),
    grandTotals.totalQty > 0 ? (grandTotals.totalCost / grandTotals.totalQty).toFixed(2) : "0.00",
    grandTotals.totalKm > 0 ? (grandTotals.totalCost / grandTotals.totalKm).toFixed(4) : "N/A",
    grandTotals.totalMmWorn > 0 ? (grandTotals.totalCost / grandTotals.totalMmWorn).toFixed(2) : "N/A",
    grandTotals.totalKm, Number(grandTotals.totalMmWorn.toFixed(1)),
  ]);

  const wb = createWorkbook();

  const ws = addStyledSheet(wb, "Brand Summary", {
    title: "TYRE BRAND PERFORMANCE SUMMARY",
    subtitle: generatedSubtitle(`${brandData.length} Brands • $${grandTotals.totalCost.toLocaleString()} Total Investment`),
    headers,
    rows: dataRows,
  });

  // Bold the grand-total row
  const totalRowNum = 4 + dataRows.length; // header=4 + data count
  const totalRow = ws.getRow(totalRowNum);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
  });

  const exportFilename = filename || `Tyre_Brand_Summary_${new Date().toISOString().split("T")[0]}.xlsx`;
  await saveWorkbook(wb, exportFilename);
}

/**
 * Export brand summary to PDF
 */
export function exportBrandSummaryToPDF(
  brandData: BrandSummaryData[],
  grandTotals: {
    bayCount: number;
    installedCount: number;
    totalQty: number;
    totalCost: number;
    totalKm: number;
    totalMmWorn: number;
  },
  filename?: string
): void {
  const doc = new jsPDF("landscape", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Tyre Brand Performance Summary", pageWidth / 2, 15, { align: "center" });

  // Subtitle with date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    pageWidth / 2,
    22,
    { align: "center" }
  );

  // KPI Summary
  doc.setFontSize(9);
  const kpiText = `Total Investment: $${grandTotals.totalCost.toLocaleString()} | ${grandTotals.totalQty} Tyres | ${brandData.length} Brands | Avg/Tyre: $${grandTotals.totalQty > 0 ? (grandTotals.totalCost / grandTotals.totalQty).toFixed(0) : "0"}`;
  doc.text(kpiText, pageWidth / 2, 28, { align: "center" });

  // Cost efficiency metrics
  const costKm = grandTotals.totalKm > 0 ? `$${(grandTotals.totalCost / grandTotals.totalKm).toFixed(4)}/km` : "N/A";
  const costMm = grandTotals.totalMmWorn > 0 ? `$${(grandTotals.totalCost / grandTotals.totalMmWorn).toFixed(2)}/mm` : "N/A";
  doc.text(`Cost Efficiency: ${costKm} | ${costMm}`, pageWidth / 2, 34, { align: "center" });

  // Table data
  const tableHeaders = [
    "Brand",
    "In Stock",
    "Installed",
    "Total Qty",
    "Total Value",
    "Cost/Tyre",
    "Cost/KM",
    "Cost/MM",
  ];

  const tableData = brandData.map((data) => [
    data.brand,
    data.bayCount.toString(),
    data.installedCount.toString(),
    data.totalQty.toString(),
    `$${data.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    `$${data.avgCostPerTyre.toFixed(0)}`,
    data.avgCostPerKm !== null ? `$${data.avgCostPerKm.toFixed(4)}` : "—",
    data.avgCostPerMm !== null ? `$${data.avgCostPerMm.toFixed(2)}` : "—",
  ]);

  // Add grand total row
  tableData.push([
    "GRAND TOTAL",
    grandTotals.bayCount.toString(),
    grandTotals.installedCount.toString(),
    grandTotals.totalQty.toString(),
    `$${grandTotals.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    `$${grandTotals.totalQty > 0 ? (grandTotals.totalCost / grandTotals.totalQty).toFixed(0) : "0"}`,
    grandTotals.totalKm > 0 ? `$${(grandTotals.totalCost / grandTotals.totalKm).toFixed(4)}` : "—",
    grandTotals.totalMmWorn > 0 ? `$${(grandTotals.totalCost / grandTotals.totalMmWorn).toFixed(2)}` : "—",
  ]);

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [99, 102, 241], // Indigo
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: "bold" },
      1: { cellWidth: 22, halign: "center" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 35, halign: "right" },
      5: { cellWidth: 30, halign: "right" },
      6: { cellWidth: 30, halign: "right" },
      7: { cellWidth: 28, halign: "right" },
    },
    didParseCell: (data) => {
      // Style the grand total row
      if (data.section === "body" && data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [226, 232, 240];
        data.cell.styles.fontStyle = "bold";
      }
      // Color-code cost columns with values
      if (data.section === "body" && (data.column.index === 4 || data.column.index === 5)) {
        data.cell.styles.textColor = [16, 185, 129]; // Emerald
      }
      if (data.section === "body" && data.column.index === 6) {
        data.cell.styles.textColor = [139, 92, 246]; // Violet
      }
      if (data.section === "body" && data.column.index === 7) {
        data.cell.styles.textColor = [245, 158, 11]; // Amber
      }
    },
  });

  // Add legend
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150;

  if (finalY < 180) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Cost/KM = Total investment ÷ Total kilometers travelled", 14, finalY + 10);
    doc.text("Cost/MM = Total investment ÷ Total millimeters of tread worn", 14, finalY + 15);
    doc.setTextColor(0, 0, 0);
  }

  const exportFilename = filename || `Tyre_Brand_Summary_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(exportFilename);
}

// ==========================================
// Rubber Audit Report Export Types & Functions
// ==========================================

export interface RubberAuditData {
  reportTitle: string;
  reportMonth: string;
  reporterName: string;
  totalVehicles: number;
  totalTyres: number;
  inflationStatus: { status: string; count: number; percentage: number }[];
  wearAnalysis: { label: string; count: number; percentage: number }[];
  sizeAnalysis: { size: string; count: number; percentage: number }[];
  brandAnalysis: { brand: string; count: number; percentage: number }[];
  vehiclesChecked: string[];
  urgentAttention: {
    fleet_number: string;
    position: string;
    size: string;
    requirement: string;
    rtd: string;
    comment: string;
    total: number;
  }[];
  urgentTotal: number;
  fleetOnStands: { fleet_number: string; tyre_size: string; tyre_count: number }[];
  recommendations: { number: number; category: string; text: string }[];
}

/**
 * Export Rubber Audit Report to PDF
 */
export function exportRubberAuditPDF(data: RubberAuditData, filename?: string): void {
  const doc = new jsPDF("portrait", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  const addSectionHeader = (title: string, yPos: number): number => {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(title, margin, yPos);
    return yPos + 8;
  };

  const getLastY = (): number => {
    return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 50;
  };

  // ---- PAGE 1: Header + Inflation + Wear Analysis ----
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.reportTitle, pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(14);
  doc.text(`FOR ${data.reportMonth.toUpperCase()}`, pageWidth / 2, 26, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (data.reporterName && data.reporterName !== "N/A") {
    doc.text(`Report by: ${data.reporterName}`, margin, 35);
  }
  doc.text(`TOTAL # of Vehicles checked = ${data.totalVehicles}`, margin, 42);
  doc.text(`TOTAL # OF TYRES CHECKED = ${data.totalTyres}`, margin, 48);

  // Inflation Status
  let y = addSectionHeader("Inflation Status", 58);
  autoTable(doc, {
    head: [["Inflation Status", "Count", "Percentage"]],
    body: [
      ...data.inflationStatus.map((r) => [r.status, String(r.count), `${r.percentage}%`]),
      [{ content: "Total", styles: { fontStyle: "bold" } }, { content: String(data.totalTyres), styles: { fontStyle: "bold" } }, { content: "100%", styles: { fontStyle: "bold" } }],
    ],
    startY: y,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: margin, right: margin },
  });

  // Wear Analysis
  y = addSectionHeader("Wear Analysis", getLastY() + 12);
  autoTable(doc, {
    head: [["Tread Depth", "Count", "Percentage"]],
    body: [
      ...data.wearAnalysis.map((r) => [r.label, String(r.count), `${r.percentage}%`]),
      [{ content: "Total", styles: { fontStyle: "bold" } }, { content: String(data.totalTyres), styles: { fontStyle: "bold" } }, { content: "100%", styles: { fontStyle: "bold" } }],
    ],
    startY: y,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: margin, right: margin },
  });

  // ---- PAGE 2: Tyre Size + Brand Analysis ----
  doc.addPage();

  y = addSectionHeader("Tyre Size Analysis", 18);
  autoTable(doc, {
    head: [["Tyre Size", "Count", "Percentage"]],
    body: [
      ...data.sizeAnalysis.map((r) => [r.size, String(r.count), `${r.percentage}%`]),
      [{ content: "Total", styles: { fontStyle: "bold" } }, { content: String(data.totalTyres), styles: { fontStyle: "bold" } }, { content: "100%", styles: { fontStyle: "bold" } }],
    ],
    startY: y,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: margin, right: margin },
  });

  y = addSectionHeader("Brand Analysis", getLastY() + 12);
  autoTable(doc, {
    head: [["Brand", "Count", "Percentage"]],
    body: [
      ...data.brandAnalysis.map((r) => [r.brand, String(r.count), `${r.percentage}%`]),
      [{ content: "Total", styles: { fontStyle: "bold" } }, { content: String(data.totalTyres), styles: { fontStyle: "bold" } }, { content: "100%", styles: { fontStyle: "bold" } }],
    ],
    startY: y,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: margin, right: margin },
  });

  // ---- PAGE 3: Vehicles Checked + Urgent Attention ----
  doc.addPage();

  y = addSectionHeader("Vehicles Checked", 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const vehicleText = data.vehiclesChecked.join(", ");
  const splitText = doc.splitTextToSize(vehicleText, pageWidth - margin * 2);
  doc.text(splitText, margin, y);
  y += splitText.length * 5 + 10;

  if (data.urgentAttention.length > 0) {
    y = addSectionHeader("Urgent Attention – Replacement Required", y);
    autoTable(doc, {
      head: [["Fleet Number", "Position", "Tyre Size", "Requirement", "RTD", "Comment", "Total"]],
      body: [
        ...data.urgentAttention.map((r) => [
          r.fleet_number, r.position, r.size, r.requirement, r.rtd, r.comment, String(r.total),
        ]),
        [
          { content: "TOTAL", colSpan: 6, styles: { fontStyle: "bold" } },
          { content: String(data.urgentTotal), styles: { fontStyle: "bold" } },
        ],
      ],
      startY: y,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      margin: { left: margin, right: margin },
    });
  }

  // ---- PAGE 4: Fleet on Stands + Recommendations ----
  doc.addPage();

  if (data.fleetOnStands.length > 0) {
    y = addSectionHeader("Fleet on Stands", 18);
    autoTable(doc, {
      head: [["Fleet Number", "Tyre Size", "Number of Tyres"]],
      body: [
        ...data.fleetOnStands.map((r) => [r.fleet_number, r.tyre_size, String(r.tyre_count)]),
        [
          { content: "TOTAL", colSpan: 2, styles: { fontStyle: "bold" } },
          { content: String(data.fleetOnStands.reduce((s, r) => s + r.tyre_count, 0)), styles: { fontStyle: "bold" } },
        ],
      ],
      startY: y,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: margin, right: margin },
    });
    y = getLastY() + 12;
  } else {
    y = 18;
  }

  // Recommendations
  y = addSectionHeader("Recommendations", y);
  autoTable(doc, {
    head: [["#", "Category", "Recommendations"]],
    body: data.recommendations.map((r) => [String(r.number), r.category, r.text]),
    startY: y,
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 40, fontStyle: "bold" },
      2: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }
  doc.setTextColor(0, 0, 0);

  const exportFilename = filename || `Rubber_Audit_Report_${data.reportMonth.replace(/\s+/g, "_")}.pdf`;
  doc.save(exportFilename);
}

/**
 * Export Rubber Audit Report to Excel
 */
export async function exportRubberAuditExcel(data: RubberAuditData, filename?: string): Promise<void> {
  const wb = createWorkbook();
  const sub = generatedSubtitle(`Report Month: ${data.reportMonth}`);

  // Sheet 1: Summary (Inflation + Wear)
  const summaryWs = wb.addWorksheet("Summary");
  addTitle(summaryWs, data.reportTitle, "C");
  addSubtitle(summaryWs, sub, "C");

  // Metadata rows
  const meta: [string, string | number][] = [
    ["Report By", data.reporterName],
    ["Total Vehicles Checked", data.totalVehicles],
    ["Total Tyres Checked", data.totalTyres],
  ];
  meta.forEach(([label, value], i) => {
    const row = summaryWs.getRow(4 + i);
    row.values = [label, value];
    row.getCell(1).font = { bold: true, size: 10, name: "Calibri" };
    row.getCell(2).font = { size: 10, name: "Calibri" };
    row.eachCell((c) => { c.border = thinBorder; });
    if (i % 2 === 1) row.eachCell((c) => { c.fill = altRowFill; });
  });

  // Inflation status table
  let startRow = 4 + meta.length + 2;
  summaryWs.getRow(startRow).values = ["INFLATION STATUS"];
  summaryWs.getRow(startRow).getCell(1).font = { bold: true, size: 12, name: "Calibri", color: { argb: "1F3864" } };
  startRow++;
  summaryWs.getRow(startRow).values = ["Status", "Count", "Percentage"];
  styleHeaderRow(summaryWs, startRow);
  data.inflationStatus.forEach((r, i) => {
    const rn = startRow + 1 + i;
    summaryWs.getRow(rn).values = [r.status, r.count, `${r.percentage}%`];
    styleBodyRow(summaryWs, rn, i % 2 === 1);
  });
  const inflTotalRow = startRow + 1 + data.inflationStatus.length;
  summaryWs.getRow(inflTotalRow).values = ["Total", data.totalTyres, "100%"];
  summaryWs.getRow(inflTotalRow).eachCell((c) => {
    c.font = { bold: true, size: 10, name: "Calibri" };
    c.border = thinBorder;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
  });

  // Wear analysis table
  startRow = inflTotalRow + 3;
  summaryWs.getRow(startRow).values = ["WEAR ANALYSIS"];
  summaryWs.getRow(startRow).getCell(1).font = { bold: true, size: 12, name: "Calibri", color: { argb: "1F3864" } };
  startRow++;
  summaryWs.getRow(startRow).values = ["Tread Depth", "Count", "Percentage"];
  styleHeaderRow(summaryWs, startRow);
  data.wearAnalysis.forEach((r, i) => {
    const rn = startRow + 1 + i;
    summaryWs.getRow(rn).values = [r.label, r.count, `${r.percentage}%`];
    styleBodyRow(summaryWs, rn, i % 2 === 1);
  });
  const wearTotalRow = startRow + 1 + data.wearAnalysis.length;
  summaryWs.getRow(wearTotalRow).values = ["Total", data.totalTyres, "100%"];
  summaryWs.getRow(wearTotalRow).eachCell((c) => {
    c.font = { bold: true, size: 10, name: "Calibri" };
    c.border = thinBorder;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
  });

  autoFitColumns(summaryWs, 15, 30);

  // Sheet 2: Size & Brand
  const sizeBrandWs = wb.addWorksheet("Size & Brand");
  addTitle(sizeBrandWs, "TYRE SIZE & BRAND ANALYSIS", "C");
  addSubtitle(sizeBrandWs, sub, "C");

  startRow = 4;
  sizeBrandWs.getRow(startRow).values = ["TYRE SIZE ANALYSIS"];
  sizeBrandWs.getRow(startRow).getCell(1).font = { bold: true, size: 12, name: "Calibri", color: { argb: "1F3864" } };
  startRow++;
  sizeBrandWs.getRow(startRow).values = ["Tyre Size", "Count", "Percentage"];
  styleHeaderRow(sizeBrandWs, startRow);
  data.sizeAnalysis.forEach((r, i) => {
    const rn = startRow + 1 + i;
    sizeBrandWs.getRow(rn).values = [r.size, r.count, `${r.percentage}%`];
    styleBodyRow(sizeBrandWs, rn, i % 2 === 1);
  });
  const sizeTotalRow = startRow + 1 + data.sizeAnalysis.length;
  sizeBrandWs.getRow(sizeTotalRow).values = ["Total", data.totalTyres, "100%"];
  sizeBrandWs.getRow(sizeTotalRow).eachCell((c) => {
    c.font = { bold: true, size: 10, name: "Calibri" };
    c.border = thinBorder;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
  });

  startRow = sizeTotalRow + 3;
  sizeBrandWs.getRow(startRow).values = ["BRAND ANALYSIS"];
  sizeBrandWs.getRow(startRow).getCell(1).font = { bold: true, size: 12, name: "Calibri", color: { argb: "1F3864" } };
  startRow++;
  sizeBrandWs.getRow(startRow).values = ["Brand", "Count", "Percentage"];
  styleHeaderRow(sizeBrandWs, startRow);
  data.brandAnalysis.forEach((r, i) => {
    const rn = startRow + 1 + i;
    sizeBrandWs.getRow(rn).values = [r.brand, r.count, `${r.percentage}%`];
    styleBodyRow(sizeBrandWs, rn, i % 2 === 1);
  });
  const brandTotalRow = startRow + 1 + data.brandAnalysis.length;
  sizeBrandWs.getRow(brandTotalRow).values = ["Total", data.totalTyres, "100%"];
  sizeBrandWs.getRow(brandTotalRow).eachCell((c) => {
    c.font = { bold: true, size: 10, name: "Calibri" };
    c.border = thinBorder;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
  });

  autoFitColumns(sizeBrandWs, 15, 30);

  // Sheet 3: Urgent Attention
  if (data.urgentAttention.length > 0) {
    const urgWs = addStyledSheet(wb, "Urgent Attention", {
      title: "URGENT ATTENTION — REPLACEMENT REQUIRED",
      subtitle: sub,
      headers: ["Fleet Number", "Position", "Tyre Size", "Requirement", "RTD", "Comment", "Total"],
      rows: [
        ...data.urgentAttention.map((r) => [r.fleet_number, r.position, r.size, r.requirement, r.rtd, r.comment, r.total]),
        ["TOTAL", "", "", "", "", "", data.urgentTotal],
      ],
    });
    // Bold total row
    const tRow = urgWs.getRow(4 + data.urgentAttention.length + 1);
    tRow.eachCell((c) => {
      c.font = { bold: true, size: 10, name: "Calibri" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
    });
  }

  // Sheet 4: Fleet on Stands
  if (data.fleetOnStands.length > 0) {
    const standsWs = addStyledSheet(wb, "Fleet on Stands", {
      title: "FLEET ON STANDS",
      subtitle: sub,
      headers: ["Fleet Number", "Tyre Size", "Number of Tyres"],
      rows: [
        ...data.fleetOnStands.map((r) => [r.fleet_number, r.tyre_size, r.tyre_count]),
        ["TOTAL", "", data.fleetOnStands.reduce((s, r) => s + r.tyre_count, 0)],
      ],
    });
    const tRow = standsWs.getRow(4 + data.fleetOnStands.length + 1);
    tRow.eachCell((c) => {
      c.font = { bold: true, size: 10, name: "Calibri" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
    });
  }

  // Sheet 5: Vehicles Checked
  addStyledSheet(wb, "Vehicles Checked", {
    title: "VEHICLES CHECKED",
    subtitle: sub,
    headers: ["Fleet Number"],
    rows: data.vehiclesChecked.map((v) => [v]),
  });

  // Sheet 6: Recommendations
  addStyledSheet(wb, "Recommendations", {
    title: "RECOMMENDATIONS",
    subtitle: sub,
    headers: ["#", "Category", "Recommendations"],
    rows: data.recommendations.map((r) => [r.number, r.category, r.text]),
  });

  const exportFilename = filename || `Rubber_Audit_Report_${data.reportMonth.replace(/\s+/g, "_")}.xlsx`;
  await saveWorkbook(wb, exportFilename);
}