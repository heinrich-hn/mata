import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface DieselAlert {
  id: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  created_at: string;
  metadata: {
    driver_name?: string;
    fleet_number?: string;
    date?: string;
    km_per_litre?: number;
    probe_discrepancy?: number;
    litres_filled?: number;
    distance_travelled?: number;
    consumption_rate?: number;
    issue_type?: string;
  };
}

// Define a type for the jsPDF instance with lastAutoTable
interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

export function generateDieselPDF(alerts: DieselAlert[], filter: string = 'all') {
  const doc = new jsPDF() as JsPDFWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Group by driver
  const driverMap = new Map<string, DieselAlert[]>();
  alerts.forEach(alert => {
    const driver = alert.metadata.driver_name || 'Unassigned';
    if (!driverMap.has(driver)) {
      driverMap.set(driver, []);
    }
    driverMap.get(driver)!.push(alert);
  });

  // Title
  doc.setFontSize(20);
  doc.setTextColor(33, 33, 33);
  doc.text('Diesel Alerts Report', pageWidth / 2, 20, { align: 'center' });

  // Metadata - filter is now guaranteed to be a string due to default value
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 30);
  doc.text(`Filter: ${filter} alerts`, 14, 35);
  doc.text(`Total Drivers: ${driverMap.size}`, 14, 40);
  doc.text(`Total Alerts: ${alerts.length}`, 14, 45);

  let yOffset = 55;

  // Process each driver
  driverMap.forEach((driverAlerts, driverName) => {
    // Check if we need a new page
    if (yOffset > 250) {
      doc.addPage();
      yOffset = 20;
    }

    // Calculate driver stats
    const activeCount = driverAlerts.filter(a => a.status === 'active').length;
    const criticalCount = driverAlerts.filter(a => a.severity === 'critical').length;
    const highCount = driverAlerts.filter(a => a.severity === 'high').length;
    const mediumCount = driverAlerts.filter(a => a.severity === 'medium').length;

    // Driver header
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yOffset - 4, pageWidth - 28, 10, 'F');

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold'); // Fixed: specify font family
    doc.text(driverName, 14, yOffset);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal'); // Reset to normal
    doc.text(`Total: ${driverAlerts.length} | Active: ${activeCount} | Critical: ${criticalCount} | High: ${highCount} | Medium: ${mediumCount}`,
      pageWidth - 14, yOffset, { align: 'right' });

    yOffset += 10;

    // Create table for this driver's alerts
    const tableData = driverAlerts.map(alert => {
      const date = alert.metadata.date
        ? format(new Date(alert.metadata.date), 'dd MMM yyyy')
        : format(new Date(alert.created_at), 'dd MMM yyyy');

      return [
        date,
        alert.metadata.fleet_number || '-',
        alert.metadata.issue_type?.replace(/_/g, ' ') || 'Fuel Alert',
        alert.metadata.km_per_litre?.toFixed(2) || '-',
        alert.metadata.litres_filled?.toFixed(1) || '-',
        alert.metadata.distance_travelled?.toFixed(1) || '-',
        alert.severity.toUpperCase(),
        alert.status
      ];
    });

    // Store the current yOffset before table
    const tableStartY = yOffset;

    autoTable(doc, {
      startY: tableStartY,
      head: [['Date', 'Fleet', 'Issue', 'km/L', 'Litres', 'km', 'Severity', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 35 },
        3: { cellWidth: 15 },
        4: { cellWidth: 15 },
        5: { cellWidth: 15 },
        6: { cellWidth: 20 },
        7: { cellWidth: 20 }
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Safely update yOffset only if cursor exists
        if (data && data.cursor && typeof data.cursor.y === 'number') {
          yOffset = data.cursor.y;
        }
      }
    });

    // Update yOffset after table using lastAutoTable
    if (doc.lastAutoTable && typeof doc.lastAutoTable.finalY === 'number') {
      yOffset = doc.lastAutoTable.finalY + 15;
    } else {
      // Fallback: add estimated height based on number of rows
      yOffset = tableStartY + (tableData.length * 10) + 30;
    }
  });

  // Summary page
  doc.addPage();
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary Statistics', pageWidth / 2, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal'); // Reset

  // Overall stats
  const totalActive = alerts.filter(a => a.status === 'active').length;
  const totalCritical = alerts.filter(a => a.severity === 'critical').length;
  const totalHigh = alerts.filter(a => a.severity === 'high').length;
  const totalMedium = alerts.filter(a => a.severity === 'medium').length;

  const summaryData = [
    ['Total Alerts', alerts.length.toString()],
    ['Active Alerts', totalActive.toString()],
    ['Critical Alerts', totalCritical.toString()],
    ['High Alerts', totalHigh.toString()],
    ['Medium Alerts', totalMedium.toString()],
    ['Drivers Affected', driverMap.size.toString()],
  ];

  autoTable(doc, {
    startY: 30,
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 11, cellPadding: 5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 40 }
    }
  });

  // Severity breakdown
  const severityData = [
    ['Critical', totalCritical.toString(), Math.round((totalCritical / alerts.length) * 100) + '%'],
    ['High', totalHigh.toString(), Math.round((totalHigh / alerts.length) * 100) + '%'],
    ['Medium', totalMedium.toString(), Math.round((totalMedium / alerts.length) * 100) + '%'],
    ['Low', alerts.filter(a => a.severity === 'low').length.toString(),
      Math.round((alerts.filter(a => a.severity === 'low').length / alerts.length) * 100) + '%'],
  ];

  autoTable(doc, {
    startY: 80,
    head: [['Severity', 'Count', 'Percentage']],
    body: severityData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  // Save the PDF
  doc.save(`diesel-alerts-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`);
}

export function generateDriverDieselPDF(driverName: string, alerts: DieselAlert[]) {
  const doc = new jsPDF() as JsPDFWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  doc.setTextColor(33, 33, 33);
  doc.setFont('helvetica', 'bold');
  doc.text(`Diesel Alerts - ${driverName}`, pageWidth / 2, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 30);
  doc.text(`Total Alerts: ${alerts.length}`, 14, 35);

  // Stats
  const activeCount = alerts.filter(a => a.status === 'active').length;
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Active: ${activeCount} | Critical: ${criticalCount} | High: ${highCount}`, 14, 45);
  doc.setFont('helvetica', 'normal');

  // Create table
  const tableData = alerts.map(alert => {
    const date = alert.metadata.date
      ? format(new Date(alert.metadata.date), 'dd MMM yyyy')
      : format(new Date(alert.created_at), 'dd MMM yyyy');

    return [
      date,
      alert.metadata.fleet_number || '-',
      alert.metadata.issue_type?.replace(/_/g, ' ') || 'Fuel Alert',
      alert.metadata.km_per_litre?.toFixed(2) || '-',
      alert.metadata.litres_filled?.toFixed(1) || '-',
      alert.metadata.distance_travelled?.toFixed(1) || '-',
      alert.severity.toUpperCase(),
      alert.status
    ];
  });

  autoTable(doc, {
    startY: 55,
    head: [['Date', 'Fleet', 'Issue', 'km/L', 'Litres', 'km', 'Severity', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 20 },
      2: { cellWidth: 35 },
      3: { cellWidth: 15 },
      4: { cellWidth: 15 },
      5: { cellWidth: 15 },
      6: { cellWidth: 20 },
      7: { cellWidth: 20 }
    },
    margin: { left: 14, right: 14 }
  });

  // Sanitize driver name for filename
  const safeDriverName = driverName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  doc.save(`diesel-alerts-${safeDriverName}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`);
}