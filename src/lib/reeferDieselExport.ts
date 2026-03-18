import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatNumber } from "./formatters";

export interface ReeferExportRecord {
  id: string;
  reefer_unit: string;
  date: string;
  fuel_station?: string;
  litres_filled?: number;
  cost_per_litre?: number;
  total_cost?: number;
  currency?: string;
  operating_hours?: number;
  previous_operating_hours?: number;
  hours_operated?: number;
  litres_per_hour?: number;
  linked_diesel_record_id?: string;
  driver_name?: string;
  notes?: string;
}

export interface ReeferSummary {
  reefer_unit: string;
  total_litres_filled: number;
  total_cost: number;
  total_hours_operated: number;
  avg_litres_per_hour: number;
  fill_count: number;
  first_fill_date: string;
  last_fill_date: string;
}

export interface ReeferByTruckSummary {
  fleet_number: string;
  driver_name?: string;
  reefer_units: string[];
  total_reefer_litres: number;
  total_reefer_cost: number;
  total_truck_cost: number;
  combined_cost: number;
  fill_count: number;
}

export interface ReeferExportOptions {
  records: ReeferExportRecord[];
  summaryData?: ReeferSummary[];
  byTruckData?: ReeferByTruckSummary[];
  dateRange?: { from: string; to: string };
}

// Helper to format currency in USD
const formatUSD = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Generate a PDF report for reefer diesel consumption
 */
