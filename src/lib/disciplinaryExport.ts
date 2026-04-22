import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface DisciplinaryExportRecord {
    id: string;
    driver_id: string;
    title: string | null;
    incident_date: string;
    category: string;
    reason: string;
    description: string | null;
    hearing_date: string | null;
    hearing_time: string | null;
    hearing_venue: string | null;
    hearing_chairperson: string | null;
    outcome: string | null;
    outcome_date: string | null;
    sanction: string | null;
    status: string;
    follow_up_date: string | null;
    issued_by: string | null;
    created_at: string;
    drivers?: { first_name: string; last_name: string; driver_number: string };
}

const COMPANY = "Matanuska Distribution";
const REPORT_TITLE = "Driver Disciplinary Register";

const STATUS_LABELS: Record<string, string> = {
    inquiry_logged: "Inquiry Logged",
    hearing_scheduled: "Hearing Scheduled",
    outcome_recorded: "Outcome Recorded",
    appeal: "Appeal",
    dismissed: "Dismissed",
    resolved: "Resolved",
    open: "Open",
    escalated: "Escalated",
    hearing_held: "Hearing Held",
};

const CATEGORY_LABELS: Record<string, string> = {
    verbal_warning: "Verbal Warning",
    written_warning: "Written Warning",
    final_warning: "Final Warning",
    suspension: "Suspension",
    dismissal: "Dismissal",
    counselling: "Counselling",
    other: "Other",
};

const STATUS_PDF_COLOR: Record<string, [number, number, number]> = {
    inquiry_logged: [100, 116, 139],
    hearing_scheduled: [37, 99, 235],
    outcome_recorded: [217, 119, 6],
    appeal: [234, 88, 12],
    dismissed: [107, 114, 128],
    resolved: [22, 163, 74],
};

const STATUS_XLSX_COLOR: Record<string, string> = {
    inquiry_logged: "64748B",
    hearing_scheduled: "2563EB",
    outcome_recorded: "D97706",
    appeal: "EA580C",
    dismissed: "6B7280",
    resolved: "16A34A",
};

const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d?: string | null) =>
    d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const driverName = (r: DisciplinaryExportRecord) =>
    `${r.drivers?.first_name ?? ""} ${r.drivers?.last_name ?? ""}`.trim() || "Unknown";

const labelStatus = (s: string) => STATUS_LABELS[s] ?? s;
const labelCategory = (c: string) => CATEGORY_LABELS[c] ?? c;

/* ─────────────────────────────────────────────
 * BULK PDF — full register
 * ──────────────────────────────────────────── */
export function exportDisciplinaryListPDF(records: DisciplinaryExportRecord[]) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(31, 56, 100);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(REPORT_TITLE, 14, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(COMPANY, pageWidth - 14, 13, { align: "right" });

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 14, 28);
    doc.text(`Total records: ${records.length}`, pageWidth - 14, 28, { align: "right" });

    // Summary line
    const counts = records.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
    }, {});
    const summary = Object.entries(counts)
        .map(([s, n]) => `${labelStatus(s)}: ${n}`)
        .join("  •  ");
    if (summary) {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(summary, 14, 33);
    }

    autoTable(doc, {
        startY: 38,
        head: [[
            "Logged",
            "Driver",
            "Driver #",
            "Title",
            "Category",
            "Incident",
            "Hearing",
            "Status",
            "Outcome",
        ]],
        body: records.map((r) => [
            fmtDateTime(r.created_at),
            driverName(r),
            r.drivers?.driver_number ?? "",
            r.title ?? r.reason ?? "",
            labelCategory(r.category),
            fmtDate(r.incident_date),
            r.hearing_date ? `${fmtDate(r.hearing_date)}${r.hearing_time ? ` ${r.hearing_time}` : ""}` : "—",
            labelStatus(r.status),
            r.outcome ?? "—",
        ]),
        styles: { fontSize: 8, cellPadding: 2, valign: "middle" },
        headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [242, 246, 252] },
        columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 32 },
            2: { cellWidth: 18 },
            3: { cellWidth: 42 },
            4: { cellWidth: 24 },
            5: { cellWidth: 20 },
            6: { cellWidth: 26 },
            7: { cellWidth: 26 },
            8: { cellWidth: "auto" },
        },
        didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 7) {
                const status = records[data.row.index]?.status;
                const c = status ? STATUS_PDF_COLOR[status] : undefined;
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
                `Page ${current} of ${pages}  •  ${COMPANY} — Confidential`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 6,
                { align: "center" },
            );
        },
    });

    doc.save(`Disciplinary_Register_${new Date().toISOString().split("T")[0]}.pdf`);
}

