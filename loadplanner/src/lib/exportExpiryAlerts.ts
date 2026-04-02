import { format } from "date-fns";
import XLSX from "xlsx-js-style";
import type { ExpiryAlert, MissingDocument } from "@/hooks/useExpiryAlerts";
import {
    BRAND, COMPANY_NAME, SYSTEM_NAME,
    xlTitle, xlSubtitle, xlHeader,
    xlMetricLabel, xlMetricValue,
    applyHeaderStyle, applyTitleRows,
} from "@/lib/exportStyles";

interface ExportOptions {
    filename?: string;
}

/** Status-based cell style */
function statusStyle(status: string) {
    if (status === "EXPIRED") return { fill: { fgColor: { rgb: BRAND.dangerBg } }, font: { bold: true, color: { rgb: BRAND.dangerDk } } };
    if (status === "CRITICAL") return { fill: { fgColor: { rgb: BRAND.warningBg } }, font: { bold: true, color: { rgb: BRAND.warningDk } } };
    return { fill: { fgColor: { rgb: BRAND.neutralBg } }, font: { color: { rgb: BRAND.neutralDk } } };
}

function encodeCell(r: number, c: number): string {
    let col = "";
    let n = c;
    do { col = String.fromCharCode(65 + (n % 26)) + col; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return `${col}${r + 1}`;
}

export function exportExpiryAlertsToExcel(
    alerts: ExpiryAlert[],
    options: ExportOptions = {},
): void {
    const { filename = `expiry-alerts-${format(new Date(), "yyyy-MM-dd")}` } =
        options;

    const driverAlerts = alerts.filter((a) => a.type === "driver");
    const vehicleAlerts = alerts.filter((a) => a.type === "vehicle");

    const workbook = XLSX.utils.book_new();

    // ── Summary sheet ─────────────────────────────────────────────────────
    const summaryAoa = [
        [COMPANY_NAME, ""],
        [`${SYSTEM_NAME} — Expiry Alerts Report`, ""],
        ["", ""],
        ["Category", "Count"],
        ["Total Alerts", alerts.length],
        ["", ""],
        ["Expired Documents", alerts.filter((a) => a.status === "expired").length],
        ["Critical (≤7 days)", alerts.filter((a) => a.status === "critical").length],
        ["Warning (≤20 days)", alerts.filter((a) => a.status === "warning").length],
        ["", ""],
        ["Driver Documents", driverAlerts.length],
        ["Vehicle Documents", vehicleAlerts.length],
        ["", ""],
        ["Report Generated", format(new Date(), "dd/MM/yyyy HH:mm")],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa);
    summarySheet["!cols"] = [{ wch: 28 }, { wch: 22 }];

    summarySheet["A1"] = { v: COMPANY_NAME, t: "s", s: xlTitle };
    summarySheet["B1"] = { v: "", t: "s", s: xlTitle };
    summarySheet["A2"] = { v: String(summaryAoa[1][0]), t: "s", s: xlSubtitle };
    summarySheet["B2"] = { v: "", t: "s", s: xlSubtitle };
    summarySheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ];
    summarySheet["A4"] = { v: "Category", t: "s", s: xlHeader };
    summarySheet["B4"] = { v: "Count", t: "s", s: xlHeader };
    for (let r = 4; r < summaryAoa.length; r++) {
        const refA = encodeCell(r, 0);
        const refB = encodeCell(r, 1);
        if (summarySheet[refA] && summarySheet[refA].v !== "" && summarySheet[refA].v !== undefined) {
            summarySheet[refA].s = xlMetricLabel;
        }
        if (summarySheet[refB] && summarySheet[refA]?.v !== "" && summarySheet[refA]?.v !== undefined) {
            summarySheet[refB].s = xlMetricValue;
        }
    }

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // ── Driver Documents sheet ────────────────────────────────────────────
    if (driverAlerts.length > 0) {
        const driverData = driverAlerts.map((alert) => ({
            "Driver Name": alert.entityName,
            "Document Type": alert.documentLabel,
            "Expiry Date": format(new Date(alert.expiryDate), "dd/MM/yyyy"),
            "Days Until Expiry":
                alert.daysUntilExpiry < 0
                    ? `${Math.abs(alert.daysUntilExpiry)} days overdue`
                    : `${alert.daysUntilExpiry} days`,
            Status:
                alert.status === "expired"
                    ? "EXPIRED"
                    : alert.status === "critical"
                        ? "CRITICAL"
                        : "WARNING",
        }));

        const titleRow = [`${COMPANY_NAME} — Driver Document Expiry Alerts`];
        const genRow = [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`];
        const driverSheet = XLSX.utils.aoa_to_sheet([titleRow, genRow, []]);
        XLSX.utils.sheet_add_json(driverSheet, driverData, { origin: "A4" });
        driverSheet["!cols"] = [
            { wch: 28 }, { wch: 22 }, { wch: 15 }, { wch: 22 }, { wch: 14 },
        ];
        const merges: XLSX.Range[] = [];
        applyTitleRows(driverSheet, 5, merges);
        driverSheet["!merges"] = merges;
        applyHeaderStyle(driverSheet, 3, 5);

        driverAlerts.forEach((alert, i) => {
            const row = i + 4;
            const ref = encodeCell(row, 4);
            if (driverSheet[ref]) {
                const st = alert.status === "expired" ? "EXPIRED" : alert.status === "critical" ? "CRITICAL" : "WARNING";
                driverSheet[ref].s = statusStyle(st);
            }
        });

        XLSX.utils.book_append_sheet(workbook, driverSheet, "Driver Documents");
    }

    // ── Vehicle Documents sheet ───────────────────────────────────────────
    if (vehicleAlerts.length > 0) {
        const vehicleData = vehicleAlerts.map((alert) => ({
            "Vehicle ID": alert.entityName,
            "Document Type": alert.documentLabel,
            "Expiry Date": format(new Date(alert.expiryDate), "dd/MM/yyyy"),
            "Days Until Expiry":
                alert.daysUntilExpiry < 0
                    ? `${Math.abs(alert.daysUntilExpiry)} days overdue`
                    : `${alert.daysUntilExpiry} days`,
            Status:
                alert.status === "expired"
                    ? "EXPIRED"
                    : alert.status === "critical"
                        ? "CRITICAL"
                        : "WARNING",
        }));

        const titleRow = [`${COMPANY_NAME} — Vehicle Document Expiry Alerts`];
        const genRow = [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`];
        const vehicleSheet = XLSX.utils.aoa_to_sheet([titleRow, genRow, []]);
        XLSX.utils.sheet_add_json(vehicleSheet, vehicleData, { origin: "A4" });
        vehicleSheet["!cols"] = [
            { wch: 18 }, { wch: 24 }, { wch: 15 }, { wch: 22 }, { wch: 14 },
        ];
        const merges: XLSX.Range[] = [];
        applyTitleRows(vehicleSheet, 5, merges);
        vehicleSheet["!merges"] = merges;
        applyHeaderStyle(vehicleSheet, 3, 5);

        vehicleAlerts.forEach((alert, i) => {
            const row = i + 4;
            const ref = encodeCell(row, 4);
            if (vehicleSheet[ref]) {
                const st = alert.status === "expired" ? "EXPIRED" : alert.status === "critical" ? "CRITICAL" : "WARNING";
                vehicleSheet[ref].s = statusStyle(st);
            }
        });

        XLSX.utils.book_append_sheet(workbook, vehicleSheet, "Vehicle Documents");
    }

    XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Export only driver documents
export function exportDriverExpiryAlertsToExcel(
    alerts: ExpiryAlert[],
    options: ExportOptions = {},
): void {
    const driverAlerts = alerts.filter((a) => a.type === "driver");
    exportExpiryAlertsToExcel(driverAlerts, {
        filename:
            options.filename ||
            `driver-expiry-alerts-${format(new Date(), "yyyy-MM-dd")}`,
    });
}

// Export only vehicle documents
export function exportVehicleExpiryAlertsToExcel(
    alerts: ExpiryAlert[],
    options: ExportOptions = {},
): void {
    const vehicleAlerts = alerts.filter((a) => a.type === "vehicle");
    exportExpiryAlertsToExcel(vehicleAlerts, {
        filename:
            options.filename ||
            `vehicle-expiry-alerts-${format(new Date(), "yyyy-MM-dd")}`,
    });
}

// Export missing documents report
export function exportMissingDocumentsToExcel(
    missingDocs: MissingDocument[],
    options: ExportOptions = {},
): void {
    const { filename = `missing-documents-${format(new Date(), "yyyy-MM-dd")}` } =
        options;

    const driverMissing = missingDocs.filter((m) => m.type === "driver");
    const vehicleMissing = missingDocs.filter((m) => m.type === "vehicle");
    const missingDates = missingDocs.filter((m) => m.missingType === "no_date");
    const missingUploads = missingDocs.filter(
        (m) => m.missingType === "no_document",
    );

    const workbook = XLSX.utils.book_new();

    // ── Summary sheet ─────────────────────────────────────────────────────
    const summaryAoa = [
        [COMPANY_NAME, ""],
        [`${SYSTEM_NAME} — Missing Documents Report`, ""],
        ["", ""],
        ["Category", "Count"],
        ["Total Missing Items", missingDocs.length],
        ["", ""],
        ["Missing Expiry Dates", missingDates.length],
        ["Missing Document Uploads", missingUploads.length],
        ["", ""],
        ["Driver Documents", driverMissing.length],
        ["Vehicle Documents", vehicleMissing.length],
        ["", ""],
        ["Report Generated", format(new Date(), "dd/MM/yyyy HH:mm")],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa);
    summarySheet["!cols"] = [{ wch: 28 }, { wch: 22 }];

    summarySheet["A1"] = { v: COMPANY_NAME, t: "s", s: xlTitle };
    summarySheet["B1"] = { v: "", t: "s", s: xlTitle };
    summarySheet["A2"] = { v: String(summaryAoa[1][0]), t: "s", s: xlSubtitle };
    summarySheet["B2"] = { v: "", t: "s", s: xlSubtitle };
    summarySheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ];
    summarySheet["A4"] = { v: "Category", t: "s", s: xlHeader };
    summarySheet["B4"] = { v: "Count", t: "s", s: xlHeader };
    for (let r = 4; r < summaryAoa.length; r++) {
        const refA = encodeCell(r, 0);
        const refB = encodeCell(r, 1);
        if (summarySheet[refA] && summarySheet[refA].v !== "" && summarySheet[refA].v !== undefined) {
            summarySheet[refA].s = xlMetricLabel;
        }
        if (summarySheet[refB] && summarySheet[refA]?.v !== "" && summarySheet[refA]?.v !== undefined) {
            summarySheet[refB].s = xlMetricValue;
        }
    }

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // ── Driver Missing Documents sheet ────────────────────────────────────
    if (driverMissing.length > 0) {
        const driverData = driverMissing.map((doc) => ({
            "Driver Name": doc.entityName,
            "Document Type": doc.documentLabel,
            Issue:
                doc.missingType === "no_document"
                    ? "Document not uploaded"
                    : "Expiry date not set",
            "Issue Type": doc.missingType === "no_document" ? "NO FILE" : "NO DATE",
        }));

        const titleRow = [`${COMPANY_NAME} — Driver Missing Documents`];
        const genRow = [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`];
        const driverSheet = XLSX.utils.aoa_to_sheet([titleRow, genRow, []]);
        XLSX.utils.sheet_add_json(driverSheet, driverData, { origin: "A4" });
        driverSheet["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 26 }, { wch: 14 }];
        const merges: XLSX.Range[] = [];
        applyTitleRows(driverSheet, 4, merges);
        driverSheet["!merges"] = merges;
        applyHeaderStyle(driverSheet, 3, 4);

        driverMissing.forEach((doc, i) => {
            const row = i + 4;
            const ref = encodeCell(row, 3);
            if (driverSheet[ref]) {
                driverSheet[ref].s = doc.missingType === "no_document"
                    ? { fill: { fgColor: { rgb: BRAND.dangerBg } }, font: { bold: true, color: { rgb: BRAND.dangerDk } } }
                    : { fill: { fgColor: { rgb: BRAND.warningBg } }, font: { bold: true, color: { rgb: BRAND.warningDk } } };
            }
        });

        XLSX.utils.book_append_sheet(workbook, driverSheet, "Driver Missing");
    }

    // ── Vehicle Missing Documents sheet ───────────────────────────────────
    if (vehicleMissing.length > 0) {
        const vehicleData = vehicleMissing.map((doc) => ({
            "Vehicle ID": doc.entityName,
            "Document Type": doc.documentLabel,
            Issue:
                doc.missingType === "no_document"
                    ? "Document not uploaded"
                    : "Expiry date not set",
            "Issue Type": doc.missingType === "no_document" ? "NO FILE" : "NO DATE",
        }));

        const titleRow = [`${COMPANY_NAME} — Vehicle Missing Documents`];
        const genRow = [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`];
        const vehicleSheet = XLSX.utils.aoa_to_sheet([titleRow, genRow, []]);
        XLSX.utils.sheet_add_json(vehicleSheet, vehicleData, { origin: "A4" });
        vehicleSheet["!cols"] = [{ wch: 18 }, { wch: 24 }, { wch: 26 }, { wch: 14 }];
        const merges: XLSX.Range[] = [];
        applyTitleRows(vehicleSheet, 4, merges);
        vehicleSheet["!merges"] = merges;
        applyHeaderStyle(vehicleSheet, 3, 4);

        vehicleMissing.forEach((doc, i) => {
            const row = i + 4;
            const ref = encodeCell(row, 3);
            if (vehicleSheet[ref]) {
                vehicleSheet[ref].s = doc.missingType === "no_document"
                    ? { fill: { fgColor: { rgb: BRAND.dangerBg } }, font: { bold: true, color: { rgb: BRAND.dangerDk } } }
                    : { fill: { fgColor: { rgb: BRAND.warningBg } }, font: { bold: true, color: { rgb: BRAND.warningDk } } };
            }
        });

        XLSX.utils.book_append_sheet(workbook, vehicleSheet, "Vehicle Missing");
    }

    XLSX.writeFile(workbook, `${filename}.xlsx`);
}
