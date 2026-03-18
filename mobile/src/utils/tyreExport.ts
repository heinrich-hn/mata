import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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
export function exportAllTyresToExcel(tyres: TyreExportData[], filename?: string): void {
  const worksheetData = tyres.map((tyre) => ({
    "Serial Number": tyre.serial_number || "-",
    "Brand": tyre.brand || "-",
    "Model": tyre.model || "-",
    "Size": tyre.size || "-",
    "Type": tyre.type || "-",
    "DOT Code": tyre.dot_code || "-",
    "Fleet Position": tyre.current_fleet_position || "-",
    "Vehicle Fleet #": tyre.vehicles?.fleet_number || "-",
    "Vehicle Reg": tyre.vehicles?.registration_number || "-",
    "Status": tyre.status || "-",
    "Initial Tread (mm)": tyre.initial_tread_depth ?? "-",
    "Current Tread (mm)": tyre.current_tread_depth ?? "-",
    "Tread Health": tyre.tread_depth_health || "-",
    "Pressure Rating (PSI)": tyre.pressure_rating ?? "-",
    "Installation Date": tyre.installation_date || "-",
    "Purchase Date": tyre.purchase_date || "-",
    "Notes": tyre.notes || "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 18 }, // Serial Number
    { wch: 12 }, // Brand
    { wch: 15 }, // Model
    { wch: 15 }, // Size
    { wch: 12 }, // Type
    { wch: 12 }, // DOT Code
    { wch: 25 }, // Fleet Position
    { wch: 12 }, // Vehicle Fleet #
    { wch: 15 }, // Vehicle Reg
    { wch: 12 }, // Status
    { wch: 15 }, // Initial Tread
    { wch: 15 }, // Current Tread
    { wch: 12 }, // Tread Health
    { wch: 15 }, // Pressure Rating
    { wch: 15 }, // Installation Date
    { wch: 15 }, // Purchase Date
    { wch: 30 }, // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "All Tyres");

  const exportFilename = filename || `Fleet_Tyres_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, exportFilename);
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
export function exportVehicleTyresToExcel(
  tyres: VehicleTyreExportData[],
  vehicleInfo: { fleetNumber: string; registration: string },
  filename?: string
): void {
  const worksheetData = tyres.map((tyre, index) => ({
    "Position": tyre.position || `P${index + 1}`,
    "Position Label": tyre.positionLabel || "-",
    "Serial Number": tyre.serial_number || "-",
    "Brand": tyre.brand || "-",
    "Model": tyre.model || "-",
    "Size": tyre.size || "-",
    "Type": tyre.type || "-",
    "DOT Code": tyre.dot_code || "-",
    "Status": tyre.status || "-",
    "Initial Tread (mm)": tyre.initial_tread_depth ?? "-",
    "Current Tread (mm)": tyre.current_tread_depth ?? "-",
    "Tread Health": tyre.tread_depth_health || "-",
    "Pressure Rating (PSI)": tyre.pressure_rating ?? "-",
    "Installation Date": tyre.installation_date || "-",
    "Notes": tyre.notes || "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 10 }, // Position
    { wch: 25 }, // Position Label
    { wch: 18 }, // Serial Number
    { wch: 12 }, // Brand
    { wch: 15 }, // Model
    { wch: 15 }, // Size
    { wch: 12 }, // Type
    { wch: 12 }, // DOT Code
    { wch: 12 }, // Status
    { wch: 15 }, // Initial Tread
    { wch: 15 }, // Current Tread
    { wch: 12 }, // Tread Health
    { wch: 15 }, // Pressure Rating
    { wch: 15 }, // Installation Date
    { wch: 30 }, // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${vehicleInfo.fleetNumber} Tyres`);

  const exportFilename = filename || `Tyres_${vehicleInfo.fleetNumber}_${vehicleInfo.registration}_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, exportFilename);
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
export function exportBayTyresToExcel(
  tyres: TyreExportData[],
  bayType: "holding-bay" | "retread-bay" | "scrap",
  filename?: string
): void {
  const bayNames = {
    "holding-bay": "Holding Bay",
    "retread-bay": "Retread Bay",
    "scrap": "Scrap & Sold"
  };

  const worksheetData = tyres.map((tyre) => ({
    "Serial Number": tyre.serial_number || "-",
    "Brand": tyre.brand || "-",
    "Model": tyre.model || "-",
    "Size": tyre.size || "-",
    "Type": tyre.type || "-",
    "DOT Code": tyre.dot_code || "-",
    "Status": tyre.status || "-",
    "Initial Tread (mm)": tyre.initial_tread_depth ?? "-",
    "Current Tread (mm)": tyre.current_tread_depth ?? "-",
    "Tread Health": tyre.tread_depth_health || "-",
    "Pressure Rating (PSI)": tyre.pressure_rating ?? "-",
    "Purchase Date": tyre.purchase_date || "-",
    "Notes": tyre.notes || "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 30 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, bayNames[bayType]);

  const exportFilename = filename || `${bayNames[bayType].replace(" ", "_")}_Tyres_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, exportFilename);
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
export function exportBrandSummaryToExcel(
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
  const worksheetData = brandData.map((data) => ({
    "Brand": data.brand,
    "In Stock": data.bayCount,
    "Installed": data.installedCount,
    "Total Qty": data.totalQty,
    "Total Value (USD)": data.totalCost.toFixed(2),
    "Avg Cost/Tyre (USD)": data.avgCostPerTyre.toFixed(2),
    "Avg Cost/KM (USD)": data.avgCostPerKm !== null ? data.avgCostPerKm.toFixed(4) : "N/A",
    "Avg Cost/MM (USD)": data.avgCostPerMm !== null ? data.avgCostPerMm.toFixed(2) : "N/A",
    "Total KM Travelled": data.totalKm,
    "Total MM Worn": data.totalMmWorn.toFixed(1),
  }));

  // Add grand totals row
  worksheetData.push({
    "Brand": "GRAND TOTAL",
    "In Stock": grandTotals.bayCount,
    "Installed": grandTotals.installedCount,
    "Total Qty": grandTotals.totalQty,
    "Total Value (USD)": grandTotals.totalCost.toFixed(2),
    "Avg Cost/Tyre (USD)": grandTotals.totalQty > 0 ? (grandTotals.totalCost / grandTotals.totalQty).toFixed(2) : "0.00",
    "Avg Cost/KM (USD)": grandTotals.totalKm > 0 ? (grandTotals.totalCost / grandTotals.totalKm).toFixed(4) : "N/A",
    "Avg Cost/MM (USD)": grandTotals.totalMmWorn > 0 ? (grandTotals.totalCost / grandTotals.totalMmWorn).toFixed(2) : "N/A",
    "Total KM Travelled": grandTotals.totalKm,
    "Total MM Worn": grandTotals.totalMmWorn.toFixed(1),
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 18 }, // Brand
    { wch: 10 }, // In Stock
    { wch: 10 }, // Installed
    { wch: 10 }, // Total Qty
    { wch: 16 }, // Total Value
    { wch: 18 }, // Avg Cost/Tyre
    { wch: 18 }, // Avg Cost/KM
    { wch: 18 }, // Avg Cost/MM
    { wch: 16 }, // Total KM
    { wch: 14 }, // Total MM Worn
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Brand Summary");

  const exportFilename = filename || `Tyre_Brand_Summary_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, exportFilename);
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