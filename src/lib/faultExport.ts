import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface FaultExportData {
  id: string;
  fault_number: string;
  fault_description: string;
  fault_category: string;
  component: string | null;
  severity: string;
  status: string;
  reported_by: string;
  reported_date: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_date: string | null;
  resolution_notes: string | null;
  vehicles?: {
    fleet_number: string | null;
    registration_number: string;
    make: string;
    model: string;
  } | null;
}

/**
 * Get severity color for PDF
 */
function getSeverityColor(severity: string): [number, number, number] {
  switch (severity.toLowerCase()) {
    case "critical":
      return [220, 38, 38]; // Red
    case "high":
      return [234, 88, 12]; // Orange
    case "medium":
      return [234, 179, 8]; // Yellow
    case "low":
      return [34, 197, 94]; // Green
    default:
      return [107, 114, 128]; // Gray
  }
}

/**
 * Get status color for PDF
 */
function getStatusColor(status: string): [number, number, number] {
  switch (status.toLowerCase()) {
    case "identified":
      return [220, 38, 38]; // Red
    case "acknowledged":
      return [234, 179, 8]; // Yellow/Orange
    case "resolved":
      return [34, 197, 94]; // Green
    default:
      return [107, 114, 128]; // Gray
  }
}

/**
 * Add PDF header with branding
 */
function addHeader(doc: jsPDF, title: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 35, "F");

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Matanuska", 15, 15);

  // Report title
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(title, 15, 25);

  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, pageWidth - 15, 15, { align: "right" });

  return 45; // Return Y position after header
}

/**
 * Add page footer
 */
function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setDrawColor(200, 200, 200);
  doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(8);
  doc.text(
    `Page ${pageNum} of ${totalPages}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );
  doc.text(
    "Confidential - Matanuska Fleet Management",
    15,
    pageHeight - 8
  );
}

/**
 * Generate PDF for a single fault entry
 */
export function generateSingleFaultPDF(fault: FaultExportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Use fleet number in header if available, otherwise fall back to fault number
  const headerLabel = fault.vehicles?.fleet_number || fault.fault_number;
  let yPos = addHeader(doc, `Fault Report - ${headerLabel}`);

  // Severity and Status badges
  const severityColor = getSeverityColor(fault.severity);
  const statusColor = getStatusColor(fault.status);

  // Severity badge
  doc.setFillColor(...severityColor);
  doc.roundedRect(15, yPos, 35, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(fault.severity.toUpperCase(), 32.5, yPos + 5.5, { align: "center" });

  // Status badge
  doc.setFillColor(...statusColor);
  doc.roundedRect(55, yPos, 40, 8, 2, 2, "F");
  doc.text(fault.status.toUpperCase(), 75, yPos + 5.5, { align: "center" });

  yPos += 18;

  // Vehicle Information Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Vehicle Information", 15, yPos);
  yPos += 8;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, yPos, pageWidth - 30, 34, 3, 3, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Fleet Number:", 20, yPos + 8);
  doc.text("Registration:", 20, yPos + 16);
  doc.text("Make / Model:", 20, yPos + 24);

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(fault.vehicles?.fleet_number || "N/A", 60, yPos + 8);
  doc.text(fault.vehicles?.registration_number || "N/A", 60, yPos + 16);
  doc.text(
    fault.vehicles ? `${fault.vehicles.make} ${fault.vehicles.model}` : "N/A",
    60,
    yPos + 24
  );

  yPos += 44;

  // Fault Details Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Fault Details", 15, yPos);
  yPos += 8;

  const faultDetails = [
    ["Fault Number", fault.fault_number],
    ["Category", fault.fault_category],
    ["Component", fault.component || "N/A"],
    ["Reported By", fault.reported_by],
    ["Reported Date", format(new Date(fault.reported_date), "dd MMM yyyy")],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: faultDetails,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 50 },
      1: { textColor: [30, 41, 59] },
    },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Description Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Description", 15, yPos);
  yPos += 8;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);

  const descLines = doc.splitTextToSize(fault.fault_description, pageWidth - 40);
  const descHeight = Math.max(descLines.length * 5 + 10, 20);
  doc.roundedRect(15, yPos, pageWidth - 30, descHeight, 3, 3, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.text(descLines, 20, yPos + 8);

  yPos += descHeight + 10;

  // Acknowledgement Section (if applicable)
  if (fault.acknowledged_at) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Acknowledgement", 15, yPos);
    yPos += 8;

    const ackDetails = [
      ["Acknowledged By", fault.acknowledged_by || "N/A"],
      ["Acknowledged At", format(new Date(fault.acknowledged_at), "dd MMM yyyy, HH:mm")],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [],
      body: ackDetails,
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        0: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 50 },
        1: { textColor: [30, 41, 59] },
      },
      margin: { left: 15, right: 15 },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Resolution Section (if applicable)
  if (fault.resolved_date) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resolution", 15, yPos);
    yPos += 8;

    const resDetails = [
      ["Resolved Date", format(new Date(fault.resolved_date), "dd MMM yyyy, HH:mm")],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [],
      body: resDetails,
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        0: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 50 },
        1: { textColor: [30, 41, 59] },
      },
      margin: { left: 15, right: 15 },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

    if (fault.resolution_notes) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("Resolution Notes:", 15, yPos + 5);

      yPos += 10;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(240, 253, 244); // Green tint

      const resNoteLines = doc.splitTextToSize(fault.resolution_notes, pageWidth - 40);
      const resNoteHeight = Math.max(resNoteLines.length * 5 + 10, 20);
      doc.roundedRect(15, yPos, pageWidth - 30, resNoteHeight, 3, 3, "FD");

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(resNoteLines, 20, yPos + 8);
    }
  }

  // Add footer
  addFooter(doc, 1, 1);

  // Save PDF
  doc.save(`Fault_Report_${fault.fault_number}_${format(new Date(), "yyyyMMdd")}.pdf`);
}

/**
 * Generate PDF report for all faults
 */
export function generateAllFaultsPDF(faults: FaultExportData[]): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  let yPos = addHeader(doc, "Vehicle Faults Summary Report");

  // Summary Statistics
  const identified = faults.filter(f => f.status === "identified").length;
  const acknowledged = faults.filter(f => f.status === "acknowledged").length;
  const resolved = faults.filter(f => f.status === "resolved").length;
  const critical = faults.filter(f => f.severity === "critical").length;
  const high = faults.filter(f => f.severity === "high").length;

  // Summary boxes
  const boxWidth = (pageWidth - 80) / 5;
  const boxHeight = 25;
  const startX = 15;

  const summaryData = [
    { label: "Total Faults", value: faults.length.toString(), color: [59, 130, 246] as [number, number, number] },
    { label: "Identified", value: identified.toString(), color: [220, 38, 38] as [number, number, number] },
    { label: "Acknowledged", value: acknowledged.toString(), color: [234, 179, 8] as [number, number, number] },
    { label: "Resolved", value: resolved.toString(), color: [34, 197, 94] as [number, number, number] },
    { label: "Critical/High", value: `${critical}/${high}`, color: [239, 68, 68] as [number, number, number] },
  ];

  summaryData.forEach((item, index) => {
    const x = startX + index * (boxWidth + 10);

    doc.setFillColor(...item.color);
    doc.roundedRect(x, yPos, boxWidth, boxHeight, 3, 3, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(item.value, x + boxWidth / 2, yPos + 10, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(item.label, x + boxWidth / 2, yPos + 19, { align: "center" });
  });

  yPos += boxHeight + 15;

  // Prepare table data
  const tableData = faults.map(fault => [
    fault.fault_number,
    fault.vehicles?.fleet_number || fault.vehicles?.registration_number || "N/A",
    fault.fault_category,
    fault.severity.toUpperCase(),
    fault.status.toUpperCase(),
    fault.reported_by,
    format(new Date(fault.reported_date), "dd/MM/yyyy"),
    fault.resolved_date ? format(new Date(fault.resolved_date), "dd/MM/yyyy") : "-",
  ]);

  // Faults Table
  autoTable(doc, {
    startY: yPos,
    head: [[
      "Fault #",
      "Vehicle",
      "Category",
      "Severity",
      "Status",
      "Reported By",
      "Reported",
      "Resolved",
    ]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 25 },
      1: { cellWidth: 30 },
      2: { cellWidth: 35 },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 28, halign: "center" },
      5: { cellWidth: 35 },
      6: { cellWidth: 25, halign: "center" },
      7: { cellWidth: 25, halign: "center" },
    },
    margin: { left: 15, right: 15 },
    didParseCell: (data) => {
      // Color code severity column
      if (data.column.index === 3 && data.section === "body") {
        const severity = data.cell.raw?.toString().toLowerCase() || "";
        const color = getSeverityColor(severity);
        data.cell.styles.textColor = color;
        data.cell.styles.fontStyle = "bold";
      }
      // Color code status column
      if (data.column.index === 4 && data.section === "body") {
        const status = data.cell.raw?.toString().toLowerCase() || "";
        const color = getStatusColor(status);
        data.cell.styles.textColor = color;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  // Save PDF
  doc.save(`Faults_Report_All_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}

