import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, isValid, parseISO } from "date-fns";

const COMPANY = "MATA Fleet Management";
const REPORT_TITLE = "Fleet Vehicle Register";
const BRAND_RGB: [number, number, number] = [31, 56, 100];
const ALT_RGB: [number, number, number] = [242, 246, 252];

export interface FleetExportVehicle {
    fleet_number: string | null;
    registration_number: string;
    make: string;
    model: string;
    vehicle_type: string;
    year?: number | null;
    vin?: string | null;
    tonnage: number | null;
    engine_specs: string | null;
    current_odometer?: number | null;
    license_disk_expiry: string | null;
    insurance_expiry?: string | null;
    mot_expiry?: string | null;
    last_service_date?: string | null;
    next_service_due?: string | null;
    active: boolean | null;
}

const TYPE_LABELS: Record<string, string> = {
    rigid_truck: "Rigid Truck",
    horse_truck: "Horse Truck",
    refrigerated_truck: "Refrigerated Truck",
    truck: "Truck",
    tanker: "Tanker",
    pickup: "Pickup",
    van: "Van",
    reefer: "Reefer",
    interlink: "Interlink",
    trailer: "Trailer",
};

const labelType = (t: string) => TYPE_LABELS[t] ?? t.replace(/_/g, " ");

const fmtDate = (s?: string | null) => {
    if (!s) return "—";
    const d = parseISO(s);
    return isValid(d) ? format(d, "yyyy-MM-dd") : "—";
};

const fmtNum = (n?: number | null) =>
    n == null ? "—" : new Intl.NumberFormat("en-GB").format(n);

const licenseStatus = (s?: string | null): "Valid" | "Expiring" | "Expired" | "—" => {
    if (!s) return "—";
    const d = parseISO(s);
    if (!isValid(d)) return "—";
    const today = new Date();
    const days = Math.floor((d.getTime() - today.getTime()) / 86400000);
    if (days < 0) return "Expired";
    if (days <= 30) return "Expiring";
    return "Valid";
};

const fileStamp = () => format(new Date(), "yyyyMMdd_HHmm");

/* ─────────────────────────────────────────────
 * EXCEL
 * ──────────────────────────────────────────── */
