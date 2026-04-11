import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

/** jsPDF instance with autoTable plugin properties */
type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

import type { DailyDipRecord, DipRecordEditEntry, FuelBunker } from "@/hooks/useFuelBunkers";

export interface DipRecordExportData {
  records: DailyDipRecord[];
  bunkers: FuelBunker[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  includeEditHistory?: boolean;
}

/**
 * Format a field name for display
 */
function formatFieldName(field: string): string {
  const fieldLabels: Record<string, string> = {
    opening_dip_cm: "Opening Dip (cm)",
    opening_volume_liters: "Opening Volume (L)",
    opening_pump_reading: "Opening Pump",
    closing_dip_cm: "Closing Dip (cm)",
    closing_volume_liters: "Closing Volume (L)",
    closing_pump_reading: "Closing Pump",
    recorded_by: "Recorded By",
    notes: "Notes",
  };
  return fieldLabels[field] || field;
}

/**
 * Get bunker name from record
 */
function getBunkerName(record: DailyDipRecord): string {
  if (record.bunker && typeof record.bunker === "object" && "name" in record.bunker) {
    return record.bunker.name;
  }
  return "Unknown";
}

/**
 * Get variance status text
 */
function getVarianceStatus(variance: number | null): string {
  if (variance === null) return "Pending";
  const absVariance = Math.abs(variance);
  if (absVariance <= 10) return "OK";
  if (variance > 0) return "Loss";
  return "Gain";
}

/**
 * Generate PDF export of dip records
 */
export function generateDipRecordsPDF(data: DipRecordExportData): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("DAILY DIP RECORDS REPORT", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  // Subtitle with date range
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (data.dateRange) {
    doc.text(
      `Period: ${format(data.dateRange.from, "MMM dd, yyyy")} - ${format(data.dateRange.to, "MMM dd, yyyy")}`,
      pageWidth / 2,
      yPos,
      { align: "center" }
    );
  } else {
    doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, pageWidth / 2, yPos, {
      align: "center",
    });
  }
  yPos += 10;

