import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** jsPDF instance with autoTable plugin properties */
type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

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
    inspector_name?: string | null;
    notes?: string | null;
    items?: Array<{
      item_name: string;
      status: string;
      notes: string | null;
      severity?: string | null;
    }>;
    faults?: Array<{
      fault_description: string;
      severity: string;
      corrective_action_status: string | null;
      corrective_action_notes: string | null;
    }>;
    oocReport?: {
      vehicle_id_or_license: string;
      make_model: string | null;
      year: string | null;
      odometer_hour_meter: string | null;
      location: string | null;
      reason_out_of_commission: string;
      immediate_plan: string[] | null;
      parts_required: Array<{
        partNameNumber: string;
        quantity: string;
        onHand: string;
        orderNeededBy: string;
      }> | null;
      additional_notes_safety_concerns: string | null;
      mechanic_name: string;
      report_date: string;
      report_time: string;
      sign_off_date: string | null;
    } | null;
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
 * Build a comprehensive PDF for a job card and return the doc + computed
 * file name without saving it. Useful for share/email flows that need the
 * raw blob or base64 payload.
 */
export function buildJobCardPDF(data: JobCardExportData): { doc: jsPDF; fileName: string } {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 15;

  const costs = calculateJobCardCosts(data);

  // ── Design tokens ────────────────────────────────────────────
  const ink: [number, number, number] = [15, 23, 42];        // slate-900
  const slate800: [number, number, number] = [30, 41, 59];
  const slate600: [number, number, number] = [71, 85, 105];
  const slate400: [number, number, number] = [148, 163, 184];
  const lineC: [number, number, number] = [226, 232, 240];   // slate-200 hairlines
  const bgSoft: [number, number, number] = [248, 250, 252];  // slate-50 panels
  const blue500: [number, number, number] = [37, 99, 235];   // brand accent
  const green600: [number, number, number] = [22, 163, 74];

  // Shared table look & feel — flat, subtle grid, zebra rows
  const baseTable = {
    theme: "grid" as const,
    styles: { lineColor: lineC, lineWidth: 0.15 },
    headStyles: {
      fillColor: slate800,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold" as const,
      fontSize: 7.5,
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 8, cellPadding: 3, textColor: ink },
    alternateRowStyles: { fillColor: bgSoft },
    footStyles: {
      fillColor: [241, 245, 249] as [number, number, number],
      textColor: slate800,
      fontStyle: "bold" as const,
      fontSize: 8,
      cellPadding: 3,
    },
    margin: { left: margin, right: margin },
  };

  // Helper: modern section header — accent bar + title + hairline rule
  const drawSectionHeader = (title: string, color: [number, number, number] = blue500) => {
    if (yPos > 240) { doc.addPage(); yPos = 20; }
    const t = title.toUpperCase();
    doc.setFillColor(...color);
    doc.roundedRect(margin, yPos - 1, 1.8, 7, 0.9, 0.9, "F");
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...ink);
    doc.text(t, margin + 5.5, yPos + 4.2);
    const tW = doc.getTextWidth(t);
    doc.setDrawColor(...lineC);
    doc.setLineWidth(0.3);
    doc.line(margin + 5.5 + tW + 4, yPos + 2.8, margin + contentWidth, yPos + 2.8);
    doc.setLineWidth(0.2);
    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);
    yPos += 12;
  };

  // Helper: smaller sub-section header
  const drawSubHeader = (title: string, color: [number, number, number]) => {
    doc.setFillColor(...color);
    doc.roundedRect(margin, yPos - 0.5, 1.5, 5.5, 0.75, 0.75, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...slate600);
    doc.text(title.toUpperCase(), margin + 4.5, yPos + 3.8);
    doc.setTextColor(0, 0, 0);
    yPos += 9;
  };

  // Helper: small uppercase label with value beneath (card fields)
  const drawLabelValue = (label: string, value: string, x: number, y: number) => {
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...slate400);
    doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ink);
    doc.text(value, x, y + 4.8);
    doc.setTextColor(0, 0, 0);
  };

  // Helper: status color
  const statusColor = (status: string): [number, number, number] => {
    const s = status.toLowerCase().replace(/[_\s]/g, "");
    if (["completed", "closed", "done", "fixed"].includes(s)) return [22, 163, 74];
    if (["inprogress", "active", "pending"].includes(s)) return [234, 179, 8];
    if (["open", "new", "notstarted"].includes(s)) return [59, 130, 246];
    if (["cancelled", "rejected", "notfixed"].includes(s)) return [220, 38, 38];
    return [100, 100, 100];
  };

  const priorityColor = (p: string): [number, number, number] => {
    const lp = p.toLowerCase();
    if (lp === "critical" || lp === "urgent") return [220, 38, 38];
    if (lp === "high") return [234, 88, 12];
    if (lp === "medium") return [234, 179, 8];
    return [22, 163, 74];
  };

  // =====================
  // HEADER BAR
  // =====================
  doc.setFillColor(...slate800);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setFillColor(...blue500);
  doc.rect(0, 42, pageWidth, 1.4, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...slate400);
  doc.text("MATANUSKA FLEET MANAGEMENT", margin, 11);

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("Job Card", margin, 23);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(147, 197, 253); // blue-300
  doc.text(`#${data.jobCard.job_number}`, margin, 32);

  // Status + Priority pills (top-right)
  const statusText = data.jobCard.status.replace(/_/g, " ").toUpperCase();
  const priorityText = data.jobCard.priority.toUpperCase();

  const sColor = statusColor(data.jobCard.status);
  const pColor = priorityColor(data.jobCard.priority);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  const stW = doc.getTextWidth(statusText) + 10;
  const prW = doc.getTextWidth(priorityText) + 10;
  const pillY = 11;

  doc.setFillColor(...sColor);
  doc.roundedRect(pageWidth - margin - stW - prW - 4, pillY, stW, 8, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, pageWidth - margin - prW - 4 - stW / 2, pillY + 5.4, { align: "center" });

  doc.setFillColor(...pColor);
  doc.roundedRect(pageWidth - margin - prW, pillY, prW, 8, 4, 4, "F");
  doc.text(priorityText, pageWidth - margin - prW / 2, pillY + 5.4, { align: "center" });

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...slate400);
  doc.text(`Generated ${format(new Date(), "dd MMM yyyy HH:mm")}`, pageWidth - margin, 36, { align: "right" });

  doc.setTextColor(0, 0, 0);
  yPos = 52;

  // =====================
  // JOB CARD DETAILS
  // =====================
  const detailsH = 46;
  doc.setDrawColor(...lineC);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, yPos, contentWidth, detailsH, 2.5, 2.5, "S");
  doc.setFillColor(...blue500);
  doc.rect(margin, yPos + 2, 1.2, detailsH - 4, "F");
  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);

  const col1 = margin + 7;
  const col2 = margin + contentWidth / 2 + 4;

  drawLabelValue("Title", data.jobCard.title.substring(0, 70), col1, yPos + 8);

  const vehicleText = data.vehicle
    ? `${data.vehicle.registration_number}${data.vehicle.make ? ` — ${data.vehicle.make} ${data.vehicle.model || ""}` : ""}`
    : "N/A";
  drawLabelValue("Vehicle", vehicleText.substring(0, 45), col1, yPos + 21);
  drawLabelValue("Assignee", data.jobCard.assignee || "Unassigned", col2, yPos + 21);
  drawLabelValue("Due Date", data.jobCard.due_date ? format(new Date(data.jobCard.due_date), "dd MMM yyyy") : "Not set", col1, yPos + 34);
  drawLabelValue("Created", data.jobCard.created_at ? format(new Date(data.jobCard.created_at), "dd MMM yyyy HH:mm") : "N/A", col2, yPos + 34);

  yPos += detailsH + 9;

  // =====================
  // COST SUMMARY SECTION
  // =====================
  drawSectionHeader("COST SUMMARY");

  // Grand Total banner
  doc.setFillColor(...green600);
  doc.roundedRect(margin, yPos, contentWidth, 18, 2.5, 2.5, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 252, 231); // green-100
  doc.text("GRAND TOTAL", margin + 7, yPos + 7.5);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${costs.totalPartsItems} part/service item${costs.totalPartsItems === 1 ? "" : "s"}  ·  ${costs.totalLaborHours.toFixed(1)} labor hours`,
    margin + 7,
    yPos + 13
  );
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`$${costs.grandTotal.toFixed(2)}`, pageWidth - margin - 7, yPos + 11.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  yPos += 23;

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
    ...baseTable,
    startY: yPos,
    head: [costBreakdownData[0]],
    body: costBreakdownData.slice(1, 4),
    foot: [costBreakdownData[4], costBreakdownData[5]],
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 50, halign: "center" },
      2: { cellWidth: 50, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });


  yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;

  // =====================
  // TASKS SECTION
  // =====================
  if (data.tasks.length > 0) {
    drawSectionHeader(`TASKS (${data.tasks.length})`);

    const tasksData = data.tasks.map((task) => [
      task.title.substring(0, 60),
      task.status.replace("_", " ").toUpperCase(),
      task.priority.toUpperCase(),
    ]);

    autoTable(doc, {
      ...baseTable,
      startY: yPos,
      head: [["Task", "Status", "Priority"]],
      body: tasksData,
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 35, halign: "center" },
        2: { cellWidth: 35, halign: "center" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.section === "body") {
          if (hookData.column.index === 1) {
            hookData.cell.styles.textColor = statusColor(hookData.cell.text[0]);
            hookData.cell.styles.fontStyle = "bold";
          }
          if (hookData.column.index === 2) {
            hookData.cell.styles.textColor = priorityColor(hookData.cell.text[0]);
            hookData.cell.styles.fontStyle = "bold";
          }
        }
      },
    });


    yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;
  }

  // =====================
  // PARTS & MATERIALS SECTION
  // =====================
  if (data.parts.length > 0) {
    drawSectionHeader(`PARTS & MATERIALS (${data.parts.length})`);

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
      ...baseTable,
      startY: yPos,
      head: [["Part/Service", "Part #", "Qty", "Source", "Unit Price", "Total", "Doc"]],
      body: partsData.slice(0, -1),
      foot: [partsData[partsData.length - 1]],
      headStyles: { ...baseTable.headStyles, fontSize: 7 },
      bodyStyles: { ...baseTable.bodyStyles, fontSize: 7, cellPadding: 2.5 },
      footStyles: { ...baseTable.footStyles, fontSize: 7 },
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


    yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;

    // =====================
    // ATTACHMENTS LIST
    // =====================
    const partsWithDocs = data.parts.filter(p => p.document_url);
    if (partsWithDocs.length > 0) {
      drawSectionHeader(`ATTACHED DOCUMENTS (${partsWithDocs.length})`, [139, 92, 246]);

      const attachmentsData = partsWithDocs.map((part) => [
        part.part_name.substring(0, 40),
        part.document_name || "Document",
        part.total_price ? `$${part.total_price.toFixed(2)}` : "-",
        part.document_url || "",
      ]);

      autoTable(doc, {
        ...baseTable,
        startY: yPos,
        head: [["Part/Service", "Document Name", "Amount", "URL (for reference)"]],
        body: attachmentsData,
        bodyStyles: { ...baseTable.bodyStyles, fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 40 },
          2: { cellWidth: 25, halign: "right" },
          3: { cellWidth: 60, overflow: "ellipsize" },
        },
        margin: { left: margin, right: margin },
      });


      yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;
    }
  }

  // =====================
  // LABOR ENTRIES SECTION
  // =====================
  if (data.laborEntries.length > 0) {
    drawSectionHeader(`LABOR ENTRIES (${data.laborEntries.length})`);

    const laborData = data.laborEntries.map((entry) => [
      entry.technician_name.substring(0, 25),
      entry.description?.substring(0, 30) || "-",
      format(new Date(entry.work_date), "dd MMM"),
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
      ...baseTable,
      startY: yPos,
      head: [["Technician", "Description", "Date", "Hours", "Rate", "Total"]],
      body: laborData.slice(0, -1),
      foot: [laborData[laborData.length - 1]],
      headStyles: { ...baseTable.headStyles, fontSize: 7 },
      bodyStyles: { ...baseTable.bodyStyles, fontSize: 7, cellPadding: 2.5 },
      footStyles: { ...baseTable.footStyles, fontSize: 7 },
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


    yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;
  }

  // =====================
  // DESCRIPTION SECTION
  // =====================
  if (data.jobCard.description) {
    drawSectionHeader("DESCRIPTION", slate800);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const descriptionLines = doc.splitTextToSize(data.jobCard.description, contentWidth - 14);
    const descH = descriptionLines.length * 4.5 + 9;
    doc.setFillColor(...bgSoft);
    doc.setDrawColor(...lineC);
    doc.roundedRect(margin, yPos - 3, contentWidth, descH, 2, 2, "FD");
    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(...slate600);
    doc.text(descriptionLines, margin + 7, yPos + 2.5);
    doc.setTextColor(0, 0, 0);
    yPos += descH + 7;
  }

  // =====================
  // NOTES / FEEDBACK SECTION
  // =====================
  if (data.notes && data.notes.length > 0) {
    drawSectionHeader(`NOTES & FOLLOW-UPS (${data.notes.length})`, [234, 179, 8]);

    const notesTableData = data.notes.map((note) => [
      note.created_at ? format(new Date(note.created_at), "dd MMM yyyy HH:mm") : "-",
      note.created_by || "Unknown",
      note.note,
    ]);

    autoTable(doc, {
      ...baseTable,
      startY: yPos,
      head: [["Date", "Author", "Note"]],
      body: notesTableData,
      headStyles: { ...baseTable.headStyles, fontSize: 7 },
      bodyStyles: { ...baseTable.bodyStyles, fontSize: 7, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: contentWidth - 65 },
      },
      margin: { left: margin, right: margin },
    });


    yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;
  }

  // =====================
  // LINKED INSPECTION SECTION
  // =====================
  if (data.inspection) {
    drawSectionHeader("LINKED INSPECTION", [14, 165, 233]);

    // Inspection details card
    doc.setFillColor(...bgSoft);
    doc.setDrawColor(...lineC);
    doc.roundedRect(margin, yPos, contentWidth, 30, 2.5, 2.5, "FD");
    doc.setDrawColor(0, 0, 0);

    const insCol1 = margin + 7;
    const insCol2 = margin + contentWidth / 2 + 4;

    drawLabelValue("Inspection #", data.inspection.inspection_number, insCol1, yPos + 8);
    drawLabelValue("Type", data.inspection.inspection_type, insCol2, yPos + 8);
    drawLabelValue("Date", format(new Date(data.inspection.inspection_date), "dd MMM yyyy"), insCol1, yPos + 21);

    if (data.inspection.inspector_name) {
      drawLabelValue("Inspector", data.inspection.inspector_name, insCol2, yPos + 21);
    }
    yPos += 36;

    // Inspection notes
    if (data.inspection.notes) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Inspection Notes:", margin + 5, yPos);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      const inspNotesLines = doc.splitTextToSize(data.inspection.notes, pageWidth - 2 * margin - 10);
      doc.text(inspNotesLines, margin + 5, yPos);
      yPos += inspNotesLines.length * 4.5 + 6;
    }

    // Inspection items table
    if (data.inspection.items && data.inspection.items.length > 0) {
      if (yPos > 210) { doc.addPage(); yPos = 20; }

      drawSubHeader(`Inspection Items (${data.inspection.items.length})`, [14, 165, 233]);

      const itemsData = data.inspection.items.map((item) => [
        item.item_name,
        item.status.toUpperCase(),
        item.severity?.toUpperCase() || "-",
        item.notes || "-",
      ]);

      autoTable(doc, {
        ...baseTable,
        startY: yPos,
        head: [["Item", "Status", "Severity", "Notes"]],
        body: itemsData,
        headStyles: { ...baseTable.headStyles, fontSize: 7 },
        bodyStyles: { ...baseTable.bodyStyles, fontSize: 7, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 25, halign: "center" },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: contentWidth - 100 },
        },
        margin: { left: margin, right: margin },
        didParseCell: (hookData) => {
          if (hookData.column.index === 1 && hookData.section === "body") {
            const status = hookData.cell.text[0];
            if (status === "FAIL") {
              hookData.cell.styles.textColor = [220, 38, 38];
              hookData.cell.styles.fontStyle = "bold";
            } else if (status === "ATTENTION") {
              hookData.cell.styles.textColor = [234, 179, 8];
              hookData.cell.styles.fontStyle = "bold";
            } else if (status === "PASS") {
              hookData.cell.styles.textColor = [22, 163, 74];
            }
          }
        },
      });


      yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;
    }

    // Inspection faults table
    if (data.inspection.faults && data.inspection.faults.length > 0) {
      if (yPos > 210) { doc.addPage(); yPos = 20; }

      drawSubHeader(`Inspection Faults (${data.inspection.faults.length})`, [234, 88, 12]);

      const faultsData = data.inspection.faults.map((f) => [
        f.fault_description,
        f.severity.toUpperCase(),
        (f.corrective_action_status || "pending").replace("_", " ").toUpperCase(),
        f.corrective_action_notes || "-",
      ]);

      autoTable(doc, {
        ...baseTable,
        startY: yPos,
        head: [["Fault", "Severity", "Status", "Action Notes"]],
        body: faultsData,
        headStyles: { ...baseTable.headStyles, fontSize: 7 },
        bodyStyles: { ...baseTable.bodyStyles, fontSize: 7, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 25, halign: "center" },
          2: { cellWidth: 30, halign: "center" },
          3: { cellWidth: contentWidth - 110 },
        },
        margin: { left: margin, right: margin },
        didParseCell: (hookData) => {
          if (hookData.column.index === 2 && hookData.section === "body") {
            const status = hookData.cell.text[0];
            if (status === "FIXED" || status === "COMPLETED") {
              hookData.cell.styles.textColor = [22, 163, 74];
            } else if (status === "PENDING") {
              hookData.cell.styles.textColor = [234, 179, 8];
              hookData.cell.styles.fontStyle = "bold";
            } else if (status === "NOT FIXED") {
              hookData.cell.styles.textColor = [220, 38, 38];
            }
          }
        },
      });


      yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;
    }

    // Out of Commission Report section
    if (data.inspection.oocReport) {
      if (yPos > 200) { doc.addPage(); yPos = 20; }
      const ooc = data.inspection.oocReport;

      drawSubHeader("Out of Commission Report", [220, 38, 38]);

      // OOC details card
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(margin, yPos, contentWidth, 30, 2.5, 2.5, "FD");
      doc.setDrawColor(0, 0, 0);

      const oocCol1 = margin + 7;
      const oocCol2 = margin + contentWidth / 2 + 4;

      drawLabelValue("Vehicle", ooc.vehicle_id_or_license, oocCol1, yPos + 8);
      drawLabelValue("Report Date", format(new Date(ooc.report_date), "dd MMM yyyy"), oocCol2, yPos + 8);
      drawLabelValue("Location", ooc.location || "N/A", oocCol1, yPos + 21);
      drawLabelValue("Mechanic", ooc.mechanic_name, oocCol2, yPos + 21);

      yPos += 36;

      // Reason
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...slate600);
      doc.text("Reason Out of Commission:", margin + 5, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      const reasonLines = doc.splitTextToSize(ooc.reason_out_of_commission, contentWidth - 10);
      doc.text(reasonLines, margin + 5, yPos);
      yPos += reasonLines.length * 4.5 + 6;

      // Immediate plan
      if (ooc.immediate_plan && ooc.immediate_plan.length > 0) {
        if (yPos > 230) { doc.addPage(); yPos = 20; }
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...slate600);
        doc.text("Immediate Plan:", margin + 5, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        ooc.immediate_plan.forEach((step, i) => {
          if (yPos > 270) { doc.addPage(); yPos = 20; }
          const stepLines = doc.splitTextToSize(`${i + 1}. ${step}`, contentWidth - 15);
          doc.text(stepLines, margin + 10, yPos);
          yPos += stepLines.length * 4.5 + 2;
        });
        yPos += 4;
      }

      // Parts required
      if (ooc.parts_required && ooc.parts_required.length > 0) {
        if (yPos > 230) { doc.addPage(); yPos = 20; }

        doc.setFont("helvetica", "bold");
        doc.text(`Parts Required (${ooc.parts_required.length}):`, margin + 5, yPos);
        yPos += 5;

        const oocPartsData = ooc.parts_required.map((p) => [
          p.partNameNumber,
          p.quantity,
          p.onHand === "yes" ? "Yes" : "No",
          p.orderNeededBy || "-",
        ]);

        autoTable(doc, {
          ...baseTable,
          startY: yPos,
          head: [["Part Name / Number", "Qty", "On Hand", "Order Needed By"]],
          body: oocPartsData,
          bodyStyles: { ...baseTable.bodyStyles, fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 65 },
            1: { cellWidth: 20, halign: "center" },
            2: { cellWidth: 20, halign: "center" },
            3: { cellWidth: 35 },
          },
          margin: { left: margin, right: margin },
        });


        yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;
      }

      // Additional notes
      if (ooc.additional_notes_safety_concerns) {
        if (yPos > 240) { doc.addPage(); yPos = 20; }
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...slate600);
        doc.text("Additional Notes / Safety Concerns:", margin + 5, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        const addNotesLines = doc.splitTextToSize(ooc.additional_notes_safety_concerns, contentWidth - 10);
        doc.text(addNotesLines, margin + 5, yPos);
        yPos += addNotesLines.length * 4.5 + 8;
      }
    }
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...lineC);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    doc.setLineWidth(0.2);
    doc.setFontSize(7);
    doc.setTextColor(...slate400);
    doc.text("Matanuska Fleet Management  ·  Confidential", margin, pageHeight - 10);
    doc.text(
      `Job Card #${data.jobCard.job_number}  ·  ${format(new Date(), "dd MMM yyyy HH:mm")}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  }

  // Save the PDF
  const fileName = `job-card-${data.jobCard.job_number}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  return { doc, fileName };
}

/**
 * Generate and download a comprehensive PDF for a job card.
 */
export function generateJobCardPDF(data: JobCardExportData): void {
  const { doc, fileName } = buildJobCardPDF(data);
  doc.save(fileName);
}