/**
 * Per-vehicle load exports.
 *
 * Produces a single workbook (Excel) or document (PDF) with one section/sheet
 * per assigned fleet vehicle. Loads without a fleet_vehicle_id are skipped.
 *
 * Used by the Load Planning page (TripssPage) and the Third Party Loads page
 * (ThirdPartyTripsPage) to give operations a vehicle-by-vehicle view.
 */
import type { Load } from "@/hooks/useTrips";
import { parseTimeWindow } from "@/lib/timeWindow";
import {
    COMPANY_NAME,
    SYSTEM_NAME,
    applyHeaderStyle,
    applyTitleRows,
    pdfColors,
    xlDataCell,
    xlHeader,
    xlMetricLabel,
    xlMetricValue,
    xlSectionHeader,
} from "@/lib/exportStyles";
import { format, getWeek, parseISO } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";

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

export interface VehicleExportOptions {
    /** ISO week number for filename / cover headers. Defaults to current week. */
    weekNumber?: number;
    /** Calendar year for filename / cover headers. Defaults to current year. */
    year?: number;
    /** Document/workbook title. Defaults to "Loads by Vehicle". */
    title?: string;
    /** Filename stem (no extension). */
    filename?: string;
}

interface VehicleGroup {
    /** fleet_vehicles.id (uuid) — used only as the grouping key. */
    vehicleKey: string;
    /** Human-readable fleet number (e.g. "T-021"). */
    vehicleId: string;
    /** Vehicle type (e.g. "Horse", "Rigid"). */
    vehicleType: string;
    /** Primary driver name shown in the cover (first non-empty wins). */
    driverName: string;
    /** Driver contact, if any. */
    driverContact: string;
    /** Loads assigned to this vehicle, sorted by loading date asc. */
    loads: Load[];
}

/** Group loads by their assigned fleet vehicle. Skips unassigned loads. */
function groupLoadsByVehicle(loads: Load[]): VehicleGroup[] {
    const map = new Map<string, VehicleGroup>();
    for (const load of loads) {
        const vehKey = load.fleet_vehicle_id;
        if (!vehKey) continue;
        let group = map.get(vehKey);
        if (!group) {
            group = {
                vehicleKey: vehKey,
                vehicleId: load.fleet_vehicle?.vehicle_id || "Unknown",
                vehicleType: load.fleet_vehicle?.type || "—",
                driverName: load.driver?.name || "—",
                driverContact: load.driver?.contact || "",
                loads: [],
            };
            map.set(vehKey, group);
        }
        // Prefer a non-empty driver name over a placeholder
        if (group.driverName === "—" && load.driver?.name) {
            group.driverName = load.driver.name;
            group.driverContact = load.driver.contact || "";
        }
        group.loads.push(load);
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
        g.loads.sort((a, b) => a.loading_date.localeCompare(b.loading_date));
    }
    // Sort vehicles alphanumerically by fleet number for stable output
    groups.sort((a, b) => a.vehicleId.localeCompare(b.vehicleId, undefined, { numeric: true }));
    return groups;
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
        return format(parseISO(iso), "dd MMM yyyy");
    } catch {
        return iso;
    }
}

// ---------------------------------------------------------------------------
// PDF export
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** Sanitise a string for use as a filename or sheet name. */
function sanitiseName(input: string): string {
    return input.replace(/[\\/?*[\]:]/g, "-").trim() || "Vehicle";
}

/** Sheet names in Excel are limited to 31 characters. */
function sheetNameFor(group: VehicleGroup): string {
    const base = sanitiseName(group.vehicleId);
    return base.slice(0, 31);
}

/**
 * Generate a multi-page PDF with one section per assigned vehicle.
 * Returns nothing — the file is downloaded directly.
 */
