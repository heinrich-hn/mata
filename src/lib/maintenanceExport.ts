import type { MaintenanceSchedule } from '@/types/maintenance';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface MaintenanceHistory {
  id: string;
  completed_date: string;
  status: string;
  duration_hours: number | null;
  total_cost: number | null;
  notes: string | null;
  maintenance_schedules?: {
    service_type: string;
    vehicle_id?: string;
  } | null;
}

export const exportSchedulesToPDF = (schedules: MaintenanceSchedule[], title: string = 'Maintenance Schedules') => {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 20);

  // Add generation date
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, 28);

  // Prepare table data
  const tableData = schedules.map(schedule => [
    schedule.title || 'Untitled',
    schedule.maintenance_type,
    schedule.category,
    schedule.priority,
    schedule.next_due_date ? format(new Date(schedule.next_due_date), 'MMM dd, yyyy') : 'N/A',
    schedule.assigned_to || 'Unassigned',
  ]);

  // Add table
  autoTable(doc, {
    head: [['Title', 'Type', 'Category', 'Priority', 'Due Date', 'Assigned To']],
    body: tableData,
    startY: 35,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  // Save PDF
  doc.save(`maintenance-schedules-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

export const exportHistoryToPDF = (history: MaintenanceHistory[], title: string = 'Maintenance History') => {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 20);

  // Add generation date
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, 28);

  // Prepare table data
  const tableData = history.map(entry => [
    entry.maintenance_schedules?.service_type || 'N/A',
    entry.maintenance_schedules?.vehicle_id || 'N/A',
    format(new Date(entry.completed_date), 'MMM dd, yyyy'),
    entry.status,
    entry.duration_hours?.toString() || '-',
    entry.total_cost ? `R${entry.total_cost.toFixed(2)}` : '-',
    entry.notes || '-',
  ]);

  // Add table
  autoTable(doc, {
    head: [['Service Type', 'Vehicle', 'Completed', 'Status', 'Duration (h)', 'Cost', 'Notes']],
    body: tableData,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  });
  // Save PDF
  doc.save(`maintenance-history-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

export const exportSchedulesToExcel = (schedules: MaintenanceSchedule[], filename: string = 'maintenance-schedules') => {
  const worksheet = XLSX.utils.json_to_sheet(
    schedules.map(schedule => ({
      Title: schedule.title || 'Untitled',
      'Maintenance Type': schedule.maintenance_type,
      Category: schedule.category,
      Priority: schedule.priority,
      'Next Due Date': schedule.next_due_date ? format(new Date(schedule.next_due_date), 'MMM dd, yyyy') : 'N/A',
      'Assigned To': schedule.assigned_to || 'Unassigned',
    }))
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedules');

  XLSX.writeFile(workbook, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

export const exportHistoryToExcel = (history: MaintenanceHistory[], filename: string = 'maintenance-history') => {
  const worksheet = XLSX.utils.json_to_sheet(
    history.map(entry => ({
      'Service Type': entry.maintenance_schedules?.service_type || 'N/A',
      'Vehicle ID': entry.maintenance_schedules?.vehicle_id || 'N/A',
      'Completed Date': format(new Date(entry.completed_date), 'MMM dd, yyyy'),
      Status: entry.status,
      'Duration (hours)': entry.duration_hours || '-',
      'Total Cost (R)': entry.total_cost || '-',
      Notes: entry.notes || '-',
    }))
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'History');

  XLSX.writeFile(workbook, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

export const exportOverdueToPDF = (schedules: MaintenanceSchedule[]) => {
  const doc = new jsPDF();
  const today = new Date();

  doc.setFontSize(18);
  doc.text('Overdue Maintenance Schedules', 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(today, 'PPP p')}`, 14, 28);
  doc.text(`Total Overdue: ${schedules.length}`, 14, 34);

  const tableData = schedules.map(schedule => {
    const dueDate = schedule.next_due_date ? new Date(schedule.next_due_date) : null;
    const daysOverdue = dueDate ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    return [
      schedule.title || schedule.service_type || 'Untitled',
      schedule.category || '-',
      schedule.priority || '-',
      schedule.next_due_date ? format(dueDate!, 'MMM dd, yyyy') : 'N/A',
      `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`,
      schedule.assigned_to || 'Unassigned',
      schedule.vehicle_id || '-',
    ];
  });

  autoTable(doc, {
    head: [['Title', 'Category', 'Priority', 'Due Date', 'Days Overdue', 'Assigned To', 'Vehicle']],
    body: tableData,
    startY: 40,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [220, 38, 38] },
  });

  doc.save(`overdue-maintenance-${format(today, 'yyyy-MM-dd')}.pdf`);
};

export const exportOverdueToExcel = (schedules: MaintenanceSchedule[]) => {
  const today = new Date();

  const worksheet = XLSX.utils.json_to_sheet(
    schedules.map(schedule => {
      const dueDate = schedule.next_due_date ? new Date(schedule.next_due_date) : null;
      const daysOverdue = dueDate ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return {
        Title: schedule.title || schedule.service_type || 'Untitled',
        Category: schedule.category || '-',
        Priority: schedule.priority || '-',
        'Due Date': schedule.next_due_date ? format(dueDate!, 'MMM dd, yyyy') : 'N/A',
        'Days Overdue': daysOverdue,
        'Assigned To': schedule.assigned_to || 'Unassigned',
        'Vehicle ID': schedule.vehicle_id || '-',
        Description: schedule.description || '-',
      };
    })
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Overdue Schedules');

  XLSX.writeFile(workbook, `overdue-maintenance-${format(today, 'yyyy-MM-dd')}.xlsx`);
};