import type { Supplier } from "@/hooks/useSuppliers";
import { COMPANY_NAME, SYSTEM_NAME, pdfColors } from "@/lib/exportStyles";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Status labels
const statusLabels: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

export function exportSuppliersToPdf(
  suppliers: Supplier[],
  filters: {
    status?: string;
    searchQuery?: string;
  } = {}
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Helper to add section header
  const addSectionHeader = (
    title: string,
    color: [number, number, number] = pdfColors.blue,
  ): number => {
    doc.setFillColor(...color);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 4, yPos + 5.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    return yPos + 12;
  };

  // Helper to add key-value row
  const addKeyValue = (
    key: string,
    value: string,
    y: number,
    width = 60,
  ): number => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(key, margin + 4, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value || "-", margin + width, y);
    return y + 6;
  };

  // ========== HEADER ==========
  // Top accent strip
  doc.setFillColor(...pdfColors.navy);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Company name
  doc.setTextColor(...pdfColors.navy);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY_NAME, margin, 14);

  // System subtitle
  doc.setTextColor(...pdfColors.textMuted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(SYSTEM_NAME, margin, 19);

  // Document title (right-aligned)
  doc.setTextColor(...pdfColors.navy);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("SUPPLIERS REPORT", pageWidth - margin, 14, { align: "right" });

  // Generated date (right-aligned)
  doc.setTextColor(...pdfColors.textMuted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`,
    pageWidth - margin,
    19,
    { align: "right" },
  );

  // Separator line
  doc.setDrawColor(...pdfColors.navy);
  doc.setLineWidth(0.5);
  doc.line(margin, 23, pageWidth - margin, 23);

  // Add filters info if any
  if (filters.status || filters.searchQuery) {
    doc.setFontSize(8);
    doc.setTextColor(...pdfColors.textMuted);
    doc.setFont("helvetica", "italic");
    const filterParts: string[] = [];
    if (filters.status) filterParts.push(`Status: ${filters.status}`);
    if (filters.searchQuery) filterParts.push(`Search: "${filters.searchQuery}"`);
    doc.text(`Filters: ${filterParts.join(" • ")}`, margin, 28);
  }

  yPos = 34;
  doc.setTextColor(0, 0, 0);

  // ========== SUMMARY ==========
  yPos = addSectionHeader("Summary");
  const totalSuppliers = suppliers.length;
  const activeCount = suppliers.filter(s => s.status === "active").length;
  const inactiveCount = suppliers.filter(s => s.status === "inactive").length;
  const suspendedCount = suppliers.filter(s => s.status === "suspended").length;

  const ratedSuppliers = suppliers.filter(s => s.rating !== null && s.rating !== undefined);
  const avgRating = ratedSuppliers.length > 0
    ? ratedSuppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / ratedSuppliers.length
    : 0;

  doc.setFontSize(9);
  yPos = addKeyValue("Total Suppliers:", totalSuppliers.toString(), yPos);
  yPos = addKeyValue("Active:", activeCount.toString(), yPos);
  yPos = addKeyValue("Inactive:", inactiveCount.toString(), yPos);
  yPos = addKeyValue("Suspended:", suspendedCount.toString(), yPos);
  yPos = addKeyValue("Average Rating:", avgRating.toFixed(1), yPos);
  yPos += 8;

  // ========== SUPPLIERS TABLE ==========
  if (suppliers.length > 0) {
    yPos = addSectionHeader("Suppliers List");

    // Prepare table data
    const tableData = suppliers.map(supplier => [
      supplier.supplier_number || "N/A",
      supplier.name,
      supplier.contact_person || "-",
      supplier.contact_phone || "-",
      supplier.city || "-",
      statusLabels[supplier.status] || supplier.status,
      supplier.rating !== null && supplier.rating !== undefined
        ? `${supplier.rating}/5`
        : "-",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [
        ["Supplier #", "Name", "Contact Person", "Phone", "City", "Status", "Rating"]
      ],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [...pdfColors.navy], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 },
        6: { cellWidth: 15 },
      },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("No suppliers found matching the criteria.", margin, yPos);
    yPos += 10;
  }

  // ========== FOOTER ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" },
    );
    doc.text(
      SYSTEM_NAME,
      margin,
      doc.internal.pageSize.getHeight() - 10,
    );
  }

  // Save the PDF
  doc.save(`suppliers-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}