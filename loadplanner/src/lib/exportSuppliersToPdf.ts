import type { Supplier } from "@/hooks/useSuppliers";
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

  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const _headerBg: [number, number, number] = [241, 245, 249]; // Light gray
  const _successColor: [number, number, number] = [34, 197, 94]; // Green

  // Helper to add section header
  const addSectionHeader = (
    title: string,
    color: [number, number, number] = primaryColor,
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
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("SUPPLIERS REPORT", margin, 18);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`,
    margin,
    28,
  );

  // Add filters info if any
  if (filters.status || filters.searchQuery) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    let filterText = "Filters: ";
    if (filters.status) {
      filterText += `Status: ${filters.status}, `;
    }
    if (filters.searchQuery) {
      filterText += `Search: "${filters.searchQuery}"`;
    }
    // Remove trailing comma and space
    filterText = filterText.replace(/, $/, "");
    doc.text(filterText, margin, 34);
  }

  yPos = 50;
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
      headStyles: { fillColor: [...primaryColor], textColor: [255, 255, 255] },
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
      "LoadFlow - Load Management System",
      margin,
      doc.internal.pageSize.getHeight() - 10,
    );
  }

  // Save the PDF
  doc.save(`suppliers-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}