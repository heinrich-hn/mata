import { format } from "date-fns";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCurrency, formatNumber } from "./formatters";

export interface DieselExportRecord {
  id: string;
  date: string;
  fleet_number: string;
  driver_name?: string;
  fuel_station?: string;
  litres_filled?: number;
  cost_per_litre?: number;
  total_cost?: number;
  currency?: string;
  km_reading?: number;
  previous_km_reading?: number;
  distance_travelled?: number;
  km_per_litre?: number;
  trip_id?: string;
  debrief_signed?: boolean;
  debrief_signed_by?: string;
  debrief_date?: string;
  notes?: string;
  /** Reefer-specific fields */
  operating_hours?: number | null;
  previous_operating_hours?: number | null;
  hours_operated?: number | null;
}

export interface FleetExportOptions {
  fleetNumber: string;
  records: DieselExportRecord[];
  dateRange?: { from: string; to: string };
  includeDebriefInfo?: boolean;
}

/**
 * Generate a PDF report for diesel consumption of a specific fleet
 */
export const generateFleetDieselPDF = (options: FleetExportOptions) => {
  const { fleetNumber, records, dateRange, includeDebriefInfo = false } = options;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  // Filter records for the fleet
  const fleetRecords = records.filter(r => r.fleet_number === fleetNumber);

  if (fleetRecords.length === 0) {
    doc.setFontSize(14);
    doc.text(`No diesel records found for fleet ${fleetNumber}`, pageWidth / 2, 50, { align: "center" });
    doc.save(`diesel-report-${fleetNumber}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    return;
  }

  // Calculate summary statistics
  const totalLitres = fleetRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
  const totalCost = fleetRecords
    .reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const totalDistance = fleetRecords.reduce((sum, r) => sum + (r.distance_travelled || 0), 0);
  const avgKmPerLitre = totalLitres > 0 ? totalDistance / totalLitres : 0;

  // Get unique drivers
  const drivers = [...new Set(fleetRecords.map(r => r.driver_name).filter(Boolean))];

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("DIESEL CONSUMPTION REPORT", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  doc.setFontSize(14);
  doc.text(`Fleet: ${fleetNumber}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  if (dateRange) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
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
  yPos += 15;

  // Summary Box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 40, 3, 3, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");

  // Row 1
  const row1Y = yPos + 10;
  doc.text("Total Records:", margin + 5, row1Y);
  doc.setFont("helvetica", "normal");
  doc.text(String(fleetRecords.length), margin + 45, row1Y);

  doc.setFont("helvetica", "bold");
  doc.text("Total Litres:", margin + 70, row1Y);
  doc.setFont("helvetica", "normal");
  doc.text(`${formatNumber(totalLitres)} L`, margin + 105, row1Y);

  doc.setFont("helvetica", "bold");
  doc.text("Total Distance:", margin + 140, row1Y);
  doc.setFont("helvetica", "normal");
  doc.text(`${formatNumber(totalDistance)} km`, margin + 175, row1Y);

  // Row 2
  const row2Y = yPos + 22;
  doc.setFont("helvetica", "bold");
  doc.text("Total Cost:", margin + 5, row2Y);
  doc.setFont("helvetica", "normal");
  const costText = formatCurrency(totalCost);
  doc.text(costText, margin + 40, row2Y);

  doc.setFont("helvetica", "bold");
  doc.text("Avg km/L:", margin + 105, row2Y);
  doc.setFont("helvetica", "normal");
  doc.text(formatNumber(avgKmPerLitre, 2), margin + 135, row2Y);

  // Row 3
  const row3Y = yPos + 34;
  doc.setFont("helvetica", "bold");
  doc.text("Drivers:", margin + 5, row3Y);
  doc.setFont("helvetica", "normal");
  const driverText = drivers.length > 3
    ? drivers.slice(0, 3).join(", ") + ` +${drivers.length - 3} more`
    : drivers.join(", ") || "N/A";
  doc.text(driverText, margin + 30, row3Y);

  yPos += 50;

  // Table Data
  const tableData = fleetRecords
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(record => {
      const row = [
        format(new Date(record.date), "MMM dd, yyyy"),
        record.driver_name || "N/A",
        record.fuel_station || "N/A",
        `${formatNumber(record.litres_filled || 0)} L`,
        record.cost_per_litre ? formatCurrency(record.cost_per_litre) : "N/A",
        formatCurrency(record.total_cost || 0),
        record.distance_travelled ? `${formatNumber(record.distance_travelled)} km` : "N/A",
        record.km_per_litre ? formatNumber(record.km_per_litre, 2) : "N/A",
      ];

      if (includeDebriefInfo) {
        row.push(record.debrief_signed ? "Yes" : "No");
      }

      return row;
    });

  const tableHeaders = [
    "Date",
    "Driver",
    "Station",
    "Litres",
    "Cost/L",
    "Total Cost",
    "Distance",
    "km/L",
  ];

  if (includeDebriefInfo) {
    tableHeaders.push("Debriefed");
  }

  // Add table using autoTable
  autoTable(doc, {
    startY: yPos,
    head: [tableHeaders],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Date
      1: { cellWidth: 25 }, // Driver
      2: { cellWidth: 28 }, // Station
      3: { cellWidth: 18, halign: 'right' }, // Litres
      4: { cellWidth: 18, halign: 'right' }, // Cost/L
      5: { cellWidth: 22, halign: 'right' }, // Total Cost
      6: { cellWidth: 22, halign: 'right' }, // Distance
      7: { cellWidth: 15, halign: 'right' }, // km/L
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      // Footer on each page
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Fleet ${fleetNumber} Diesel Report | Page ${doc.getNumberOfPages()} | Generated: ${format(new Date(), "MMM dd, yyyy")}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
      doc.setTextColor(0, 0, 0);
    },
  });

  // Save the PDF
  const fileName = `diesel-report-${fleetNumber}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
};

/**
 * Generate an Excel file for diesel consumption of a specific fleet
 */
export const generateFleetDieselExcel = (options: FleetExportOptions) => {
  const { fleetNumber, records, dateRange, includeDebriefInfo = false } = options;

  // Filter records for the fleet
  const fleetRecords = records.filter(r => r.fleet_number === fleetNumber);

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Calculate summary statistics
  const totalLitres = fleetRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
  const totalCost = fleetRecords
    .reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const totalDistance = fleetRecords.reduce((sum, r) => sum + (r.distance_travelled || 0), 0);
  const avgKmPerLitre = totalLitres > 0 ? totalDistance / totalLitres : 0;
  const drivers = [...new Set(fleetRecords.map(r => r.driver_name).filter(Boolean))];

  // Summary Sheet
  const summaryData = [
    ['DIESEL CONSUMPTION REPORT'],
    [''],
    ['Fleet Number', fleetNumber],
    ['Report Generated', format(new Date(), "MMM dd, yyyy HH:mm")],
    dateRange ? ['Period', `${format(new Date(dateRange.from), "MMM dd, yyyy")} - ${format(new Date(dateRange.to), "MMM dd, yyyy")}`] : ['Period', 'All Time'],
    [''],
    ['SUMMARY'],
    ['Total Records', fleetRecords.length],
    ['Total Litres', totalLitres.toFixed(2)],
    ['Total Distance (km)', totalDistance.toFixed(2)],
    ['Average km/L', avgKmPerLitre.toFixed(2)],
    [''],
    ['DRIVERS'],
    ...drivers.map((d, i) => [i + 1, d]),
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Set column widths
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 40 }];

  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Transactions Sheet
  const headers = [
    'Date',
    'Driver',
    'Fuel Station',
    'Litres Filled',
    'Cost per Litre',
    'Total Cost',
    'Currency',
    'KM Reading',
    'Previous KM',
    'Distance (km)',
    'km/L',
    'Trip ID',
    'Notes',
  ];

  if (includeDebriefInfo) {
    headers.push('Debriefed', 'Debriefed By', 'Debrief Date');
  }

  const transactionData = [
    headers,
    ...fleetRecords
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(record => {
        const row: (string | number | undefined)[] = [
          format(new Date(record.date), "yyyy-MM-dd"),
          record.driver_name || '',
          record.fuel_station || '',
          record.litres_filled?.toFixed(2) || '',
          record.cost_per_litre?.toFixed(2) || '',
          record.total_cost?.toFixed(2) || '',
          record.currency || 'USD',
          record.km_reading || '',
          record.previous_km_reading || '',
          record.distance_travelled || '',
          record.km_per_litre?.toFixed(2) || '',
          record.trip_id || '',
          record.notes || '',
        ];

        if (includeDebriefInfo) {
          row.push(
            record.debrief_signed ? 'Yes' : 'No',
            record.debrief_signed_by || '',
            record.debrief_date || ''
          );
        }

        return row;
      }),
    // Totals row
    [
      'TOTALS',
      '',
      '',
      totalLitres.toFixed(2),
      '',
      (totalCost).toFixed(2),
      '',
      '',
      '',
      totalDistance.toFixed(2),
      avgKmPerLitre.toFixed(2),
      '',
      '',
    ],
  ];

  const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);

  // Set column widths
  transactionSheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 20 }, // Driver
    { wch: 25 }, // Station
    { wch: 12 }, // Litres
    { wch: 12 }, // Cost/L
    { wch: 12 }, // Total
    { wch: 8 },  // Currency
    { wch: 10 }, // KM Reading
    { wch: 10 }, // Prev KM
    { wch: 12 }, // Distance
    { wch: 8 },  // km/L
    { wch: 20 }, // Trip ID
    { wch: 30 }, // Notes
  ];

  XLSX.utils.book_append_sheet(wb, transactionSheet, 'Transactions');

  // Driver Summary Sheet
  const driverSummary = new Map<string, {
    litres: number;
    cost: number;
    costUSD: number;
    distance: number;
    fills: number;
  }>();

  fleetRecords.forEach(record => {
    const driver = record.driver_name || 'Unknown';
    const existing = driverSummary.get(driver) || {
      litres: 0,
      cost: 0,
      costUSD: 0,
      distance: 0,
      fills: 0,
    };

    existing.litres += record.litres_filled || 0;
    existing.cost += (record.total_cost || 0);
    existing.costUSD += record.currency === 'USD' ? (record.total_cost || 0) : 0;
    existing.distance += record.distance_travelled || 0;
    existing.fills += 1;

    driverSummary.set(driver, existing);
  });

  const driverData = [
    ['Driver', 'Total Litres', 'Total Cost', 'Total Distance (km)', 'Avg km/L', 'Fill Count'],
    ...Array.from(driverSummary.entries()).map(([driver, stats]) => [
      driver,
      stats.litres.toFixed(2),
      stats.cost.toFixed(2),
      stats.costUSD.toFixed(2),
      stats.distance.toFixed(2),
      stats.litres > 0 ? (stats.distance / stats.litres).toFixed(2) : '0.00',
      stats.fills,
    ]),
  ];

  const driverSheet = XLSX.utils.aoa_to_sheet(driverData);
  driverSheet['!cols'] = [
    { wch: 25 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(wb, driverSheet, 'By Driver');

  // Generate and download
  const fileName = `diesel-report-${fleetNumber}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

/**
 * Generate a combined PDF report for all fleets (or selected fleets)
 */
export const generateAllFleetsDieselPDF = (
  records: DieselExportRecord[],
  fleetNumbers?: string[],
  dateRange?: { from: string; to: string }
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  // Get unique fleets
  const allFleets = [...new Set(records.map(r => r.fleet_number))].sort();
  const fleetsToExport = fleetNumbers || allFleets;

  // Calculate overall totals
  const filteredRecords = records.filter(r => fleetsToExport.includes(r.fleet_number));
  const totalLitres = filteredRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
  const totalCost = filteredRecords
    .reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const totalDistance = filteredRecords.reduce((sum, r) => sum + (r.distance_travelled || 0), 0);

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FLEET DIESEL CONSUMPTION SUMMARY", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  if (dateRange) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
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

  // Overall Summary Box
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 25, 3, 3, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);

  const summaryY = yPos + 10;
  doc.text(`Fleets: ${fleetsToExport.length}`, margin + 10, summaryY);
  doc.text(`Records: ${filteredRecords.length}`, margin + 50, summaryY);
  doc.text(`Litres: ${formatNumber(totalLitres)}`, margin + 95, summaryY);
  doc.text(`Cost: ${formatCurrency(totalCost)}`, margin + 140, summaryY);

  doc.setTextColor(0, 0, 0);
  yPos += 35;

  // Fleet comparison table
  const fleetData = fleetsToExport.map(fleet => {
    const fleetRecords = filteredRecords.filter(r => r.fleet_number === fleet);
    const litres = fleetRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
    const cost = fleetRecords
      .reduce((sum, r) => sum + (r.total_cost || 0), 0);
    const costUSD = fleetRecords
      .filter(r => r.currency === 'USD')
      .reduce((sum, r) => sum + (r.total_cost || 0), 0);
    const distance = fleetRecords.reduce((sum, r) => sum + (r.distance_travelled || 0), 0);
    const avgKmL = litres > 0 ? distance / litres : 0;
    const drivers = [...new Set(fleetRecords.map(r => r.driver_name).filter(Boolean))];

    return [
      fleet,
      formatNumber(litres) + ' L',
      formatCurrency(cost),
      costUSD > 0 ? formatCurrency(costUSD) : '-',
      formatNumber(distance) + ' km',
      formatNumber(avgKmL, 2),
      String(fleetRecords.length),
      String(drivers.length),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Fleet', 'Litres', 'Cost (USD)', 'Cost (USD)', 'Distance', 'Avg km/L', 'Records', 'Drivers']],
    body: fleetData,
    foot: [[
      'TOTAL',
      formatNumber(totalLitres) + ' L',
      formatCurrency(totalCost),
      formatNumber(totalDistance) + ' km',
      totalLitres > 0 ? formatNumber(totalDistance / totalLitres, 2) : '-',
      String(filteredRecords.length),
      '-',
    ]],
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      // Footer
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Fleet Diesel Summary | Page ${doc.getNumberOfPages()} | Generated: ${format(new Date(), "MMM dd, yyyy")}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
      doc.setTextColor(0, 0, 0);
    },
  });

  // Save
  const fileName = `diesel-all-fleets-summary-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
};

/**
 * Generate a combined Excel file for all fleets (or selected fleets)
 */
export const generateAllFleetsDieselExcel = (
  records: DieselExportRecord[],
  fleetNumbers?: string[],
  dateRange?: { from: string; to: string }
) => {
  const wb = XLSX.utils.book_new();

  // Get unique fleets
  const allFleets = [...new Set(records.map(r => r.fleet_number))].sort();
  const fleetsToExport = fleetNumbers || allFleets;

  const filteredRecords = records.filter(r => fleetsToExport.includes(r.fleet_number));

  // Calculate overall totals
  const totalLitres = filteredRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
  const totalCost = filteredRecords
    .reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const totalDistance = filteredRecords.reduce((sum, r) => sum + (r.distance_travelled || 0), 0);

  // Summary Sheet
  const summaryData = [
    ['FLEET DIESEL CONSUMPTION SUMMARY'],
    [''],
    ['Report Generated', format(new Date(), "MMM dd, yyyy HH:mm")],
    dateRange ? ['Period', `${format(new Date(dateRange.from), "MMM dd, yyyy")} - ${format(new Date(dateRange.to), "MMM dd, yyyy")}`] : ['Period', 'All Time'],
    [''],
    ['OVERALL TOTALS'],
    ['Total Fleets', fleetsToExport.length],
    ['Total Records', filteredRecords.length],
    ['Total Litres', totalLitres.toFixed(2)],
    ['Total Distance (km)', totalDistance.toFixed(2)],
    ['Average km/L', totalLitres > 0 ? (totalDistance / totalLitres).toFixed(2) : '0.00'],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Fleet Comparison Sheet
  const fleetComparisonData = [
    ['Fleet', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Distance (km)', 'Avg km/L', 'Records', 'Drivers'],
    ...fleetsToExport.map(fleet => {
      const fleetRecords = filteredRecords.filter(r => r.fleet_number === fleet);
      const litres = fleetRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
      const cost = fleetRecords
        .reduce((sum, r) => sum + (r.total_cost || 0), 0);
      const costUSD = fleetRecords
        .filter(r => r.currency === 'USD')
        .reduce((sum, r) => sum + (r.total_cost || 0), 0);
      const distance = fleetRecords.reduce((sum, r) => sum + (r.distance_travelled || 0), 0);
      const drivers = [...new Set(fleetRecords.map(r => r.driver_name).filter(Boolean))];

      return [
        fleet,
        litres.toFixed(2),
        cost.toFixed(2),
        costUSD.toFixed(2),
        distance.toFixed(2),
        litres > 0 ? (distance / litres).toFixed(2) : '0.00',
        fleetRecords.length,
        drivers.length,
      ];
    }),
    // Totals row
    [
      'TOTAL',
      totalLitres.toFixed(2),
      totalCost.toFixed(2),
      totalDistance.toFixed(2),
      totalLitres > 0 ? (totalDistance / totalLitres).toFixed(2) : '0.00',
      filteredRecords.length,
      '',
    ],
  ];

  const fleetSheet = XLSX.utils.aoa_to_sheet(fleetComparisonData);
  fleetSheet['!cols'] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, fleetSheet, 'Fleet Comparison');

  // All Transactions Sheet
  const transactionHeaders = [
    'Date',
    'Fleet',
    'Driver',
    'Fuel Station',
    'Litres',
    'Cost/L',
    'Total Cost',
    'Currency',
    'Distance',
    'km/L',
  ];

  const transactionData = [
    transactionHeaders,
    ...filteredRecords
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(record => [
        format(new Date(record.date), "yyyy-MM-dd"),
        record.fleet_number,
        record.driver_name || '',
        record.fuel_station || '',
        record.litres_filled?.toFixed(2) || '',
        record.cost_per_litre?.toFixed(2) || '',
        record.total_cost?.toFixed(2) || '',
        record.currency || 'USD',
        record.distance_travelled || '',
        record.km_per_litre?.toFixed(2) || '',
      ]),
  ];

  const allTransactionsSheet = XLSX.utils.aoa_to_sheet(transactionData);
  allTransactionsSheet['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
    { wch: 25 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, allTransactionsSheet, 'All Transactions');

  // Generate and download
  const fileName = `diesel-all-fleets-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ─────────────────────────────────────────────────────────────────────────────
// Comprehensive Report Types (mirroring the Reports section in DieselManagement)
// ─────────────────────────────────────────────────────────────────────────────

export interface DieselDriverReport {
  driver: string;
  totalLitres: number;
  totalCost: number;
  totalDistance: number;
  avgKmPerLitre: number;
  fillCount: number;
  lastFillDate: string;
}

export interface DieselReeferDriverReport {
  driver: string;
  totalLitres: number;
  totalCost: number;
  fillCount: number;
  lastFillDate: string;
  fleets: string[];
  avgLitresPerHour: number;
  totalHoursOperated: number;
}

export interface DieselFleetReport {
  fleet: string;
  totalLitres: number;
  totalCost: number;
  totalDistance: number;
  avgKmPerLitre: number;
  fillCount: number;
  drivers: string[];
}

export interface DieselReeferFleetReport {
  fleet: string;
  totalLitres: number;
  totalCost: number;
  fillCount: number;
  drivers: string[];
  avgLitresPerHour: number;
  totalHoursOperated: number;
}

export interface DieselStationReport {
  station: string;
  totalLitres: number;
  totalCost: number;
  avgCostPerLitre: number;
  fillCount: number;
  fleetsServed: string[];
}

export interface DieselWeeklyFleetData {
  fleet: string;
  totalLitres: number;
  totalKm: number;
  consumption: number | null;
  totalHours: number;
  reeferConsumption: number | null;
  totalCost: number;
}

export interface DieselWeeklySectionData {
  name: string;
  fleets: string[];
  isReeferSection: boolean;
  data: DieselWeeklyFleetData[];
  sectionTotal: {
    totalLitres: number;
    totalKm: number;
    consumption: number | null;
    totalHours: number;
    reeferConsumption: number | null;
    totalCost: number;
  };
}

export interface DieselWeeklyReport {
  weekNumber: number;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  sections: DieselWeeklySectionData[];
  grandTotal: {
    totalLitres: number;
    totalKm: number;
    consumption: number | null;
    totalCost: number;
  };
}

export interface ComprehensiveDieselExcelInput {
  driverReports: DieselDriverReport[];
  reeferDriverReports: DieselReeferDriverReport[];
  fleetReports: DieselFleetReport[];
  reeferFleetReports: DieselReeferFleetReport[];
  stationReports: DieselStationReport[];
  reeferStationReports: DieselStationReport[];
  weeklyReports: DieselWeeklyReport[];
  truckRecords: DieselExportRecord[];
  reeferRecords: DieselExportRecord[];
  /** Optional reporting period – shown in headers/subtitles of exports */
  dateRange?: { from: string; to: string; label?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
type AoaRow = (string | number | null)[];

const n2 = (v: number) => Number(v.toFixed(2));
const n3 = (v: number) => Number(v.toFixed(3));
const dash = (v: number | null | undefined, decimals = 2): string | number =>
  v == null || v === 0 ? '—' : Number(v.toFixed(decimals));

/** Apply column widths to a worksheet */
const applySheetHeader = (ws: XLSX.WorkSheet, cols: { wch: number }[]) => {
  ws['!cols'] = cols;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a comprehensive multi-sheet Excel report that mirrors every tab
 * visible in the Diesel Management → Reports section of the application.
 *
 * Sheets produced:
 *   1. Overview          – high-level summary stats
 *   2. Truck - By Driver – truck driver breakdown
 *   3. Truck - By Fleet  – truck fleet breakdown
 *   4. Truck - By Station– fuel station breakdown (trucks)
 *   5. Weekly Consumption– categorised weekly table matching the UI exactly
 *   6. Reefer - By Fleet – reefer fleet breakdown (L/hr)
 *   7. Reefer - By Driver– reefer driver breakdown (L/hr)
 *   8. Reefer - By Station– fuel station breakdown (reefers)
 *   9. Truck Transactions– raw truck transaction data
 *  10. Reefer Transactions– raw reefer transaction data
 */
export const generateComprehensiveDieselExcel = ({
  driverReports,
  reeferDriverReports,
  fleetReports,
  reeferFleetReports,
  stationReports,
  reeferStationReports,
  weeklyReports,
  truckRecords,
  reeferRecords,
  dateRange,
}: ComprehensiveDieselExcelInput): void => {
  const wb = XLSX.utils.book_new();
  const generatedOn = format(new Date(), 'MMM dd, yyyy HH:mm');
  const dateStamp = format(new Date(), 'yyyy-MM-dd');
  const periodLabel = dateRange
    ? `Period: ${format(new Date(dateRange.from), 'MMM dd, yyyy')} – ${format(new Date(dateRange.to), 'MMM dd, yyyy')}`
    : 'Period: All Time';

  // ── 1. Overview ──────────────────────────────────────────────────────────
  {
    const truckLitres = truckRecords.reduce((s, r) => s + (r.litres_filled || 0), 0);
    const truckDist = truckRecords.reduce((s, r) => s + (r.distance_travelled || 0), 0);
    const truckCost = truckRecords.reduce((s, r) => s + (r.total_cost || 0), 0);

    const reeferLitres = reeferRecords.reduce((s, r) => s + (r.litres_filled || 0), 0);
    const reeferCost = reeferRecords.reduce((s, r) => s + (r.total_cost || 0), 0);

    const data: AoaRow[] = [
      ['CAR CRAFT CO — DIESEL CONSUMPTION REPORT'],
      [`Generated: ${generatedOn}`],
      [periodLabel],
      [],
      ['TRUCK FLEET SUMMARY', null, null, null],
      ['Metric', 'Value'],
      ['Total Truck Records', truckRecords.length],
      ['Total Litres (Trucks)', n2(truckLitres)],
      ['Total Cost', n2(truckCost)],
      ['Total Distance (km)', n2(truckDist)],
      ['Overall km/L', truckLitres > 0 ? n3(truckDist / truckLitres) : '—'],
      ['Unique Truck Fleets', fleetReports.length],
      ['Unique Truck Drivers', driverReports.length],
      [],
      ['REEFER FLEET SUMMARY', null, null, null],
      ['Metric', 'Value'],
      ['Total Reefer Records', reeferRecords.length],
      ['Total Litres (Reefers)', n2(reeferLitres)],
      ['Total Cost', n2(reeferCost)],
      ['Unique Reefer Units', reeferFleetReports.length],
      ['Unique Reefer Drivers', reeferDriverReports.length],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    applySheetHeader(ws, [{ wch: 30 }, { wch: 20 }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Overview');
  }

  // ── 2. Truck - By Driver ─────────────────────────────────────────────────
  {
    const headers: AoaRow = [
      'Driver', 'Total Litres', 'Total Cost',
      'Total Distance (km)', 'Avg km/L', 'Fill Count', 'Last Fill Date',
    ];
    const rows: AoaRow[] = driverReports.map(r => [
      r.driver,
      n2(r.totalLitres),
      n2(r.totalCost),
      n2(r.totalDistance),
      n3(r.avgKmPerLitre),
      r.fillCount,
      r.lastFillDate,
    ]);
    // Totals
    rows.push([
      'TOTAL',
      n2(driverReports.reduce((s, r) => s + r.totalLitres, 0)),
      n2(driverReports.reduce((s, r) => s + r.totalCost, 0)),
      n2(driverReports.reduce((s, r) => s + r.totalDistance, 0)),
      '', driverReports.reduce((s, r) => s + r.fillCount, 0), '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    applySheetHeader(ws, [
      { wch: 25 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Truck - By Driver');
  }

  // ── 3. Truck - By Fleet ──────────────────────────────────────────────────
  {
    const headers: AoaRow = [
      'Fleet', 'Total Litres', 'Total Cost',
      'Total Distance (km)', 'Avg km/L', 'Fill Count', 'Drivers',
    ];
    const rows: AoaRow[] = fleetReports.map(r => [
      r.fleet,
      n2(r.totalLitres),
      n2(r.totalCost),
      n2(r.totalDistance),
      n3(r.avgKmPerLitre),
      r.fillCount,
      r.drivers.join(', '),
    ]);
    rows.push([
      'TOTAL',
      n2(fleetReports.reduce((s, r) => s + r.totalLitres, 0)),
      n2(fleetReports.reduce((s, r) => s + r.totalCost, 0)),
      n2(fleetReports.reduce((s, r) => s + r.totalDistance, 0)),
      '',
      fleetReports.reduce((s, r) => s + r.fillCount, 0),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    applySheetHeader(ws, [
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 40 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Truck - By Fleet');
  }

  // ── 4. Truck - By Station ────────────────────────────────────────────────
  {
    const headers: AoaRow = [
      'Fuel Station', 'Total Litres', 'Total Cost',
      'Avg Cost / Litre', 'Fill Count', 'Fleets Served',
    ];
    const rows: AoaRow[] = stationReports.map(r => [
      r.station,
      n2(r.totalLitres),
      n2(r.totalCost),
      n2(r.avgCostPerLitre),
      r.fillCount,
      r.fleetsServed.sort().join(', '),
    ]);
    rows.push([
      'TOTAL',
      n2(stationReports.reduce((s, r) => s + r.totalLitres, 0)),
      n2(stationReports.reduce((s, r) => s + r.totalCost, 0)),
      '',
      stationReports.reduce((s, r) => s + r.fillCount, 0),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    applySheetHeader(ws, [
      { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 10 }, { wch: 40 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Truck - By Station');
  }

  // ── 5. Weekly Consumption (mirrors UI exactly) ───────────────────────────
  {
    const aoa: AoaRow[] = [
      ['WEEKLY DIESEL CONSUMPTION REPORT'],
      [`Generated: ${generatedOn}`],
      [],
    ];

    for (const week of weeklyReports) {
      aoa.push([`WEEK ${week.weekNumber}   ${week.weekLabel}   (${week.weekStart} – ${week.weekEnd})`]);
      aoa.push([]);

      for (const section of week.sections) {
        aoa.push([`▸ ${section.name}`]);

        if (section.isReeferSection) {
          aoa.push(['Fleet', 'Litres', 'Hours Operated', 'L / H', 'Cost (USD)', 'Cost (USD)'] as AoaRow);
          for (const d of section.data) {
            if (d.totalLitres > 0 || d.totalHours > 0) {
              aoa.push([
                d.fleet,
                n2(d.totalLitres),
                dash(d.totalHours, 1),
                dash(d.reeferConsumption, 2),
                n2(d.totalCost),
              ]);
            }
          }
          const st = section.sectionTotal;
          aoa.push([
            'Section Total',
            n2(st.totalLitres),
            st.totalHours > 0 ? n3(st.totalHours) : '—',
            st.reeferConsumption != null ? n3(st.reeferConsumption) : '—',
            n2(st.totalCost),
          ]);
        } else {
          aoa.push(['Fleet', 'Litres', 'KM', 'km / L', 'Cost (USD)', 'Cost (USD)'] as AoaRow);
          for (const d of section.data) {
            if (d.totalLitres > 0 || d.totalKm > 0) {
              aoa.push([
                d.fleet,
                n2(d.totalLitres),
                d.totalKm > 0 ? d.totalKm : '—',
                dash(d.consumption, 3),
                n2(d.totalCost),
              ]);
            }
          }
          const st = section.sectionTotal;
          aoa.push([
            'Section Total',
            n2(st.totalLitres),
            st.totalKm > 0 ? st.totalKm : '—',
            st.consumption != null ? n3(st.consumption) : '—',
            n2(st.totalCost),
          ]);
        }
        aoa.push([]);
      }

      const gt = week.grandTotal;
      aoa.push([
        `GRAND TOTAL — Trucks (Week ${week.weekNumber})`,
        n2(gt.totalLitres),
        gt.totalKm > 0 ? gt.totalKm : '—',
        gt.consumption != null ? n3(gt.consumption) : '—',
        n2(gt.totalCost),
      ]);
      aoa.push([]);
      aoa.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applySheetHeader(ws, [
      { wch: 42 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
      { wch: 14 }, { wch: 14 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Weekly Consumption');
  }

  // ── 6. Reefer - By Fleet ─────────────────────────────────────────────────
  {
    const headers: AoaRow = [
      'Reefer Unit', 'Total Litres', 'Total Cost',
      'Avg L / H', 'Hours Operated', 'Fill Count', 'Drivers',
    ];
    const rows: AoaRow[] = reeferFleetReports.map(r => [
      r.fleet,
      n2(r.totalLitres),
      n2(r.totalCost),
      r.avgLitresPerHour > 0 ? n2(r.avgLitresPerHour) : '—',
      r.totalHoursOperated > 0 ? n2(r.totalHoursOperated) : '—',
      r.fillCount,
      r.drivers.join(', '),
    ]);
    rows.push([
      'TOTAL',
      n2(reeferFleetReports.reduce((s, r) => s + r.totalLitres, 0)),
      n2(reeferFleetReports.reduce((s, r) => s + r.totalCost, 0)),
      '',
      n2(reeferFleetReports.reduce((s, r) => s + r.totalHoursOperated, 0)),
      reeferFleetReports.reduce((s, r) => s + r.fillCount, 0),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    applySheetHeader(ws, [
      { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 40 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Reefer - By Fleet');
  }

  // ── 7. Reefer - By Driver ────────────────────────────────────────────────
  {
    const headers: AoaRow = [
      'Driver', 'Total Litres', 'Total Cost',
      'Avg L / H', 'Hours Operated', 'Fill Count', 'Last Fill Date', 'Reefer Units',
    ];
    const rows: AoaRow[] = reeferDriverReports.map(r => [
      r.driver,
      n2(r.totalLitres),
      n2(r.totalCost),
      r.avgLitresPerHour > 0 ? n2(r.avgLitresPerHour) : '—',
      r.totalHoursOperated > 0 ? n2(r.totalHoursOperated) : '—',
      r.fillCount,
      r.lastFillDate,
      r.fleets.join(', '),
    ]);
    rows.push([
      'TOTAL',
      n2(reeferDriverReports.reduce((s, r) => s + r.totalLitres, 0)),
      n2(reeferDriverReports.reduce((s, r) => s + r.totalCost, 0)),
      '',
      n2(reeferDriverReports.reduce((s, r) => s + r.totalHoursOperated, 0)),
      reeferDriverReports.reduce((s, r) => s + r.fillCount, 0),
      '', '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    applySheetHeader(ws, [
      { wch: 25 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 30 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Reefer - By Driver');
  }

  // ── 8. Reefer - By Station ───────────────────────────────────────────────
  {
    const headers: AoaRow = [
      'Fuel Station', 'Total Litres', 'Total Cost',
      'Avg Cost / Litre', 'Fill Count', 'Reefer Units Served',
    ];
    const rows: AoaRow[] = reeferStationReports.map(r => [
      r.station,
      n2(r.totalLitres),
      n2(r.totalCost),
      n2(r.avgCostPerLitre),
      r.fillCount,
      r.fleetsServed.sort().join(', '),
    ]);
    rows.push([
      'TOTAL',
      n2(reeferStationReports.reduce((s, r) => s + r.totalLitres, 0)),
      n2(reeferStationReports.reduce((s, r) => s + r.totalCost, 0)),
      '',
      reeferStationReports.reduce((s, r) => s + r.fillCount, 0),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    applySheetHeader(ws, [
      { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 10 }, { wch: 40 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Reefer - By Station');
  }

  // ── 9. Truck Transactions ────────────────────────────────────────────────
  {
    const headers: AoaRow = [
      'Date', 'Fleet', 'Driver', 'Fuel Station',
      'Litres Filled', 'Cost / Litre', 'Total Cost', 'Currency',
      'KM Reading', 'Prev KM', 'Distance (km)', 'km/L',
      'Debrief Status', 'Debriefed By', 'Debrief Date', 'Notes',
    ];
    const rows: AoaRow[] = truckRecords
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(r => {
        const kml = r.distance_travelled && r.litres_filled
          ? n3(r.distance_travelled / r.litres_filled) : '—';
        return [
          r.date,
          r.fleet_number,
          r.driver_name || '',
          r.fuel_station || '',
          r.litres_filled != null ? n2(r.litres_filled) : '',
          r.cost_per_litre != null ? n2(r.cost_per_litre) : '',
          r.total_cost != null ? n2(r.total_cost) : '',
          r.currency || 'USD',
          r.km_reading || '',
          r.previous_km_reading || '',
          r.distance_travelled || '',
          kml,
          r.debrief_signed ? 'Completed' : 'Pending / N/A',
          r.debrief_signed_by || '',
          r.debrief_date || '',
          (r.notes || '').replace(/[\t\n\r]/g, ' '),
        ];
      });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    applySheetHeader(ws, [
      { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 26 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 },
      { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 30 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Truck Transactions');
  }

  // ── 10. Reefer Transactions ──────────────────────────────────────────────
  {
    const headers: AoaRow = [
      'Date', 'Reefer Unit', 'Driver', 'Fuel Station',
      'Litres Filled', 'Cost / Litre', 'Total Cost', 'Currency',
      'Operating Hours', 'Prev Hours', 'Hours Operated', 'L / H',
      'Notes',
    ];
    const rows: AoaRow[] = reeferRecords
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((r) => {
        const lph = r.hours_operated && r.litres_filled
          ? n2(r.litres_filled / r.hours_operated) : '—';
        return [
          r.date,
          r.fleet_number,
          r.driver_name || '',
          r.fuel_station || '',
          r.litres_filled != null ? n2(r.litres_filled) : '',
          r.cost_per_litre != null ? n2(r.cost_per_litre) : '',
          r.total_cost != null ? n2(r.total_cost) : '',
          r.currency || 'USD',
          r.operating_hours != null ? r.operating_hours : '',
          r.previous_operating_hours != null ? r.previous_operating_hours : '',
          r.hours_operated != null ? r.hours_operated : '',
          lph,
          (r.notes || '').replace(/[\t\n\r]/g, ' '),
        ];
      });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    applySheetHeader(ws, [
      { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 26 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 30 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Reefer Transactions');
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  XLSX.writeFile(wb, `diesel-comprehensive-report-${dateStamp}.xlsx`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Export sheet / section selection
// ─────────────────────────────────────────────────────────────────────────────

/** Which sheets / sections to include in a styled export. Defaults: all true except raw transactions. */
export interface ExportSheetSelection {
  overview?: boolean;
  truckByDriver?: boolean;
  truckByFleet?: boolean;
  truckByStation?: boolean;
  weekly?: boolean;
  reeferByFleet?: boolean;
  reeferByDriver?: boolean;
  reeferByStation?: boolean;
  truckTransactions?: boolean;
  reeferTransactions?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ExcelJS colour palette (ARGB strings)
// ─────────────────────────────────────────────────────────────────────────────
const XC = {
  navy: 'FF1E3A5F',
  colHead: 'FF1F2937',
  weekHead: 'FF2563EB',
  totalBg: 'FFD1FAE5',
  sectionBg: 'FFEFF6FF',
  altRow: 'FFF3F4F6',
  subtitleBg: 'FFE8EEF6',
  cyan: 'FF0891B2',
  cyanLight: 'FFE0F7FA',
  white: 'FFFFFFFF',
  darkText: 'FF111827',
  grayText: 'FF6B7280',
  totalText: 'FF065F46',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ExcelJS cell-level helpers (prefixed _xl to avoid collisions with SheetJS helpers above)
// ─────────────────────────────────────────────────────────────────────────────
type _XCell = ExcelJS.Cell;

const _xlFill = (cell: _XCell, argb: string): void => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
};

const _xlFont = (cell: _XCell, bold: boolean, size: number, argb: string): void => {
  cell.font = { name: 'Calibri', bold, size, color: { argb } };
};

const _xlBorder = (
  cell: _XCell,
  side: 'top' | 'bottom',
  argb: string,
  style: ExcelJS.BorderStyle = 'thin',
): void => {
  cell.border = { ...(cell.border ?? {}), [side]: { style, color: { argb } } };
};

/** Apply uniform style to cells 1..colCount in a row. */
const _xlRowStyle = (
  row: ExcelJS.Row,
  colCount: number,
  opts: {
    fill?: string;
    bold?: boolean;
    size?: number;
    color?: string;
    height?: number;
    borderTop?: string;
    borderBottom?: string;
  },
): void => {
  if (opts.height) row.height = opts.height;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    if (opts.fill) _xlFill(cell, opts.fill);
    _xlFont(cell, opts.bold ?? false, opts.size ?? 10, opts.color ?? XC.darkText);
    cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle', indent: c === 1 ? 1 : 0 };
    if (opts.borderTop) _xlBorder(cell, 'top', opts.borderTop, 'medium');
    if (opts.borderBottom) _xlBorder(cell, 'bottom', opts.borderBottom, 'medium');
  }
};

/** Title block: navy title row + grey subtitle row + spacer. */
const _xlSheetTitle = (ws: ExcelJS.Worksheet, title: string, sub: string, colCount: number): void => {
  ws.addRow([]);
  const tRow = ws.addRow([title]);
  ws.mergeCells(tRow.number, 1, tRow.number, colCount);
  _xlRowStyle(tRow, colCount, { fill: XC.navy, bold: true, size: 13, color: XC.white, height: 26 });
  const sRow = ws.addRow([sub]);
  ws.mergeCells(sRow.number, 1, sRow.number, colCount);
  _xlRowStyle(sRow, colCount, { fill: XC.subtitleBg, bold: false, size: 8, color: XC.grayText, height: 14 });
  ws.addRow([]);
};

/** Full-width section heading row. */
const _xlSection = (
  ws: ExcelJS.Worksheet, label: string, colCount: number, bgColor: string = XC.colHead,
): void => {
  const r = ws.addRow([label]);
  ws.mergeCells(r.number, 1, r.number, colCount);
  _xlRowStyle(r, colCount, { fill: bgColor, bold: true, size: 10, color: XC.white, height: 18 });
};

/** Column header row. */
const _xlHeaders = (ws: ExcelJS.Worksheet, headers: string[], bgColor: string = XC.navy): ExcelJS.Row => {
  const r = ws.addRow(headers);
  r.height = 18;
  const cc = headers.length;
  for (let c = 1; c <= cc; c++) {
    const cell = r.getCell(c);
    _xlFill(cell, bgColor);
    _xlFont(cell, true, 10, XC.white);
    cell.alignment = { horizontal: c === 1 ? 'left' : 'center', vertical: 'middle' };
    _xlBorder(cell, 'bottom', bgColor, 'medium');
  }
  return r;
};

/** Data row with optional alternating background. */
const _xlDataRow = (
  ws: ExcelJS.Worksheet,
  values: (string | number | null | undefined)[],
  isAlt: boolean,
): void => {
  const r = ws.addRow(values);
  r.height = 16;
  const cc = values.length;
  for (let c = 1; c <= cc; c++) {
    const cell = r.getCell(c);
    if (isAlt) _xlFill(cell, XC.altRow);
    _xlFont(cell, false, 10, XC.darkText);
    cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle', indent: c === 1 ? 1 : 0 };
  }
};

/** Green total/summary row. */
const _xlTotalRow = (ws: ExcelJS.Worksheet, values: (string | number | null | undefined)[]): void => {
  const cc = values.length;
  const r = ws.addRow(values);
  r.height = 18;
  for (let c = 1; c <= cc; c++) {
    const cell = r.getCell(c);
    _xlFill(cell, XC.totalBg);
    _xlFont(cell, true, 10, XC.totalText);
    cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle', indent: c === 1 ? 1 : 0 };
    _xlBorder(cell, 'top', XC.navy, 'medium');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Styled Excel export (ExcelJS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a professionally styled multi-sheet Excel workbook (.xlsx) with
 * coloured headers, total rows, alternating rows and frozen panes.
 * Sections can be toggled via the `sheets` parameter.
 */
export const generateStyledDieselExcel = async (
  input: ComprehensiveDieselExcelInput,
  sheets: ExportSheetSelection = {},
): Promise<void> => {
  const {
    driverReports, reeferDriverReports, fleetReports, reeferFleetReports,
    stationReports, reeferStationReports, weeklyReports, truckRecords, reeferRecords,
  } = input;

  const sel = {
    overview: sheets.overview !== false,
    truckByDriver: sheets.truckByDriver !== false,
    truckByFleet: sheets.truckByFleet !== false,
    truckByStation: sheets.truckByStation !== false,
    weekly: sheets.weekly !== false,
    reeferByFleet: sheets.reeferByFleet !== false,
    reeferByDriver: sheets.reeferByDriver !== false,
    reeferByStation: sheets.reeferByStation !== false,
    truckTransactions: sheets.truckTransactions === true,
    reeferTransactions: sheets.reeferTransactions === true,
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Car Craft Co — Fleet Management';
  wb.created = new Date();
  const generatedOn = format(new Date(), 'MMM dd, yyyy HH:mm');
  const dateStamp = format(new Date(), 'yyyy-MM-dd');
  const periodStr = input.dateRange
    ? `Period: ${format(new Date(input.dateRange.from), 'MMM dd, yyyy')} – ${format(new Date(input.dateRange.to), 'MMM dd, yyyy')}`
    : 'Period: All Time';
  const sub = `Generated: ${generatedOn}  |  ${periodStr}`;

  const xlSum = <T>(arr: T[], key: keyof T) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);

  // ── Overview ──────────────────────────────────────────────────────────────
  if (sel.overview) {
    const ws = wb.addWorksheet('Overview');
    ws.columns = [{ key: 'a', width: 38 }, { key: 'b', width: 24 }];
    _xlSheetTitle(ws, 'CAR CRAFT CO — DIESEL CONSUMPTION REPORT', sub, 2);

    const tL = truckRecords.reduce((s, r) => s + (r.litres_filled || 0), 0);
    const tD = truckRecords.reduce((s, r) => s + (r.distance_travelled || 0), 0);
    const tCost = truckRecords.reduce((s, r) => s + (r.total_cost || 0), 0);

    _xlSection(ws, '▸  TRUCK FLEET SUMMARY', 2);
    _xlHeaders(ws, ['Metric', 'Value']);
    ([
      ['Total Truck Records', truckRecords.length],
      ['Total Litres', n2(tL)],
      ['Total Cost', n2(tCost)],
      ['Total Distance (km)', n2(tD)],
      ['Overall km/L', tL > 0 ? n3(tD / tL) : '—'],
      ['Unique Fleets', fleetReports.length],
      ['Unique Drivers', driverReports.length],
    ] as [string, string | number][]).forEach((vals, i) => _xlDataRow(ws, vals, i % 2 === 1));

    ws.addRow([]);
    const rL = reeferRecords.reduce((s, r) => s + (r.litres_filled || 0), 0);
    const rCost = reeferRecords.reduce((s, r) => s + (r.total_cost || 0), 0);

    _xlSection(ws, '▸  REEFER FLEET SUMMARY', 2, XC.cyan);
    _xlHeaders(ws, ['Metric', 'Value'], XC.cyan);
    ([
      ['Total Reefer Records', reeferRecords.length],
      ['Total Litres', n2(rL)],
      ['Total Cost', n2(rCost)],
      ['Unique Reefer Units', reeferFleetReports.length],
      ['Unique Reefer Drivers', reeferDriverReports.length],
    ] as [string, string | number][]).forEach((vals, i) => _xlDataRow(ws, vals, i % 2 === 1));

    ws.views = [{ state: 'frozen', ySplit: 4 }];
  }

  // ── Truck – By Driver ──────────────────────────────────────────────────────
  if (sel.truckByDriver) {
    const ws = wb.addWorksheet('Truck – By Driver');
    ws.columns = [28, 14, 16, 16, 18, 10, 10, 14].map(w => ({ width: w }));
    _xlSheetTitle(ws, 'TRUCK FLEET — BY DRIVER', sub, 8);
    _xlHeaders(ws, ['Driver', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Distance (km)', 'Avg km/L', 'Fill Count', 'Last Fill Date']);
    driverReports.forEach((r, i) =>
      _xlDataRow(ws, [r.driver, n2(r.totalLitres), n2(r.totalCost), n2(r.totalDistance), n3(r.avgKmPerLitre), r.fillCount, r.lastFillDate], i % 2 === 1));
    _xlTotalRow(ws, ['TOTAL', n2(xlSum(driverReports, 'totalLitres')), n2(xlSum(driverReports, 'totalCost')), n2(xlSum(driverReports, 'totalDistance')), '', xlSum(driverReports, 'fillCount'), '']);
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  }

  // ── Truck – By Fleet ───────────────────────────────────────────────────────
  if (sel.truckByFleet) {
    const ws = wb.addWorksheet('Truck – By Fleet');
    ws.columns = [14, 14, 16, 16, 18, 10, 10, 42].map(w => ({ width: w }));
    _xlSheetTitle(ws, 'TRUCK FLEET — BY FLEET NUMBER', sub, 8);
    _xlHeaders(ws, ['Fleet', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Distance (km)', 'Avg km/L', 'Fill Count', 'Drivers']);
    fleetReports.forEach((r, i) =>
      _xlDataRow(ws, [r.fleet, n2(r.totalLitres), n2(r.totalCost), n2(r.totalDistance), n3(r.avgKmPerLitre), r.fillCount, r.drivers.join(', ')], i % 2 === 1));
    _xlTotalRow(ws, ['TOTAL', n2(xlSum(fleetReports, 'totalLitres')), n2(xlSum(fleetReports, 'totalCost')), n2(xlSum(fleetReports, 'totalDistance')), '', xlSum(fleetReports, 'fillCount'), '']);
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  }

  // ── Truck – By Station ─────────────────────────────────────────────────────
  if (sel.truckByStation) {
    const ws = wb.addWorksheet('Truck – By Station');
    ws.columns = [30, 14, 16, 16, 16, 10, 42].map(w => ({ width: w }));
    _xlSheetTitle(ws, 'TRUCK FLEET — BY FUEL STATION', sub, 7);
    _xlHeaders(ws, ['Fuel Station', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Avg Cost/Litre', 'Fill Count', 'Fleets Served']);
    stationReports.forEach((r, i) =>
      _xlDataRow(ws, [r.station, n2(r.totalLitres), n2(r.totalCost), n2(r.avgCostPerLitre), r.fillCount, r.fleetsServed.sort().join(', ')], i % 2 === 1));
    _xlTotalRow(ws, ['TOTAL', n2(xlSum(stationReports, 'totalLitres')), n2(xlSum(stationReports, 'totalCost')), '', xlSum(stationReports, 'fillCount'), '']);
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  }

  // ── Weekly Consumption ─────────────────────────────────────────────────────
  if (sel.weekly) {
    const CC = 6;
    const ws = wb.addWorksheet('Weekly Consumption');
    ws.columns = [44, 12, 15, 12, 16, 16].map(w => ({ width: w }));
    _xlSheetTitle(ws, 'WEEKLY DIESEL CONSUMPTION REPORT', sub, CC);

    for (const week of weeklyReports) {
      const wRow = ws.addRow([`WEEK ${week.weekNumber}   ${week.weekLabel}   (${week.weekStart} – ${week.weekEnd})`]);
      ws.mergeCells(wRow.number, 1, wRow.number, CC);
      _xlRowStyle(wRow, CC, { fill: XC.weekHead, bold: true, size: 11, color: XC.white, height: 22 });

      for (const section of week.sections) {
        const isR = section.isReeferSection;
        const sRow = ws.addRow([`  ▸  ${section.name}`]);
        ws.mergeCells(sRow.number, 1, sRow.number, CC);
        _xlRowStyle(sRow, CC, { fill: isR ? XC.cyanLight : XC.sectionBg, bold: true, size: 10, color: isR ? XC.cyan : XC.navy, height: 18 });

        _xlHeaders(ws,
          isR
            ? ['Reefer Unit', 'Litres', 'Hrs Operated', 'L / H', 'Cost (USD)', 'Cost (USD)']
            : ['Fleet', 'Litres', 'KM', 'km / L', 'Cost (USD)', 'Cost (USD)'],
          isR ? XC.cyan : XC.navy);

        let ai = 0;
        for (const d of section.data) {
          if (isR ? (d.totalLitres === 0 && d.totalHours === 0) : (d.totalLitres === 0 && d.totalKm === 0)) continue;
          _xlDataRow(ws,
            isR
              ? [d.fleet, n2(d.totalLitres), dash(d.totalHours, 1), dash(d.reeferConsumption, 2), n2(d.totalCost)]
              : [d.fleet, n2(d.totalLitres), d.totalKm > 0 ? d.totalKm : '—', dash(d.consumption, 3), n2(d.totalCost)],
            ai++ % 2 === 1);
        }

        const st = section.sectionTotal;
        const stRow = ws.addRow(isR
          ? ['Section Total', n2(st.totalLitres), st.totalHours > 0 ? n3(st.totalHours) : '—', st.reeferConsumption ? n3(st.reeferConsumption) : '—', n2(st.totalCost)]
          : ['Section Total', n2(st.totalLitres), st.totalKm > 0 ? st.totalKm : '—', st.consumption ? n3(st.consumption) : '—', n2(st.totalCost)]);
        stRow.height = 16;
        for (let c = 1; c <= CC; c++) {
          const cell = stRow.getCell(c);
          _xlFill(cell, isR ? XC.cyanLight : XC.sectionBg);
          _xlFont(cell, true, 10, isR ? XC.cyan : XC.navy);
          cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle', indent: c === 1 ? 1 : 0 };
          _xlBorder(cell, 'top', isR ? XC.cyan : XC.navy, 'thin');
        }
        ws.addRow([]);
      }

      const gt = week.grandTotal;
      _xlTotalRow(ws, [`GRAND TOTAL — Week ${week.weekNumber}`, n2(gt.totalLitres), gt.totalKm > 0 ? gt.totalKm : '—', gt.consumption ? n3(gt.consumption) : '—', n2(gt.totalCost)]);
      ws.addRow([]);
      ws.addRow([]);
    }
  }

  // ── Reefer – By Fleet ──────────────────────────────────────────────────────
  if (sel.reeferByFleet) {
    const ws = wb.addWorksheet('Reefer – By Fleet');
    ws.columns = [14, 14, 16, 16, 12, 16, 10, 42].map(w => ({ width: w }));
    _xlSheetTitle(ws, 'REEFER FLEET — BY REEFER UNIT', sub, 8);
    _xlHeaders(ws, ['Reefer Unit', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Avg L/H', 'Hrs Operated', 'Fill Count', 'Drivers'], XC.cyan);
    reeferFleetReports.forEach((r, i) =>
      _xlDataRow(ws, [r.fleet, n2(r.totalLitres), n2(r.totalCost), r.avgLitresPerHour > 0 ? n2(r.avgLitresPerHour) : '—', r.totalHoursOperated > 0 ? n2(r.totalHoursOperated) : '—', r.fillCount, r.drivers.join(', ')], i % 2 === 1));
    _xlTotalRow(ws, ['TOTAL', n2(xlSum(reeferFleetReports, 'totalLitres')), n2(xlSum(reeferFleetReports, 'totalCost')), '', n2(xlSum(reeferFleetReports, 'totalHoursOperated')), xlSum(reeferFleetReports, 'fillCount'), '']);
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  }

  // ── Reefer – By Driver ─────────────────────────────────────────────────────
  if (sel.reeferByDriver) {
    const ws = wb.addWorksheet('Reefer – By Driver');
    ws.columns = [28, 14, 16, 16, 12, 16, 10, 14, 32].map(w => ({ width: w }));
    _xlSheetTitle(ws, 'REEFER FLEET — BY DRIVER', sub, 9);
    _xlHeaders(ws, ['Driver', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Avg L/H', 'Hrs Operated', 'Fill Count', 'Last Fill Date', 'Reefer Units'], XC.cyan);
    reeferDriverReports.forEach((r, i) =>
      _xlDataRow(ws, [r.driver, n2(r.totalLitres), n2(r.totalCost), r.avgLitresPerHour > 0 ? n2(r.avgLitresPerHour) : '—', r.totalHoursOperated > 0 ? n2(r.totalHoursOperated) : '—', r.fillCount, r.lastFillDate, r.fleets.join(', ')], i % 2 === 1));
    _xlTotalRow(ws, ['TOTAL', n2(xlSum(reeferDriverReports, 'totalLitres')), n2(xlSum(reeferDriverReports, 'totalCost')), '', n2(xlSum(reeferDriverReports, 'totalHoursOperated')), xlSum(reeferDriverReports, 'fillCount'), '', '']);
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  }

  // ── Reefer – By Station ────────────────────────────────────────────────────
  if (sel.reeferByStation) {
    const ws = wb.addWorksheet('Reefer – By Station');
    ws.columns = [30, 14, 16, 16, 16, 10, 42].map(w => ({ width: w }));
    _xlSheetTitle(ws, 'REEFER FLEET — BY FUEL STATION', sub, 7);
    _xlHeaders(ws, ['Fuel Station', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Avg Cost/Litre', 'Fill Count', 'Reefer Units Served'], XC.cyan);
    reeferStationReports.forEach((r, i) =>
      _xlDataRow(ws, [r.station, n2(r.totalLitres), n2(r.totalCost), n2(r.avgCostPerLitre), r.fillCount, r.fleetsServed.sort().join(', ')], i % 2 === 1));
    _xlTotalRow(ws, ['TOTAL', n2(xlSum(reeferStationReports, 'totalLitres')), n2(xlSum(reeferStationReports, 'totalCost')), '', xlSum(reeferStationReports, 'fillCount'), '']);
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  }

  // ── Truck Transactions ─────────────────────────────────────────────────────
  if (sel.truckTransactions) {
    const ws = wb.addWorksheet('Truck Transactions');
    ws.columns = [12, 10, 24, 28, 12, 12, 12, 8, 12, 12, 14, 8, 16, 22, 14, 32].map(w => ({ width: w }));
    _xlSheetTitle(ws, 'TRUCK TRANSACTIONS — RAW DATA', sub, 16);
    _xlHeaders(ws, ['Date', 'Fleet', 'Driver', 'Fuel Station', 'Litres', 'Cost/Litre', 'Total Cost', 'Currency', 'KM Reading', 'Prev KM', 'Distance', 'km/L', 'Debrief', 'Debriefed By', 'Debrief Date', 'Notes']);
    truckRecords.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((r, i) => {
        const kml = r.distance_travelled && r.litres_filled ? n3(r.distance_travelled / r.litres_filled) : '—';
        _xlDataRow(ws, [r.date, r.fleet_number, r.driver_name || '', r.fuel_station || '', r.litres_filled ? n2(r.litres_filled) : '', r.cost_per_litre ? n2(r.cost_per_litre) : '', r.total_cost ? n2(r.total_cost) : '', r.currency || 'USD', r.km_reading || '', r.previous_km_reading || '', r.distance_travelled || '', kml, r.debrief_signed ? 'Completed' : 'Pending', r.debrief_signed_by || '', r.debrief_date || '', (r.notes || '').replace(/[\t\n\r]/g, ' ')], i % 2 === 1);
      });
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  }

  // ── Reefer Transactions ────────────────────────────────────────────────────
  if (sel.reeferTransactions) {
    const ws = wb.addWorksheet('Reefer Transactions');
    ws.columns = [12, 14, 24, 28, 12, 12, 12, 8, 14, 14, 14, 8, 32].map(w => ({ width: w }));
    _xlSheetTitle(ws, 'REEFER TRANSACTIONS — RAW DATA', sub, 13);
    _xlHeaders(ws, ['Date', 'Reefer Unit', 'Driver', 'Fuel Station', 'Litres', 'Cost/Litre', 'Total Cost', 'Currency', 'Op. Hours', 'Prev Hours', 'Hours Operated', 'L / H', 'Notes'], XC.cyan);
    reeferRecords.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((r, i) => {
        const lph = r.hours_operated && r.litres_filled ? n2(r.litres_filled / r.hours_operated) : '—';
        _xlDataRow(ws, [r.date, r.fleet_number, r.driver_name || '', r.fuel_station || '', r.litres_filled ? n2(r.litres_filled) : '', r.cost_per_litre ? n2(r.cost_per_litre) : '', r.total_cost ? n2(r.total_cost) : '', r.currency || 'USD', r.operating_hours ?? '', r.previous_operating_hours ?? '', r.hours_operated ?? '', lph, (r.notes || '').replace(/[\t\n\r]/g, ' ')], i % 2 === 1);
      });
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  }

  // ── Write buffer → browser download ─────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diesel-report-${dateStamp}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF export (jsPDF + autoTable, landscape A4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a professionally formatted multi-section PDF report (landscape A4)
 * with selectable sections, company header banner on every page, and page numbers.
 */
export const generateComprehensiveDieselPDF = (
  input: ComprehensiveDieselExcelInput,
  sheets: ExportSheetSelection = {},
): void => {
  const {
    driverReports, reeferDriverReports, fleetReports, reeferFleetReports,
    stationReports, reeferStationReports, weeklyReports, truckRecords, reeferRecords,
  } = input;

  const sel = {
    overview: sheets.overview !== false,
    truckByDriver: sheets.truckByDriver !== false,
    truckByFleet: sheets.truckByFleet !== false,
    truckByStation: sheets.truckByStation !== false,
    weekly: sheets.weekly !== false,
    reeferByFleet: sheets.reeferByFleet !== false,
    reeferByDriver: sheets.reeferByDriver !== false,
    reeferByStation: sheets.reeferByStation !== false,
    truckTransactions: sheets.truckTransactions === true,
    reeferTransactions: sheets.reeferTransactions === true,
  };

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const ML = 14;
  const MR = 14;
  const dateStamp = format(new Date(), 'yyyy-MM-dd');
  const generatedOn = format(new Date(), 'MMM dd, yyyy HH:mm');
  const periodStr = input.dateRange
    ? `Period: ${format(new Date(input.dateRange.from), 'MMM dd, yyyy')} – ${format(new Date(input.dateRange.to), 'MMM dd, yyyy')}`
    : 'Period: All Time';

  const HEAD = [30, 58, 95] as [number, number, number];
  const CYAN = [8, 145, 178] as [number, number, number];
  const TOT = [209, 250, 229] as [number, number, number];
  const TTEXT = [6, 95, 70] as [number, number, number];
  const ALT = [249, 250, 251] as [number, number, number];

  const drawPageHeader = (): void => {
    doc.setFillColor(...HEAD);
    doc.rect(0, 0, PW, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CAR CRAFT CO — DIESEL CONSUMPTION REPORT', ML, 10.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${periodStr}  |  Generated: ${generatedOn}`, PW - MR, 10.5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const addFooters = (): void => {
    const total = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('Car Craft Co — Diesel Management Report', ML, PH - 5);
      doc.text(`Page ${p} of ${total}`, PW / 2, PH - 5, { align: 'center' });
      doc.text(dateStamp, PW - MR, PH - 5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }
  };

  const lastY = (): number => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 22;

  const addSectionHeading = (title: string, rgb: [number, number, number] = HEAD): number => {
    const y = lastY() + 8;
    const safe = y > PH - 35 ? (() => { doc.addPage(); drawPageHeader(); return 26; })() : y;
    doc.setFillColor(...rgb);
    doc.rect(ML, safe - 7, PW - ML - MR, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, ML + 3, safe - 0.5);
    doc.setTextColor(0, 0, 0);
    return safe + 2;
  };

  const baseOpts = (startY: number, isReefer = false) => ({
    startY,
    margin: { left: ML, right: MR },
    styles: { fontSize: 9, cellPadding: 2 } as const,
    headStyles: {
      fillColor: isReefer ? CYAN : HEAD,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold' as const,
    },
    alternateRowStyles: { fillColor: ALT },
    footStyles: { fillColor: TOT, textColor: TTEXT, fontStyle: 'bold' as const },
    showFoot: 'lastPage' as const,
    didDrawPage: () => { drawPageHeader(); },
  });

  const pdfSum = <T>(arr: T[], key: keyof T) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);

  drawPageHeader();

  // ── Overview ────────────────────────────────────────────────────────────
  if (sel.overview) {
    const startY = addSectionHeading('OVERVIEW — FLEET SUMMARY');
    const tL = truckRecords.reduce((s, r) => s + (r.litres_filled || 0), 0);
    const tD = truckRecords.reduce((s, r) => s + (r.distance_travelled || 0), 0);
    const rL = reeferRecords.reduce((s, r) => s + (r.litres_filled || 0), 0);
    autoTable(doc, {
      ...baseOpts(startY),
      head: [['Category', 'Truck Fleet', 'Reefer Fleet']],
      body: [
        ['Total Records', truckRecords.length, reeferRecords.length],
        ['Total Litres', n2(tL), n2(rL)],
        ['Total Distance (km)', n2(tD), 'N/A'],
        ['Overall km/L', tL > 0 ? n3(tD / tL) : '—', 'N/A (L/hr)'],
        ['Unique Fleets/Units', fleetReports.length, reeferFleetReports.length],
        ['Unique Drivers', driverReports.length, reeferDriverReports.length],
      ],
      columnStyles: { 0: { fontStyle: 'bold' } },
    });
  }

  // ── Truck – By Driver ──────────────────────────────────────────────────
  if (sel.truckByDriver && driverReports.length > 0) {
    autoTable(doc, {
      ...baseOpts(addSectionHeading('TRUCK FLEET — BY DRIVER')),
      head: [['Driver', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Distance (km)', 'Avg km/L', 'Fills', 'Last Fill']],
      body: driverReports.map(r => [r.driver, n2(r.totalLitres), n2(r.totalCost), n2(r.totalDistance), n3(r.avgKmPerLitre), r.fillCount, r.lastFillDate]),
      foot: [['TOTAL', n2(pdfSum(driverReports, 'totalLitres')), n2(pdfSum(driverReports, 'totalCost')), n2(pdfSum(driverReports, 'totalDistance')), '', pdfSum(driverReports, 'fillCount'), '']],
      columnStyles: { 0: { cellWidth: 48 } },
    });
  }

  // ── Truck – By Fleet ───────────────────────────────────────────────────
  if (sel.truckByFleet && fleetReports.length > 0) {
    autoTable(doc, {
      ...baseOpts(addSectionHeading('TRUCK FLEET — BY FLEET NUMBER')),
      head: [['Fleet', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Distance (km)', 'Avg km/L', 'Fills', 'Drivers']],
      body: fleetReports.map(r => [r.fleet, n2(r.totalLitres), n2(r.totalCost), n2(r.totalDistance), n3(r.avgKmPerLitre), r.fillCount, r.drivers.slice(0, 4).join(', ') + (r.drivers.length > 4 ? ` +${r.drivers.length - 4}` : '')]),
      foot: [['TOTAL', n2(pdfSum(fleetReports, 'totalLitres')), n2(pdfSum(fleetReports, 'totalCost')), n2(pdfSum(fleetReports, 'totalDistance')), '', pdfSum(fleetReports, 'fillCount'), '']],
    });
  }

  // ── Truck – By Station ─────────────────────────────────────────────────
  if (sel.truckByStation && stationReports.length > 0) {
    autoTable(doc, {
      ...baseOpts(addSectionHeading('TRUCK FLEET — BY FUEL STATION')),
      head: [['Fuel Station', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Avg Cost/Litre', 'Fills', 'Fleets Served']],
      body: stationReports.map(r => [r.station, n2(r.totalLitres), n2(r.totalCost), n2(r.avgCostPerLitre), r.fillCount, r.fleetsServed.slice(0, 5).join(', ') + (r.fleetsServed.length > 5 ? ` +${r.fleetsServed.length - 5}` : '')]),
      foot: [['TOTAL', n2(pdfSum(stationReports, 'totalLitres')), n2(pdfSum(stationReports, 'totalCost')), '', pdfSum(stationReports, 'fillCount'), '']],
    });
  }

  // ── Weekly Consumption ─────────────────────────────────────────────────
  if (sel.weekly && weeklyReports.length > 0) {
    for (const week of weeklyReports) {
      addSectionHeading(`WEEK ${week.weekNumber} — ${week.weekLabel}  (${week.weekStart} – ${week.weekEnd})`);
      for (const section of week.sections) {
        const isR = section.isReeferSection;
        const subY = lastY() + 4;
        if (subY < PH - 20) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...(isR ? CYAN : HEAD));
          doc.text(`  ▸  ${section.name}`, ML, subY);
          doc.setTextColor(0, 0, 0);
        }
        const st = section.sectionTotal;
        autoTable(doc, {
          ...baseOpts(subY + 2, isR),
          head: [isR
            ? ['Reefer Unit', 'Litres', 'Hrs Operated', 'L/H', 'Cost (USD)', 'Cost (USD)']
            : ['Fleet', 'Litres', 'KM', 'km/L', 'Cost (USD)', 'Cost (USD)']],
          body: section.data
            .filter(d => isR ? d.totalLitres > 0 || d.totalHours > 0 : d.totalLitres > 0 || d.totalKm > 0)
            .map(d => isR
              ? [d.fleet, n2(d.totalLitres), dash(d.totalHours, 1), dash(d.reeferConsumption, 2), n2(d.totalCost)]
              : [d.fleet, n2(d.totalLitres), d.totalKm > 0 ? d.totalKm : '—', dash(d.consumption, 3), n2(d.totalCost)]),
          foot: [isR
            ? ['Section Total', n2(st.totalLitres), st.totalHours > 0 ? n3(st.totalHours) : '—', st.reeferConsumption ? n3(st.reeferConsumption) : '—', n2(st.totalCost)]
            : ['Section Total', n2(st.totalLitres), st.totalKm > 0 ? st.totalKm : '—', st.consumption ? n3(st.consumption) : '—', n2(st.totalCost)]],
        });
      }
      const gt = week.grandTotal;
      const gtY = lastY() + 3;
      doc.setFillColor(...TOT);
      doc.rect(ML, gtY - 1, PW - ML - MR, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...TTEXT);
      doc.text(`GRAND TOTAL  —  Litres: ${n2(gt.totalLitres)}   |   Cost: ${n2(gt.totalCost)}`, ML + 3, gtY + 4.5);
      doc.setTextColor(0, 0, 0);
    }
  }

  // ── Reefer – By Fleet ──────────────────────────────────────────────────
  if (sel.reeferByFleet && reeferFleetReports.length > 0) {
    autoTable(doc, {
      ...baseOpts(addSectionHeading('REEFER FLEET — BY REEFER UNIT', CYAN), true),
      head: [['Reefer Unit', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Avg L/H', 'Hrs Operated', 'Fills', 'Drivers']],
      body: reeferFleetReports.map(r => [r.fleet, n2(r.totalLitres), n2(r.totalCost), r.avgLitresPerHour > 0 ? n2(r.avgLitresPerHour) : '—', r.totalHoursOperated > 0 ? n2(r.totalHoursOperated) : '—', r.fillCount, r.drivers.slice(0, 3).join(', ')]),
      foot: [['TOTAL', n2(pdfSum(reeferFleetReports, 'totalLitres')), n2(pdfSum(reeferFleetReports, 'totalCost')), '', n2(pdfSum(reeferFleetReports, 'totalHoursOperated')), pdfSum(reeferFleetReports, 'fillCount'), '']],
    });
  }

  // ── Reefer – By Driver ─────────────────────────────────────────────────
  if (sel.reeferByDriver && reeferDriverReports.length > 0) {
    autoTable(doc, {
      ...baseOpts(addSectionHeading('REEFER FLEET — BY DRIVER', CYAN), true),
      head: [['Driver', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Avg L/H', 'Hrs Operated', 'Fills', 'Last Fill', 'Reefer Units']],
      body: reeferDriverReports.map(r => [r.driver, n2(r.totalLitres), n2(r.totalCost), r.avgLitresPerHour > 0 ? n2(r.avgLitresPerHour) : '—', r.totalHoursOperated > 0 ? n2(r.totalHoursOperated) : '—', r.fillCount, r.lastFillDate, r.fleets.join(', ')]),
      foot: [['TOTAL', n2(pdfSum(reeferDriverReports, 'totalLitres')), n2(pdfSum(reeferDriverReports, 'totalCost')), '', n2(pdfSum(reeferDriverReports, 'totalHoursOperated')), pdfSum(reeferDriverReports, 'fillCount'), '', '']],
      columnStyles: { 0: { cellWidth: 45 } },
    });
  }

  // ── Reefer – By Station ────────────────────────────────────────────────
  if (sel.reeferByStation && reeferStationReports.length > 0) {
    autoTable(doc, {
      ...baseOpts(addSectionHeading('REEFER FLEET — BY FUEL STATION', CYAN), true),
      head: [['Fuel Station', 'Total Litres', 'Cost (USD)', 'Cost (USD)', 'Avg Cost/Litre', 'Fills', 'Reefer Units']],
      body: reeferStationReports.map(r => [r.station, n2(r.totalLitres), n2(r.totalCost), n2(r.avgCostPerLitre), r.fillCount, r.fleetsServed.join(', ')]),
      foot: [['TOTAL', n2(pdfSum(reeferStationReports, 'totalLitres')), n2(pdfSum(reeferStationReports, 'totalCost')), '', pdfSum(reeferStationReports, 'fillCount'), '']],
    });
  }

  // ── Truck Transactions ─────────────────────────────────────────────────
  if (sel.truckTransactions && truckRecords.length > 0) {
    doc.addPage();
    drawPageHeader();
    autoTable(doc, {
      ...baseOpts(addSectionHeading('TRUCK TRANSACTIONS — RAW DATA')),
      head: [['Date', 'Fleet', 'Driver', 'Station', 'Litres', 'Cost/L', 'Total', 'Ccy', 'KM', '∆KM', 'km/L', 'Debrief']],
      body: truckRecords.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(r => {
        const kml = r.distance_travelled && r.litres_filled ? n3(r.distance_travelled / r.litres_filled) : '—';
        return [r.date, r.fleet_number, r.driver_name || '', r.fuel_station || '', r.litres_filled ? n2(r.litres_filled) : '', r.cost_per_litre ? n2(r.cost_per_litre) : '', r.total_cost ? n2(r.total_cost) : '', r.currency || 'USD', r.km_reading || '', r.distance_travelled || '', kml, r.debrief_signed ? '✓' : '—'];
      }),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: HEAD, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: ALT },
    });
  }

  // ── Reefer Transactions ────────────────────────────────────────────────
  if (sel.reeferTransactions && reeferRecords.length > 0) {
    doc.addPage();
    drawPageHeader();
    autoTable(doc, {
      ...baseOpts(addSectionHeading('REEFER TRANSACTIONS — RAW DATA', CYAN), true),
      head: [['Date', 'Unit', 'Driver', 'Station', 'Litres', 'Cost/L', 'Total', 'Ccy', 'Op.Hrs', '∆Hrs', 'L/H', 'Notes']],
      body: reeferRecords.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(r => {
        const lph = r.hours_operated && r.litres_filled ? n2(r.litres_filled / r.hours_operated) : '—';
        return [r.date, r.fleet_number, r.driver_name || '', r.fuel_station || '', r.litres_filled ? n2(r.litres_filled) : '', r.cost_per_litre ? n2(r.cost_per_litre) : '', r.total_cost ? n2(r.total_cost) : '', r.currency || 'USD', r.operating_hours ?? '', r.hours_operated ?? '', lph, (r.notes || '').substring(0, 40)];
      }),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: CYAN, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: ALT },
    });
  }

  // ── Footer on every page ───────────────────────────────────────────────
  addFooters();

  doc.save(`diesel-report-${dateStamp}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Yearly Weekly-Filtered Excel Export (separate Reefer & Truck sheets)
// ─────────────────────────────────────────────────────────────────────────────

export interface YearlyWeeklyExportInput {
  year: number;
  truckRecords: DieselExportRecord[];
  reeferRecords: DieselExportRecord[];
}

type YearlyReeferRecord = DieselExportRecord & {
  operating_hours?: number;
  hours_operated?: number;
};

/**
 * Generate a yearly Excel workbook with transactions grouped by ISO week.
 * Creates two sheets:
 *   1. "Trucks" — All non-reefer diesel transactions, grouped by week
 *   2. "Reefers" — All reefer diesel transactions, grouped by week
 * Each week has a header row followed by the individual transactions.
 */
export const generateYearlyWeeklyDieselExcel = async (
  input: YearlyWeeklyExportInput,
): Promise<void> => {
  const { year, truckRecords, reeferRecords } = input;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Car Craft Co — Fleet Management';
  wb.created = new Date();
  const generatedOn = format(new Date(), 'MMM dd, yyyy HH:mm');

  /** Get ISO week start (Monday) from a date */
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  /** Get ISO week number */
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  /** Format week label */
  const fmtWeek = (start: Date): string => {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}`;
  };

  /** Group records by ISO week key */
  const groupByWeek = <T extends { date: string }>(records: T[]): Map<string, { weekStart: Date; weekNum: number; records: T[] }> => {
    const weekMap = new Map<string, { weekStart: Date; weekNum: number; records: T[] }>();
    for (const rec of records) {
      const d = new Date(rec.date);
      if (d.getFullYear() !== year) continue;
      const ws = getWeekStart(d);
      const key = ws.toISOString().split('T')[0];
      if (!weekMap.has(key)) {
        weekMap.set(key, { weekStart: ws, weekNum: getWeekNumber(ws), records: [] });
      }
      weekMap.get(key)!.records.push(rec);
    }
    return weekMap;
  };

  // ── Trucks Sheet ──────────────────────────────────────────────────────
  const truckHeaders = ['Date', 'Fleet', 'Driver', 'Fuel Station', 'Litres', 'Cost/L', 'Total Cost', 'Currency', 'KM Reading', 'Distance', 'km/L', 'Notes'];
  const truckCols = truckHeaders.length;

  const wsTruck = wb.addWorksheet('Trucks');
  wsTruck.columns = [14, 10, 24, 28, 12, 12, 14, 8, 12, 12, 8, 32].map(w => ({ width: w }));
  _xlSheetTitle(wsTruck, `TRUCK DIESEL TRANSACTIONS — ${year}`, `Generated: ${generatedOn}`, truckCols);

  const truckWeeks = groupByWeek(truckRecords);
  const sortedTruckWeeks = Array.from(truckWeeks.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  let truckGrandLitres = 0, truckGrandCost = 0, truckGrandDistance = 0;

  for (const [, { weekStart, weekNum, records }] of sortedTruckWeeks) {
    // Week header
    _xlSection(wsTruck, `WEEK ${weekNum} — ${fmtWeek(weekStart)}`, truckCols, XC.weekHead);
    _xlHeaders(wsTruck, truckHeaders);

    // Sort by date within the week
    const sorted = records.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let weekLitres = 0, weekCost = 0, weekDist = 0;
    sorted.forEach((r, i) => {
      const litres = r.litres_filled || 0;
      const cost = r.total_cost || 0;
      const dist = r.distance_travelled || 0;
      const kml = dist && litres ? n3(dist / litres) : '—';

      weekLitres += litres;
      weekCost += cost;
      weekDist += dist;

      _xlDataRow(wsTruck, [
        r.date, r.fleet_number, r.driver_name || '', r.fuel_station || '',
        litres ? n2(litres) : '', r.cost_per_litre ? n2(r.cost_per_litre) : '',
        cost ? n2(cost) : '', r.currency || 'USD',
        r.km_reading || '', dist || '', kml,
        (r.notes || '').replace(/[\t\n\r]/g, ' '),
      ], i % 2 === 1);
    });

    // Week subtotal
    const weekTotalLabel = `Week ${weekNum} Total — ${records.length} transactions`;
    const weekCostStr = `${n2(weekCost)}`;
    _xlTotalRow(wsTruck, [weekTotalLabel, '', '', '', n2(weekLitres), '', weekCostStr, '', '', weekDist || '', weekDist && weekLitres ? n3(weekDist / weekLitres) : '', '']);
    wsTruck.addRow([]);

    truckGrandLitres += weekLitres;
    truckGrandCost += weekCost;
    truckGrandDistance += weekDist;
  }

  // Grand total for trucks
  if (sortedTruckWeeks.length > 0) {
    const grandCostStr = `${n2(truckGrandCost)}`;
    _xlTotalRow(wsTruck, [`YEAR ${year} GRAND TOTAL — ${truckRecords.filter(r => new Date(r.date).getFullYear() === year).length} transactions`, '', '', '', n2(truckGrandLitres), '', grandCostStr, '', '', truckGrandDistance || '', truckGrandLitres ? n3(truckGrandDistance / truckGrandLitres) : '', '']);
  }
  wsTruck.views = [{ state: 'frozen', ySplit: 4 }];

  // ── Reefers Sheet ─────────────────────────────────────────────────────
  const reeferYearlyRecords = reeferRecords as YearlyReeferRecord[];
  const reeferHeaders = ['Date', 'Reefer Unit', 'Driver', 'Fuel Station', 'Litres', 'Cost/L', 'Total Cost', 'Currency', 'Op. Hours', 'Hrs Operated', 'L/H', 'Notes'];
  const reeferCols = reeferHeaders.length;

  const wsReefer = wb.addWorksheet('Reefers');
  wsReefer.columns = [14, 14, 24, 28, 12, 12, 14, 8, 14, 14, 8, 32].map(w => ({ width: w }));
  _xlSheetTitle(wsReefer, `REEFER DIESEL TRANSACTIONS — ${year}`, `Generated: ${generatedOn}`, reeferCols);

  const reeferWeeks = groupByWeek(reeferYearlyRecords);
  const sortedReeferWeeks = Array.from(reeferWeeks.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  let reeferGrandLitres = 0, reeferGrandCost = 0;

  for (const [, { weekStart, weekNum, records }] of sortedReeferWeeks) {
    _xlSection(wsReefer, `WEEK ${weekNum} — ${fmtWeek(weekStart)}`, reeferCols, XC.cyan);
    _xlHeaders(wsReefer, reeferHeaders, XC.cyan);

    const sorted = records.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let weekLitres = 0, weekCost = 0;
    sorted.forEach((r, i: number) => {
      const litres = r.litres_filled || 0;
      const cost = r.total_cost || 0;
      const lph = r.hours_operated && litres ? n2(litres / r.hours_operated) : '—';

      weekLitres += litres;
      weekCost += cost;

      _xlDataRow(wsReefer, [
        r.date, r.fleet_number, r.driver_name || '', r.fuel_station || '',
        litres ? n2(litres) : '', r.cost_per_litre ? n2(r.cost_per_litre) : '',
        cost ? n2(cost) : '', r.currency || 'USD',
        r.operating_hours ?? '', r.hours_operated ?? '', lph,
        (r.notes || '').replace(/[\t\n\r]/g, ' '),
      ], i % 2 === 1);
    });

    const weekCostStr = `${n2(weekCost)}`;
    _xlTotalRow(wsReefer, [`Week ${weekNum} Total — ${records.length} transactions`, '', '', '', n2(weekLitres), '', weekCostStr, '', '', '', '', '']);
    wsReefer.addRow([]);

    reeferGrandLitres += weekLitres;
    reeferGrandCost += weekCost;
  }

  // Grand total for reefers
  if (sortedReeferWeeks.length > 0) {
    const grandCostStr = `${n2(reeferGrandCost)}`;
    _xlTotalRow(wsReefer, [`YEAR ${year} GRAND TOTAL — ${reeferYearlyRecords.filter((r) => new Date(r.date).getFullYear() === year).length} transactions`, '', '', '', n2(reeferGrandLitres), '', grandCostStr, '', '', '', '', '']);
  }
  wsReefer.views = [{ state: 'frozen', ySplit: 4 }];

  // ── Write buffer → browser download ─────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diesel-yearly-weekly-${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};