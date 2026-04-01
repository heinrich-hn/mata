import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TyreInspectionPdfData {
    inspectionNumber: string;
    inspectionDate: string;
    vehicleRegistration: string;
    fleetNumber: string | null;
    inspectorName: string;
    odometerReading: number | null;
    status: string;
    hasFault: boolean;
    positions: TyrePositionPdfData[];
    inspectionHistory?: InspectionHistoryEntry[];
}

interface TyrePositionPdfData {
    position: string;
    positionLabel: string;
    brand: string;
    size: string;
    dotCode: string;
    treadDepth: string;
    pressure: string;
    condition: string;
    wearPattern: string;
    kmTravelled: number | null;
    installationKm: number | null;
    purchaseCost: number | null;
    initialTreadDepth: number | null;
    treadWorn: number | null;
    wearRate: number | null;
    costPerMm: number | null;
    notes: string;
}

export interface InspectionHistoryEntry {
    inspectionNumber: string;
    inspectionDate: string;
    inspectorName: string;
    inspectionType: string;
    odometerReading: number | null;
    status: string;
    hasFault: boolean;
}

export interface TyreLifecyclePdfData {
    tyreId: string;
    dotCode: string | null;
    serialNumber: string | null;
    brand: string | null;
    model: string | null;
    size: string | null;
    condition: string | null;
    currentTreadDepth: number | null;
    initialTreadDepth: number | null;
    installationDate: string | null;
    installationKm: number | null;
    kmTravelled: number | null;
    purchaseCost: number | null;
    currentVehicle: string | null;
    currentPosition: string | null;
    events: TyreLifecycleEvent[];
    inspections: TyreLifecycleInspection[];
}

interface TyreLifecycleEvent {
    eventType: string;
    eventDate: string;
    notes: string | null;
    metadata: Record<string, unknown> | null;
}

interface TyreLifecycleInspection {
    inspectionDate: string;
    position: string;
    treadDepth: number | null;
    pressure: number | null;
    condition: string;
    wearPattern: string | null;
    inspectorName: string | null;
    vehicleRegistration: string | null;
}

/**
 * Generate a PDF report for a completed tyre inspection
 */
