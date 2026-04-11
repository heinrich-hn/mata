import { format } from "date-fns";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import { formatCurrency, formatNumber } from "./formatters";

export interface DieselDebriefRecord {
  id: string;
  fleet_number?: string;
  date?: string;
  driver_name?: string | null;
  fuel_station?: string;
  litres_filled?: number | null;
  cost_per_litre?: number | null;
  total_cost?: number | null;
  currency?: string;
  km_per_litre?: number | null;
  distance_travelled?: number | null;
  trip_id?: string | null;
  trip_number?: string | null;
  linked_trailers?: string[] | null;
  requires_debrief?: boolean;
  debrief_trigger_reason?: string | null;
  debrief_notes?: string | null;
  debrief_signed?: boolean;
  debrief_signed_at?: string | null;
  debrief_signed_by?: string | null;
  probe_reading?: number | null;
  probe_discrepancy?: number | null;
  probe_verified?: boolean;
  probe_action_taken?: string | null;
}

export interface DieselNorm {
  expected_km_per_litre?: number | null;
  min_acceptable?: number | null;
  max_acceptable?: number | null;
}

export const generateDieselDebriefPDF = (record: DieselDebriefRecord, norm?: DieselNorm) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 20;

  // Helper function for wrapped text
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 7) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("DIESEL CONSUMPTION DEBRIEF FORM", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Form #: DSL-${record.id.split("-")[0].toUpperCase()}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Diesel Record Details Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DIESEL RECORD DETAILS", margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos - 2, contentWidth, 50);

  const detailsY = yPos + 3;
  doc.text(`Fleet Number: ${record.fleet_number}`, margin + 5, detailsY);
  doc.text(`Date: ${format(new Date(record.date), "MMM dd, yyyy")}`, pageWidth / 2 + 10, detailsY);

  doc.text(`Driver: ${record.driver_name || "N/A"}`, margin + 5, detailsY + 7);
  doc.text(`Station: ${record.fuel_station}`, pageWidth / 2 + 10, detailsY + 7);

  doc.text(`Litres Filled: ${formatNumber(record.litres_filled)} L`, margin + 5, detailsY + 14);
  doc.text(`Total Cost: ${formatCurrency(record.total_cost, record.currency || "USD")}`, pageWidth / 2 + 10, detailsY + 14);

  if (record.distance_travelled) {
    doc.text(`Distance: ${formatNumber(record.distance_travelled)} km`, margin + 5, detailsY + 21);
  }

  if (record.km_per_litre) {
    doc.text(`Efficiency: ${formatNumber(record.km_per_litre, 2)} km/L`, pageWidth / 2 + 10, detailsY + 21);
  }

  if (record.trip_id) {
    doc.text(`Linked Trip: ${record.trip_number || record.trip_id.split("-")[0]}`, margin + 5, detailsY + 28);
  }

  if (record.linked_trailers && record.linked_trailers.length > 0) {
    doc.text(`Trailers: ${record.linked_trailers.join(", ")}`, pageWidth / 2 + 10, detailsY + 28);
  }

  if (record.probe_reading) {
    doc.text(`Probe Reading: ${formatNumber(record.probe_reading)} L`, margin + 5, detailsY + 35);
    if (record.probe_discrepancy) {
      doc.text(`Probe Discrepancy: ${formatNumber(record.probe_discrepancy)} L`, pageWidth / 2 + 10, detailsY + 35);
    }
  }

  yPos += 55;

  // Performance Analysis Section
  if (norm || record.requires_debrief) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("PERFORMANCE ANALYSIS", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    if (norm) {
      doc.text(`Fleet Norm: ${formatNumber(norm.expected_km_per_litre, 2)} km/L`, margin, yPos);
      yPos += 7;
      doc.text(`Acceptable Range: ${formatNumber(norm.min_acceptable, 2)} - ${formatNumber(norm.max_acceptable, 2)} km/L`, margin, yPos);
      yPos += 7;
    }

    if (record.km_per_litre) {
      doc.text(`Actual Performance: ${formatNumber(record.km_per_litre, 2)} km/L`, margin, yPos);
      yPos += 7;

      if (norm) {
        let status = "WITHIN";
        let statusColor: [number, number, number] = [0, 128, 0];
        if (record.km_per_litre < norm.min_acceptable) {
          status = "BELOW";
          statusColor = [220, 38, 38];
        }

        doc.setFont("helvetica", "bold");
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.text(`Status: ${status} norm`, margin, yPos);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        yPos += 10;
      }
    }

    if (record.debrief_trigger_reason) {
      doc.setFont("helvetica", "bold");
      doc.text("Issues Identified:", margin, yPos);
      yPos += 7;
      doc.setFont("helvetica", "normal");
      yPos = addWrappedText(`• ${record.debrief_trigger_reason}`, margin + 5, yPos, contentWidth - 5);
      yPos += 5;
    }

    if (record.probe_discrepancy && record.probe_discrepancy > 5) {
      doc.setFont("helvetica", "normal");
      yPos = addWrappedText(`• Significant probe discrepancy detected (${formatNumber(record.probe_discrepancy)} L)`, margin + 5, yPos, contentWidth - 5);
      yPos += 5;
    }

    yPos += 10;
  }

  // Debrief Discussion
  if (record.debrief_signed) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DEBRIEF DISCUSSION", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Conducted By: ${record.debrief_signed_by}`, margin, yPos);
    yPos += 7;
    doc.text(`Date: ${format(new Date(record.debrief_signed_at), "MMM dd, yyyy")}`, margin, yPos);
    yPos += 10;

    if (record.debrief_notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", margin, yPos);
      yPos += 7;
      doc.setFont("helvetica", "normal");
      yPos = addWrappedText(record.debrief_notes, margin, yPos, contentWidth);
      yPos += 10;
    }

    if (record.probe_verified && record.probe_action_taken) {
      doc.setFont("helvetica", "bold");
      doc.text("Probe Verification Action:", margin, yPos);
      yPos += 7;
      doc.setFont("helvetica", "normal");
      yPos = addWrappedText(record.probe_action_taken, margin, yPos, contentWidth);
      yPos += 10;
    }
  }

  // Check if we need a new page for signatures
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  // Signatures Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("ACKNOWLEDGMENT & SIGNATURES", margin, yPos);
  yPos += 10;

  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos, contentWidth, 50);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Debriefer Signature
  doc.text("Debriefer Signature:", margin + 5, yPos + 8);
  doc.line(margin + 35, yPos + 10, pageWidth - margin - 40, yPos + 10);
  if (record.debrief_signed_by) {
    doc.setFont("helvetica", "italic");
    doc.text(record.debrief_signed_by, margin + 35, yPos + 9);
    doc.setFont("helvetica", "normal");
  }
  doc.text(`Date: ${format(new Date(record.debrief_signed_at || new Date()), "MMM dd, yyyy")}`, pageWidth - margin - 35, yPos + 8);

  doc.setFontSize(8);
  doc.text(
    "I confirm the debrief was conducted and documented accurately.",
    margin + 5,
    yPos + 16,
    { maxWidth: contentWidth - 10 }
  );

  // Driver Signature (optional)
  doc.setFontSize(9);
  doc.text("Driver Signature (optional):", margin + 5, yPos + 28);
  doc.line(margin + 45, yPos + 30, pageWidth - margin - 40, yPos + 30);
  doc.text(`Date: _____________`, pageWidth - margin - 35, yPos + 28);

  doc.setFontSize(8);
  doc.text(
    "I acknowledge the discussion and understand the corrective actions required.",
    margin + 5,
    yPos + 36,
    { maxWidth: contentWidth - 10 }
  );

  // Footer
  yPos = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")} | Form Reference: DSL-${record.id.split("-")[0]}`,
    pageWidth / 2,
    yPos,
    { align: "center" }
  );

  // Save the PDF
  const fileName = `diesel-debrief-${record.fleet_number}-${format(new Date(record.date), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
};

/**
 * Same as generateDieselDebriefPDF but returns the PDF as a Uint8Array instead of
 * triggering a browser download. Used for programmatic sharing (e.g. WhatsApp).
 */
export const generateDieselDebriefPDFBlob = (record: DieselDebriefRecord, norm?: DieselNorm): { blob: Blob; fileName: string } => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 20;

  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight = 7) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
  };

  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("DIESEL CONSUMPTION DEBRIEF FORM", pageWidth / 2, yPos, { align: "center" }); yPos += 10;
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Form #: DSL-${record.id.split("-")[0].toUpperCase()}`, pageWidth / 2, yPos, { align: "center" }); yPos += 15;

  doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text("DIESEL RECORD DETAILS", margin, yPos); yPos += 8;
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos - 2, contentWidth, 50);
  const dy = yPos + 3;
  doc.text(`Fleet Number: ${record.fleet_number}`, margin + 5, dy);
  doc.text(`Date: ${format(new Date(record.date), "MMM dd, yyyy")}`, pageWidth / 2 + 10, dy);
  doc.text(`Driver: ${record.driver_name || "N/A"}`, margin + 5, dy + 7);
  doc.text(`Station: ${record.fuel_station}`, pageWidth / 2 + 10, dy + 7);
  doc.text(`Litres Filled: ${formatNumber(record.litres_filled)} L`, margin + 5, dy + 14);
  doc.text(`Total Cost: ${formatCurrency(record.total_cost, record.currency || "USD")}`, pageWidth / 2 + 10, dy + 14);
  if (record.distance_travelled) doc.text(`Distance: ${formatNumber(record.distance_travelled)} km`, margin + 5, dy + 21);
  if (record.km_per_litre) doc.text(`Efficiency: ${formatNumber(record.km_per_litre, 2)} km/L`, pageWidth / 2 + 10, dy + 21);
  yPos += 55;

  if (norm || record.requires_debrief) {
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("PERFORMANCE ANALYSIS", margin, yPos); yPos += 8;
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    if (norm) { doc.text(`Fleet Norm: ${formatNumber(norm.expected_km_per_litre, 2)} km/L`, margin, yPos); yPos += 7; }
    if (record.km_per_litre) { doc.text(`Actual: ${formatNumber(record.km_per_litre, 2)} km/L`, margin, yPos); yPos += 10; }
    if (record.debrief_trigger_reason) {
      doc.setFont("helvetica", "bold"); doc.text("Issues:", margin, yPos); yPos += 7;
      doc.setFont("helvetica", "normal");
      yPos = addWrappedText(`• ${record.debrief_trigger_reason}`, margin + 5, yPos, contentWidth - 5) + 5;
    }
    yPos += 5;
  }

  if (record.debrief_signed) {
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("DEBRIEF DISCUSSION", margin, yPos); yPos += 8;
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Conducted By: ${record.debrief_signed_by}`, margin, yPos); yPos += 7;
    doc.text(`Date: ${format(new Date(record.debrief_signed_at), "MMM dd, yyyy")}`, margin, yPos); yPos += 10;
    if (record.debrief_notes) {
      doc.setFont("helvetica", "bold"); doc.text("Notes:", margin, yPos); yPos += 7;
      doc.setFont("helvetica", "normal");
      yPos = addWrappedText(record.debrief_notes, margin, yPos, contentWidth) + 10;
    }
  }

  if (yPos > 200) { doc.addPage(); yPos = 20; }
  doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text("ACKNOWLEDGMENT & SIGNATURES", margin, yPos); yPos += 10;
  doc.setDrawColor(200, 200, 200); doc.rect(margin, yPos, contentWidth, 50);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Debriefer Signature:", margin + 5, yPos + 8);
  doc.line(margin + 35, yPos + 10, pageWidth - margin - 40, yPos + 10);
  if (record.debrief_signed_by) { doc.setFont("helvetica", "italic"); doc.text(record.debrief_signed_by, margin + 35, yPos + 9); doc.setFont("helvetica", "normal"); }
  doc.text(`Date: ${format(new Date(record.debrief_signed_at || new Date()), "MMM dd, yyyy")}`, pageWidth - margin - 35, yPos + 8);
  doc.setFontSize(8); doc.text("I confirm the debrief was conducted and documented accurately.", margin + 5, yPos + 16, { maxWidth: contentWidth - 10 });
  doc.setFontSize(9); doc.text("Driver Signature (optional):", margin + 5, yPos + 28);
  doc.line(margin + 45, yPos + 30, pageWidth - margin - 40, yPos + 30);
  doc.text("Date: _____________", pageWidth - margin - 35, yPos + 28);
  doc.setFontSize(8); doc.text("I acknowledge the discussion and understand the corrective actions required.", margin + 5, yPos + 36, { maxWidth: contentWidth - 10 });

  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8); doc.setTextColor(128, 128, 128);
  doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")} | Form Reference: DSL-${record.id.split("-")[0]}`, pageWidth / 2, footerY, { align: "center" });

  const fileName = `diesel-debrief-${record.fleet_number}-${format(new Date(record.date), "yyyy-MM-dd")}.pdf`;
  const pdfArrayBuffer = doc.output('arraybuffer') as ArrayBuffer;
  return { blob: new Blob([pdfArrayBuffer], { type: 'application/pdf' }), fileName };
};