/**
 * Generate PDF report for filtered faults (by status, severity, etc.)
 */
export function generateFilteredFaultsPDF(
  faults: FaultExportData[],
  filterDescription: string
): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  let yPos = addHeader(doc, `Vehicle Faults Report - ${filterDescription}`);

  // Filter info banner
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, yPos, pageWidth - 30, 12, 2, 2, "FD");

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Filter: ${filterDescription} | Total Records: ${faults.length}`, 20, yPos + 8);

  yPos += 20;

  // Prepare table data
  const tableData = faults.map(fault => [
    fault.fault_number,
    fault.vehicles?.fleet_number || fault.vehicles?.registration_number || "N/A",
    fault.fault_category,
    fault.component || "-",
    fault.severity.toUpperCase(),
    fault.status.toUpperCase(),
    fault.reported_by,
    format(new Date(fault.reported_date), "dd/MM/yyyy"),
  ]);

  // Faults Table
  autoTable(doc, {
    startY: yPos,
    head: [[
      "Fault #",
      "Vehicle",
      "Category",
      "Component",
      "Severity",
      "Status",
      "Reported By",
      "Date",
    ]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
    },
    margin: { left: 15, right: 15 },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === "body") {
        const severity = data.cell.raw?.toString().toLowerCase() || "";
        const color = getSeverityColor(severity);
        data.cell.styles.textColor = color;
        data.cell.styles.fontStyle = "bold";
      }
      if (data.column.index === 5 && data.section === "body") {
        const status = data.cell.raw?.toString().toLowerCase() || "";
        const color = getStatusColor(status);
        data.cell.styles.textColor = color;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Add footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  // Save PDF
  const safeFilterName = filterDescription.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`Faults_Report_${safeFilterName}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}