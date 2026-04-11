import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** jsPDF instance with autoTable plugin properties */
type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

export interface OocReportExportData {
    id: string;
    vehicle_id_or_license: string;
    make_model: string | null;
    year: string | null;
    odometer_hour_meter: string | null;
    location: string | null;
    reason_out_of_commission: string;
    immediate_plan: string[] | null;
    parts_required: Array<{
        partNameNumber: string;
        quantity: string;
        onHand: string;
        orderNeededBy: string;
    }> | null;
    additional_notes_safety_concerns: string | null;
    mechanic_name: string;
    mechanic_signature: string | null;
    report_date: string;
    report_time: string;
    sign_off_date: string | null;
    // Optional joined data
    inspection_number?: string | null;
    inspection_date?: string | null;
    inspector_name?: string | null;
    faults?: Array<{
        fault_description: string;
        severity: string;
        corrective_action_status: string | null;
    }>;
}

/**
 * Generate a PDF for a single Out-of-Commission report
 */
export function generateOocReportPDF(data: OocReportExportData): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 15;

    // Header bar
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("OUT OF COMMISSION REPORT", pageWidth / 2, 16, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(data.vehicle_id_or_license, pageWidth / 2, 25, { align: "center" });
    doc.setFontSize(8);
    doc.text(
        `Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`,
        pageWidth - margin,
        32,
        { align: "right" }
    );
    doc.setTextColor(0, 0, 0);
    yPos = 45;

    // Status banner
    doc.setFillColor(220, 38, 38); // Red
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 12, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("VEHICLE OUT OF SERVICE", pageWidth / 2, yPos + 8, { align: "center" });
    doc.setTextColor(0, 0, 0);
    yPos += 18;

    // =====================
    // VEHICLE INFORMATION
    // =====================
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("VEHICLE INFORMATION", margin + 5, yPos + 7);
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 36, 3, 3, "F");

    doc.setFontSize(9);
    const col1 = margin + 5;
    const col2 = margin + 95;
    let infoY = yPos + 7;

    const drawField = (label: string, value: string, x: number, y: number) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, x, y);
        doc.setFont("helvetica", "normal");
        doc.text(value, x + 35, y);
    };

    drawField("Vehicle ID", data.vehicle_id_or_license, col1, infoY);
    drawField("Report Date", format(new Date(data.report_date), "dd MMM yyyy"), col2, infoY);
    infoY += 7;
    drawField("Make/Model", data.make_model || "N/A", col1, infoY);
    drawField("Report Time", data.report_time || "N/A", col2, infoY);
    infoY += 7;
    drawField("Year", data.year || "N/A", col1, infoY);
    drawField("Odometer", data.odometer_hour_meter || "N/A", col2, infoY);
    infoY += 7;
    drawField("Location", data.location || "N/A", col1, infoY);

    yPos += 42;

    // Linked inspection info
    if (data.inspection_number) {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 14, 3, 3, "F");
        doc.setFontSize(9);
        drawField("Inspection", data.inspection_number, col1, yPos + 7);
        if (data.inspection_date) {
            drawField("Insp. Date", format(new Date(data.inspection_date), "dd MMM yyyy"), col2, yPos + 7);
        }
        yPos += 18;
    }

    // =====================
    // REASON OUT OF COMMISSION
    // =====================
    doc.setFillColor(220, 38, 38); // Red
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("REASON OUT OF COMMISSION", margin + 5, yPos + 7);
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const reasonLines = doc.splitTextToSize(data.reason_out_of_commission, pageWidth - 2 * margin - 10);
    doc.text(reasonLines, margin + 5, yPos);
    yPos += reasonLines.length * 4.5 + 8;

    // =====================
    // IMMEDIATE PLAN / STEPS
    // =====================
    if (data.immediate_plan && data.immediate_plan.length > 0) {
        if (yPos > 230) { doc.addPage(); yPos = 20; }

        doc.setFillColor(234, 179, 8); // Amber
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("IMMEDIATE PLAN / STEPS", margin + 5, yPos + 7);
        doc.setTextColor(0, 0, 0);
        yPos += 14;

        const planData = data.immediate_plan.map((step, i) => [
            `${i + 1}`,
            step,
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [["#", "Step"]],
            body: planData,
            theme: "striped",
            headStyles: {
                fillColor: [161, 121, 0],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 9,
            },
            bodyStyles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 15, halign: "center" },
                1: { cellWidth: pageWidth - 2 * margin - 15 },
            },
            margin: { left: margin, right: margin },
        });

        yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;
    }

    // =====================
    // PARTS REQUIRED
    // =====================
    if (data.parts_required && data.parts_required.length > 0) {
        if (yPos > 210) { doc.addPage(); yPos = 20; }

        doc.setFillColor(59, 130, 246);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(`PARTS REQUIRED (${data.parts_required.length})`, margin + 5, yPos + 7);
        doc.setTextColor(0, 0, 0);
        yPos += 14;

        const partsData = data.parts_required.map((p) => [
            p.partNameNumber,
            p.quantity,
            p.onHand === "yes" ? "Yes" : "No",
            p.orderNeededBy || "-",
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [["Part Name / Number", "Qty", "On Hand", "Order Needed By"]],
            body: partsData,
            theme: "striped",
            headStyles: {
                fillColor: [100, 100, 100],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 9,
            },
            bodyStyles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { cellWidth: 25, halign: "center" },
                2: { cellWidth: 25, halign: "center" },
                3: { cellWidth: 40 },
            },
            margin: { left: margin, right: margin },
            didParseCell: (hookData) => {
                if (hookData.column.index === 2 && hookData.section === "body") {
                    const val = hookData.cell.text[0];
                    if (val === "No") {
                        hookData.cell.styles.textColor = [220, 38, 38];
                        hookData.cell.styles.fontStyle = "bold";
                    } else if (val === "Yes") {
                        hookData.cell.styles.textColor = [22, 163, 74];
                    }
                }
            },
        });

        yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;
    }

    // =====================
    // FAULTS (if provided)
    // =====================
    if (data.faults && data.faults.length > 0) {
        if (yPos > 210) { doc.addPage(); yPos = 20; }

        doc.setFillColor(234, 88, 12); // Orange
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(`INSPECTION FAULTS (${data.faults.length})`, margin + 5, yPos + 7);
        doc.setTextColor(0, 0, 0);
        yPos += 14;

        const faultsData = data.faults.map((f) => [
            f.fault_description,
            f.severity.toUpperCase(),
            (f.corrective_action_status || "pending").replace("_", " ").toUpperCase(),
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [["Fault Description", "Severity", "Status"]],
            body: faultsData,
            theme: "striped",
            headStyles: {
                fillColor: [234, 88, 12],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 9,
            },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 90 },
                1: { cellWidth: 30, halign: "center" },
                2: { cellWidth: 40, halign: "center" },
            },
            margin: { left: margin, right: margin },
            didParseCell: (hookData) => {
                if (hookData.column.index === 1 && hookData.section === "body") {
                    const sev = hookData.cell.text[0];
                    if (sev === "CRITICAL" || sev === "HIGH") {
                        hookData.cell.styles.textColor = [220, 38, 38];
                        hookData.cell.styles.fontStyle = "bold";
                    } else if (sev === "MEDIUM") {
                        hookData.cell.styles.textColor = [234, 179, 8];
                    }
                }
                if (hookData.column.index === 2 && hookData.section === "body") {
                    const status = hookData.cell.text[0];
                    if (status === "FIXED" || status === "COMPLETED") {
                        hookData.cell.styles.textColor = [22, 163, 74];
                    } else if (status === "PENDING") {
                        hookData.cell.styles.textColor = [234, 179, 8];
                        hookData.cell.styles.fontStyle = "bold";
                    } else if (status === "NOT FIXED") {
                        hookData.cell.styles.textColor = [220, 38, 38];
                    }
                }
            },
        });

        yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;
    }

    // =====================
    // ADDITIONAL NOTES / SAFETY CONCERNS
    // =====================
    if (data.additional_notes_safety_concerns) {
        if (yPos > 230) { doc.addPage(); yPos = 20; }

        doc.setFillColor(139, 92, 246); // Purple
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("ADDITIONAL NOTES / SAFETY CONCERNS", margin + 5, yPos + 7);
        doc.setTextColor(0, 0, 0);
        yPos += 14;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const notesLines = doc.splitTextToSize(data.additional_notes_safety_concerns, pageWidth - 2 * margin - 10);
        doc.text(notesLines, margin + 5, yPos);
        yPos += notesLines.length * 4.5 + 10;
    }

    // =====================
    // MECHANIC SIGN-OFF
    // =====================
    if (yPos > 230) { doc.addPage(); yPos = 20; }

    doc.setFillColor(30, 41, 59);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("MECHANIC / INSPECTOR SIGN-OFF", margin + 5, yPos + 7);
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 22, 3, 3, "F");

    doc.setFontSize(9);
    drawField("Name", data.mechanic_name, col1, yPos + 7);
    drawField("Signature", data.mechanic_signature || "—", col2, yPos + 7);
    drawField("Sign-off Date", data.sign_off_date ? format(new Date(data.sign_off_date), "dd MMM yyyy") : "—", col1, yPos + 15);

    // Footer on each page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
            `Out of Commission Report — ${data.vehicle_id_or_license} | Page ${i} of ${pageCount}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: "center" }
        );
        doc.text("Confidential — Matanuska Fleet Management", margin, pageHeight - 10);
        doc.setTextColor(0, 0, 0);
    }

    const fileName = `OOC-Report-${data.vehicle_id_or_license.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(fileName);
}