export async function exportFleetExcel(vehicles: FleetExportVehicle[]) {
    const wb = new ExcelJS.Workbook();
    wb.creator = COMPANY;
    wb.created = new Date();

    const ws = wb.addWorksheet("Fleet Register", {
        properties: { defaultRowHeight: 18 },
        views: [{ state: "frozen", ySplit: 4 }],
        pageSetup: {
            orientation: "landscape",
            paperSize: 9,
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: {
                left: 0.4, right: 0.4, top: 0.6, bottom: 0.6,
                header: 0.3, footer: 0.3,
            },
        },
        headerFooter: {
            oddFooter: `&L${COMPANY}&CFleet Register&RPage &P of &N`,
        },
    });

    // Title row
    ws.mergeCells("A1:N1");
    ws.getCell("A1").value = REPORT_TITLE;
    ws.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getCell("A1").fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" },
    };
    ws.getRow(1).height = 28;

    ws.mergeCells("A2:N2");
    ws.getCell("A2").value =
        `${COMPANY}  •  Generated ${format(new Date(), "yyyy-MM-dd HH:mm")}  •  ${vehicles.length} vehicles`;
    ws.getCell("A2").font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF666666" } };
    ws.getCell("A2").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(2).height = 18;

    // Summary line
    const activeCount = vehicles.filter((v) => v.active).length;
    const inactiveCount = vehicles.length - activeCount;
    const expired = vehicles.filter((v) => licenseStatus(v.license_disk_expiry) === "Expired").length;
    const expiring = vehicles.filter((v) => licenseStatus(v.license_disk_expiry) === "Expiring").length;
    ws.mergeCells("A3:N3");
    ws.getCell("A3").value =
        `Active: ${activeCount}    Inactive: ${inactiveCount}    License expired: ${expired}    Expiring (≤30d): ${expiring}`;
    ws.getCell("A3").font = { name: "Calibri", size: 10, color: { argb: "FF444444" } };
    ws.getCell("A3").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(3).height = 18;

    // Header row
    const headers = [
        "Fleet #", "Registration", "Make", "Model", "Type", "Year", "VIN",
        "Tonnage (t)", "VIN", "Odometer (km)",
        "License Disk Expiry", "License Status", "Next Service Due", "Status",
    ];
    const headerRow = ws.getRow(4);
    headerRow.values = headers;
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" },
        };
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
            top: { style: "thin", color: { argb: "FFB0B7C3" } },
            bottom: { style: "thin", color: { argb: "FFB0B7C3" } },
            left: { style: "thin", color: { argb: "FFB0B7C3" } },
            right: { style: "thin", color: { argb: "FFB0B7C3" } },
        };
    });

    // Column widths
    const widths = [10, 16, 14, 16, 18, 8, 22, 12, 22, 14, 18, 14, 18, 10];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    // Body rows
    vehicles.forEach((v, idx) => {
        const ls = licenseStatus(v.license_disk_expiry);
        const row = ws.addRow([
            v.fleet_number ?? "—",
            v.registration_number,
            v.make,
            v.model,
            labelType(v.vehicle_type),
            v.year ?? "—",
            v.vin ?? "—",
            v.tonnage ?? "—",
            v.vin ?? v.engine_specs ?? "—",
            v.current_odometer ?? "—",
            fmtDate(v.license_disk_expiry),
            ls,
            fmtDate(v.next_service_due),
            v.active ? "Active" : "Inactive",
        ]);

        row.height = 18;
        row.eachCell((cell, col) => {
            cell.font = { name: "Calibri", size: 10 };
            cell.alignment = {
                vertical: "middle",
                horizontal: col === 1 || col === 6 || col === 8 || col === 10 || col === 12 || col === 14
                    ? "center" : "left",
            };
            cell.border = {
                top: { style: "hair", color: { argb: "FFE2E5EB" } },
                bottom: { style: "hair", color: { argb: "FFE2E5EB" } },
                left: { style: "hair", color: { argb: "FFE2E5EB" } },
                right: { style: "hair", color: { argb: "FFE2E5EB" } },
            };
            if (idx % 2 === 1) {
                cell.fill = {
                    type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F6FC" },
                };
            }
        });

        // Status colouring
        const statusCell = row.getCell(14);
        statusCell.font = {
            name: "Calibri", size: 10, bold: true,
            color: { argb: v.active ? "FF16A34A" : "FFDC2626" },
        };

        // License status colouring
        const licenseCell = row.getCell(12);
        const colour = ls === "Expired"
            ? "FFDC2626"
            : ls === "Expiring"
                ? "FFD97706"
                : ls === "Valid"
                    ? "FF16A34A"
                    : "FF666666";
        licenseCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: colour } };
    });

    if (vehicles.length === 0) {
        const r = ws.addRow(["No vehicles to export"]);
        ws.mergeCells(`A${r.number}:N${r.number}`);
        r.getCell(1).font = { italic: true, color: { argb: "FF888888" } };
        r.getCell(1).alignment = { horizontal: "center" };
    }

    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
        new Blob([buf], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Fleet_Register_${fileStamp()}.xlsx`,
    );
}

/* ─────────────────────────────────────────────
 * PDF
 * ──────────────────────────────────────────── */
export function exportFleetPDF(vehicles: FleetExportVehicle[]) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header band
    doc.setFillColor(...BRAND_RGB);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(REPORT_TITLE, 14, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(COMPANY, pageWidth - 14, 13, { align: "right" });

    // Sub line
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    doc.text(
        `Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
        14, 28,
    );
    doc.text(
        `Total vehicles: ${vehicles.length}`,
        pageWidth - 14, 28, { align: "right" },
    );

    // Summary
    const activeCount = vehicles.filter((v) => v.active).length;
    const inactiveCount = vehicles.length - activeCount;
    const expired = vehicles.filter((v) => licenseStatus(v.license_disk_expiry) === "Expired").length;
    const expiring = vehicles.filter((v) => licenseStatus(v.license_disk_expiry) === "Expiring").length;
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(
        `Active: ${activeCount}   •   Inactive: ${inactiveCount}   •   License expired: ${expired}   •   Expiring (≤30d): ${expiring}`,
        14, 33,
    );

    autoTable(doc, {
        startY: 38,
        head: [[
            "Fleet #", "Reg.", "Make", "Model", "Type", "Year",
            "Tonnage", "Odometer (km)", "License Expiry", "Status",
        ]],
        body: vehicles.map((v) => [
            v.fleet_number ?? "—",
            v.registration_number,
            v.make,
            v.model,
            labelType(v.vehicle_type),
            v.year ?? "—",
            v.tonnage ?? "—",
            fmtNum(v.current_odometer),
            `${fmtDate(v.license_disk_expiry)} (${licenseStatus(v.license_disk_expiry)})`,
            v.active ? "Active" : "Inactive",
        ]),
        styles: { fontSize: 8, cellPadding: 2, valign: "middle" },
        headStyles: {
            fillColor: BRAND_RGB,
            textColor: 255,
            fontStyle: "bold",
            fontSize: 8,
            halign: "center",
        },
        alternateRowStyles: { fillColor: ALT_RGB },
        columnStyles: {
            0: { cellWidth: 18, halign: "center" },
            1: { cellWidth: 26 },
            2: { cellWidth: 24 },
            3: { cellWidth: 28 },
            4: { cellWidth: 32 },
            5: { cellWidth: 14, halign: "center" },
            6: { cellWidth: 18, halign: "right" },
            7: { cellWidth: 26, halign: "right" },
            8: { cellWidth: 40, halign: "center" },
            9: { cellWidth: "auto", halign: "center" },
        },
        didParseCell: (data) => {
            if (data.section !== "body") return;
            const v = vehicles[data.row.index];
            if (!v) return;

            if (data.column.index === 9) {
                data.cell.styles.textColor = v.active ? [22, 163, 74] : [220, 38, 38];
                data.cell.styles.fontStyle = "bold";
            }
            if (data.column.index === 8) {
                const s = licenseStatus(v.license_disk_expiry);
                const c: [number, number, number] | null =
                    s === "Expired" ? [220, 38, 38]
                        : s === "Expiring" ? [217, 119, 6]
                            : s === "Valid" ? [22, 163, 74]
                                : null;
                if (c) {
                    data.cell.styles.textColor = c;
                    data.cell.styles.fontStyle = "bold";
                }
            }
        },
        didDrawPage: () => {
            const pages = doc.getNumberOfPages();
            const current = doc.getCurrentPageInfo().pageNumber;
            doc.setFontSize(8);
            doc.setTextColor(140, 140, 140);
            doc.text(
                `Page ${current} of ${pages}   •   ${COMPANY} — Confidential`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 6,
                { align: "center" },
            );
        },
        margin: { top: 38, bottom: 12, left: 10, right: 10 },
    });

    doc.save(`Fleet_Register_${fileStamp()}.pdf`);
}
