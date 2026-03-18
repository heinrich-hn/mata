import { Trip } from '@/types/operations';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { formatCurrency, formatDate } from './formatters';
import { ProcessedTripReport } from './reportUtils';

export const downloadTripExcel = (report: ProcessedTripReport) => {
  const { trip, costs, kpis } = report;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Trip Summary Sheet
  const summaryData = [
    ['Trip Report'],
    [''],
    ['Trip Number', trip.trip_number],
    ['Fleet Number', trip.vehicle_id || 'N/A'],
    ['Driver', trip.driver_name || 'N/A'],
    ['Client', trip.client_name || 'N/A'],
    ['Origin', trip.origin || 'N/A'],
    ['Destination', trip.destination || 'N/A'],
    ['Departure Date', formatDate(trip.departure_date)],
    ['Arrival Date', formatDate(trip.arrival_date)],
    ['Distance (km)', trip.distance_km || 'N/A'],
    ['Status', trip.status],
    [''],
    ['Financial Summary'],
    ['Currency', kpis.currency],
    ['Total Revenue', formatCurrency(kpis.totalRevenue, kpis.currency)],
    ['Total Expenses', formatCurrency(kpis.totalExpenses, kpis.currency)],
    ['Net Profit/Loss', formatCurrency(kpis.netProfit, kpis.currency)],
    ['Cost per KM', kpis.costPerKm ? formatCurrency(kpis.costPerKm, kpis.currency) : 'N/A'],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Cost Entries Sheet
  const costData = [
    ['Date', 'Category', 'Sub-Category', 'Amount', 'Currency', 'Reference', 'Notes', 'Flagged', 'Attachments'],
    ...costs.map(cost => [
      formatDate(cost.date),
      cost.category,
      cost.sub_category || '',
      cost.amount,
      cost.currency,
      cost.reference_number || '',
      cost.notes || '',
      cost.is_flagged ? 'Yes' : 'No',
      cost.attachments && Array.isArray(cost.attachments) ? cost.attachments.length : 0,
    ]),
    ['', '', 'Total', kpis.totalExpenses, '', '', '', '', ''],
  ];

  const costSheet = XLSX.utils.aoa_to_sheet(costData);
  XLSX.utils.book_append_sheet(wb, costSheet, 'Cost Entries');

  // Generate and download
  XLSX.writeFile(wb, `Trip_Report_${trip.trip_number}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const downloadTripPDF = async (elementId: string, trip: Trip) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Report element not found');
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 0;

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    pdf.save(`Trip_Report_${trip.trip_number}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};