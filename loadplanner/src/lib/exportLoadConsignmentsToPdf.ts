import type { LoadConsignment } from "@/hooks/useLoadConsignments";
import { format, parseISO } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Status labels with proper formatting
const statusLabels: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  "in-transit": "In Transit",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Company branding
const COMPANY_NAME = "MATANUSKA PTY LTD";
const COMPANY_REG = "Registration: 2020/123456/07";
const COMPANY_VAT = "VAT: 4870123456";

// Color palette - Professional corporate colors
const colors = {
  primary: [0, 63, 92] as [number, number, number], // Dark blue - Matanuska brand
  secondary: [51, 51, 51] as [number, number, number], // Dark gray
  accent: [0, 153, 51] as [number, number, number], // Green for success
  warning: [255, 153, 0] as [number, number, number], // Orange for warnings
  danger: [204, 0, 0] as [number, number, number], // Red for cancelled
  lightBg: [249, 250, 251] as [number, number, number], // Very light gray
  border: [221, 221, 221] as [number, number, number], // Light gray
  text: {
    primary: [51, 51, 51] as [number, number, number],
    secondary: [102, 102, 102] as [number, number, number],
    light: [153, 153, 153] as [number, number, number],
  },
};

// Type for the autoTable plugin
interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

export function exportLoadConsignmentsToPdf(
  consignments: LoadConsignment[],
  filters: {
    status?: string;
    searchQuery?: string;
  } = {}
): void {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  }) as JsPDFWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 15;

  // Helper function to draw a line separator
  const drawLine = (y: number, style: "solid" | "dashed" = "solid"): void => {
    if (style === "dashed") {
      doc.setLineDashPattern([2, 2], 0);
    } else {
      doc.setLineDashPattern([], 0);
    }
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
  };

  // Helper to add section header
  const addSectionHeader = (title: string): number => {
    doc.setTextColor(...colors.primary);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, yPos);

    // Underline
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos + 1, margin + 50, yPos + 1);

    doc.setTextColor(...colors.text.primary);
    doc.setFont("helvetica", "normal");
    return yPos + 8;
  };

  // ========== HEADER SECTION ==========
  // Top border with company color
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Company name
  doc.setTextColor(...colors.primary);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY_NAME, margin, 15);

  // Registration and VAT
  doc.setTextColor(...colors.text.secondary);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${COMPANY_REG} | ${COMPANY_VAT}`, margin, 22);

  // Document title
  doc.setTextColor(...colors.primary);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("LOAD CONFIRMATION", pageWidth - margin, 15, { align: "right" });

  // Reference and date
  const refNumber = `LC-${format(new Date(), "yyyyMMdd")}-${String(consignments.length).padStart(3, "0")}`;
  doc.setTextColor(...colors.text.secondary);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Ref: ${refNumber} | Date: ${format(new Date(), "dd MMM yyyy")}`, pageWidth - margin, 22, { align: "right" });

  // Separator line
  drawLine(28);
  yPos = 35;

  // ========== FILTERS SECTION (if any) ==========
  if (filters.status || filters.searchQuery) {
    doc.setTextColor(...colors.text.secondary);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    const filterParts: string[] = [];
    if (filters.status) {
      filterParts.push(`Status: ${statusLabels[filters.status] || filters.status}`);
    }
    if (filters.searchQuery) {
      filterParts.push(`Search: "${filters.searchQuery}"`);
    }
    doc.text(`Filters: ${filterParts.join(" • ")}`, margin, yPos);
    yPos += 6;
  }

  // ========== CONSIGNMENTS TABLE ==========
  if (consignments.length > 0) {
    yPos = addSectionHeader("CONSIGNMENT DETAILS");

    // Prepare table data - DON'T truncate important information
    const tableData = consignments.map((consignment, index) => {
      const statusDisplay = statusLabels[consignment.status] || consignment.status;

      // Format currency
      const amount = consignment.total_amount !== null
        ? `${consignment.rate_currency === 'USD' ? 'US$' : 'R'} ${consignment.total_amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
        : "—";

      return [
        String(index + 1),
        consignment.consignment_number, // Full consignment number
        consignment.supplier_name || "—", // Full supplier name - THIS IS IMPORTANT
        consignment.origin, // Full origin
        consignment.destination, // Full destination
        consignment.loading_date ? format(parseISO(consignment.loading_date), "dd MMM yyyy") : "—",
        statusDisplay,
        amount,
      ];
    });

    // Calculate column widths to prioritize important columns
    // Total available width = pageWidth - (2 * margin) = 297 - 30 = 267mm
    autoTable(doc, {
      startY: yPos,
      head: [
        ["#", "Consignment #", "Supplier", "Origin", "Destination", "Load Date", "Status", "Amount"],
      ],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: colors.border,
        lineWidth: 0.1,
        textColor: colors.text.primary,
        valign: "middle",
        overflow: "linebreak",
        cellWidth: 'wrap',
      },
      headStyles: {
        fillColor: colors.primary,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: colors.lightBg,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" as const }, // #
        1: { cellWidth: 35, halign: "left" as const }, // Consignment # - increased from 22 to 35
        2: { cellWidth: 45, halign: "left" as const }, // Supplier - increased from 30 to 45
        3: { cellWidth: 40, halign: "left" as const }, // Origin - increased from 28 to 40
        4: { cellWidth: 40, halign: "left" as const }, // Destination - increased from 28 to 40
        5: { cellWidth: 25, halign: "center" as const }, // Load Date - increased from 16 to 25
        6: { cellWidth: 20, halign: "center" as const }, // Status - increased from 16 to 20
        7: { cellWidth: 32, halign: "right" as const, fontStyle: "bold" as const }, // Amount - increased from 24 to 32
      },
      didDrawPage: (data) => {
        // Add page number at bottom
        doc.setTextColor(...colors.text.light);
        doc.setFontSize(6);
        doc.text(
          `Page ${data.pageNumber}`,
          pageWidth - margin,
          pageHeight - 10,
          { align: "right" }
        );
      },
    });

    yPos = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : yPos + 10;

    // ========== SUMMARY SECTION ==========
    if (consignments.length > 0) {
      const totalValue = consignments
        .filter(c => c.total_amount !== null)
        .reduce((sum, c) => sum + (c.total_amount || 0), 0);

      const pendingCount = consignments.filter(c => c.status === "pending").length;
      const inTransitCount = consignments.filter(c => c.status === "in-transit").length;
      const deliveredCount = consignments.filter(c => c.status === "delivered" || c.status === "completed").length;

      doc.setFillColor(248, 249, 250);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 20, 1, 1, "F");

      doc.setTextColor(...colors.primary);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("SUMMARY", margin + 5, yPos + 6);

      doc.setTextColor(...colors.text.secondary);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");

      // Spread out summary information
      doc.text(`Total: ${consignments.length}`, margin + 30, yPos + 6);
      doc.text(`Pending: ${pendingCount}`, margin + 60, yPos + 6);
      doc.text(`In Transit: ${inTransitCount}`, margin + 90, yPos + 6);
      doc.text(`Delivered: ${deliveredCount}`, margin + 120, yPos + 6);

      const currencySymbol = consignments[0]?.rate_currency === 'USD' ? 'US$' : 'R';
      doc.setFont("helvetica", "bold");
      doc.text(
        `Total Value: ${currencySymbol} ${totalValue.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        pageWidth - margin - 60,
        yPos + 6
      );

      yPos += 25;
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...colors.text.light);
    doc.setFont("helvetica", "italic");
    doc.text(
      "No consignments found.",
      pageWidth / 2,
      yPos + 15,
      { align: "center" }
    );
  }

  // ========== FOOTER ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setTextColor(...colors.text.light);
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generated by Matanuska Transport System • ${format(new Date(), "dd MMM yyyy HH:mm")}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" }
    );
  }

  // Save the PDF
  const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
  doc.save(`Matanuska_Load_Confirmation_${timestamp}.pdf`);
}