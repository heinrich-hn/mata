/**
 * Per-day PDF export for the Load Planning page.
 *
 * Produces a single PDF document containing all loads scheduled to load on a
 * given day, grouped by assigned fleet vehicle (with an "Unassigned" section
 * for any loads without a vehicle yet). Subcontractor loads are flagged.
 */
import type { Load } from "@/hooks/useTrips";
import {
    COMPANY_NAME,
    SYSTEM_NAME,
    pdfColors,
} from "@/lib/exportStyles";
import { computeTimeVariance, getSubcontractorInfo, parseTimeWindow } from "@/lib/timeWindow";
import { format, parseISO } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";

/**
 * Returns "Yes" if no leg of the load was late by more than 15 minutes,
 * "No" if any leg was late by more than 15 minutes, "—" if no actual
 * data is available yet.
 */
function loadOnTimeLabel(load: Load): "Yes" | "No" | "—" {
    const tw = parseTimeWindow(load.time_window);
    const legs: Array<[string | null | undefined, string | null | undefined]> = [
        [tw.origin?.plannedArrival, load.actual_loading_arrival || tw.origin?.actualArrival],
        [tw.origin?.plannedDeparture, load.actual_loading_departure || tw.origin?.actualDeparture],
        [tw.destination?.plannedArrival, load.actual_offloading_arrival || tw.destination?.actualArrival],
        [tw.destination?.plannedDeparture, load.actual_offloading_departure || tw.destination?.actualDeparture],
    ];
    let hasData = false;
    for (const [planned, actual] of legs) {
        const v = computeTimeVariance(planned, actual);
        if (v.diffMin === null) continue;
        hasData = true;
        if (v.diffMin > 15) return "No";
    }
    return hasData ? "Yes" : "—";
}

const statusLabels: Record<string, string> = {
    scheduled: "Scheduled",
    "in-transit": "In Transit",
    pending: "Pending",
    delivered: "Delivered",
};

const cargoLabels: Record<string, string> = {
    VanSalesRetail: "Van Sales/Retail",
    Retail: "Retail",
    Vendor: "Vendor",
    RetailVendor: "Retail Vendor",
    Fertilizer: "Fertilizer",
    BV: "BV (Backload)",
    CBC: "CBC (Backload)",
    Packaging: "Packaging (Backload)",
};

interface DaySection {
    /** Display label for the section header (vehicle id or "Unassigned"). */
    label: string;
    /** Optional sub-label, e.g. driver name + contact. */
    sublabel: string;
    /** Loads belonging to this section. */
    loads: Load[];
}

function groupForDay(loads: Load[]): DaySection[] {
    const byVehicle = new Map<string, DaySection>();
    const bySubcontractor = new Map<string, DaySection>();
    const unassigned: Load[] = [];

    for (const load of loads) {
        const sub = getSubcontractorInfo(load);

        // Subcontractor loads are grouped under their supplier name regardless
        // of whether a fleet vehicle is also linked, so they never appear as
        // "Unassigned".
        if (sub) {
            const subKey = `sub:${sub.name}`;
            let section = bySubcontractor.get(subKey);
            if (!section) {
                section = {
                    label: sub.name,
                    sublabel: "Subcontractor",
                    loads: [],
                };
                bySubcontractor.set(subKey, section);
            }
            section.loads.push(load);
            continue;
        }

        const vehKey = load.fleet_vehicle_id;
        if (!vehKey) {
            unassigned.push(load);
            continue;
        }
        let section = byVehicle.get(vehKey);
        if (!section) {
            const driverBits = [load.driver?.name, load.driver?.contact]
                .filter(Boolean)
                .join(" • ");
            section = {
                label: load.fleet_vehicle?.vehicle_id || "Unknown Vehicle",
                sublabel: driverBits || "No driver assigned",
                loads: [],
            };
            byVehicle.set(vehKey, section);
        }
        section.loads.push(load);
    }

    const vehicleSections = Array.from(byVehicle.values()).sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
    const subSections = Array.from(bySubcontractor.values()).sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
    const sections = [...vehicleSections, ...subSections];
    for (const s of sections) {
        s.loads.sort((a, b) => a.load_id.localeCompare(b.load_id));
    }

    if (unassigned.length > 0) {
        unassigned.sort((a, b) => a.load_id.localeCompare(b.load_id));
        sections.push({
            label: "Unassigned Loads",
            sublabel: "No fleet vehicle yet",
            loads: unassigned,
        });
    }

    return sections;
}