export interface FleetDebriefSummaryRecord {
  id: string;
  fleet_number: string;
  date: string;
  driver_name?: string;
  fuel_station?: string;
  litres_filled?: number;
  total_cost?: number;
  currency?: string;
  km_per_litre?: number;
  debrief_signed?: boolean;
  debrief_signed_by?: string;
  debrief_signed_at?: string;
  debrief_notes?: string;
  requires_debrief?: boolean;
  debrief_trigger_reason?: string;
}

export interface FleetDebriefSummaryOptions {
  fleetNumber: string;
  records: FleetDebriefSummaryRecord[];
  showPendingOnly?: boolean;
  dateRange?: { from: string; to: string };
}

/**
 * Generate a PDF summary of debrief status for a specific fleet
 * Shows which transactions still need to be debriefed and which are completed
 */
export const generateFleetDebriefSummaryPDF = (options: FleetDebriefSummaryOptions) => {
  const { fleetNumber, records, showPendingOnly = false, dateRange } = options;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 20;

  // Filter records if showPendingOnly
  const filteredRecords = showPendingOnly
    ? records.filter(r => r.requires_debrief && !r.debrief_signed)
    : records;

  // Separate into pending and completed
  const pendingRecords = filteredRecords.filter(r => r.requires_debrief && !r.debrief_signed);
  const completedRecords = filteredRecords.filter(r => r.debrief_signed);
  const noDebriefNeeded = filteredRecords.filter(r => !r.requires_debrief && !r.debrief_signed);

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("DIESEL DEBRIEF STATUS SUMMARY", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Fleet: ${fleetNumber}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 6;

  if (dateRange) {
    doc.setFontSize(10);
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
  yPos += 12;

  // Summary Statistics Box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPos, contentWidth, 28, 3, 3, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const statsY = yPos + 8;

  // Column positions
  const col1 = margin + 10;
  const col2 = margin + contentWidth / 3;
  const col3 = margin + (2 * contentWidth) / 3;

  doc.text("Total Records", col1, statsY);
  doc.text("Pending Debrief", col2, statsY);
  doc.text("Completed", col3, statsY);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(String(filteredRecords.length), col1, statsY + 12);

  doc.setTextColor(220, 38, 38); // Red for pending
  doc.text(String(pendingRecords.length), col2, statsY + 12);

  doc.setTextColor(22, 163, 74); // Green for completed
  doc.text(String(completedRecords.length), col3, statsY + 12);

  doc.setTextColor(0, 0, 0);
  yPos += 35;

  // Table header helper
  const drawTableHeader = (title: string, bgColor: [number, number, number]) => {
    checkPageBreak(40);
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    doc.rect(margin, yPos, contentWidth, 8, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 5, yPos + 6);
    doc.setTextColor(0, 0, 0);
    yPos += 10;

    // Column headers
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 7, "F");

    const colWidths = [22, 35, 35, 25, 25, 38];
    let xPos = margin + 2;
    const headers = ["Date", "Driver", "Station", "Litres", "km/L", "Status/Notes"];

    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5);
      xPos += colWidths[i];
    });

    yPos += 9;
    doc.setFont("helvetica", "normal");
  };

  // Draw record row helper
  const drawRecordRow = (record: FleetDebriefSummaryRecord, showDebriefInfo: boolean) => {
    checkPageBreak(12);

    doc.setFontSize(7);
    const colWidths = [22, 35, 35, 25, 25, 38];
    let xPos = margin + 2;

    // Date
    doc.text(format(new Date(record.date), "MMM dd"), xPos, yPos);
    xPos += colWidths[0];

    // Driver (truncate if too long)
    const driver = (record.driver_name || "N/A").substring(0, 18);
    doc.text(driver, xPos, yPos);
    xPos += colWidths[1];

    // Station (truncate if too long)
    const station = (record.fuel_station || "N/A").substring(0, 18);
    doc.text(station, xPos, yPos);
    xPos += colWidths[2];

    // Litres
    doc.text(formatNumber(record.litres_filled || 0) + " L", xPos, yPos);
    xPos += colWidths[3];

    // km/L with color coding
    if (record.km_per_litre) {
      if (record.requires_debrief && !record.debrief_signed) {
        doc.setTextColor(220, 38, 38); // Red
      } else if (record.debrief_signed) {
        doc.setTextColor(22, 163, 74); // Green
      }
      doc.text(formatNumber(record.km_per_litre, 2), xPos, yPos);
      doc.setTextColor(0, 0, 0);
    } else {
      doc.text("N/A", xPos, yPos);
    }
    xPos += colWidths[4];

    // Status/Notes
    if (showDebriefInfo && record.debrief_signed) {
      const signedBy = `Signed: ${(record.debrief_signed_by || "").substring(0, 15)}`;
      doc.text(signedBy, xPos, yPos);
    } else if (record.requires_debrief && !record.debrief_signed) {
      doc.setTextColor(220, 38, 38);
      doc.text("PENDING DEBRIEF", xPos, yPos);
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(128, 128, 128);
      doc.text("Within norm", xPos, yPos);
      doc.setTextColor(0, 0, 0);
    }

    yPos += 6;

    // Add separator line
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, yPos - 2, margin + contentWidth, yPos - 2);
  };

  // PENDING DEBRIEFS SECTION
  if (pendingRecords.length > 0) {
    drawTableHeader(`PENDING DEBRIEFS (${pendingRecords.length})`, [220, 38, 38]);
    pendingRecords
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach(record => drawRecordRow(record, false));
    yPos += 8;
  }

  // COMPLETED DEBRIEFS SECTION
  if (completedRecords.length > 0 && !showPendingOnly) {
    drawTableHeader(`COMPLETED DEBRIEFS (${completedRecords.length})`, [22, 163, 74]);
    completedRecords
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach(record => drawRecordRow(record, true));
    yPos += 8;
  }

  // NO DEBRIEF NEEDED SECTION (optional, only if not showing pending only)
  if (noDebriefNeeded.length > 0 && !showPendingOnly) {
    drawTableHeader(`WITHIN NORM - NO DEBRIEF NEEDED (${noDebriefNeeded.length})`, [100, 100, 100]);
    noDebriefNeeded
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10) // Limit to last 10 to save space
      .forEach(record => drawRecordRow(record, false));

    if (noDebriefNeeded.length > 10) {
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`... and ${noDebriefNeeded.length - 10} more records within norm`, margin + 5, yPos + 4);
      doc.setTextColor(0, 0, 0);
      yPos += 10;
    }
  }

  // Footer on last page
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Fleet Debrief Summary - ${fleetNumber} | Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // Save the PDF
  const fileName = `fleet-debrief-summary-${fleetNumber}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
};

/**
 * Generate a PDF summary of multiple selected diesel transactions for debrief review
 */
export const generateSelectedTransactionsPDF = (
  records: FleetDebriefSummaryRecord[],
  title?: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 20;

  // Group by fleet
  const byFleet = records.reduce((acc, record) => {
    if (!acc[record.fleet_number]) acc[record.fleet_number] = [];
    acc[record.fleet_number].push(record);
    return acc;
  }, {} as Record<string, FleetDebriefSummaryRecord[]>);

  const fleetNumbers = Object.keys(byFleet).sort();

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title || "DIESEL TRANSACTIONS DEBRIEF REPORT", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${records.length} transactions across ${fleetNumbers.length} fleet(s)`, pageWidth / 2, yPos, { align: "center" });
  yPos += 6;

  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, pageWidth / 2, yPos, { align: "center" });
  doc.setTextColor(0, 0, 0);
  yPos += 12;

  // Summary box
  const pendingCount = records.filter(r => r.requires_debrief && !r.debrief_signed).length;
  const completedCount = records.filter(r => r.debrief_signed).length;
  const withinNormCount = records.filter(r => !r.requires_debrief && !r.debrief_signed).length;

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPos, contentWidth, 20, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const summaryY = yPos + 8;

  doc.text(`Pending: `, margin + 10, summaryY);
  doc.setTextColor(220, 38, 38);
  doc.text(String(pendingCount), margin + 35, summaryY);
  doc.setTextColor(0, 0, 0);

  doc.text(`Completed: `, margin + 60, summaryY);
  doc.setTextColor(22, 163, 74);
  doc.text(String(completedCount), margin + 95, summaryY);
  doc.setTextColor(0, 0, 0);

  doc.text(`Within Norm: `, margin + 120, summaryY);
  doc.text(String(withinNormCount), margin + 160, summaryY);

  yPos += 28;

  // Process each fleet
  fleetNumbers.forEach((fleetNumber, fleetIndex) => {
    const fleetRecords = byFleet[fleetNumber];
    const fleetPending = fleetRecords.filter(r => r.requires_debrief && !r.debrief_signed);
    const fleetCompleted = fleetRecords.filter(r => r.debrief_signed);

    checkPageBreak(30);

    // Fleet header
    doc.setFillColor(59, 130, 246); // Blue
    doc.rect(margin, yPos, contentWidth, 10, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`Fleet: ${fleetNumber}`, margin + 5, yPos + 7);
    doc.setFontSize(9);
    doc.text(
      `${fleetRecords.length} records | ${fleetPending.length} pending | ${fleetCompleted.length} completed`,
      pageWidth - margin - 5,
      yPos + 7,
      { align: "right" }
    );
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    // Table header
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 7, "F");

    const colWidths = [22, 32, 32, 22, 20, 22, 30];
    let xPos = margin + 2;
    const headers = ["Date", "Driver", "Station", "Litres", "km/L", "Cost", "Status"];

    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5);
      xPos += colWidths[i];
    });

    yPos += 9;
    doc.setFont("helvetica", "normal");

    // Records
    fleetRecords
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach(record => {
        checkPageBreak(8);

        doc.setFontSize(7);
        let xPos = margin + 2;

        // Date
        doc.text(format(new Date(record.date), "MMM dd"), xPos, yPos);
        xPos += colWidths[0];

        // Driver
        doc.text((record.driver_name || "N/A").substring(0, 16), xPos, yPos);
        xPos += colWidths[1];

        // Station
        doc.text((record.fuel_station || "N/A").substring(0, 16), xPos, yPos);
        xPos += colWidths[2];

        // Litres
        doc.text(formatNumber(record.litres_filled || 0) + " L", xPos, yPos);
        xPos += colWidths[3];

        // km/L
        if (record.km_per_litre) {
          if (record.requires_debrief && !record.debrief_signed) {
            doc.setTextColor(220, 38, 38);
          }
          doc.text(formatNumber(record.km_per_litre, 2), xPos, yPos);
          doc.setTextColor(0, 0, 0);
        } else {
          doc.text("N/A", xPos, yPos);
        }
        xPos += colWidths[4];

        // Cost
        doc.text(`$${formatNumber(record.total_cost || 0)}`, xPos, yPos);
        xPos += colWidths[5];

        // Status
        if (record.debrief_signed) {
          doc.setTextColor(22, 163, 74);
          doc.text("Debriefed", xPos, yPos);
        } else if (record.requires_debrief) {
          doc.setTextColor(220, 38, 38);
          doc.text("PENDING", xPos, yPos);
        } else {
          doc.setTextColor(128, 128, 128);
          doc.text("OK", xPos, yPos);
        }
        doc.setTextColor(0, 0, 0);

        yPos += 6;
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, yPos - 2, margin + contentWidth, yPos - 2);
      });

    yPos += 10;

    // Add page break between fleets if needed
    if (fleetIndex < fleetNumbers.length - 1) {
      checkPageBreak(40);
    }
  });

  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Diesel Transactions Report | Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // Save
  const fileName = `diesel-transactions-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
};

// ─────────────────────────────────────────────────────────────────────────────
// ExcelJS colour palette for debrief exports
// ─────────────────────────────────────────────────────────────────────────────
const XC = {
  navy: 'FF1E3A5F',
  red: 'FFDC2626',
  redLight: 'FFFEF2F2',
  green: 'FF16A34A',
  greenLight: 'FFF0FDF4',
  amber: 'FFD97706',
  amberLight: 'FFFFFBEB',
  altRow: 'FFF3F4F6',
  white: 'FFFFFFFF',
  darkText: 'FF111827',
  grayText: 'FF6B7280',
  totalBg: 'FFD1FAE5',
  totalText: 'FF065F46',
  subtitleBg: 'FFE8EEF6',
  sectionBg: 'FF2563EB',
} as const;

type XCell = ExcelJS.Cell;

const xlFill = (cell: XCell, argb: string): void => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
};

const xlFont = (cell: XCell, bold: boolean, size: number, argb: string): void => {
  cell.font = { name: 'Calibri', bold, size, color: { argb } };
};

const xlBorder = (cell: XCell, argb: string = 'FFD9D9D9'): void => {
  const border = { style: 'thin' as const, color: { argb } };
  cell.border = { top: border, bottom: border, left: border, right: border };
};

export interface DebriefExcelRecord {
  date: string;
  fleet_number: string;
  driver_name?: string;
  fuel_station?: string;
  litres_filled?: number;
  total_cost?: number;
  currency?: string;
  distance_travelled?: number;
  km_per_litre?: number;
  expected_km_per_litre?: number;
  min_acceptable?: number;
  variance_pct?: number;
  debrief_status: 'Pending' | 'Completed' | 'Within Norm';
  debrief_signed_by?: string;
  debrief_date?: string;
  debrief_trigger_reason?: string;
  notes?: string;
}

/**
 * Generate a professionally styled Excel workbook for diesel debrief data.
 * Uses ExcelJS for proper .xlsx formatting with headers, zebra rows, status colours, etc.
 */
export const generateDebriefExcel = async (
  records: DebriefExcelRecord[],
  type: 'pending' | 'completed' | 'all',
): Promise<void> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Car Craft Co — Fleet Management';
  wb.created = new Date();
  const generatedOn = format(new Date(), 'MMM dd, yyyy HH:mm');
  const dateStamp = format(new Date(), 'yyyy-MM-dd');

  const pendingRecords = records.filter(r => r.debrief_status === 'Pending');
  const completedRecords = records.filter(r => r.debrief_status === 'Completed');
  const withinNormRecords = records.filter(r => r.debrief_status === 'Within Norm');

  // ── Summary Sheet ─────────────────────────────────────────────────────────
  const summaryWs = wb.addWorksheet('Summary');
  summaryWs.columns = [
    { key: 'a', width: 30 },
    { key: 'b', width: 20 },
  ];

  // Title
  summaryWs.addRow([]);
  const titleRow = summaryWs.addRow(['DIESEL DEBRIEF REPORT']);
  summaryWs.mergeCells(titleRow.number, 1, titleRow.number, 2);
  const tCell = titleRow.getCell(1);
  xlFill(tCell, XC.navy);
  xlFont(tCell, true, 14, XC.white);
  tCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 30;

  const subRow = summaryWs.addRow([`Generated: ${generatedOn}`]);
  summaryWs.mergeCells(subRow.number, 1, subRow.number, 2);
  const sCell = subRow.getCell(1);
  xlFill(sCell, XC.subtitleBg);
  xlFont(sCell, false, 9, XC.grayText);
  sCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subRow.height = 18;

  summaryWs.addRow([]);

  // Stats
  const stats = [
    ['Total Records', records.length],
    ['Pending Debrief', pendingRecords.length],
    ['Completed Debrief', completedRecords.length],
    ['Within Norm', withinNormRecords.length],
  ];

  stats.forEach(([label, value], idx) => {
    const r = summaryWs.addRow([label, value]);
    r.height = 22;
    const labelCell = r.getCell(1);
    const valCell = r.getCell(2);
    xlBorder(labelCell);
    xlBorder(valCell);
    xlFont(labelCell, true, 11, XC.darkText);
    valCell.alignment = { horizontal: 'right', vertical: 'middle' };

    if (idx === 1) {
      xlFont(valCell, true, 12, XC.red);
    } else if (idx === 2) {
      xlFont(valCell, true, 12, XC.green);
    } else {
      xlFont(valCell, true, 12, XC.darkText);
    }

    if (idx % 2 === 1) {
      xlFill(labelCell, XC.altRow);
      xlFill(valCell, XC.altRow);
    }
  });

  // Fleet breakdown
  const fleetGroups = new Map<string, { pending: number; completed: number; withinNorm: number }>();
  records.forEach(r => {
    const fleet = r.fleet_number;
    const existing = fleetGroups.get(fleet) || { pending: 0, completed: 0, withinNorm: 0 };
    if (r.debrief_status === 'Pending') existing.pending++;
    else if (r.debrief_status === 'Completed') existing.completed++;
    else existing.withinNorm++;
    fleetGroups.set(fleet, existing);
  });

  summaryWs.addRow([]);
  summaryWs.addRow([]);

  // Fleet breakdown header
  const fbHeaderRow = summaryWs.addRow(['Fleet Breakdown']);
  summaryWs.mergeCells(fbHeaderRow.number, 1, fbHeaderRow.number, 2);
  xlFill(fbHeaderRow.getCell(1), XC.sectionBg);
  xlFont(fbHeaderRow.getCell(1), true, 11, XC.white);
  fbHeaderRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  fbHeaderRow.height = 22;

  // We need more columns for the fleet breakdown
  const fbCols = ['Fleet', 'Pending', 'Completed', 'Within Norm', 'Total'];
  const fbHRow = summaryWs.addRow(fbCols);
  fbHRow.height = 20;
  fbCols.forEach((_, i) => {
    const cell = fbHRow.getCell(i + 1);
    xlFill(cell, XC.navy);
    xlFont(cell, true, 10, XC.white);
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    xlBorder(cell);
  });

  let fbIdx = 0;
  [...fleetGroups.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([fleet, counts]) => {
    const total = counts.pending + counts.completed + counts.withinNorm;
    const r = summaryWs.addRow([fleet, counts.pending, counts.completed, counts.withinNorm, total]);
    r.height = 18;
    for (let c = 1; c <= 5; c++) {
      const cell = r.getCell(c);
      xlBorder(cell);
      xlFont(cell, false, 10, XC.darkText);
      cell.alignment = { horizontal: c === 1 ? 'left' : 'center', vertical: 'middle' };
      if (fbIdx % 2 === 1) xlFill(cell, XC.altRow);

      // Colour-code pending/completed values
      if (c === 2 && counts.pending > 0) xlFont(cell, true, 10, XC.red);
      if (c === 3 && counts.completed > 0) xlFont(cell, true, 10, XC.green);
    }
    fbIdx++;
  });

  // ── Data Sheets ───────────────────────────────────────────────────────────
  const headers = [
    'Date', 'Fleet Number', 'Driver', 'Fuel Station', 'Litres Filled',
    'Total Cost', 'Currency', 'Distance (km)', 'Actual km/L', 'Expected km/L',
    'Min Acceptable', 'Variance %', 'Debrief Status', 'Debriefed By',
    'Debrief Date', 'Trigger Reason', 'Notes',
  ];

  const colWidths = [13, 14, 20, 22, 14, 14, 10, 14, 12, 13, 14, 12, 15, 18, 13, 22, 30];

  const addDataSheet = (
    name: string,
    sheetRecords: DebriefExcelRecord[],
    statusColor: string,
  ) => {
    if (sheetRecords.length === 0) return;

    const ws = wb.addWorksheet(name);
    ws.columns = colWidths.map((w, i) => ({ key: `col${i}`, width: w }));

    // Title
    ws.addRow([]);
    const tRow = ws.addRow([name.toUpperCase()]);
    ws.mergeCells(tRow.number, 1, tRow.number, headers.length);
    xlFill(tRow.getCell(1), statusColor);
    xlFont(tRow.getCell(1), true, 13, XC.white);
    tRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    tRow.height = 28;

    const sRow = ws.addRow([`${sheetRecords.length} records • Generated: ${generatedOn}`]);
    ws.mergeCells(sRow.number, 1, sRow.number, headers.length);
    xlFill(sRow.getCell(1), XC.subtitleBg);
    xlFont(sRow.getCell(1), false, 9, XC.grayText);
    sRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    sRow.height = 16;

    ws.addRow([]);

    // Headers
    const hRow = ws.addRow(headers);
    hRow.height = 22;
    headers.forEach((_, i) => {
      const cell = hRow.getCell(i + 1);
      xlFill(cell, XC.navy);
      xlFont(cell, true, 9, XC.white);
      cell.alignment = { horizontal: i === 0 || i === 1 || i === 2 || i === 3 ? 'left' : 'center', vertical: 'middle', wrapText: true };
      xlBorder(cell, XC.navy);
    });

    // Freeze panes
    ws.views = [{ state: 'frozen', ySplit: hRow.number, xSplit: 2 }];

    // Data rows
    sheetRecords.forEach((rec, idx) => {
      const row = ws.addRow([
        rec.date ? format(new Date(rec.date), 'MMM dd, yyyy') : '',
        rec.fleet_number,
        rec.driver_name || '',
        rec.fuel_station || '',
        rec.litres_filled?.toFixed(2) || '',
        rec.total_cost?.toFixed(2) || '',
        rec.currency || 'USD',
        rec.distance_travelled || '',
        rec.km_per_litre?.toFixed(2) || '',
        rec.expected_km_per_litre?.toFixed(2) || '',
        rec.min_acceptable?.toFixed(2) || '',
        rec.variance_pct != null ? `${rec.variance_pct.toFixed(1)}%` : '',
        rec.debrief_status,
        rec.debrief_signed_by || '',
        rec.debrief_date ? format(new Date(rec.debrief_date), 'MMM dd, yyyy') : '',
        rec.debrief_trigger_reason || '',
        rec.notes || '',
      ]);
      row.height = 18;

      for (let c = 1; c <= headers.length; c++) {
        const cell = row.getCell(c);
        xlBorder(cell);
        xlFont(cell, false, 9, XC.darkText);
        cell.alignment = {
          horizontal: c <= 4 ? 'left' : (c === 13 ? 'center' : 'right'),
          vertical: 'middle',
        };

        // Zebra stripes
        if (idx % 2 === 1) xlFill(cell, XC.altRow);

        // Status column colouring
        if (c === 13) {
          if (rec.debrief_status === 'Pending') {
            xlFont(cell, true, 9, XC.red);
            xlFill(cell, XC.redLight);
          } else if (rec.debrief_status === 'Completed') {
            xlFont(cell, true, 9, XC.green);
            xlFill(cell, XC.greenLight);
          } else {
            xlFont(cell, false, 9, XC.grayText);
          }
        }

        // Variance colouring
        if (c === 12 && rec.variance_pct != null) {
          if (rec.variance_pct < -10) {
            xlFont(cell, true, 9, XC.red);
          } else if (rec.variance_pct < 0) {
            xlFont(cell, true, 9, XC.amber);
          } else {
            xlFont(cell, false, 9, XC.green);
          }
        }

        // km/L colouring
        if (c === 9 && rec.km_per_litre != null && rec.min_acceptable != null) {
          if (rec.km_per_litre < rec.min_acceptable) {
            xlFont(cell, true, 9, XC.red);
          }
        }
      }
    });

    // Totals row
    const totalLitres = sheetRecords.reduce((s, r) => s + (r.litres_filled || 0), 0);
    const totalCost = sheetRecords.reduce((s, r) => s + (r.total_cost || 0), 0);
    const totalDist = sheetRecords.reduce((s, r) => s + (r.distance_travelled || 0), 0);
    const avgKmL = totalLitres > 0 ? totalDist / totalLitres : 0;

    const totRow = ws.addRow([
      'TOTAL', '', '', '',
      totalLitres.toFixed(2),
      totalCost.toFixed(2),
      '', totalDist || '',
      avgKmL > 0 ? avgKmL.toFixed(2) : '',
      '', '', '',
      `${sheetRecords.length} records`, '', '', '', '',
    ]);
    totRow.height = 22;
    for (let c = 1; c <= headers.length; c++) {
      const cell = totRow.getCell(c);
      xlFill(cell, XC.totalBg);
      xlFont(cell, true, 10, XC.totalText);
      cell.alignment = { horizontal: c <= 4 ? 'left' : (c === 13 ? 'center' : 'right'), vertical: 'middle' };
      xlBorder(cell, XC.totalText);
    }
  };

  // Build sheets based on export type
  if (type === 'pending' || type === 'all') {
    addDataSheet('Pending Debriefs', pendingRecords, XC.red);
  }
  if (type === 'completed' || type === 'all') {
    addDataSheet('Completed Debriefs', completedRecords, XC.green);
  }
  if (type === 'all' && withinNormRecords.length > 0) {
    addDataSheet('Within Norm', withinNormRecords, XC.grayText);
  }

  // Save
  const typeLabel = type === 'pending' ? 'pending' : type === 'completed' ? 'completed' : 'all';
  const filename = `diesel_debriefs_${typeLabel}_${dateStamp}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
};