/* ─────────────────────────────────────────────
 * BULK EXCEL — full register
 * ──────────────────────────────────────────── */
export async function exportDisciplinaryListExcel(records: DisciplinaryExportRecord[]) {
    const wb = new ExcelJS.Workbook();
    wb.creator = COMPANY;
    wb.created = new Date();

    const hFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "1F3864" } };
    const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFF" }, size: 10, name: "Calibri" };
    const hAlign: Partial<ExcelJS.Alignment> = { vertical: "middle", horizontal: "center", wrapText: true };
    const bdr: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "D9D9D9" } },
        bottom: { style: "thin", color: { argb: "D9D9D9" } },
        left: { style: "thin", color: { argb: "D9D9D9" } },
        right: { style: "thin", color: { argb: "D9D9D9" } },
    };
    const zFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F6FC" } };
    const bodyFont: Partial<ExcelJS.Font> = { size: 9, name: "Calibri" };

    const ws = wb.addWorksheet("Disciplinary Register");

    ws.mergeCells("A1:K1");
    const tc = ws.getCell("A1");
    tc.value = REPORT_TITLE.toUpperCase();
    tc.font = { bold: true, size: 16, color: { argb: "1F3864" }, name: "Calibri" };
    ws.getRow(1).height = 30;

    ws.mergeCells("A2:K2");
    ws.getCell("A2").value = `${COMPANY}  •  Generated ${new Date().toLocaleString("en-GB")}  •  ${records.length} records`;
    ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "666666" }, name: "Calibri" };

    const headers = [
        "Logged",
        "Driver",
        "Driver #",
        "Title",
        "Category",
        "Incident Date",
        "Reason",
        "Hearing Date",
        "Hearing Venue",
        "Status",
        "Outcome",
    ];
    ws.getRow(4).values = headers;
    const headerRow = ws.getRow(4);
    headerRow.eachCell((c) => { c.fill = hFill; c.font = hFont; c.alignment = hAlign; c.border = bdr; });
    headerRow.height = 26;

    records.forEach((r, i) => {
        const row = ws.getRow(i + 5);
        row.values = [
            fmtDateTime(r.created_at),
            driverName(r),
            r.drivers?.driver_number ?? "",
            r.title ?? r.reason ?? "",
            labelCategory(r.category),
            fmtDate(r.incident_date),
            r.reason ?? "",
            r.hearing_date ? `${fmtDate(r.hearing_date)}${r.hearing_time ? ` ${r.hearing_time}` : ""}` : "",
            r.hearing_venue ?? "",
            labelStatus(r.status),
            r.outcome ?? "",
        ];
        row.eachCell((c) => { c.border = bdr; c.font = bodyFont; c.alignment = { vertical: "middle", wrapText: true }; });
        if (i % 2 === 1) row.eachCell((c) => { c.fill = zFill; });

        const statusCell = row.getCell(10);
        const argb = STATUS_XLSX_COLOR[r.status];
        if (argb) statusCell.font = { ...bodyFont, color: { argb }, bold: true };
    });

    // Auto column width
    const widths = [22, 26, 14, 30, 20, 16, 40, 22, 22, 22, 40];
    ws.columns.forEach((c, i) => { c.width = widths[i] ?? 18; });
    ws.autoFilter = { from: "A4", to: `K${records.length + 4}` };
    ws.views = [{ state: "frozen", ySplit: 4 }];

    // Summary sheet
    const sWs = wb.addWorksheet("Summary");
    sWs.mergeCells("A1:B1");
    sWs.getCell("A1").value = "SUMMARY";
    sWs.getCell("A1").font = { bold: true, size: 16, color: { argb: "1F3864" }, name: "Calibri" };
    sWs.getRow(1).height = 30;
    sWs.getRow(3).values = ["Status", "Count"];
    const sHead = sWs.getRow(3);
    sHead.eachCell((c) => { c.fill = hFill; c.font = hFont; c.alignment = hAlign; c.border = bdr; });

    const counts = records.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
    }, {});
    const summaryRows: [string, number][] = [
        ["Total", records.length],
        ...Object.entries(counts).map(([s, n]) => [labelStatus(s), n] as [string, number]),
    ];
    summaryRows.forEach((r, i) => {
        const row = sWs.getRow(4 + i);
        row.values = [r[0], r[1]];
        row.getCell(1).font = { bold: i === 0, size: 10, name: "Calibri" };
        row.getCell(2).font = { size: 10, name: "Calibri" };
        row.eachCell((c) => { c.border = bdr; });
        if (i % 2 === 1) row.eachCell((c) => { c.fill = zFill; });
    });
    sWs.getColumn(1).width = 28;
    sWs.getColumn(2).width = 14;

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `Disciplinary_Register_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
}

/* ─────────────────────────────────────────────
 * Timeline derivation (no audit log table — derived from record fields)
 * ──────────────────────────────────────────── */
interface TimelineEvent {
    when: string;     // ISO/formatted
    stage: string;    // e.g. "Inquiry Logged"
    detail: string;   // e.g. "By Manager X"
}

function buildTimeline(r: DisciplinaryExportRecord): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    events.push({
        when: fmtDateTime(r.created_at),
        stage: "1. Inquiry Logged",
        detail: r.issued_by ? `Issued by ${r.issued_by}` : "Disciplinary inquiry opened",
    });

    if (r.hearing_date) {
        const detail = [
            r.hearing_time ? `Time: ${r.hearing_time}` : null,
            r.hearing_venue ? `Venue: ${r.hearing_venue}` : null,
            r.hearing_chairperson ? `Chair: ${r.hearing_chairperson}` : null,
        ].filter(Boolean).join("  •  ") || "Hearing scheduled";
        events.push({
            when: fmtDate(r.hearing_date),
            stage: "2. Hearing Scheduled",
            detail,
        });
    }

    if (r.outcome_date || r.outcome) {
        const detail = [
            r.sanction ? `Sanction: ${r.sanction}` : null,
            r.outcome ? `Outcome: ${r.outcome}` : null,
        ].filter(Boolean).join("  •  ") || "Outcome recorded";
        events.push({
            when: fmtDate(r.outcome_date) ?? fmtDateTime(r.created_at),
            stage: "3. Outcome Recorded",
            detail,
        });
    }

    if (r.follow_up_date) {
        events.push({
            when: fmtDate(r.follow_up_date),
            stage: "Follow-up Scheduled",
            detail: "Review / monitoring date",
        });
    }

    if (["resolved", "dismissed"].includes(r.status)) {
        events.push({
            when: fmtDate(r.outcome_date) ?? "—",
            stage: r.status === "resolved" ? "Case Resolved" : "Case Dismissed",
            detail: `Final status: ${labelStatus(r.status)}`,
        });
    }

    return events;
}

/* ─────────────────────────────────────────────
 * INDIVIDUAL PDF — full case file with timeline
 * ──────────────────────────────────────────── */
export function exportDisciplinaryRecordPDF(r: DisciplinaryExportRecord) {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header band
    doc.setFillColor(31, 56, 100);
    doc.rect(0, 0, pageWidth, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Disciplinary Case File", 14, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(COMPANY, pageWidth - 14, 14, { align: "right" });
    doc.setFontSize(8);
    doc.text(`Case ID: ${r.id}`, 14, 21);
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, pageWidth - 14, 21, { align: "right" });

    // Driver block
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(driverName(r), 14, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Driver #: ${r.drivers?.driver_number ?? "—"}`, 14, 42);

    // Case info table
    autoTable(doc, {
        startY: 48,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 42, fontStyle: "bold", fillColor: [242, 246, 252] },
            1: { cellWidth: "auto" },
        },
        body: [
            ["Title", r.title ?? "—"],
            ["Category", labelCategory(r.category)],
            ["Status", labelStatus(r.status)],
            ["Incident Date", fmtDate(r.incident_date)],
            ["Logged", fmtDateTime(r.created_at)],
            ["Issued By", r.issued_by ?? "—"],
        ],
        didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 1 && data.row.index === 2) {
                const c = STATUS_PDF_COLOR[r.status];
                if (c) {
                    data.cell.styles.textColor = c;
                    data.cell.styles.fontStyle = "bold";
                }
            }
        },
    });

    // Non-conformance / reason
    let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    const sectionHeader = (label: string, yPos: number) => {
        doc.setFillColor(31, 56, 100);
        doc.rect(14, yPos, pageWidth - 28, 6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(label, 16, yPos + 4.2);
    };
    const para = (txt: string, yStart: number) => {
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        const lines = doc.splitTextToSize(txt, pageWidth - 28);
        doc.text(lines, 14, yStart);
        return yStart + lines.length * 4.6;
    };

    sectionHeader("Non-Conformance / Reason", y);
    y += 8;
    y = para(r.reason || "—", y);

    if (r.description) {
        y += 4;
        sectionHeader("Description", y);
        y += 8;
        y = para(r.description, y);
    }

    if (r.hearing_date) {
        y += 4;
        sectionHeader("Hearing Details", y);
        y += 7;
        autoTable(doc, {
            startY: y,
            theme: "grid",
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 42, fontStyle: "bold", fillColor: [242, 246, 252] },
                1: { cellWidth: "auto" },
            },
            body: [
                ["Date", fmtDate(r.hearing_date)],
                ["Time", r.hearing_time ?? "—"],
                ["Venue", r.hearing_venue ?? "—"],
                ["Chairperson", r.hearing_chairperson ?? "—"],
            ],
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    }

    if (r.outcome || r.sanction || r.outcome_date) {
        sectionHeader("Outcome", y);
        y += 7;
        autoTable(doc, {
            startY: y,
            theme: "grid",
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 42, fontStyle: "bold", fillColor: [242, 246, 252] },
                1: { cellWidth: "auto" },
            },
            body: [
                ["Outcome Date", fmtDate(r.outcome_date)],
                ["Sanction", r.sanction ?? "—"],
                ["Outcome", r.outcome ?? "—"],
                ["Follow-up", fmtDate(r.follow_up_date)],
            ],
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    // Timeline
    const timeline = buildTimeline(r);
    if (y > 230) { doc.addPage(); y = 20; }
    sectionHeader("Case Timeline", y);
    y += 7;
    autoTable(doc, {
        startY: y,
        theme: "grid",
        head: [["When", "Stage", "Detail"]],
        body: timeline.map((e) => [e.when, e.stage, e.detail]),
        styles: { fontSize: 8.5, cellPadding: 2.5, valign: "top" },
        headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [242, 246, 252] },
        columnStyles: {
            0: { cellWidth: 38 },
            1: { cellWidth: 42, fontStyle: "bold" },
            2: { cellWidth: "auto" },
        },
    });

    // Footer
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
            `Page ${i} of ${pages}  •  ${COMPANY} — Confidential HR Document`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 6,
            { align: "center" },
        );
    }

    const safeName = driverName(r).replace(/[^a-z0-9]+/gi, "_");
    doc.save(`Disciplinary_${safeName}_${r.id.slice(0, 8)}.pdf`);
}

