// src/lib/inspectionPdfExport.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InspectionData {
  inspection_number: string;
  inspection_date: string;
  vehicle_registration: string;
  vehicle_make?: string;
  vehicle_model?: string;
  inspector_name: string;
  fault_count: number;
  corrective_action_status: string;
  linked_work_order?: string;
  inspection_type?: string;
  notes?: string;
  status: string;
  template_name?: string;
}

interface InspectionItem {
  item_name: string;
  status: string;
  notes?: string;
  severity?: string;
}

/**
 * Generate a PDF report for a vehicle inspection
 */
export async function generateInspectionPDF(
  inspection: InspectionData,
  items?: InspectionItem[]
): Promise<void> {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('Vehicle Inspection Report', 105, 20, { align: 'center' });

  // Company info (if needed)
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Matanuska - Fleet Management System', 105, 28, { align: 'center' });

  // Inspection details section
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text('Inspection Details', 14, 45);

  // Draw a line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 48, 196, 48);

  // Inspection information
  doc.setFontSize(10);
  const detailsStartY = 56;
  const leftColX = 14;
  const rightColX = 110;

  // Left column
  doc.setFont(undefined, 'bold');
  doc.text('Inspection Number:', leftColX, detailsStartY);
  doc.setFont(undefined, 'normal');
  doc.text(inspection.inspection_number, leftColX + 45, detailsStartY);

  doc.setFont(undefined, 'bold');
  doc.text('Vehicle:', leftColX, detailsStartY + 8);
  doc.setFont(undefined, 'normal');
  const vehicleInfo = inspection.vehicle_make && inspection.vehicle_model
    ? `${inspection.vehicle_registration} (${inspection.vehicle_make} ${inspection.vehicle_model})`
    : inspection.vehicle_registration;
  doc.text(vehicleInfo, leftColX + 45, detailsStartY + 8);

  doc.setFont(undefined, 'bold');
  doc.text('Inspector:', leftColX, detailsStartY + 16);
  doc.setFont(undefined, 'normal');
  doc.text(inspection.inspector_name, leftColX + 45, detailsStartY + 16);

  // Right column
  doc.setFont(undefined, 'bold');
  doc.text('Date:', rightColX, detailsStartY);
  doc.setFont(undefined, 'normal');
  doc.text(new Date(inspection.inspection_date).toLocaleDateString(), rightColX + 30, detailsStartY);

  doc.setFont(undefined, 'bold');
  doc.text('Type:', rightColX, detailsStartY + 8);
  doc.setFont(undefined, 'normal');
  doc.text(inspection.inspection_type || 'Standard', rightColX + 30, detailsStartY + 8);

  doc.setFont(undefined, 'bold');
  doc.text('Status:', rightColX, detailsStartY + 16);
  doc.setFont(undefined, 'normal');
  doc.text(inspection.status.toUpperCase(), rightColX + 30, detailsStartY + 16);

  // Fault summary
  doc.setFont(undefined, 'bold');
  doc.text('Faults Found:', leftColX, detailsStartY + 24);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(inspection.fault_count > 0 ? 200 : 0, inspection.fault_count > 0 ? 0 : 150, 0);
  doc.text(inspection.fault_count.toString(), leftColX + 45, detailsStartY + 24);
  doc.setTextColor(40, 40, 40);

  doc.setFont(undefined, 'bold');
  doc.text('Corrective Action:', rightColX, detailsStartY + 24);
  doc.setFont(undefined, 'normal');
  doc.text(inspection.corrective_action_status || 'N/A', rightColX + 30, detailsStartY + 24);

  // Notes section
  if (inspection.notes) {
    doc.setFont(undefined, 'bold');
    doc.text('Notes:', leftColX, detailsStartY + 32);
    doc.setFont(undefined, 'normal');
    const splitNotes = doc.splitTextToSize(inspection.notes, 170);
    doc.text(splitNotes, leftColX, detailsStartY + 38);
  }

  // Inspection items table
  if (items && items.length > 0) {
    const tableStartY = inspection.notes ? detailsStartY + 58 : detailsStartY + 40;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Inspection Items', 14, tableStartY);

    // Prepare table data
    const tableData = items.map(item => [
      item.item_name,
      item.status.toUpperCase(),
      item.severity || '-',
      item.notes || '-'
    ]);

    autoTable(doc, {
      startY: tableStartY + 5,
      head: [['Item', 'Status', 'Severity', 'Notes']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 70 },
      },
      didParseCell: (data) => {
        // Color code status cells
        if (data.column.index === 1 && data.section === 'body') {
          const status = data.cell.text[0];
          if (status === 'FAIL') {
            data.cell.styles.textColor = [200, 0, 0];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'PASS') {
            data.cell.styles.textColor = [0, 150, 0];
          } else if (status === 'WARNING') {
            data.cell.styles.textColor = [200, 150, 0];
          }
        }
      },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} | Generated: ${new Date().toLocaleString()}`,
      105,
      290,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `Inspection_${inspection.inspection_number}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

/**
 * Generate a batch PDF report for multiple inspections
 */
export async function generateBatchInspectionPDF(
  inspections: InspectionData[]
): Promise<void> {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text('Batch Inspection Report', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Total Inspections: ${inspections.length}`, 105, 28, { align: 'center' });

  // Summary table
  const tableData = inspections.map(insp => [
    insp.inspection_number,
    new Date(insp.inspection_date).toLocaleDateString(),
    insp.vehicle_registration,
    insp.inspector_name,
    insp.fault_count.toString(),
    insp.status.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Inspection #', 'Date', 'Vehicle', 'Inspector', 'Faults', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      4: { halign: 'center' },
      5: { halign: 'center' },
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} | Generated: ${new Date().toLocaleString()}`,
      105,
      290,
      { align: 'center' }
    );
  }

  // Save
  const fileName = `Batch_Inspections_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}