/**
 * Generate a comprehensive debrief PDF report with professional table formatting.
 * Groups records by fleet with summary statistics and colour-coded status.
 */
export const generateDebriefPDF = (
  records: DebriefExcelRecord[],
  type: 'pending' | 'completed' | 'all',
): void => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 15;

  const pendingRecords = records.filter(r => r.debrief_status === 'Pending');
  const completedRecords = records.filter(r => r.debrief_status === 'Completed');

  const typeLabel = type === 'pending' ? 'PENDING DEBRIEFS'
    : type === 'completed' ? 'COMPLETED DEBRIEFS'
      : 'DIESEL DEBRIEF REPORT';

  // ── Helper: Check page break ───────────────────────────────────────────
  const checkPageBreak = (needed: number) => {
    if (yPos + needed > pageHeight - 20) {
      // Footer on current page
      addFooter();
      doc.addPage();
      yPos = 15;
      return true;
    }
    return false;
  };

  // ── Footer helper ──────────────────────────────────────────────────────
  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Car Craft Co • Diesel Debrief Report • Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
    doc.setTextColor(0, 0, 0);
  };

  // ── Title Section ──────────────────────────────────────────────────────
  doc.setFillColor(30, 58, 95); // Navy
  doc.rect(margin, yPos, contentWidth, 14, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(typeLabel, pageWidth / 2, yPos + 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  yPos += 18;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}  •  ${records.length} records`, pageWidth / 2, yPos, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  yPos += 8;

  // ── Summary Box ────────────────────────────────────────────────────────
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const boxY = yPos + 7;
  const colSpacing = contentWidth / 4;

  doc.text('Total Records:', margin + 10, boxY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(records.length), margin + 45, boxY);

  doc.setFont('helvetica', 'bold');
  doc.text('Pending:', margin + colSpacing + 10, boxY);
  doc.setTextColor(220, 38, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(String(pendingRecords.length), margin + colSpacing + 35, boxY);
  doc.setTextColor(0, 0, 0);

  doc.setFont('helvetica', 'bold');
  doc.text('Completed:', margin + 2 * colSpacing + 10, boxY);
  doc.setTextColor(22, 163, 74);
  doc.setFont('helvetica', 'normal');
  doc.text(String(completedRecords.length), margin + 2 * colSpacing + 45, boxY);
  doc.setTextColor(0, 0, 0);

  const totalLitres = records.reduce((s, r) => s + (r.litres_filled || 0), 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Litres:', margin + 3 * colSpacing + 10, boxY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatNumber(totalLitres) + ' L', margin + 3 * colSpacing + 45, boxY);

  yPos += 24;

  // ── Group records by fleet ─────────────────────────────────────────────
  const byFleet = records.reduce((acc, r) => {
    if (!acc[r.fleet_number]) acc[r.fleet_number] = [];
    acc[r.fleet_number].push(r);
    return acc;
  }, {} as Record<string, DebriefExcelRecord[]>);

  const fleetNumbers = Object.keys(byFleet).sort();

  // ── Table column config ────────────────────────────────────────────────
  const colDefs = [
    { header: 'Date', width: 28 },
    { header: 'Driver', width: 38 },
    { header: 'Station', width: 38 },
    { header: 'Litres', width: 22 },
    { header: 'Cost', width: 28 },
    { header: 'Distance', width: 22 },
    { header: 'km/L', width: 18 },
    { header: 'Expected', width: 20 },
    { header: 'Variance', width: 22 },
    { header: 'Status', width: 24 },
    { header: 'Debriefed By', width: 30 },
  ];

  const drawTableHeader = () => {
    doc.setFillColor(30, 58, 95);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    let xPos = margin + 2;
    colDefs.forEach(col => {
      doc.text(col.header, xPos, yPos + 6);
      xPos += col.width;
    });

    doc.setTextColor(0, 0, 0);
    yPos += 10;
  };

  const drawDataRow = (rec: DebriefExcelRecord, isAlt: boolean) => {
    if (isAlt) {
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, yPos - 3, contentWidth, 7, 'F');
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    let xPos = margin + 2;

    // Date
    doc.text(rec.date ? format(new Date(rec.date), 'MMM dd') : '', xPos, yPos);
    xPos += colDefs[0].width;

    // Driver
    doc.text((rec.driver_name || 'N/A').substring(0, 20), xPos, yPos);
    xPos += colDefs[1].width;

    // Station
    doc.text((rec.fuel_station || 'N/A').substring(0, 20), xPos, yPos);
    xPos += colDefs[2].width;

    // Litres
    doc.text(rec.litres_filled ? formatNumber(rec.litres_filled) + ' L' : '', xPos, yPos);
    xPos += colDefs[3].width;

    // Cost
    const curr = rec.currency === 'USD' ? '$' : 'R';
    doc.text(rec.total_cost ? `${curr}${formatNumber(rec.total_cost)}` : '', xPos, yPos);
    xPos += colDefs[4].width;

    // Distance
    doc.text(rec.distance_travelled ? formatNumber(rec.distance_travelled) + ' km' : '', xPos, yPos);
    xPos += colDefs[5].width;

    // km/L (colour-coded)
    if (rec.km_per_litre != null) {
      if (rec.min_acceptable != null && rec.km_per_litre < rec.min_acceptable) {
        doc.setTextColor(220, 38, 38);
      }
      doc.text(formatNumber(rec.km_per_litre, 2), xPos, yPos);
      doc.setTextColor(0, 0, 0);
    }
    xPos += colDefs[6].width;

    // Expected
    doc.text(rec.expected_km_per_litre ? formatNumber(rec.expected_km_per_litre, 2) : '', xPos, yPos);
    xPos += colDefs[7].width;

    // Variance
    if (rec.variance_pct != null) {
      if (rec.variance_pct < -10) doc.setTextColor(220, 38, 38);
      else if (rec.variance_pct < 0) doc.setTextColor(217, 119, 6);
      else doc.setTextColor(22, 163, 74);
      doc.text(`${rec.variance_pct.toFixed(1)}%`, xPos, yPos);
      doc.setTextColor(0, 0, 0);
    }
    xPos += colDefs[8].width;

    // Status
    if (rec.debrief_status === 'Pending') {
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('PENDING', xPos, yPos);
    } else if (rec.debrief_status === 'Completed') {
      doc.setTextColor(22, 163, 74);
      doc.setFont('helvetica', 'bold');
      doc.text('Completed', xPos, yPos);
    } else {
      doc.setTextColor(128, 128, 128);
      doc.text('OK', xPos, yPos);
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    xPos += colDefs[9].width;

    // Debriefed by
    doc.text((rec.debrief_signed_by || '').substring(0, 16), xPos, yPos);

    yPos += 7;

    // Separator
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, yPos - 3, margin + contentWidth, yPos - 3);
  };

  // ── Render each fleet section ──────────────────────────────────────────
  fleetNumbers.forEach((fleet, fleetIdx) => {
    const fleetRecords = byFleet[fleet];
    const fleetPending = fleetRecords.filter(r => r.debrief_status === 'Pending').length;
    const fleetCompleted = fleetRecords.filter(r => r.debrief_status === 'Completed').length;
    const fleetLitres = fleetRecords.reduce((s, r) => s + (r.litres_filled || 0), 0);

    checkPageBreak(30);

    // Fleet header
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(margin, yPos, contentWidth, 10, 1, 1, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`Fleet: ${fleet}`, margin + 5, yPos + 7);
    doc.setFontSize(8);
    doc.text(
      `${fleetRecords.length} records  •  ${fleetPending} pending  •  ${fleetCompleted} completed  •  ${formatNumber(fleetLitres)} L`,
      pageWidth - margin - 5,
      yPos + 7,
      { align: 'right' }
    );
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    // Table header
    drawTableHeader();

    // Data rows
    fleetRecords
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((rec, idx) => {
        checkPageBreak(10);
        drawDataRow(rec, idx % 2 === 1);
      });

    yPos += 6;

    // Page break between fleets if space is tight
    if (fleetIdx < fleetNumbers.length - 1) {
      checkPageBreak(35);
    }
  });

  // Footer on last page
  addFooter();

  // Save
  const typeFile = type === 'pending' ? 'pending' : type === 'completed' ? 'completed' : 'all';
  const fileName = `diesel_debriefs_${typeFile}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};