/* ─────────────────────────────────────────────
 * INDIVIDUAL EXCEL — full case file with timeline
 * ──────────────────────────────────────────── */
export async function exportDisciplinaryRecordExcel(r: DisciplinaryExportRecord) {
    const wb = new ExcelJS.Workbook();
    wb.creator = COMPANY;
    wb.created = new Date();

    const navy = "1F3864";
    const zebra = "F2F6FC";
    const hFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
    const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFF" }, size: 10, name: "Calibri" };
    const hAlign: Partial<ExcelJS.Alignment> = { vertical: "middle", horizontal: "left", wrapText: true };
    const bdr: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "D9D9D9" } },
        bottom: { style: "thin", color: { argb: "D9D9D9" } },
        left: { style: "thin", color: { argb: "D9D9D9" } },
        right: { style: "thin", color: { argb: "D9D9D9" } },
    };
    const labelFont: Partial<ExcelJS.Font> = { bold: true, size: 10, name: "Calibri" };
    const valueFont: Partial<ExcelJS.Font> = { size: 10, name: "Calibri" };
    const labelFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };

    /* Case sheet */
    const ws = wb.addWorksheet("Case File");
    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 70;

    ws.mergeCells("A1:B1");
    const t = ws.getCell("A1");
    t.value = "DISCIPLINARY CASE FILE";
    t.font = { bold: true, size: 16, color: { argb: navy }, name: "Calibri" };
    ws.getRow(1).height = 30;

    ws.mergeCells("A2:B2");
    ws.getCell("A2").value = `${COMPANY}  •  Generated ${new Date().toLocaleString("en-GB")}  •  Case ID ${r.id}`;
    ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "666666" }, name: "Calibri" };

    let row = 4;
    const section = (label: string) => {
        ws.mergeCells(row, 1, row, 2);
        const c = ws.getCell(row, 1);
        c.value = label;
        c.fill = hFill; c.font = hFont; c.alignment = hAlign;
        ws.getRow(row).height = 22;
        row++;
    };
    const kv = (k: string, v: string | null | undefined, opts?: { color?: string }) => {
        const r1 = ws.getRow(row);
        r1.getCell(1).value = k;
        r1.getCell(2).value = v ?? "—";
        r1.getCell(1).font = labelFont; r1.getCell(1).fill = labelFill;
        r1.getCell(2).font = opts?.color ? { ...valueFont, color: { argb: opts.color }, bold: true } : valueFont;
        r1.getCell(1).border = bdr; r1.getCell(2).border = bdr;
        r1.getCell(2).alignment = { vertical: "top", wrapText: true };
        row++;
    };

    section("DRIVER");
    kv("Name", driverName(r));
    kv("Driver #", r.drivers?.driver_number);

    section("CASE DETAILS");
    kv("Title", r.title);
    kv("Category", labelCategory(r.category));
    kv("Status", labelStatus(r.status), { color: STATUS_XLSX_COLOR[r.status] });
    kv("Incident Date", fmtDate(r.incident_date));
    kv("Logged", fmtDateTime(r.created_at));
    kv("Issued By", r.issued_by);

    section("NON-CONFORMANCE / REASON");
    kv("Reason", r.reason);
    if (r.description) kv("Description", r.description);

    if (r.hearing_date) {
        section("HEARING");
        kv("Date", fmtDate(r.hearing_date));
        kv("Time", r.hearing_time);
        kv("Venue", r.hearing_venue);
        kv("Chairperson", r.hearing_chairperson);
    }

    if (r.outcome || r.sanction || r.outcome_date) {
        section("OUTCOME");
        kv("Outcome Date", fmtDate(r.outcome_date));
        kv("Sanction", r.sanction);
        kv("Outcome", r.outcome);
        kv("Follow-up", fmtDate(r.follow_up_date));
    }

    /* Timeline sheet */
    const tws = wb.addWorksheet("Timeline");
    tws.mergeCells("A1:C1");
    tws.getCell("A1").value = "CASE TIMELINE";
    tws.getCell("A1").font = { bold: true, size: 16, color: { argb: navy }, name: "Calibri" };
    tws.getRow(1).height = 30;

    tws.mergeCells("A2:C2");
    tws.getCell("A2").value = `${driverName(r)}  •  Case ID ${r.id}`;
    tws.getCell("A2").font = { italic: true, size: 9, color: { argb: "666666" }, name: "Calibri" };

    tws.getRow(4).values = ["When", "Stage", "Detail"];
    tws.getRow(4).eachCell((c) => { c.fill = hFill; c.font = hFont; c.alignment = hAlign; c.border = bdr; });
    tws.getRow(4).height = 22;

    const timeline = buildTimeline(r);
    timeline.forEach((e, i) => {
        const tr = tws.getRow(i + 5);
        tr.values = [e.when, e.stage, e.detail];
        tr.eachCell((c) => { c.border = bdr; c.font = valueFont; c.alignment = { vertical: "top", wrapText: true }; });
        if (i % 2 === 1) tr.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } }; });
        tr.getCell(2).font = { ...valueFont, bold: true };
    });
    tws.getColumn(1).width = 26;
    tws.getColumn(2).width = 26;
    tws.getColumn(3).width = 70;
    tws.views = [{ state: "frozen", ySplit: 4 }];

    const buffer = await wb.xlsx.writeBuffer();
    const safeName = driverName(r).replace(/[^a-z0-9]+/gi, "_");
    saveAs(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `Disciplinary_${safeName}_${r.id.slice(0, 8)}.xlsx`,
    );
}