export function exportLoadsByVehiclePdf(
    loads: Load[],
    options: VehicleExportOptions = {},
): void {
    const groups = groupLoadsByVehicle(loads);
    if (groups.length === 0) {
        return;
    }

    const weekNum = options.weekNumber ?? getWeek(new Date(), { weekStartsOn: 1 });
    const yr = options.year ?? new Date().getFullYear();
    const title = options.title ?? "Loads by Vehicle";
    const filename =
        (options.filename ?? `loads-by-vehicle-week-${weekNum}-${yr}`) + ".pdf";

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    const drawHeader = (vehicleLabel: string) => {
        // Top navy banner
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
        const right = `${title} — Week ${weekNum}, ${yr}`;
        const rightWidth = doc.getTextWidth(right);
        doc.text(right, pageWidth - margin - rightWidth, 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const sub = `Vehicle: ${vehicleLabel}`;
        const subWidth = doc.getTextWidth(sub);
        doc.text(sub, pageWidth - margin - subWidth, 15.5);

        doc.setTextColor(0, 0, 0);
    };

    const drawFooter = (pageNum: number, pageTotalEstimate: number) => {
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
        const pageLabel = `Page ${pageNum} of ${pageTotalEstimate}`;
        const w = doc.getTextWidth(pageLabel);
        doc.text(pageLabel, pageWidth - margin - w, pageHeight - 6);
        doc.setTextColor(0, 0, 0);
    };

    // We don't know exact page count up front (autoTable may overflow), so we
    // post-process page numbers after rendering all content.
    groups.forEach((group, idx) => {
        if (idx > 0) doc.addPage();
        drawHeader(group.vehicleId);

        // Vehicle / Driver summary card
        let yPos = 26;
        doc.setDrawColor(...pdfColors.textMuted);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, yPos, pageWidth - margin * 2, 26, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...pdfColors.navy);
        doc.text(group.vehicleId, margin + 4, yPos + 8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...pdfColors.textPrimary);
        doc.text(`Type: ${group.vehicleType}`, margin + 4, yPos + 14);
        doc.text(
            `Driver: ${group.driverName}${group.driverContact ? `  •  ${group.driverContact}` : ""}`,
            margin + 4,
            yPos + 19.5,
        );

        // Right-aligned mini stats
        const totalQty = group.loads.reduce((s, l) => s + (l.quantity || 0), 0);
        const totalWt = group.loads.reduce((s, l) => s + (l.weight || 0), 0);
        const stats = [
            `Loads: ${group.loads.length}`,
            `Qty: ${totalQty}`,
            `Weight: ${totalWt.toFixed(1)} T`,
        ];
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...pdfColors.navy);
        stats.forEach((s, i) => {
            const w = doc.getTextWidth(s);
            doc.text(s, pageWidth - margin - 4 - w, yPos + 8 + i * 5.5);
        });
        doc.setTextColor(0, 0, 0);

        yPos += 32;

        // Loads table
        const head = [[
            "Load ID",
            "Status",
            "Loading",
            "Offloading",
            "Origin",
            "Destination",
            "Cargo",
            "Notes",
        ]];

        const body = group.loads.map((load) => {
            const tw = parseTimeWindow(load.time_window);
            const plannedArr = tw.origin?.plannedArrival || "";
            const actualArr = tw.origin?.actualArrival || "";
            const loadingCell = `${formatDate(load.loading_date)}${plannedArr ? `\nPlan ${plannedArr}` : ""
                }${actualArr ? `\nAct  ${actualArr}` : ""}`;
            const offPlanArr = tw.destination?.plannedArrival || "";
            const offActArr = tw.destination?.actualArrival || "";
            const offloadingCell = `${formatDate(load.offloading_date)}${offPlanArr ? `\nPlan ${offPlanArr}` : ""
                }${offActArr ? `\nAct  ${offActArr}` : ""}`;
            return [
                load.load_id,
                statusLabels[load.status] || load.status,
                loadingCell,
                offloadingCell,
                load.origin,
                load.destination,
                cargoLabels[load.cargo_type] || load.cargo_type,
                load.notes || "",
            ];
        });

        autoTable(doc, {
            startY: yPos,
            head,
            body,
            theme: "grid",
            margin: { left: margin, right: margin, bottom: 16 },
            styles: {
                font: "helvetica",
                fontSize: 8,
                cellPadding: 2,
                overflow: "linebreak",
                textColor: [30, 41, 59],
                lineColor: [226, 232, 240],
                lineWidth: 0.2,
            },
            headStyles: {
                fillColor: pdfColors.navy as unknown as [number, number, number],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 8.5,
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 20, fontStyle: "bold" },
                1: { cellWidth: 18 },
                2: { cellWidth: 24 },
                3: { cellWidth: 24 },
                4: { cellWidth: 28 },
                5: { cellWidth: 28 },
                6: { cellWidth: 22 },
                7: { cellWidth: "auto" },
            },
            didDrawPage: () => {
                // Re-draw header on every page break inside autoTable
                drawHeader(group.vehicleId);
            },
        });
    });

    // Add page numbers / footer to every page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
    }

    const blob = doc.output("blob");
    downloadBlob(blob, filename);
}