export function generateTyreInspectionPDF(data: TyreInspectionPdfData): void {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(31, 56, 100);
    doc.text('Tyre Inspection Report', centerX, 18, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Matanuska - Fleet Management System', centerX, 25, { align: 'center' });

    // Divider
    doc.setDrawColor(31, 56, 100);
    doc.setLineWidth(0.5);
    doc.line(14, 29, pageWidth - 14, 29);

    // Inspection details - two column layout
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const startY = 36;
    const leftX = 14;
    const rightX = centerX + 10;
    const labelOffset = 35;

    const drawField = (label: string, value: string, x: number, y: number) => {
        doc.setFont(undefined!, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(`${label}:`, x, y);
        doc.setFont(undefined!, 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(value, x + labelOffset, y);
    };

    drawField('Inspection #', data.inspectionNumber || '-', leftX, startY);
    const vehicleText = data.fleetNumber
        ? `${data.vehicleRegistration} (Fleet ${data.fleetNumber})`
        : data.vehicleRegistration;
    drawField('Vehicle', vehicleText || '-', leftX, startY + 7);
    drawField('Inspector', data.inspectorName || '-', leftX, startY + 14);

    drawField('Date', data.inspectionDate
        ? new Date(data.inspectionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '-', rightX, startY);
    drawField('Odometer', data.odometerReading ? `${data.odometerReading.toLocaleString()} km` : '-', rightX, startY + 7);
    drawField('Status', (data.status || 'completed').toUpperCase(), rightX, startY + 14);

    // Faults indicator
    doc.setFont(undefined!, 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('Faults:', leftX, startY + 21);
    doc.setFont(undefined!, 'normal');
    doc.setTextColor(data.hasFault ? 200 : 0, data.hasFault ? 0 : 130, 0);
    doc.text(data.hasFault ? 'Yes — see details below' : 'None', leftX + labelOffset, startY + 21);
    doc.setTextColor(40, 40, 40);

    // Summary statistics computed from positions
    const posWithTyres = data.positions.filter(p => p.treadDepth || p.initialTreadDepth);
    const totalCost = posWithTyres.reduce((s, p) => s + (p.purchaseCost || 0), 0);
    const totalKm = posWithTyres.reduce((s, p) => s + (p.kmTravelled || 0), 0);
    const avgInstallKm = (() => {
        const withKm = posWithTyres.filter(p => p.installationKm != null);
        return withKm.length > 0 ? withKm.reduce((s, p) => s + (p.installationKm || 0), 0) / withKm.length : null;
    })();
    const avgInitialTread = (() => {
        const withTread = posWithTyres.filter(p => p.initialTreadDepth != null);
        return withTread.length > 0 ? withTread.reduce((s, p) => s + (p.initialTreadDepth || 0), 0) / withTread.length : null;
    })();
    const avgCurrentTread = (() => {
        const withTread = posWithTyres.filter(p => p.treadDepth);
        return withTread.length > 0 ? withTread.reduce((s, p) => s + (parseFloat(p.treadDepth) || 0), 0) / withTread.length : null;
    })();
    const avgWorn = (avgInitialTread != null && avgCurrentTread != null && avgInitialTread > avgCurrentTread)
        ? avgInitialTread - avgCurrentTread : null;

    // Summary bar
    const summaryY = startY + 27;
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, pageWidth - 28, 12, 2, 2, 'FD');

    doc.setFontSize(7.5);
    const summaryItems: string[] = [
        `Installed Price: $${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Install Odom: ${avgInstallKm != null ? `${Math.round(avgInstallKm).toLocaleString()} km` : '-'}`,
        `KM Travelled: ${totalKm > 0 ? `${totalKm.toLocaleString()} km` : '-'}`,
        `Installed mm: ${avgInitialTread != null ? `${avgInitialTread.toFixed(1)} mm` : '-'}`,
        `Inspected mm: ${avgCurrentTread != null ? `${avgCurrentTread.toFixed(1)} mm` : '-'}`,
        `Wear: ${avgWorn != null ? `${avgWorn.toFixed(1)} mm` : '-'}`,
    ];
    const segmentWidth = (pageWidth - 28) / summaryItems.length;
    summaryItems.forEach((item, i) => {
        const segX = 14 + segmentWidth * i + segmentWidth / 2;
        const [label, value] = item.split(': ');
        doc.setFont(undefined!, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(label + ':', segX, summaryY + 5, { align: 'center' });
        doc.setFont(undefined!, 'normal');
        doc.setTextColor(31, 56, 100);
        doc.text(value, segX, summaryY + 9.5, { align: 'center' });
    });

    // Positions table
    const tableStartY = summaryY + 16;
    doc.setFontSize(11);
    doc.setFont(undefined!, 'bold');
    doc.setTextColor(31, 56, 100);
    doc.text('Tyre Positions', 14, tableStartY);

    const tableData = data.positions.map((pos) => [
        pos.positionLabel || pos.position,
        pos.dotCode || '-',
        pos.brand || '-',
        pos.size || '-',
        pos.treadDepth ? `${pos.treadDepth} mm` : '-',
        pos.treadWorn !== null && pos.treadWorn > 0 ? `${pos.treadWorn.toFixed(1)} mm` : '-',
        pos.kmTravelled !== null ? pos.kmTravelled.toLocaleString() : '-',
        pos.wearRate !== null ? pos.wearRate.toFixed(2) : '-',
        pos.costPerMm !== null ? `$${pos.costPerMm.toFixed(2)}` : '-',
        pos.pressure ? `${pos.pressure}` : '-',
        (pos.condition || '-').replace('_', ' '),
    ]);

    autoTable(doc, {
        startY: tableStartY + 3,
        head: [['Position', 'Serial / DOT', 'Brand', 'Size', 'Tread', 'Worn', 'KM Travelled', 'mm/1000km', 'Cost/MM', 'PSI', 'Condition']],
        body: tableData,
        theme: 'striped',
        headStyles: {
            fillColor: [31, 56, 100],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: 3,
            halign: 'center',
        },
        bodyStyles: {
            fontSize: 7.5,
            cellPadding: 2.5,
            halign: 'center',
        },
        alternateRowStyles: { fillColor: [240, 244, 248] },
        columnStyles: {
            0: { cellWidth: 32, halign: 'left', fontStyle: 'bold' },
            1: { cellWidth: 30 },
            2: { cellWidth: 24 },
            3: { cellWidth: 30 },
            4: { cellWidth: 20 },
            5: { cellWidth: 20 },
            6: { cellWidth: 28 },
            7: { cellWidth: 22 },
            8: { cellWidth: 22 },
            9: { cellWidth: 16 },
            10: { cellWidth: 24 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (cellData) => {
            // Condition column color coding
            if (cellData.column.index === 10 && cellData.section === 'body') {
                const val = cellData.cell.text[0]?.toLowerCase();
                if (val === 'poor' || val === 'needs replacement') {
                    cellData.cell.styles.textColor = [200, 0, 0];
                    cellData.cell.styles.fontStyle = 'bold';
                } else if (val === 'fair') {
                    cellData.cell.styles.textColor = [180, 130, 0];
                } else if (val === 'good' || val === 'excellent') {
                    cellData.cell.styles.textColor = [0, 130, 0];
                }
            }
        },
    });

    // Notes section
    const positionsWithNotes = data.positions.filter((p) => p.notes);
    if (positionsWithNotes.length > 0) {
        const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || tableStartY + 60;
        doc.setFontSize(11);
        doc.setFont(undefined!, 'bold');
        doc.setTextColor(31, 56, 100);
        doc.text('Notes', 14, finalY + 10);

        doc.setFontSize(8);
        doc.setFont(undefined!, 'normal');
        doc.setTextColor(40, 40, 40);
        let noteY = finalY + 17;
        for (const pos of positionsWithNotes) {
            if (noteY > pageHeight - 20) {
                doc.addPage();
                noteY = 20;
            }
            doc.setFont(undefined!, 'bold');
            doc.text(`${pos.positionLabel}:`, 14, noteY);
            doc.setFont(undefined!, 'normal');
            const split = doc.splitTextToSize(pos.notes, pageWidth - 80);
            doc.text(split, 55, noteY);
            noteY += split.length * 4.5 + 4;
        }
    }

    // Inspection History section
    if (data.inspectionHistory && data.inspectionHistory.length > 0) {
        let historyY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || tableStartY + 60;
        // If notes were rendered, recompute from last auto table
        if (positionsWithNotes.length > 0) {
            historyY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || historyY;
        }
        if (historyY > pageHeight - 40) {
            doc.addPage();
            historyY = 20;
        }

        doc.setFontSize(11);
        doc.setFont(undefined!, 'bold');
        doc.setTextColor(31, 56, 100);
        doc.text('Fleet Inspection History', 14, historyY + 10);

        const historyData = data.inspectionHistory.map((h) => [
            h.inspectionNumber,
            h.inspectionDate ? new Date(h.inspectionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
            h.inspectionType || '-',
            h.inspectorName || '-',
            h.odometerReading ? `${h.odometerReading.toLocaleString()} km` : '-',
            h.status?.toUpperCase() || '-',
            h.hasFault ? 'Yes' : 'No',
        ]);

        autoTable(doc, {
            startY: historyY + 13,
            head: [['Inspection #', 'Date', 'Type', 'Inspector', 'Odometer', 'Status', 'Faults']],
            body: historyData,
            theme: 'striped',
            headStyles: {
                fillColor: [60, 90, 140],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 7.5,
                cellPadding: 3,
                halign: 'center',
            },
            bodyStyles: {
                fontSize: 7.5,
                cellPadding: 2.5,
                halign: 'center',
            },
            alternateRowStyles: { fillColor: [240, 244, 248] },
            columnStyles: {
                0: { cellWidth: 40, halign: 'left' },
                1: { cellWidth: 35 },
                2: { cellWidth: 40 },
                3: { cellWidth: 45 },
                4: { cellWidth: 35 },
                5: { cellWidth: 30 },
                6: { cellWidth: 25 },
            },
            margin: { left: 14, right: 14 },
            didParseCell: (cellData) => {
                if (cellData.column.index === 6 && cellData.section === 'body') {
                    const val = cellData.cell.text[0];
                    if (val === 'Yes') {
                        cellData.cell.styles.textColor = [200, 0, 0];
                        cellData.cell.styles.fontStyle = 'bold';
                    }
                }
            },
        });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Page ${i} of ${pageCount}  |  Generated: ${new Date().toLocaleString()}  |  Matanuska Fleet Management`,
            centerX, pageHeight - 8, { align: 'center' }
        );
    }

    const fileName = `Tyre_Inspection_${data.inspectionNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

/**
 * Generate a PDF report for a single tyre's lifecycle (inspection + movement history)
 */
export function generateTyreLifecyclePDF(data: TyreLifecyclePdfData): void {
    const doc = new jsPDF({ orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;

    // Header
    doc.setFontSize(16);
    doc.setTextColor(31, 56, 100);
    doc.text('Tyre Lifecycle Report', centerX, 18, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Matanuska - Fleet Management System', centerX, 25, { align: 'center' });

    doc.setDrawColor(31, 56, 100);
    doc.setLineWidth(0.5);
    doc.line(14, 29, pageWidth - 14, 29);

    // Tyre info summary
    let y = 37;
    doc.setFontSize(10);

    const drawField = (label: string, value: string, x: number, yPos: number) => {
        doc.setFont(undefined!, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(`${label}:`, x, yPos);
        doc.setFont(undefined!, 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(value, x + 40, yPos);
    };

    const leftX = 14;
    const rightX = pageWidth / 2 + 10;

    drawField('DOT / Serial', data.dotCode || data.serialNumber || '-', leftX, y);
    drawField('Brand / Model', `${data.brand || '-'} ${data.model || ''}`.trim(), rightX, y);
    y += 7;
    drawField('Size', data.size || '-', leftX, y);
    drawField('Condition', (data.condition || '-').replace('_', ' '), rightX, y);
    y += 7;
    drawField('Installed', data.installationDate ? new Date(data.installationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-', leftX, y);
    drawField('Install Odom', data.installationKm != null ? `${data.installationKm.toLocaleString()} km` : '-', rightX, y);
    y += 7;
    drawField('KM Travelled', data.kmTravelled != null ? `${data.kmTravelled.toLocaleString()} km` : '-', leftX, y);
    drawField('Price (USD)', data.purchaseCost != null ? `$${data.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-', rightX, y);
    y += 7;
    drawField('Vehicle', data.currentVehicle || '-', leftX, y);
    drawField('Position', data.currentPosition || '-', rightX, y);

    // Summary stats bar
    y += 10;
    const treadWorn = (data.initialTreadDepth != null && data.currentTreadDepth != null && data.initialTreadDepth > data.currentTreadDepth)
        ? data.initialTreadDepth - data.currentTreadDepth : null;
    const wearRate = (treadWorn != null && treadWorn > 0 && data.kmTravelled != null && data.kmTravelled > 0)
        ? treadWorn / (data.kmTravelled / 1000) : null;
    const costPerMm = (treadWorn != null && treadWorn > 0 && data.purchaseCost != null && data.purchaseCost > 0)
        ? data.purchaseCost / treadWorn : null;

    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, pageWidth - 28, 12, 2, 2, 'FD');

    doc.setFontSize(7.5);
    const statsItems = [
        `Initial: ${data.initialTreadDepth != null ? `${data.initialTreadDepth.toFixed(1)} mm` : '-'}`,
        `Current: ${data.currentTreadDepth != null ? `${data.currentTreadDepth.toFixed(1)} mm` : '-'}`,
        `Worn: ${treadWorn != null ? `${treadWorn.toFixed(1)} mm` : '-'}`,
        `Wear Rate: ${wearRate != null ? `${wearRate.toFixed(2)} mm/1000km` : '-'}`,
        `Cost/MM: ${costPerMm != null ? `$${costPerMm.toFixed(2)}` : '-'}`,
    ];
    const statSegWidth = (pageWidth - 28) / statsItems.length;
    statsItems.forEach((item, i) => {
        const segX = 14 + statSegWidth * i + statSegWidth / 2;
        const [label, value] = item.split(': ');
        doc.setFont(undefined!, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(label + ':', segX, y + 5, { align: 'center' });
        doc.setFont(undefined!, 'normal');
        doc.setTextColor(31, 56, 100);
        doc.text(value, segX, y + 9.5, { align: 'center' });
    });

    // Lifecycle Events table
    y += 20;
    if (data.events.length > 0) {
        doc.setFontSize(11);
        doc.setFont(undefined!, 'bold');
        doc.setTextColor(31, 56, 100);
        doc.text('Lifecycle Events', 14, y);

        const eventsData = data.events.map((e) => [
            new Date(e.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            e.eventType.replace('_', ' ').toUpperCase(),
            e.notes || '-',
        ]);

        autoTable(doc, {
            startY: y + 3,
            head: [['Date', 'Event', 'Notes']],
            body: eventsData,
            theme: 'striped',
            headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
            bodyStyles: { fontSize: 8, cellPadding: 2.5 },
            alternateRowStyles: { fillColor: [240, 244, 248] },
            columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 35 }, 2: { cellWidth: 'auto' } },
            margin: { left: 14, right: 14 },
        });
    }

    // Inspection History table
    const eventsEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y;
    if (data.inspections.length > 0) {
        let inspY = eventsEndY + 10;
        if (inspY > pageHeight - 40) {
            doc.addPage();
            inspY = 20;
        }

        doc.setFontSize(11);
        doc.setFont(undefined!, 'bold');
        doc.setTextColor(31, 56, 100);
        doc.text('Inspection History', 14, inspY);

        const inspData = data.inspections.map((insp) => [
            new Date(insp.inspectionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            insp.position || '-',
            insp.treadDepth != null ? `${insp.treadDepth} mm` : '-',
            insp.pressure != null ? `${insp.pressure} PSI` : '-',
            (insp.condition || '-').replace('_', ' '),
            insp.wearPattern?.replace('_', ' ') || 'Normal',
            insp.inspectorName || '-',
            insp.vehicleRegistration || '-',
        ]);

        autoTable(doc, {
            startY: inspY + 3,
            head: [['Date', 'Position', 'Tread', 'Pressure', 'Condition', 'Wear', 'Inspector', 'Vehicle']],
            body: inspData,
            theme: 'striped',
            headStyles: { fillColor: [60, 90, 140], textColor: 255, fontStyle: 'bold', fontSize: 7.5, cellPadding: 3, halign: 'center' },
            bodyStyles: { fontSize: 7.5, cellPadding: 2.5, halign: 'center' },
            alternateRowStyles: { fillColor: [240, 244, 248] },
            margin: { left: 14, right: 14 },
            didParseCell: (cellData) => {
                if (cellData.column.index === 4 && cellData.section === 'body') {
                    const val = cellData.cell.text[0]?.toLowerCase();
                    if (val === 'poor' || val === 'needs replacement') {
                        cellData.cell.styles.textColor = [200, 0, 0];
                        cellData.cell.styles.fontStyle = 'bold';
                    } else if (val === 'fair') {
                        cellData.cell.styles.textColor = [180, 130, 0];
                    } else if (val === 'good' || val === 'excellent') {
                        cellData.cell.styles.textColor = [0, 130, 0];
                    }
                }
            },
        });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Page ${i} of ${pageCount}  |  Generated: ${new Date().toLocaleString()}  |  Matanuska Fleet Management`,
            centerX, pageHeight - 8, { align: 'center' }
        );
    }

    const identifier = data.dotCode || data.serialNumber || data.tyreId.slice(0, 8);
    doc.save(`Tyre_Lifecycle_${identifier}_${new Date().toISOString().split('T')[0]}.pdf`);
}