export const generateReeferDieselPDF = (options: ReeferExportOptions) => {
  const { records, summaryData = [], byTruckData = [], dateRange } = options;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  if (records.length === 0 && summaryData.length === 0) {
    doc.setFontSize(14);
    doc.text("No reefer diesel records found", pageWidth / 2, 50, { align: "center" });
    doc.save(`reefer-diesel-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    return;
  }

  // Calculate summary statistics
  const totalLitres = records.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
  const totalCost = records.reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const totalHours = records.reduce((sum, r) => sum + (r.hours_operated || 0), 0);
  const avgLph = totalHours > 0 ? totalLitres / totalHours : 0;
  const uniqueReefers = [...new Set(records.map(r => r.reefer_unit))];

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("REEFER DIESEL CONSUMPTION REPORT", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  if (dateRange) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Period: ${format(new Date(dateRange.from), "MMM dd, yyyy")} - ${format(new Date(dateRange.to), "MMM dd, yyyy")}`,
      pageWidth / 2,
      yPos,
      { align: "center" }
    );
    yPos += 6;
  }

  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, pageWidth / 2, yPos, { align: "center" });
  doc.setTextColor(0, 0, 0);
  yPos += 15;

  // Summary Box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 40, 3, 3, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Summary Statistics", margin + 5, yPos + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Total Litres: ${formatNumber(totalLitres)} L`, margin + 5, yPos + 20);
  doc.text(`Total Cost: ${formatUSD(totalCost)}`, margin + 5, yPos + 28);
  doc.text(`Total Hours: ${formatNumber(totalHours)} hrs`, margin + 80, yPos + 20);
  doc.text(`Avg L/hr: ${avgLph.toFixed(2)}`, margin + 80, yPos + 28);
  doc.text(`Records: ${records.length}`, margin + 140, yPos + 20);
  doc.text(`Reefers: ${uniqueReefers.length}`, margin + 140, yPos + 28);

  yPos += 50;

  // Records Table
  if (records.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Individual Fill-ups", margin, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [["Date", "Reefer", "Driver", "Litres", "Cost (USD)", "Hours Op.", "L/hr"]],
      body: records.map(r => [
        format(new Date(r.date), "MMM dd, yyyy"),
        r.reefer_unit,
        r.driver_name || "-",
        formatNumber(r.litres_filled || 0),
        formatUSD(r.total_cost || 0),
        r.hours_operated ? formatNumber(r.hours_operated) : "-",
        r.litres_per_hour ? r.litres_per_hour.toFixed(2) : "-",
      ]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }

  // Summary by Reefer Table
  if (summaryData.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Consumption by Reefer Unit", margin, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [["Reefer", "Fills", "Total Litres", "Total Cost", "Hours Op.", "Avg L/hr", "First Fill", "Last Fill"]],
      body: summaryData.map(s => [
        s.reefer_unit,
        s.fill_count,
        formatNumber(s.total_litres_filled),
        formatUSD(s.total_cost),
        formatNumber(s.total_hours_operated),
        s.avg_litres_per_hour.toFixed(2),
        format(new Date(s.first_fill_date), "MMM dd"),
        format(new Date(s.last_fill_date), "MMM dd"),
      ]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }

  // By Truck Summary Table
  if (byTruckData.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Consumption by Truck", margin, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [["Fleet", "Driver", "Reefers", "Fills", "Reefer Litres", "Reefer Cost", "Truck Cost", "Combined"]],
      body: byTruckData.map(s => [
        s.fleet_number,
        s.driver_name || "-",
        s.reefer_units.join(", "),
        s.fill_count,
        formatNumber(s.total_reefer_litres),
        formatUSD(s.total_reefer_cost),
        formatUSD(s.total_truck_cost),
        formatUSD(s.combined_cost),
      ]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });
  }

  // Save the PDF
  const filename = dateRange
    ? `reefer-diesel-${format(new Date(dateRange.from), "yyyy-MM-dd")}-to-${format(new Date(dateRange.to), "yyyy-MM-dd")}.pdf`
    : `reefer-diesel-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;

  doc.save(filename);
};

/**
 * Generate Excel export for reefer diesel records
 */
export const generateReeferDieselExcel = (options: ReeferExportOptions) => {
  const { records, summaryData = [], byTruckData = [], dateRange } = options;
  const workbook = XLSX.utils.book_new();

  // Summary Statistics Sheet
  const totalLitres = records.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
  const totalCost = records.reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const totalHours = records.reduce((sum, r) => sum + (r.hours_operated || 0), 0);
  const avgLph = totalHours > 0 ? totalLitres / totalHours : 0;
  const uniqueReefers = [...new Set(records.map(r => r.reefer_unit))];

  const summarySheet = [
    ["Reefer Diesel Consumption Report"],
    ["Generated", format(new Date(), "yyyy-MM-dd HH:mm")],
    dateRange ? ["Period", `${dateRange.from} to ${dateRange.to}`] : [],
    [],
    ["Summary Statistics"],
    ["Total Records", records.length],
    ["Total Litres", totalLitres.toFixed(2)],
    ["Total Cost (USD)", totalCost.toFixed(2)],
    ["Total Hours Operated", totalHours.toFixed(1)],
    ["Average L/hr", avgLph.toFixed(2)],
    ["Unique Reefer Units", uniqueReefers.length],
  ].filter(row => row.length > 0);

  const summaryWs = XLSX.utils.aoa_to_sheet(summarySheet);
  XLSX.utils.book_append_sheet(workbook, summaryWs, "Summary");

  // Individual Records Sheet
  if (records.length > 0) {
    const recordsData = records.map(r => ({
      "Date": r.date,
      "Reefer Unit": r.reefer_unit,
      "Driver": r.driver_name || "",
      "Fuel Station": r.fuel_station || "",
      "Litres Filled": r.litres_filled || 0,
      "Cost per Litre (USD)": r.cost_per_litre || 0,
      "Total Cost (USD)": r.total_cost || 0,
      "Operating Hours": r.operating_hours || "",
      "Previous Hours": r.previous_operating_hours || "",
      "Hours Operated": r.hours_operated || "",
      "L/hr": r.litres_per_hour ? r.litres_per_hour.toFixed(2) : "",
      "Linked to Truck": r.linked_diesel_record_id ? "Yes" : "No",
      "Notes": r.notes || "",
    }));

    const recordsWs = XLSX.utils.json_to_sheet(recordsData);
    XLSX.utils.book_append_sheet(workbook, recordsWs, "Records");
  }

  // By Reefer Summary Sheet
  if (summaryData.length > 0) {
    const reeferSummaryData = summaryData.map(s => ({
      "Reefer Unit": s.reefer_unit,
      "Fill Count": s.fill_count,
      "Total Litres": s.total_litres_filled.toFixed(2),
      "Total Cost (USD)": s.total_cost.toFixed(2),
      "Total Hours Operated": s.total_hours_operated.toFixed(1),
      "Avg L/hr": s.avg_litres_per_hour.toFixed(2),
      "First Fill Date": s.first_fill_date,
      "Last Fill Date": s.last_fill_date,
    }));

    const reeferWs = XLSX.utils.json_to_sheet(reeferSummaryData);
    XLSX.utils.book_append_sheet(workbook, reeferWs, "By Reefer");
  }

  // By Truck Summary Sheet
  if (byTruckData.length > 0) {
    const truckSummaryData = byTruckData.map(s => ({
      "Fleet Number": s.fleet_number,
      "Driver": s.driver_name || "",
      "Reefer Units": s.reefer_units.join(", "),
      "Fill Count": s.fill_count,
      "Reefer Litres": s.total_reefer_litres.toFixed(2),
      "Reefer Cost (USD)": s.total_reefer_cost.toFixed(2),
      "Truck Cost (USD)": s.total_truck_cost.toFixed(2),
      "Combined Cost (USD)": s.combined_cost.toFixed(2),
    }));

    const truckWs = XLSX.utils.json_to_sheet(truckSummaryData);
    XLSX.utils.book_append_sheet(workbook, truckWs, "By Truck");
  }

  // Save the file
  const filename = dateRange
    ? `reefer-diesel-${format(new Date(dateRange.from), "yyyy-MM-dd")}-to-${format(new Date(dateRange.to), "yyyy-MM-dd")}.xlsx`
    : `reefer-diesel-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;

  XLSX.writeFile(workbook, filename);
};

/**
 * Sync reefer diesel data to Google Sheets via Supabase edge function
 */
export const syncReeferToGoogleSheets = async (supabaseUrl: string, apiKey: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Use query params as the Edge Function reads from URL, not body
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-google-sheets?type=reefer&period=all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "apikey": apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to sync to Google Sheets");
    }

    const result = await response.json();
    return { success: true, message: result.message || "Reefer data synced to Google Sheets" };
  } catch (error) {
    console.error("Error syncing to Google Sheets:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
};