// ---------------------------------------------------------------------------
// Excel export
// ---------------------------------------------------------------------------

/** Build a per-vehicle worksheet and return it. */
function buildVehicleSheet(
    group: VehicleGroup,
    weekNum: number,
    yr: number,
    title: string,
): XLSX.WorkSheet {
    // Row 1: company / title banner
    // Row 2: generated stamp
    // Row 3: blank
    // Row 4: vehicle/driver section header
    // Row 5-7: vehicle/driver key/value rows
    // Row 8: blank
    // Row 9+: loads table
    const rows = group.loads.map((load) => {
        const tw = parseTimeWindow(load.time_window);
        return {
            "Load ID": load.load_id,
            Status: statusLabels[load.status] || load.status,
            "Loading Date": formatDate(load.loading_date),
            "Loading Planned": tw.origin?.plannedArrival || "",
            "Loading Actual": tw.origin?.actualArrival || "",
            Origin: load.origin,
            Destination: load.destination,
            "Offloading Date": formatDate(load.offloading_date),
            "Offloading Planned": tw.destination?.plannedArrival || "",
            "Offloading Actual": tw.destination?.actualArrival || "",
            "Cargo Type": cargoLabels[load.cargo_type] || load.cargo_type,
            Notes: load.notes || "",
        };
    });

    const totalQty = group.loads.reduce((s, l) => s + (l.quantity || 0), 0);
    const totalWt = group.loads.reduce((s, l) => s + (l.weight || 0), 0);

    const aoa: (string | number)[][] = [
        [`${COMPANY_NAME} — ${title} — Week ${weekNum}, ${yr}`],
        [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
        [],
        ["Vehicle Summary"],
        ["Fleet Number", group.vehicleId],
        ["Vehicle Type", group.vehicleType],
        ["Driver", group.driverName],
        ["Driver Contact", group.driverContact || "—"],
        ["Total Loads", group.loads.length],
        ["Total Quantity", totalQty],
        ["Total Weight (T)", totalWt],
        [],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const dataStartRow = aoa.length; // 0-based row where headers will be written
    XLSX.utils.sheet_add_json(worksheet, rows, {
        origin: { r: dataStartRow, c: 0 },
    });

    const colCount = 12;
    const merges: XLSX.Range[] = [];
    applyTitleRows(worksheet, colCount, merges);

    // Section header for vehicle summary (row index 3)
    const sectionRef = XLSX.utils.encode_cell({ r: 3, c: 0 });
    if (worksheet[sectionRef]) {
        worksheet[sectionRef].s = xlSectionHeader;
        merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } });
    }

    // Style summary key/value rows (rows 4..10)
    for (let r = 4; r <= 10; r++) {
        const a = XLSX.utils.encode_cell({ r, c: 0 });
        const b = XLSX.utils.encode_cell({ r, c: 1 });
        if (worksheet[a]) worksheet[a].s = xlMetricLabel;
        if (worksheet[b]) worksheet[b].s = xlMetricValue;
    }

    worksheet["!merges"] = merges;
    applyHeaderStyle(worksheet, dataStartRow, colCount);

    // Style data cells
    for (let r = dataStartRow + 1; r <= dataStartRow + rows.length; r++) {
        for (let c = 0; c < colCount; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (worksheet[ref]) worksheet[ref].s = xlDataCell;
        }
    }

    worksheet["!cols"] = [
        { wch: 14 }, // Load ID
        { wch: 12 }, // Status
        { wch: 13 }, // Loading Date
        { wch: 13 }, // Loading Planned
        { wch: 13 }, // Loading Actual
        { wch: 22 }, // Origin
        { wch: 22 }, // Destination
        { wch: 14 }, // Offloading Date
        { wch: 14 }, // Offloading Planned
        { wch: 14 }, // Offloading Actual
        { wch: 16 }, // Cargo Type
        { wch: 36 }, // Notes
    ];

    // Freeze the header rows so the table header stays visible while scrolling
    worksheet["!freeze"] = { xSplit: 0, ySplit: dataStartRow + 1 };

    return worksheet;
}