  // Summary stats
  const totalRecords = data.records.length;
  const closedRecords = data.records.filter((r) => r.status === "closed" || r.status === "reconciled").length;
  const openRecords = data.records.filter((r) => r.status === "open").length;
  const totalVariance = data.records
    .filter((r) => r.variance_liters !== null)
    .reduce((sum, r) => sum + (r.variance_liters || 0), 0);
  const lossRecords = data.records.filter((r) => r.variance_liters !== null && r.variance_liters > 10).length;

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 18, 3, 3, "F");

  doc.setFontSize(9);
  const summaryY = yPos + 12;
  const colWidth = (pageWidth - 2 * margin) / 5;

  doc.setFont("helvetica", "bold");
  doc.text("Total Records:", margin + 5, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(String(totalRecords), margin + 35, summaryY);

  doc.setFont("helvetica", "bold");
  doc.text("Closed:", margin + colWidth + 5, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(String(closedRecords), margin + colWidth + 25, summaryY);

  doc.setFont("helvetica", "bold");
  doc.text("Open:", margin + 2 * colWidth + 5, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(String(openRecords), margin + 2 * colWidth + 22, summaryY);

  doc.setFont("helvetica", "bold");
  doc.text("Total Variance:", margin + 3 * colWidth + 5, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(`${totalVariance.toLocaleString()} L`, margin + 3 * colWidth + 42, summaryY);

  doc.setFont("helvetica", "bold");
  doc.text("Loss Events:", margin + 4 * colWidth + 5, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(String(lossRecords), margin + 4 * colWidth + 38, summaryY);

  yPos += 25;

  // Main table
  const tableData = data.records.map((record) => [
    format(new Date(record.record_date), "dd/MM/yyyy"),
    getBunkerName(record),
    record.opening_volume_liters.toLocaleString(),
    record.closing_volume_liters?.toLocaleString() || "—",
    (record.diesel_additions_liters || 0) > 0 ? `+${record.diesel_additions_liters.toLocaleString()}` : "—",
    record.tank_usage_liters !== null ? `${record.tank_usage_liters.toLocaleString()}` : "—",
    record.pump_issued_liters?.toLocaleString() || "—",
    record.variance_liters !== null ? `${record.variance_liters > 0 ? "+" : ""}${record.variance_liters.toLocaleString()}` : "—",
    getVarianceStatus(record.variance_liters),
    record.status.charAt(0).toUpperCase() + record.status.slice(1),
    record.recorded_by || "—",
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        "Date",
        "Bunker",
        "Opening (A)",
        "Closing (B)",
        "Additions",
        "Tank Usage (C)",
        "Pump Issued (F)",
        "Variance (G)",
        "Result",
        "Status",
        "Recorded By",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { halign: "right", cellWidth: 23 },
      3: { halign: "right", cellWidth: 23 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 25 },
      6: { halign: "right", cellWidth: 25 },
      7: { halign: "right", cellWidth: 23 },
      8: { halign: "center", cellWidth: 18 },
      9: { halign: "center", cellWidth: 18 },
      10: { cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      // Color additions cells (green)
      if (data.column.index === 4 && data.section === "body") {
        const cellText = data.cell.raw as string;
        if (cellText !== "—") {
          data.cell.styles.textColor = [40, 167, 69];
        }
      }
      // Color variance cells
      if (data.column.index === 7 && data.section === "body") {
        const cellText = data.cell.raw as string;
        if (cellText.startsWith("+")) {
          data.cell.styles.textColor = [220, 53, 69]; // Red for loss
        } else if (cellText !== "—" && !cellText.startsWith("+")) {
          const val = parseFloat(cellText.replace(/,/g, ""));
          if (Math.abs(val) <= 10) {
            data.cell.styles.textColor = [40, 167, 69]; // Green for OK
          } else {
            data.cell.styles.textColor = [255, 152, 0]; // Orange for gain
          }
        }
      }
      // Color result cells
      if (data.column.index === 8 && data.section === "body") {
        const result = data.cell.raw as string;
        if (result === "OK") {
          data.cell.styles.textColor = [40, 167, 69];
        } else if (result === "Loss") {
          data.cell.styles.textColor = [220, 53, 69];
        } else if (result === "Gain") {
          data.cell.styles.textColor = [255, 152, 0];
        }
      }
    },
  });

  // Add edit history if requested
  if (data.includeEditHistory) {
    const recordsWithHistory = data.records.filter(
      (r) => r.edit_history && (r.edit_history as DipRecordEditEntry[]).length > 0
    );

    if (recordsWithHistory.length > 0) {
      doc.addPage();
      yPos = 20;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("EDIT HISTORY / AUDIT TRAIL", pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      recordsWithHistory.forEach((record) => {
        const history = record.edit_history as DipRecordEditEntry[];

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(
          `${format(new Date(record.record_date), "dd/MM/yyyy")} - ${getBunkerName(record)}`,
          margin,
          yPos
        );
        yPos += 6;

        const historyData = history.map((entry) => [
          format(new Date(entry.timestamp), "dd/MM/yyyy HH:mm"),
          entry.edited_by,
          entry.changes.map((c) => formatFieldName(c.field)).join(", "),
          entry.changes.map((c) => `${c.old_value ?? "—"} → ${c.new_value ?? "—"}`).join("; "),
          entry.reason || "—",
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [["Date/Time", "Edited By", "Fields Changed", "Changes", "Reason"]],
          body: historyData,
          theme: "striped",
          headStyles: {
            fillColor: [100, 100, 100],
            fontSize: 8,
          },
          bodyStyles: {
            fontSize: 7,
          },
          margin: { left: margin, right: margin },
        });

        yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;

        if (yPos > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          yPos = 20;
        }
      });
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${pageCount} | Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save
  const filename = data.dateRange
    ? `dip_records_${format(data.dateRange.from, "yyyyMMdd")}_${format(data.dateRange.to, "yyyyMMdd")}.pdf`
    : `dip_records_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;

  doc.save(filename);
}

/**
 * Generate Excel export of dip records
 */
export function generateDipRecordsExcel(data: DipRecordExportData): void {
  const wb = XLSX.utils.book_new();

  // Main records sheet
  const recordsData = data.records.map((record) => ({
    Date: format(new Date(record.record_date), "yyyy-MM-dd"),
    Bunker: getBunkerName(record),
    "Opening Dip (cm)": record.opening_dip_cm ?? "",
    "Opening Volume (L)": record.opening_volume_liters,
    "Opening Pump": record.opening_pump_reading ?? "",
    "Closing Dip (cm)": record.closing_dip_cm ?? "",
    "Closing Volume (L)": record.closing_volume_liters ?? "",
    "Closing Pump": record.closing_pump_reading ?? "",
    "Diesel Additions (L)": record.diesel_additions_liters || 0,
    "Tank Usage (C)": record.tank_usage_liters ?? "",
    "Pump Issued (F)": record.pump_issued_liters ?? "",
    "Variance (G)": record.variance_liters ?? "",
    Result: getVarianceStatus(record.variance_liters),
    Status: record.status,
    "Recorded By": record.recorded_by ?? "",
    Notes: record.notes ?? "",
    "Created At": record.created_at ? format(new Date(record.created_at), "yyyy-MM-dd HH:mm:ss") : "",
    "Updated At": record.updated_at ? format(new Date(record.updated_at), "yyyy-MM-dd HH:mm:ss") : "",
    "Last Edited By": record.last_edited_by ?? "",
    "Last Edited At": record.last_edited_at ? format(new Date(record.last_edited_at), "yyyy-MM-dd HH:mm:ss") : "",
  }));

  const wsRecords = XLSX.utils.json_to_sheet(recordsData);

  // Set column widths
  wsRecords["!cols"] = [
    { wch: 12 }, // Date
    { wch: 20 }, // Bunker
    { wch: 15 }, // Opening Dip
    { wch: 18 }, // Opening Volume
    { wch: 15 }, // Opening Pump
    { wch: 15 }, // Closing Dip
    { wch: 18 }, // Closing Volume
    { wch: 15 }, // Closing Pump
    { wch: 18 }, // Diesel Additions
    { wch: 15 }, // Tank Usage
    { wch: 15 }, // Pump Issued
    { wch: 12 }, // Variance
    { wch: 10 }, // Result
    { wch: 12 }, // Status
    { wch: 15 }, // Recorded By
    { wch: 30 }, // Notes
    { wch: 20 }, // Created At
    { wch: 20 }, // Updated At
    { wch: 15 }, // Last Edited By
    { wch: 20 }, // Last Edited At
  ];

  XLSX.utils.book_append_sheet(wb, wsRecords, "Dip Records");

  // Edit history sheet (if requested)
  if (data.includeEditHistory) {
    const historyData: {
      "Record Date": string;
      Bunker: string;
      "Edit Date/Time": string;
      "Edited By": string;
      Field: string;
      "Old Value": string;
      "New Value": string;
      Reason: string;
    }[] = [];

    data.records.forEach((record) => {
      const history = (record.edit_history || []) as DipRecordEditEntry[];
      history.forEach((entry) => {
        entry.changes.forEach((change) => {
          historyData.push({
            "Record Date": format(new Date(record.record_date), "yyyy-MM-dd"),
            Bunker: getBunkerName(record),
            "Edit Date/Time": format(new Date(entry.timestamp), "yyyy-MM-dd HH:mm:ss"),
            "Edited By": entry.edited_by,
            Field: formatFieldName(change.field),
            "Old Value": String(change.old_value ?? ""),
            "New Value": String(change.new_value ?? ""),
            Reason: entry.reason || "",
          });
        });
      });
    });

    if (historyData.length > 0) {
      const wsHistory = XLSX.utils.json_to_sheet(historyData);
      wsHistory["!cols"] = [
        { wch: 12 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, wsHistory, "Edit History");
    }
  }

  // Summary sheet
  const summaryData = [
    { Metric: "Total Records", Value: data.records.length },
    { Metric: "Closed Records", Value: data.records.filter((r) => r.status === "closed" || r.status === "reconciled").length },
    { Metric: "Open Records", Value: data.records.filter((r) => r.status === "open").length },
    { Metric: "Records with OK Variance", Value: data.records.filter((r) => r.variance_liters !== null && Math.abs(r.variance_liters) <= 10).length },
    { Metric: "Records with Loss", Value: data.records.filter((r) => r.variance_liters !== null && r.variance_liters > 10).length },
    { Metric: "Records with Gain", Value: data.records.filter((r) => r.variance_liters !== null && r.variance_liters < -10).length },
    { Metric: "Total Variance (L)", Value: data.records.filter((r) => r.variance_liters !== null).reduce((sum, r) => sum + (r.variance_liters || 0), 0) },
    { Metric: "Total Tank Usage (L)", Value: data.records.filter((r) => r.tank_usage_liters !== null).reduce((sum, r) => sum + (r.tank_usage_liters || 0), 0) },
    { Metric: "Total Pump Issued (L)", Value: data.records.filter((r) => r.pump_issued_liters !== null).reduce((sum, r) => sum + (r.pump_issued_liters || 0), 0) },
    { Metric: "Records with Edits", Value: data.records.filter((r) => r.edit_history && (r.edit_history as DipRecordEditEntry[]).length > 0).length },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Save
  const filename = data.dateRange
    ? `dip_records_${format(data.dateRange.from, "yyyyMMdd")}_${format(data.dateRange.to, "yyyyMMdd")}.xlsx`
    : `dip_records_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;

  XLSX.writeFile(wb, filename);
}