function formatDateLong(iso: string): string {
    try {
        return format(parseISO(iso), "EEEE, dd MMMM yyyy");
    } catch {
        return iso;
    }
}

function formatDateShort(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
        return format(parseISO(iso), "dd MMM");
    } catch {
        return iso;
    }
}

export interface DayExportOptions {
    /** Filename stem (no extension). */
    filename?: string;
    /** Document title shown in the header. Defaults to "Daily Load Plan". */
    title?: string;
}

/**
 * Generate a PDF listing all loads scheduled to load on `dayIso` (yyyy-MM-dd).
 * The file is downloaded directly.
 */
export function exportLoadsForDayPdf(
    loads: Load[],
    dayIso: string,
    options: DayExportOptions = {},
): void {
    const title = options.title ?? "Daily Load Plan";
    const filename = (options.filename ?? `daily-load-plan-${dayIso}`) + ".pdf";

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;

    const dayLabel = formatDateLong(dayIso);
    const sections = groupForDay(loads);

    const drawHeader = () => {
        doc.setFillColor(...pdfColors.navy);
        doc.rect(0, 0, pageWidth, 18, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(COMPANY_NAME, margin, 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(SYSTEM_NAME, margin, 15.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        const right = title;
        const rightWidth = doc.getTextWidth(right);
        doc.text(right, pageWidth - margin - rightWidth, 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const sub = dayLabel;
        const subWidth = doc.getTextWidth(sub);
        doc.text(sub, pageWidth - margin - subWidth, 15.5);

        doc.setTextColor(0, 0, 0);
    };

    const drawFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(...pdfColors.textMuted);
        doc.setLineWidth(0.2);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...pdfColors.textMuted);
        doc.text(
            `Generated ${format(new Date(), "dd MMM yyyy HH:mm")}`,
            margin,
            pageHeight - 6,
        );
        const pageLabel = `Page ${pageNum} of ${totalPages}`;
        const w = doc.getTextWidth(pageLabel);
        doc.text(pageLabel, pageWidth - margin - w, pageHeight - 6);
        doc.setTextColor(0, 0, 0);
    };

    drawHeader();

    // Day summary card (compact, single line)
    let yPos = 22;
    const totalLoads = loads.length;
    const vehicleCount = sections.filter((s) => s.label !== "Unassigned Loads")
        .length;
    const subcontractedCount = loads.filter((l) => getSubcontractorInfo(l) !== null)
        .length;

    doc.setDrawColor(...pdfColors.textMuted);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 12, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...pdfColors.navy);
    doc.text(dayLabel, margin + 3, yPos + 7.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...pdfColors.textPrimary);
    const summaryLine = [
        `Loads: ${totalLoads}`,
        `Vehicles: ${vehicleCount}`,
        subcontractedCount > 0 ? `Subcontracted: ${subcontractedCount}` : "",
    ]
        .filter(Boolean)
        .join("    •    ");
    const summaryWidth = doc.getTextWidth(summaryLine);
    doc.text(summaryLine, pageWidth - margin - 3 - summaryWidth, yPos + 7.5);
    doc.setTextColor(0, 0, 0);

    yPos += 16;

    if (loads.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(11);
        doc.setTextColor(...pdfColors.textMuted);
        doc.text("No loads scheduled for this day.", margin, yPos + 6);

        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            drawFooter(i, totalPages);
        }
        const blobEmpty = doc.output("blob");
        const urlEmpty = URL.createObjectURL(blobEmpty);
        const aEmpty = document.createElement("a");
        aEmpty.href = urlEmpty;
        aEmpty.download = filename;
        document.body.appendChild(aEmpty);
        aEmpty.click();
        document.body.removeChild(aEmpty);
        URL.revokeObjectURL(urlEmpty);
        return;
    }

    // Build a single flat schedule table so the entire day fits on one page
    // wherever possible. Subcontractor loads show the supplier name in the
    // Vehicle column with "Subcontractor" in the Driver column — so a dedicated
    // Subcontractor column is unnecessary and the saved width goes to the
    // origin/destination/notes columns.
    const head = [[
        "Vehicle / Carrier",
        "Driver",
        "Load ID",
        "Status",
        "Origin",
        "Destination",
        "Offload",
        "Cargo",
        "Notes",
    ]];

    const body: string[][] = [];
    sections.forEach((section) => {
        section.loads.forEach((load) => {
            const tw = parseTimeWindow(load.time_window);
            const plannedArr = tw.origin?.plannedArrival || "";
            const status = statusLabels[load.status] || load.status;
            const statusCell = plannedArr ? `${status}\nLoad ${plannedArr}` : status;
            body.push([
                section.label,
                section.sublabel,
                load.load_id,
                statusCell,
                load.origin,
                load.destination,
                formatDateShort(load.offloading_date),
                cargoLabels[load.cargo_type] || load.cargo_type,
                load.notes || "",
            ]);
        });
    });

    // Auto-shrink fonts/padding when there are many rows so the schedule fits
    // on a single landscape A4 page whenever practical. Minimums kept generous
    // enough that text stays readable rather than cramped.
    const rowCount = body.length;
    const fontSize = rowCount > 32 ? 7.5 : rowCount > 22 ? 8 : rowCount > 14 ? 8.5 : 9;
    const cellPadding = rowCount > 32 ? 1.2 : rowCount > 22 ? 1.6 : rowCount > 14 ? 1.9 : 2.2;

    autoTable(doc, {
        startY: yPos,
        head,
        body,
        theme: "grid",
        margin: { left: margin, right: margin, bottom: 16 },
        styles: {
            font: "helvetica",
            fontSize,
            cellPadding,
            overflow: "linebreak",
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            valign: "middle",
        },
        headStyles: {
            fillColor: pdfColors.navy as unknown as [number, number, number],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: fontSize + 0.5,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { cellWidth: 32, fontStyle: "bold" }, // Vehicle / Carrier
            1: { cellWidth: 36 },                    // Driver
            2: { cellWidth: 24, fontStyle: "bold" }, // Load ID
            3: { cellWidth: 26 },                    // Status
            4: { cellWidth: 38 },                    // Origin
            5: { cellWidth: 38 },                    // Destination
            6: { cellWidth: 18, halign: "center" },  // Offload
            7: { cellWidth: 28 },                    // Cargo
            8: { cellWidth: "auto" },                // Notes
        },
        didDrawPage: () => {
            drawHeader();
        },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
    }

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * On-Time daily PDF — same layout as `exportLoadsForDayPdf` but with the
 * Notes column replaced by an "On Time" Yes/No column. A load is considered
 * on time when no leg is more than 15 minutes late.
 */
export function exportLoadsForDayOnTimePdf(
    loads: Load[],
    dayIso: string,
    options: DayExportOptions = {},
): void {
    const title = options.title ?? "Daily Load Plan — On-Time";
    const filename = (options.filename ?? `daily-load-plan-on-time-${dayIso}`) + ".pdf";

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;

    const dayLabel = formatDateLong(dayIso);
    const sections = groupForDay(loads);

    const drawHeader = () => {
        doc.setFillColor(...pdfColors.navy);
        doc.rect(0, 0, pageWidth, 18, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(COMPANY_NAME, margin, 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(SYSTEM_NAME, margin, 15.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        const rightWidth = doc.getTextWidth(title);
        doc.text(title, pageWidth - margin - rightWidth, 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const subWidth = doc.getTextWidth(dayLabel);
        doc.text(dayLabel, pageWidth - margin - subWidth, 15.5);

        doc.setTextColor(0, 0, 0);
    };

    const drawFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(...pdfColors.textMuted);
        doc.setLineWidth(0.2);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...pdfColors.textMuted);
        doc.text(
            `Generated ${format(new Date(), "dd MMM yyyy HH:mm")}`,
            margin,
            pageHeight - 6,
        );
        const pageLabel = `Page ${pageNum} of ${totalPages}`;
        const w = doc.getTextWidth(pageLabel);
        doc.text(pageLabel, pageWidth - margin - w, pageHeight - 6);
        doc.setTextColor(0, 0, 0);
    };

    drawHeader();

    // Day summary card with on-time tally
    let yPos = 22;
    const totalLoads = loads.length;
    const vehicleCount = sections.filter((s) => s.label !== "Unassigned Loads").length;
    const onTimeLabels = loads.map(loadOnTimeLabel);
    const onTimeCount = onTimeLabels.filter((l) => l === "Yes").length;
    const lateCount = onTimeLabels.filter((l) => l === "No").length;

    doc.setDrawColor(...pdfColors.textMuted);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 12, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...pdfColors.navy);
    doc.text(dayLabel, margin + 3, yPos + 7.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...pdfColors.textPrimary);
    const summaryLine = [
        `Loads: ${totalLoads}`,
        `Vehicles: ${vehicleCount}`,
        `On Time: ${onTimeCount}`,
        `Late: ${lateCount}`,
    ].join("    •    ");
    const summaryWidth = doc.getTextWidth(summaryLine);
    doc.text(summaryLine, pageWidth - margin - 3 - summaryWidth, yPos + 7.5);
    doc.setTextColor(0, 0, 0);

    yPos += 16;

    if (loads.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(11);
        doc.setTextColor(...pdfColors.textMuted);
        doc.text("No loads scheduled for this day.", margin, yPos + 6);

        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            drawFooter(i, totalPages);
        }
        const blobEmpty = doc.output("blob");
        const urlEmpty = URL.createObjectURL(blobEmpty);
        const aEmpty = document.createElement("a");
        aEmpty.href = urlEmpty;
        aEmpty.download = filename;
        document.body.appendChild(aEmpty);
        aEmpty.click();
        document.body.removeChild(aEmpty);
        URL.revokeObjectURL(urlEmpty);
        return;
    }

    const head = [[
        "Vehicle / Carrier",
        "Driver",
        "Load ID",
        "Status",
        "Origin",
        "Destination",
        "Offload",
        "Cargo",
        "On Time",
    ]];

    const body: string[][] = [];
    sections.forEach((section) => {
        section.loads.forEach((load) => {
            const tw = parseTimeWindow(load.time_window);
            const plannedArr = tw.origin?.plannedArrival || "";
            const status = statusLabels[load.status] || load.status;
            const statusCell = plannedArr ? `${status}\nLoad ${plannedArr}` : status;
            body.push([
                section.label,
                section.sublabel,
                load.load_id,
                statusCell,
                load.origin,
                load.destination,
                formatDateShort(load.offloading_date),
                cargoLabels[load.cargo_type] || load.cargo_type,
                loadOnTimeLabel(load),
            ]);
        });
    });

    const rowCount = body.length;
    const fontSize = rowCount > 32 ? 7.5 : rowCount > 22 ? 8 : rowCount > 14 ? 8.5 : 9;
    const cellPadding = rowCount > 32 ? 1.2 : rowCount > 22 ? 1.6 : rowCount > 14 ? 1.9 : 2.2;

    autoTable(doc, {
        startY: yPos,
        head,
        body,
        theme: "grid",
        margin: { left: margin, right: margin, bottom: 16 },
        styles: {
            font: "helvetica",
            fontSize,
            cellPadding,
            overflow: "linebreak",
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            valign: "middle",
        },
        headStyles: {
            fillColor: pdfColors.navy as unknown as [number, number, number],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: fontSize + 0.5,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { cellWidth: 32, fontStyle: "bold" },
            1: { cellWidth: 36 },
            2: { cellWidth: 26, fontStyle: "bold" },
            3: { cellWidth: 28 },
            4: { cellWidth: 42 },
            5: { cellWidth: 42 },
            6: { cellWidth: 18, halign: "center" },
            7: { cellWidth: 30 },
            8: { cellWidth: "auto", halign: "center", fontStyle: "bold" },
        },
        didParseCell: (data: CellHookData) => {
            if (data.section === "body" && data.column.index === 8) {
                const v = String(data.cell.raw ?? "").trim();
                if (v === "Yes") {
                    data.cell.styles.fillColor = [220, 252, 231]; // green-100
                    data.cell.styles.textColor = [21, 128, 61];   // green-700
                } else if (v === "No") {
                    data.cell.styles.fillColor = [254, 226, 226]; // red-100
                    data.cell.styles.textColor = [185, 28, 28];   // red-700
                }
            }
        },
        didDrawPage: () => {
            drawHeader();
        },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
    }

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