/**
 * Generate a single .xlsx workbook containing one worksheet per assigned
 * vehicle plus a summary sheet that lists every vehicle and its load count.
 */
export function exportLoadsByVehicleExcel(
    loads: Load[],
    options: VehicleExportOptions = {},
): void {
    const groups = groupLoadsByVehicle(loads);
    if (groups.length === 0) {
        return;
    }

    const weekNum = options.weekNumber ?? getWeek(new Date(), { weekStartsOn: 1 });
    const yr = options.year ?? new Date().getFullYear();
    const title = options.title ?? "Loads by Vehicle";
    const filename = options.filename ?? `loads-by-vehicle-week-${weekNum}-${yr}`;

    const workbook = XLSX.utils.book_new();

    // ---- Summary sheet ----
    const summaryRows = groups.map((g) => ({
        "Fleet Number": g.vehicleId,
        Type: g.vehicleType,
        Driver: g.driverName,
        Contact: g.driverContact || "—",
        "Total Loads": g.loads.length,
        "Total Quantity": g.loads.reduce((s, l) => s + (l.quantity || 0), 0),
        "Total Weight (T)": g.loads.reduce((s, l) => s + (l.weight || 0), 0),
    }));

    const summaryAoa: (string | number)[][] = [
        [`${COMPANY_NAME} — ${title} (Summary) — Week ${weekNum}, ${yr}`],
        [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
        [],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa);
    XLSX.utils.sheet_add_json(summarySheet, summaryRows, { origin: "A4" });

    const summaryCols = 7;
    const summaryMerges: XLSX.Range[] = [];
    applyTitleRows(summarySheet, summaryCols, summaryMerges);
    summarySheet["!merges"] = summaryMerges;
    applyHeaderStyle(summarySheet, 3, summaryCols);
    summarySheet["!cols"] = [
        { wch: 14 },
        { wch: 14 },
        { wch: 22 },
        { wch: 18 },
        { wch: 12 },
        { wch: 14 },
        { wch: 16 },
    ];

    // Style header row of summary
    for (let r = 4; r <= 3 + summaryRows.length; r++) {
        for (let c = 0; c < summaryCols; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (summarySheet[ref]) summarySheet[ref].s = xlDataCell;
        }
    }

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // ---- One sheet per vehicle ----
    const usedNames = new Set<string>(["Summary"]);
    for (const group of groups) {
        let name = sheetNameFor(group);
        let suffix = 1;
        while (usedNames.has(name)) {
            const base = sheetNameFor(group).slice(0, 28);
            name = `${base}_${suffix++}`;
        }
        usedNames.add(name);
        const sheet = buildVehicleSheet(group, weekNum, yr, title);
        XLSX.utils.book_append_sheet(workbook, sheet, name);
    }

    XLSX.writeFile(workbook, `${filename}.xlsx`);

    // Reference imports kept intentionally for style consistency
    void xlHeader;
}
