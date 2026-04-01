import type { MaintenanceSchedule } from '@/types/maintenance';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  addStyledSheet,
  addSummarySheet,
  createWorkbook,
  saveWorkbook,
  priorityColours,
  statusColours,
} from '@/utils/excelStyles';

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

export const exportSchedulesToExcel = async (schedules: MaintenanceSchedule[], filename: string = 'maintenance-schedules') => {
  const headers = ['Title', 'Maintenance Type', 'Category', 'Priority', 'Next Due Date', 'Assigned To'];

  const rows = schedules.map(schedule => [
    schedule.title || 'Untitled',
    schedule.maintenance_type,
    schedule.category,
    schedule.priority,
    schedule.next_due_date ? format(new Date(schedule.next_due_date), 'MMM dd, yyyy') : 'N/A',
    schedule.assigned_to || 'Unassigned',
  ]);

  const wb = createWorkbook();

  addStyledSheet(wb, 'Schedules', {
    title: 'MAINTENANCE SCHEDULES',
    headers,
    rows,
    cellStyler: (row, col) => {
      if (col === 4) return priorityColours[String(row[3]).toLowerCase()];
      return undefined;
    },
    dropdowns: { 4: ['critical', 'high', 'medium', 'low'] },
  });

  // Summary
  const critical = schedules.filter(s => s.priority === 'critical').length;
  const high = schedules.filter(s => s.priority === 'high').length;
  addSummarySheet(wb, 'Summary', {
    title: 'SCHEDULE SUMMARY',
    rows: [
      ['Total Schedules', schedules.length],
      ['Critical Priority', critical],
      ['High Priority', high],
      ['Medium Priority', schedules.filter(s => s.priority === 'medium').length],
      ['Low Priority', schedules.filter(s => s.priority === 'low').length],
    ],
  });

  await saveWorkbook(wb, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

export const exportHistoryToExcel = async (history: MaintenanceHistory[], filename: string = 'maintenance-history') => {
  const headers = ['Service Type', 'Vehicle ID', 'Completed Date', 'Status', 'Duration (hours)', 'Total Cost (R)', 'Notes'];

  const rows = history.map(entry => [
    entry.maintenance_schedules?.service_type || 'N/A',
    entry.maintenance_schedules?.vehicle_id || 'N/A',
    format(new Date(entry.completed_date), 'MMM dd, yyyy'),
    entry.status,
    entry.duration_hours ?? '',
    entry.total_cost ? `R${entry.total_cost.toFixed(2)}` : '-',
    entry.notes || '-',
  ]);

  const wb = createWorkbook();

  addStyledSheet(wb, 'History', {
    title: 'MAINTENANCE HISTORY',
    headers,
    rows,
    cellStyler: (row, col) => {
      if (col === 4) return statusColours[String(row[3]).toLowerCase()];
      return undefined;
    },
  });

  // Summary
  const totalCost = history.reduce((s, e) => s + (e.total_cost || 0), 0);
  const totalHours = history.reduce((s, e) => s + (e.duration_hours || 0), 0);
  addSummarySheet(wb, 'Summary', {
    title: 'HISTORY SUMMARY',
    rows: [
      ['Total Records', history.length],
      ['Total Cost', `R${totalCost.toFixed(2)}`],
      ['Total Duration (hours)', totalHours],
      ['Average Cost per Job', history.length > 0 ? `R${(totalCost / history.length).toFixed(2)}` : 'R0.00'],
    ],
  });

  await saveWorkbook(wb, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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

export const exportOverdueToExcel = async (schedules: MaintenanceSchedule[]) => {
  const today = new Date();

  const headers = ['Title', 'Category', 'Priority', 'Due Date', 'Days Overdue', 'Assigned To', 'Vehicle ID', 'Description'];

  const rows = schedules.map(schedule => {
    const dueDate = schedule.next_due_date ? new Date(schedule.next_due_date) : null;
    const daysOverdue = dueDate ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    return [
      schedule.title || schedule.service_type || 'Untitled',
      schedule.category || '-',
      schedule.priority || '-',
      schedule.next_due_date ? format(dueDate!, 'MMM dd, yyyy') : 'N/A',
      daysOverdue,
      schedule.assigned_to || 'Unassigned',
      schedule.vehicle_id || '-',
      schedule.description || '-',
    ];
  });

  const wb = createWorkbook();

  addStyledSheet(wb, 'Overdue Schedules', {
    title: 'OVERDUE MAINTENANCE SCHEDULES',
    subtitle: `Generated: ${format(today, 'dd MMMM yyyy')} • Total Overdue: ${schedules.length} • Car Craft Co Fleet Management`,
    headers,
    rows,
    cellStyler: (row, col) => {
      if (col === 3) return priorityColours[String(row[2]).toLowerCase()];
      // Highlight days overdue red when > 14
      if (col === 5 && typeof row[4] === 'number' && row[4] > 14) {
        return { size: 9, name: 'Calibri', color: { argb: 'DC2626' }, bold: true };
      }
      return undefined;
    },
    dropdowns: { 3: ['critical', 'high', 'medium', 'low'] },
  });

  await saveWorkbook(wb, `overdue-maintenance-${format(today, 'yyyy-MM-dd')}.xlsx`);
};