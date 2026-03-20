import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface JobCardExportData {
  jobCard: {
    id: string;
    job_number: string;
    title: string;
    status: string;
    priority: string;
    assignee: string | null;
    due_date: string | null;
    created_at: string | null;
    description: string | null;
  };
  vehicle?: {
    registration_number: string;
    make?: string | null;
    model?: string | null;
  } | null;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>;
  laborEntries: Array<{
    id: string;
    technician_name: string;
    description: string | null;
    hours_worked: number;
    hourly_rate: number;
    total_cost: number;
    work_date: string;
  }>;
  parts: Array<{
    id: string;
    part_name: string;
    part_number: string | null;
    quantity: number;
    status: string;
    unit_price?: number | null;
    total_price?: number | null;
    is_from_inventory?: boolean | null;
    is_service?: boolean | null;
    vendor_id?: string | null;
    vendors?: { name: string } | null;
    inventory?: { name: string; part_number: string | null } | null;
    document_url?: string | null;
    document_name?: string | null;
  }>;
  notes?: Array<{
    id: string;
    note: string;
    created_by: string | null;
    created_at: string | null;
  }>;
  inspection?: {
    inspection_number: string;
    inspection_type: string;
    inspection_date: string;
  } | null;
}

export interface CostSummary {
  // Parts costs
  inventoryPartsCost: number;
  externalPartsCost: number;
  servicesCost: number;
  totalPartsCost: number;
  // Labor costs
  totalLaborCost: number;
  totalLaborHours: number;
  // Grand total
  grandTotal: number;
  // Item counts
  inventoryItemsCount: number;
  externalItemsCount: number;
  serviceItemsCount: number;
  totalPartsItems: number;
  laborEntriesCount: number;
}

/**
 * Calculate comprehensive cost summary for a job card
 */
export function calculateJobCardCosts(data: JobCardExportData): CostSummary {
  const summary: CostSummary = {
    inventoryPartsCost: 0,
    externalPartsCost: 0,
    servicesCost: 0,
    totalPartsCost: 0,
    totalLaborCost: 0,
    totalLaborHours: 0,
    grandTotal: 0,
    inventoryItemsCount: 0,
    externalItemsCount: 0,
    serviceItemsCount: 0,
    totalPartsItems: 0,
    laborEntriesCount: data.laborEntries.length,
  };

  // Calculate parts costs
  data.parts.forEach((part) => {
    if (part.status === "cancelled") return;

    const price = part.total_price || 0;
    summary.totalPartsItems++;
    summary.totalPartsCost += price;

    if (part.is_service) {
      summary.servicesCost += price;
      summary.serviceItemsCount++;
    } else if (part.is_from_inventory) {
      summary.inventoryPartsCost += price;
      summary.inventoryItemsCount++;
    } else {
      summary.externalPartsCost += price;
      summary.externalItemsCount++;
    }
  });

  // Calculate labor costs
  data.laborEntries.forEach((entry) => {
    summary.totalLaborCost += entry.total_cost || 0;
    summary.totalLaborHours += entry.hours_worked || 0;
  });

  // Grand total
  summary.grandTotal = summary.totalPartsCost + summary.totalLaborCost;

  return summary;
}

/**
 * Generate a comprehensive PDF for a job card
 */
