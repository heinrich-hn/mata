import { format } from "date-fns";
import jsPDF from "jspdf";
import { formatCurrency, formatNumber } from "./formatters";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generateDieselDebriefPDF = (record: any, norm?: any) => {
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
  doc.text(`Total Cost: ${formatCurrency(record.total_cost, record.currency || "ZAR")}`, pageWidth / 2 + 10, detailsY + 14);

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
        } else if (record.km_per_litre > norm.max_acceptable) {
          status = "ABOVE";
          statusColor = [234, 179, 8];
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generateDieselDebriefPDFBlob = (record: any, norm?: any): { blob: Blob; fileName: string } => {
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
  doc.text(`Total Cost: ${formatCurrency(record.total_cost, record.currency || "ZAR")}`, pageWidth / 2 + 10, dy + 14);
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
        const currency = record.currency === "USD" ? "$" : "R";
        doc.text(`${currency}${formatNumber(record.total_cost || 0)}`, xPos, yPos);
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