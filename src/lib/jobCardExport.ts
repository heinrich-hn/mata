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
 * Generate a comprehensive PDF for a job card
 */
export function generateJobCardPDF(data: JobCardExportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 15;

  const costs = calculateJobCardCosts(data);

  // Color palette
  const slate800: [number, number, number] = [30, 41, 59];
  const slate600: [number, number, number] = [71, 85, 105];
  const blue500: [number, number, number] = [59, 130, 246];

  // Helper: draw section header
  const drawSectionHeader = (title: string, color: [number, number, number] = blue500) => {
    if (yPos > 240) { doc.addPage(); yPos = 20; }
    doc.setFillColor(...color);
    doc.roundedRect(margin, yPos, contentWidth, 9, 1.5, 1.5, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 4, yPos + 6.5);
    doc.setTextColor(0, 0, 0);
    yPos += 13;
  };

  // Helper: labelled field
  const drawField = (label: string, value: string, x: number, y: number, labelW = 30) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...slate600);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value, x + labelW, y);
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
  doc.rect(0, 0, pageWidth, 38, "F");

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("JOB CARD", margin, 16);

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(`#${data.jobCard.job_number}`, margin, 26);

  doc.setFontSize(8);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, pageWidth - margin, 34, { align: "right" });

  // Status + Priority pills on header
  const statusText = data.jobCard.status.replace(/_/g, " ").toUpperCase();
  const priorityText = data.jobCard.priority.toUpperCase();

  const sColor = statusColor(data.jobCard.status);
  const pColor = priorityColor(data.jobCard.priority);

  // Status pill
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const stW = doc.getTextWidth(statusText) + 8;
  const prW = doc.getTextWidth(priorityText) + 8;
  const pillY = 10;

  doc.setFillColor(...sColor);
  doc.roundedRect(pageWidth - margin - stW - prW - 6, pillY, stW, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, pageWidth - margin - stW - prW - 6 + 4, pillY + 5.5);

  // Priority pill
  doc.setFillColor(...pColor);
  doc.roundedRect(pageWidth - margin - prW, pillY, prW, 8, 2, 2, "F");
  doc.text(priorityText, pageWidth - margin - prW + 4, pillY + 5.5);

  doc.setTextColor(0, 0, 0);
  yPos = 48;

  // =====================
  // JOB CARD DETAILS
  // =====================
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, yPos, contentWidth, 40, 3, 3, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, yPos, contentWidth, 40, 3, 3, "S");
  doc.setDrawColor(0, 0, 0);

  doc.setFontSize(9);
  const col1 = margin + 6;
  const col2 = margin + contentWidth / 2 + 4;
  let fy = yPos + 8;

  drawField("Title:", data.jobCard.title.substring(0, 55), col1, fy, 22);
  fy += 8;

  const vehicleText = data.vehicle
    ? `${data.vehicle.registration_number}${data.vehicle.make ? ` — ${data.vehicle.make} ${data.vehicle.model || ""}` : ""}`
    : "N/A";
  drawField("Vehicle:", vehicleText.substring(0, 50), col1, fy, 22);
  drawField("Assignee:", data.jobCard.assignee || "Unassigned", col2, fy, 26);
  fy += 8;

  drawField("Due Date:", data.jobCard.due_date ? format(new Date(data.jobCard.due_date), "dd MMM yyyy") : "Not set", col1, fy, 26);
  drawField("Created:", data.jobCard.created_at ? format(new Date(data.jobCard.created_at), "dd MMM yyyy HH:mm") : "N/A", col2, fy, 26);
  fy += 8;

  // Thin accent line under details box
  doc.setDrawColor(...blue500);
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + 40, margin + contentWidth, yPos + 40);
  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);

  yPos += 48;

  // =====================
  // COST SUMMARY SECTION
  // =====================
  drawSectionHeader("COST SUMMARY");

  // Grand Total Box
  doc.setFillColor(22, 163, 74);
  doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL", margin + 6, yPos + 7);
  doc.setFontSize(15);
  doc.text(`$${costs.grandTotal.toFixed(2)}`, pageWidth - margin - 6, yPos + 12, { align: "right" });
  doc.setTextColor(0, 0, 0);
  yPos += 22;

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
      fillColor: slate800,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: slate800,
      fontStyle: "bold",
      fontSize: 8,
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
    drawSectionHeader(`TASKS (${data.tasks.length})`);

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
        fillColor: slate800,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3,
      },
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;
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
      startY: yPos,
      head: [["Part/Service", "Part #", "Qty", "Source", "Unit Price", "Total", "Doc"]],
      body: partsData.slice(0, -1),
      foot: [partsData[partsData.length - 1]],
      theme: "striped",
      headStyles: {
        fillColor: slate800,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2.5,
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: slate800,
        fontStyle: "bold",
        fontSize: 7,
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
      drawSectionHeader(`ATTACHED DOCUMENTS (${partsWithDocs.length})`, [139, 92, 246]);

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
      startY: yPos,
      head: [["Technician", "Description", "Date", "Hours", "Rate", "Total"]],
      body: laborData.slice(0, -1),
      foot: [laborData[laborData.length - 1]],
      theme: "striped",
      headStyles: {
        fillColor: slate800,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2.5,
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: slate800,
        fontStyle: "bold",
        fontSize: 7,
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
    drawSectionHeader("DESCRIPTION", slate800);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const descriptionLines = doc.splitTextToSize(data.jobCard.description, contentWidth - 10);
    doc.text(descriptionLines, margin + 5, yPos);
    yPos += descriptionLines.length * 4.5 + 10;
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
      startY: yPos,
      head: [["Date", "Author", "Note"]],
      body: notesTableData,
      theme: "striped",
      headStyles: {
        fillColor: [161, 121, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2.5,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: contentWidth - 65 },
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
    drawSectionHeader("LINKED INSPECTION", [14, 165, 233]);

    // Inspection details box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, contentWidth, 22, 3, 3, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPos, contentWidth, 22, 3, 3, "S");
    doc.setDrawColor(0, 0, 0);

    doc.setFontSize(9);
    const insCol1 = margin + 6;
    const insCol2 = margin + contentWidth / 2 + 4;

    drawField("Inspection #:", data.inspection.inspection_number, insCol1, yPos + 7, 34);
    drawField("Type:", data.inspection.inspection_type, insCol2, yPos + 7, 20);
    drawField("Date:", format(new Date(data.inspection.inspection_date), "dd MMM yyyy"), insCol1, yPos + 15, 20);

    if (data.inspection.inspector_name) {
      drawField("Inspector:", data.inspection.inspector_name, insCol2, yPos + 15, 28);
    }
    yPos += 28;

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

      doc.setFillColor(14, 165, 233);
      doc.roundedRect(margin, yPos, contentWidth, 9, 1.5, 1.5, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(`INSPECTION ITEMS (${data.inspection.items.length})`, margin + 4, yPos + 6.5);
      doc.setTextColor(0, 0, 0);
      yPos += 13;

      const itemsData = data.inspection.items.map((item) => [
        item.item_name,
        item.status.toUpperCase(),
        item.severity?.toUpperCase() || "-",
        item.notes || "-",
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Item", "Status", "Severity", "Notes"]],
        body: itemsData,
        theme: "striped",
        headStyles: {
          fillColor: [14, 165, 233],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7,
        },
        bodyStyles: { fontSize: 7, cellPadding: 2.5 },
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Inspection faults table
    if (data.inspection.faults && data.inspection.faults.length > 0) {
      if (yPos > 210) { doc.addPage(); yPos = 20; }

      doc.setFillColor(234, 88, 12);
      doc.roundedRect(margin, yPos, contentWidth, 9, 1.5, 1.5, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(`INSPECTION FAULTS (${data.inspection.faults.length})`, margin + 4, yPos + 6.5);
      doc.setTextColor(0, 0, 0);
      yPos += 13;

      const faultsData = data.inspection.faults.map((f) => [
        f.fault_description,
        f.severity.toUpperCase(),
        (f.corrective_action_status || "pending").replace("_", " ").toUpperCase(),
        f.corrective_action_notes || "-",
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Fault", "Severity", "Status", "Action Notes"]],
        body: faultsData,
        theme: "striped",
        headStyles: {
          fillColor: [234, 88, 12],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7,
        },
        bodyStyles: { fontSize: 7, cellPadding: 2.5 },
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Out of Commission Report section
    if (data.inspection.oocReport) {
      if (yPos > 200) { doc.addPage(); yPos = 20; }
      const ooc = data.inspection.oocReport;

      doc.setFillColor(220, 38, 38);
      doc.roundedRect(margin, yPos, contentWidth, 9, 1.5, 1.5, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("OUT OF COMMISSION REPORT", margin + 4, yPos + 6.5);
      doc.setTextColor(0, 0, 0);
      yPos += 13;

      // OOC details
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(margin, yPos, contentWidth, 22, 3, 3, "F");
      doc.setFontSize(9);
      const oocCol1 = margin + 6;
      const oocCol2 = margin + contentWidth / 2 + 4;

      drawField("Vehicle:", ooc.vehicle_id_or_license, oocCol1, yPos + 7, 25);
      drawField("Report Date:", format(new Date(ooc.report_date), "dd MMM yyyy"), oocCol2, yPos + 7, 34);
      drawField("Location:", ooc.location || "N/A", oocCol1, yPos + 15, 25);
      drawField("Mechanic:", ooc.mechanic_name, oocCol2, yPos + 15, 28);

      yPos += 28;

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
          startY: yPos,
          head: [["Part Name / Number", "Qty", "On Hand", "Order Needed By"]],
          body: oocPartsData,
          theme: "striped",
          headStyles: {
            fillColor: [100, 100, 100],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 8,
          },
          bodyStyles: { fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 65 },
            1: { cellWidth: 20, halign: "center" },
            2: { cellWidth: 20, halign: "center" },
            3: { cellWidth: 35 },
          },
          margin: { left: margin, right: margin },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yPos = (doc as any).lastAutoTable.finalY + 8;
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
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Job Card #${data.jobCard.job_number}  |  Page ${i} of ${pageCount}  |  Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    doc.text("Confidential — Matanuska Fleet Management", margin, pageHeight - 10);
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  }

  // Save the PDF
  const fileName = `job-card-${data.jobCard.job_number}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}