export function generateJobCardPDF(data: JobCardExportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  const costs = calculateJobCardCosts(data);

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("JOB CARD", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`#${data.jobCard.job_number}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  // Job Card Details Box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 45, 3, 3, "F");

  doc.setFontSize(10);
  const detailsStartY = yPos + 8;
  const col1 = margin + 5;
  const col2 = margin + 95;

  doc.setFont("helvetica", "bold");
  doc.text("Title:", col1, detailsStartY);
  doc.setFont("helvetica", "normal");
  doc.text(data.jobCard.title.substring(0, 50), col1 + 20, detailsStartY);

  doc.setFont("helvetica", "bold");
  doc.text("Status:", col2, detailsStartY);
  doc.setFont("helvetica", "normal");
  doc.text(data.jobCard.status.replace("_", " ").toUpperCase(), col2 + 25, detailsStartY);

  doc.setFont("helvetica", "bold");
  doc.text("Vehicle:", col1, detailsStartY + 8);
  doc.setFont("helvetica", "normal");
  const vehicleText = data.vehicle
    ? `${data.vehicle.registration_number}${data.vehicle.make ? ` - ${data.vehicle.make} ${data.vehicle.model || ""}` : ""}`
    : "N/A";
  doc.text(vehicleText.substring(0, 45), col1 + 25, detailsStartY + 8);

  doc.setFont("helvetica", "bold");
  doc.text("Priority:", col2, detailsStartY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(data.jobCard.priority.toUpperCase(), col2 + 25, detailsStartY + 8);

  doc.setFont("helvetica", "bold");
  doc.text("Assignee:", col1, detailsStartY + 16);
  doc.setFont("helvetica", "normal");
  doc.text(data.jobCard.assignee || "Unassigned", col1 + 30, detailsStartY + 16);

  doc.setFont("helvetica", "bold");
  doc.text("Due Date:", col2, detailsStartY + 16);
  doc.setFont("helvetica", "normal");
  doc.text(
    data.jobCard.due_date ? format(new Date(data.jobCard.due_date), "MMM dd, yyyy") : "Not set",
    col2 + 30,
    detailsStartY + 16
  );

  doc.setFont("helvetica", "bold");
  doc.text("Created:", col1, detailsStartY + 24);
  doc.setFont("helvetica", "normal");
  doc.text(
    data.jobCard.created_at ? format(new Date(data.jobCard.created_at), "MMM dd, yyyy HH:mm") : "N/A",
    col1 + 25,
    detailsStartY + 24
  );

  yPos += 55;

  // =====================
  // COST SUMMARY SECTION
  // =====================
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("COST SUMMARY", margin + 5, yPos + 7);
  doc.setTextColor(0, 0, 0);
  yPos += 14;

  // Grand Total Box
  doc.setFillColor(34, 197, 94); // Green
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 22, 3, 3, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL", margin + 5, yPos + 8);
  doc.setFontSize(16);
  doc.text(`$${costs.grandTotal.toFixed(2)}`, pageWidth - margin - 5, yPos + 14, { align: "right" });
  doc.setTextColor(0, 0, 0);
  yPos += 28;

  // Cost Breakdown Table
  const costBreakdownData = [
    ["Category", "Items", "Cost"],
    ["Inventory Parts", String(costs.inventoryItemsCount), `$${costs.inventoryPartsCost.toFixed(2)}`],
    ["External Parts", String(costs.externalItemsCount), `$${costs.externalPartsCost.toFixed(2)}`],
    ["Services", String(costs.serviceItemsCount), `$${costs.servicesCost.toFixed(2)}`],
    ["SUBTOTAL (Parts & Services)", String(costs.totalPartsItems), `$${costs.totalPartsCost.toFixed(2)}`],
    ["Labor", `${costs.laborEntriesCount} entries (${costs.totalLaborHours.toFixed(1)}h)`, `$${costs.totalLaborCost.toFixed(2)}`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [costBreakdownData[0]],
    body: costBreakdownData.slice(1, 4),
    foot: [costBreakdownData[4], costBreakdownData[5]],
    theme: "grid",
    headStyles: {
      fillColor: [100, 100, 100],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 50, halign: "center" },
      2: { cellWidth: 50, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // =====================
  // TASKS SECTION
  // =====================
  if (data.tasks.length > 0) {
    // Check for page break
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`TASKS (${data.tasks.length})`, margin + 5, yPos + 7);
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    const tasksData = data.tasks.map((task) => [
      task.title.substring(0, 60),
      task.status.replace("_", " ").toUpperCase(),
      task.priority.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Task", "Status", "Priority"]],
      body: tasksData,
      theme: "striped",
      headStyles: {
        fillColor: [100, 100, 100],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 35, halign: "center" },
        2: { cellWidth: 35, halign: "center" },
      },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // =====================
  // PARTS & MATERIALS SECTION
  // =====================
  if (data.parts.length > 0) {
    // Check for page break
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`PARTS & MATERIALS (${data.parts.length})`, margin + 5, yPos + 7);
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    const partsData = data.parts.map((part) => {
      let source = "External";
      if (part.is_service) source = "Service";
      else if (part.is_from_inventory) source = "Inventory";

      return [
        part.part_name.substring(0, 35),
        part.part_number || "-",
        String(part.quantity),
        source,
        part.unit_price ? `$${part.unit_price.toFixed(2)}` : "-",
        part.total_price ? `$${part.total_price.toFixed(2)}` : "-",
        part.document_url ? "Yes" : "-",
      ];
    });

    // Add totals row
    partsData.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      `$${costs.totalPartsCost.toFixed(2)}`,
      "",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Part/Service", "Part #", "Qty", "Source", "Unit Price", "Total", "Doc"]],
      body: partsData.slice(0, -1),
      foot: [partsData[partsData.length - 1]],
      theme: "striped",
      headStyles: {
        fillColor: [100, 100, 100],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 7,
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 48 },
        1: { cellWidth: 22 },
        2: { cellWidth: 12, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 15, halign: "center" },
      },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // =====================
    // ATTACHMENTS LIST
    // =====================
    const partsWithDocs = data.parts.filter(p => p.document_url);
    if (partsWithDocs.length > 0) {
      // Check for page break
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(139, 92, 246); // Purple
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(`ATTACHED DOCUMENTS (${partsWithDocs.length})`, margin + 5, yPos + 7);
      doc.setTextColor(0, 0, 0);
      yPos += 14;

      const attachmentsData = partsWithDocs.map((part) => [
        part.part_name.substring(0, 40),
        part.document_name || "Document",
        part.total_price ? `$${part.total_price.toFixed(2)}` : "-",
        part.document_url || "",
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Part/Service", "Document Name", "Amount", "URL (for reference)"]],
        body: attachmentsData,
        theme: "striped",
        headStyles: {
          fillColor: [139, 92, 246],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        bodyStyles: {
          fontSize: 7,
        },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 40 },
          2: { cellWidth: 25, halign: "right" },
          3: { cellWidth: 60, overflow: "ellipsize" },
        },
        margin: { left: margin, right: margin },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // =====================
  // LABOR ENTRIES SECTION
  // =====================
  if (data.laborEntries.length > 0) {
    // Check for page break
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`LABOR ENTRIES (${data.laborEntries.length})`, margin + 5, yPos + 7);
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    const laborData = data.laborEntries.map((entry) => [
      entry.technician_name.substring(0, 25),
      entry.description?.substring(0, 30) || "-",
      format(new Date(entry.work_date), "MMM dd"),
      `${entry.hours_worked}h`,
      `$${entry.hourly_rate}/h`,
      `$${entry.total_cost.toFixed(2)}`,
    ]);

    // Add totals row
    laborData.push([
      "TOTAL",
      "",
      "",
      `${costs.totalLaborHours.toFixed(1)}h`,
      "",
      `$${costs.totalLaborCost.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Technician", "Description", "Date", "Hours", "Rate", "Total"]],
      body: laborData.slice(0, -1),
      foot: [laborData[laborData.length - 1]],
      theme: "striped",
      headStyles: {
        fillColor: [100, 100, 100],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 7,
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 50 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 25, halign: "right" },
      },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // =====================
  // DESCRIPTION SECTION
  // =====================
  if (data.jobCard.description) {
    // Check for page break
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("DESCRIPTION / NOTES", margin + 5, yPos + 7);
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const descriptionLines = doc.splitTextToSize(data.jobCard.description, pageWidth - 2 * margin - 10);
    doc.text(descriptionLines, margin + 5, yPos);
    yPos += descriptionLines.length * 4.5 + 10;
  }

  // =====================
  // NOTES / FEEDBACK SECTION
  // =====================
  if (data.notes && data.notes.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(234, 179, 8); // Yellow/amber
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`NOTES & FEEDBACK (${data.notes.length})`, margin + 5, yPos + 7);
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    const notesTableData = data.notes.map((note) => [
      note.created_at ? format(new Date(note.created_at), "MMM dd, yyyy HH:mm") : "-",
      note.created_by || "Unknown",
      note.note,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Date", "Author", "Note"]],
      body: notesTableData,
      theme: "striped",
      headStyles: {
        fillColor: [161, 121, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: pageWidth - 2 * margin - 65 },
      },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // =====================
  // LINKED INSPECTION SECTION
  // =====================
  if (data.inspection) {
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(14, 165, 233); // Sky blue
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("LINKED INSPECTION", margin + 5, yPos + 7);
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Inspection #: ${data.inspection.inspection_number}`, margin + 5, yPos);
    yPos += 5;
    doc.text(`Type: ${data.inspection.inspection_type}`, margin + 5, yPos);
    yPos += 5;
    doc.text(`Date: ${format(new Date(data.inspection.inspection_date), "MMM dd, yyyy")}`, margin + 5, yPos);
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Job Card #${data.jobCard.job_number} | Page ${i} of ${pageCount} | Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    doc.setTextColor(0, 0, 0);
  }

  // Save the PDF
  const fileName = `job-card-${data.jobCard.job_number}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}