// ──────────────────────────────────────────────────────────────────────────────
// Weekly Debrief Export — Last 7 days per vehicle with signature & acceptance
// ──────────────────────────────────────────────────────────────────────────────

export interface WeeklyDebriefRecord {
  id: string;
  fleet_number: string;
  date: string;
  driver_name?: string;
  fuel_station?: string;
  litres_filled?: number;
  total_cost?: number;
  currency?: string;
  km_per_litre?: number;
  distance_travelled?: number;
  debrief_signed?: boolean;
  debrief_signed_by?: string;
  debrief_signed_at?: string;
  debrief_notes?: string;
  requires_debrief?: boolean;
  debrief_trigger_reason?: string;
  probe_discrepancy?: number;
  vehicle_litres_only?: number;
  trailer_litres_total?: number;
  linked_trailers?: string[];
}

export interface WeeklyDebriefNorm {
  fleet_number: string;
  expected_km_per_litre: number;
  min_acceptable: number;
  max_acceptable: number;
}

export interface WeeklyDebriefExportOptions {
  /** All diesel records (will be filtered to last 7 days internally). */
  records: WeeklyDebriefRecord[];
  /** Norms lookup — used to show expected vs actual efficiency. */
  norms: WeeklyDebriefNorm[];
  /** Optional: restrict to a single fleet number. If omitted all fleets are included. */
  fleetNumber?: string;
  /** Optional: restrict to a single driver name. */
  driverName?: string;
  /** If true, returns a Blob instead of triggering a download. */
  returnBlob?: boolean;
}

