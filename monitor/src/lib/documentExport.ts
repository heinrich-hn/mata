import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface JsPDFWithAutoTable extends jsPDF {
    lastAutoTable: { finalY: number };
}

export interface DocumentAlert {
    entityType: "vehicle" | "driver";
    entityName: string;
    entityDetail: string;
    documentType: string;
    documentNumber: string;
    expiryDate: string;
    daysUntilExpiry: number;
    isOverdue: boolean;
}

function formatDocType(type: string) {
    return type
        .replace(/_/g, " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

// ── PDF ──

export function generateDocumentsPDF(alerts: DocumentAlert[], entityFilter: string) {
    const doc = new jsPDF({ orientation: "landscape" }) as JsPDFWithAutoTable;
    const pw = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(
        `Document Expiry Report – ${entityFilter === "vehicle" ? "Vehicles" : "Drivers"}`,
        pw / 2,
        18,
        { align: "center" }
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, 26);
    doc.text(`Total: ${alerts.length}`, pw - 14, 26, { align: "right" });

    const rows = alerts.map((a) => [
        a.entityName,
        a.entityDetail,
        formatDocType(a.documentType),
        a.documentNumber || "–",
        format(new Date(a.expiryDate), "dd MMM yyyy"),
        a.isOverdue ? `${Math.abs(a.daysUntilExpiry)}d overdue` : `${a.daysUntilExpiry}d left`,
        a.isOverdue ? "OVERDUE" : "EXPIRING",
    ]);

    autoTable(doc, {
        startY: 32,
        head: [
            [
                entityFilter === "vehicle" ? "Vehicle" : "Driver",
                entityFilter === "vehicle" ? "Make / Model" : "Driver #",
                "Doc Type",
                "Doc Number",
                "Expiry Date",
                "Days",
                "Status",
            ],
        ],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        didParseCell(data) {
            if (data.section === "body" && data.column.index === 6) {
                const val = data.cell.raw as string;
                if (val === "OVERDUE") {
                    data.cell.styles.textColor = [220, 38, 38];
                    data.cell.styles.fontStyle = "bold";
                } else {
                    data.cell.styles.textColor = [217, 119, 6];
                }
            }
        },
        margin: { left: 14, right: 14 },
    });

    doc.save(`document-expiry-${entityFilter}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ── Excel ──

export function generateDocumentsExcel(alerts: DocumentAlert[], entityFilter: string) {
    const rows = alerts.map((a) => ({
        [entityFilter === "vehicle" ? "Vehicle" : "Driver"]: a.entityName,
        [entityFilter === "vehicle" ? "Make / Model" : "Driver #"]: a.entityDetail,
        "Document Type": formatDocType(a.documentType),
        "Document Number": a.documentNumber || "",
        "Expiry Date": format(new Date(a.expiryDate), "dd MMM yyyy"),
        Days: a.isOverdue ? -Math.abs(a.daysUntilExpiry) : a.daysUntilExpiry,
        Status: a.isOverdue ? "OVERDUE" : "EXPIRING SOON",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Document Alerts");

    // Set column widths
    ws["!cols"] = [
        { wch: 22 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 10 },
        { wch: 14 },
    ];

    XLSX.writeFile(wb, `document-expiry-${entityFilter}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}

// ── WhatsApp ──

export function buildDocumentsWhatsAppMessage(alerts: DocumentAlert[], entityFilter: string): string {
    const overdue = alerts.filter((a) => a.isOverdue);
    const expiring = alerts.filter((a) => !a.isOverdue);

    const lines: string[] = [
        `📄 *Document Expiry Alerts – ${entityFilter === "vehicle" ? "Vehicles" : "Drivers"}*`,
        `📅 ${format(new Date(), "dd MMM yyyy")}`,
        `Total: ${alerts.length} | ⛔ ${overdue.length} overdue | ⚠️ ${expiring.length} expiring`,
        "",
    ];

    if (overdue.length > 0) {
        lines.push("*⛔ OVERDUE:*");
        for (const a of overdue) {
            lines.push(
                `  • ${a.entityName} | ${formatDocType(a.documentType)} | expired ${format(new Date(a.expiryDate), "dd MMM")} (${Math.abs(a.daysUntilExpiry)}d ago)`
            );
        }
        lines.push("");
    }

    if (expiring.length > 0) {
        lines.push("*⚠️ EXPIRING SOON:*");
        for (const a of expiring) {
            lines.push(
                `  • ${a.entityName} | ${formatDocType(a.documentType)} | ${format(new Date(a.expiryDate), "dd MMM")} (${a.daysUntilExpiry}d left)`
            );
        }
        lines.push("");
    }

    lines.push("_Please action these outstanding documents._");
    return lines.join("\n");
}

function normalisePhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("0") && digits.length === 10) return "27" + digits.slice(1);
    if (digits.length === 9) return "27" + digits;
    return digits;
}

export function openWhatsApp(message: string, phone?: string): void {
    const encoded = encodeURIComponent(message);
    const url = phone
        ? `https://wa.me/${normalisePhone(phone)}?text=${encoded}`
        : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
}

// ── Single-item exports ──

export function buildSingleDocWhatsApp(a: DocumentAlert): string {
    const status = a.isOverdue ? "⛔ OVERDUE" : "⚠️ EXPIRING SOON";
    const daysText = a.isOverdue
        ? `${Math.abs(a.daysUntilExpiry)} days overdue`
        : `${a.daysUntilExpiry} days remaining`;
    return [
        `📄 *Document Alert*`,
        `${status}`,
        ``,
        `*${a.entityName}* ${a.entityDetail ? `(${a.entityDetail})` : ""}`,
        `Document: ${formatDocType(a.documentType)}`,
        a.documentNumber ? `Number: ${a.documentNumber}` : "",
        `Expiry: ${format(new Date(a.expiryDate), "dd MMM yyyy")} — ${daysText}`,
        ``,
        `_Please action this document urgently._`,
    ]
        .filter(Boolean)
        .join("\n");
}

export function generateSingleDocPDF(a: DocumentAlert) {
    const doc = new jsPDF() as JsPDFWithAutoTable;
    const pw = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Document Expiry Notice", pw / 2, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, 30);

    autoTable(doc, {
        startY: 38,
        head: [["Field", "Value"]],
        body: [
            [a.entityType === "vehicle" ? "Vehicle" : "Driver", a.entityName],
            [a.entityType === "vehicle" ? "Make / Model" : "Driver #", a.entityDetail || "–"],
            ["Document Type", formatDocType(a.documentType)],
            ["Document Number", a.documentNumber || "–"],
            ["Expiry Date", format(new Date(a.expiryDate), "dd MMM yyyy")],
            ["Status", a.isOverdue ? `OVERDUE (${Math.abs(a.daysUntilExpiry)}d)` : `EXPIRING (${a.daysUntilExpiry}d left)`],
        ],
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
        margin: { left: 14, right: 14 },
    });

    doc.save(`doc-alert-${a.entityName.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