/**
 * Generate a PDF containing the last 7 days of diesel debriefs grouped by
 * vehicle, with a signature & acceptance section on each vehicle page.
 */
export const generateWeeklyDebriefsPDF = (options: WeeklyDebriefExportOptions): Blob | void => {
  const { records, norms, fleetNumber, driverName, returnBlob } = options;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // ── Date range: last 7 days ──
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const rangeStart = format(sevenDaysAgo, 'yyyy-MM-dd');
  const rangeEnd = format(now, 'yyyy-MM-dd');

  // Filter records to the window + optional fleet/driver filter
  let filtered = records.filter(r => r.date >= rangeStart && r.date <= rangeEnd);
  if (fleetNumber) filtered = filtered.filter(r => r.fleet_number === fleetNumber);
  if (driverName) filtered = filtered.filter(r => r.driver_name === driverName);

  // Group by fleet
  const byFleet: Record<string, WeeklyDebriefRecord[]> = {};
  for (const r of filtered) {
    if (!byFleet[r.fleet_number]) byFleet[r.fleet_number] = [];
    byFleet[r.fleet_number].push(r);
  }
  // Sort each group by date ascending
  for (const fleet of Object.keys(byFleet)) {
    byFleet[fleet].sort((a, b) => a.date.localeCompare(b.date));
  }
  const fleetNumbers = Object.keys(byFleet).sort();

  if (fleetNumbers.length === 0) {
    // Nothing to export — produce a single page notice
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('No debrief records found for the last 7 days.', pageWidth / 2, 40, { align: 'center' });
    if (returnBlob) return doc.output('blob');
    doc.save(`weekly-debriefs-${format(now, 'yyyy-MM-dd')}.pdf`);
    return;
  }

  const getNorm = (fleet: string) => norms.find(n => n.fleet_number === fleet);

  // Helpers
  let yPos = 0;

  const checkPageBreak = (space: number) => {
    if (yPos + space > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Generated: ${format(now, 'MMM dd, yyyy HH:mm')} | Weekly Debrief Report`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' },
    );
    doc.setTextColor(0, 0, 0);
  };

  // ──────────────────────────────────────────────
  // Iterate each fleet — new page per vehicle
  // ──────────────────────────────────────────────
  fleetNumbers.forEach((fleet, fleetIdx) => {
    if (fleetIdx > 0) doc.addPage();
    yPos = 20;

    const fleetRecords = byFleet[fleet];
    const norm = getNorm(fleet);

    // ── Title ──
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('WEEKLY DIESEL DEBRIEF REPORT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 9;

    doc.setFontSize(11);
    doc.text(`Vehicle: ${fleet}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Period: ${format(sevenDaysAgo, 'dd MMM yyyy')} – ${format(now, 'dd MMM yyyy')}`,
      pageWidth / 2,
      yPos,
      { align: 'center' },
    );
    yPos += 5;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${format(now, 'dd MMM yyyy HH:mm')}`, pageWidth / 2, yPos, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPos += 10;

    // ── Norm info box ──
    if (norm) {
      doc.setFillColor(240, 245, 255);
      doc.roundedRect(margin, yPos, contentWidth, 14, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Fleet Norm:', margin + 4, yPos + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Expected ${formatNumber(norm.expected_km_per_litre, 2)} km/L  |  Acceptable range: ${formatNumber(norm.min_acceptable, 2)} – ${formatNumber(norm.max_acceptable, 2)} km/L`,
        margin + 30,
        yPos + 5,
      );
      // Totals
      const totalLitres = fleetRecords.reduce((s, r) => s + (r.litres_filled || 0), 0);
      const totalCost = fleetRecords.reduce((s, r) => s + (r.total_cost || 0), 0);
      const curr = (fleetRecords[0]?.currency || 'USD') as string;
      doc.setFontSize(8);
      doc.text(
        `Transactions: ${fleetRecords.length}  |  Total: ${formatNumber(totalLitres, 1)} L  |  ${formatCurrency(totalCost, curr)}`,
        margin + 4,
        yPos + 11,
      );
      yPos += 18;
    } else {
      yPos += 2;
    }

    // ── Table header ──
    const colWidths = [22, 30, 30, 20, 22, 20, 46];
    const headers = ['Date', 'Driver', 'Station', 'Litres', 'Cost', 'km/L', 'Debrief Status'];

    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    let xPos = margin + 2;
    headers.forEach((h, i) => {
      doc.text(h, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    doc.setTextColor(0, 0, 0);
    yPos += 10;

    // ── Table rows ──
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    fleetRecords.forEach((record, rowIdx) => {
      checkPageBreak(14);

      // Alternate row background
      if (rowIdx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, yPos - 3, contentWidth, 8, 'F');
      }

      xPos = margin + 2;

      // Date
      doc.text(format(new Date(record.date), 'dd MMM'), xPos, yPos);
      xPos += colWidths[0];

      // Driver
      doc.text((record.driver_name || 'N/A').substring(0, 16), xPos, yPos);
      xPos += colWidths[1];

      // Station
      doc.text((record.fuel_station || 'N/A').substring(0, 16), xPos, yPos);
      xPos += colWidths[2];

      // Litres
      doc.text(formatNumber(record.litres_filled || 0, 1) + ' L', xPos, yPos);
      xPos += colWidths[3];

      // Cost
      const curr = (record.currency || 'USD') as string;
      doc.text(formatCurrency(record.total_cost || 0, curr), xPos, yPos);
      xPos += colWidths[4];

      // km/L (colour-coded)
      if (record.km_per_litre) {
        const belowNorm = norm && record.km_per_litre < norm.min_acceptable;
        if (belowNorm) {
          doc.setTextColor(220, 38, 38); // red
        } else {
          doc.setTextColor(22, 163, 74); // green
        }
        doc.text(formatNumber(record.km_per_litre, 2), xPos, yPos);
        doc.setTextColor(0, 0, 0);
      } else {
        doc.text('N/A', xPos, yPos);
      }
      xPos += colWidths[5];

      // Debrief status
      if (record.debrief_signed) {
        doc.setTextColor(22, 163, 74);
        const signedText = `Signed: ${(record.debrief_signed_by || '').substring(0, 12)}`;
        doc.text(signedText, xPos, yPos);
        doc.setTextColor(0, 0, 0);
      } else if (record.requires_debrief) {
        doc.setTextColor(220, 38, 38);
        doc.text('PENDING', xPos, yPos);
        doc.setTextColor(0, 0, 0);
      } else {
        doc.setTextColor(120, 120, 120);
        doc.text('Within norm', xPos, yPos);
        doc.setTextColor(0, 0, 0);
      }

      yPos += 7;

      // If there are debrief notes, show them in a sub-row
      if (record.debrief_notes) {
        checkPageBreak(8);
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        const noteText = `Notes: ${record.debrief_notes.substring(0, 90)}${record.debrief_notes.length > 90 ? '...' : ''}`;
        doc.text(noteText, margin + 4, yPos);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7.5);
        yPos += 5;
      }

      // Separator
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, yPos - 1, margin + contentWidth, yPos - 1);
    });

    yPos += 6;

    // ── Summary totals ──
    checkPageBreak(20);
    const totalLitres = fleetRecords.reduce((s, r) => s + (r.litres_filled || 0), 0);
    const totalCost = fleetRecords.reduce((s, r) => s + (r.total_cost || 0), 0);
    const avgKmL = fleetRecords.filter(r => r.km_per_litre).reduce((s, r) => s + (r.km_per_litre || 0), 0) / (fleetRecords.filter(r => r.km_per_litre).length || 1);
    const pending = fleetRecords.filter(r => r.requires_debrief && !r.debrief_signed).length;
    const completed = fleetRecords.filter(r => r.debrief_signed).length;
    const curr = (fleetRecords[0]?.currency || 'USD') as string;

    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, yPos, contentWidth, 16, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Weekly Totals:', margin + 4, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${formatNumber(totalLitres, 1)} L  |  ${formatCurrency(totalCost, curr)}  |  Avg ${formatNumber(avgKmL, 2)} km/L  |  Debriefed: ${completed}  |  Pending: ${pending}`,
      margin + 34,
      yPos + 5,
    );

    yPos += 10;

    // ── Issues summary (only if there are records requiring debrief) ──
    const issueRecords = fleetRecords.filter(r => r.requires_debrief);
    if (issueRecords.length > 0) {
      checkPageBreak(16 + issueRecords.length * 5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Issues Identified:', margin + 4, yPos + 5);
      yPos += 9;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      issueRecords.forEach(r => {
        checkPageBreak(7);
        const reason = r.debrief_trigger_reason || 'Below acceptable efficiency';
        doc.text(
          `• ${format(new Date(r.date), 'dd MMM')} — ${r.driver_name || 'N/A'}: ${reason.substring(0, 80)}`,
          margin + 6,
          yPos,
        );
        yPos += 5;
      });
      yPos += 4;
    }

    // ──────────────────────────────────────────────
    // SIGNATURE & ACCEPTANCE SECTION
    // ──────────────────────────────────────────────
    checkPageBreak(75);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SIGNATURE & ACCEPTANCE', margin, yPos + 2);
    yPos += 8;

    doc.setDrawColor(180, 180, 180);
    doc.rect(margin, yPos, contentWidth, 64);

    const sigStartY = yPos + 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'I have reviewed the above diesel consumption records for the stated period. All discrepancies',
      margin + 4,
      sigStartY,
    );
    doc.text(
      'have been discussed and the corrective actions noted herein are understood and accepted.',
      margin + 4,
      sigStartY + 5,
    );

    const sig1Y = sigStartY + 18;
    const sig2Y = sig1Y + 22;

    // Fleet Manager / Debriefer
    doc.setFont('helvetica', 'bold');
    doc.text('Fleet Manager / Debriefer:', margin + 4, sig1Y);
    doc.setFont('helvetica', 'normal');
    doc.text('Name:', margin + 4, sig1Y + 7);
    doc.line(margin + 18, sig1Y + 8, margin + 80, sig1Y + 8);
    doc.text('Signature:', margin + 85, sig1Y + 7);
    doc.line(margin + 103, sig1Y + 8, margin + contentWidth - 4, sig1Y + 8);
    doc.text('Date:', margin + 4, sig1Y + 14);
    doc.line(margin + 16, sig1Y + 15, margin + 55, sig1Y + 15);

    // Driver
    doc.setFont('helvetica', 'bold');
    doc.text('Driver:', margin + 4, sig2Y);
    doc.setFont('helvetica', 'normal');
    doc.text('Name:', margin + 4, sig2Y + 7);
    doc.line(margin + 18, sig2Y + 8, margin + 80, sig2Y + 8);
    doc.text('Signature:', margin + 85, sig2Y + 7);
    doc.line(margin + 103, sig2Y + 8, margin + contentWidth - 4, sig2Y + 8);
    doc.text('Date:', margin + 4, sig2Y + 14);
    doc.line(margin + 16, sig2Y + 15, margin + 55, sig2Y + 15);

    // Footer
    addFooter();
  });

  // Save or return blob
  const driverSuffix = driverName ? `-${driverName.replace(/\s+/g, '_')}` : '';
  const fleetSuffix = fleetNumber || 'all-vehicles';
  const fileName = `weekly-debriefs-${fleetSuffix}${driverSuffix}-${format(now, 'yyyy-MM-dd')}.pdf`;
  if (returnBlob) return doc.output('blob');
  doc.save(fileName);
};