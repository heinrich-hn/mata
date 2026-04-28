/**
 * Trip PDF export utility for the Dashboard app.
 * Generates a comprehensive trip report including driver info, load details,
 * revenue breakdown, and all associated expenses.
 */

import { format, parseISO } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

type RGBColor = [number, number, number];

// ─── Color palette ────────────────────────────────────────────────────────────
const navy: RGBColor = [15, 41, 84];
const blue: RGBColor = [37, 99, 235];
const emerald: RGBColor = [5, 150, 105];
const amber: RGBColor = [217, 119, 6];
const rose: RGBColor = [225, 29, 72];
const gray600: RGBColor = [75, 85, 99];
const gray200: RGBColor = [229, 231, 235];
const white: RGBColor = [255, 255, 255];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TripExportData {
    trip: {
        id: string;
        trip_number: string;
        status?: string | null;
        route?: string | null;
        origin?: string | null;
        destination?: string | null;
        driver_name?: string | null;
        client_name?: string | null;
        fleet_number?: string | null; // may not be present in type, kept for runtime use
        [key: string]: unknown;
        load_type?: string | null;
        departure_date?: string | null;
        arrival_date?: string | null;
        starting_km?: number | null;
        ending_km?: number | null;
        distance_km?: number | null;
        empty_km?: number | null;
        base_revenue?: number | null;
        additional_revenue?: number | null;
        additional_revenue_reason?: string | null;
        revenue_type?: string | null;
        rate_per_km?: number | null;
        revenue_currency?: string | null;
        zero_revenue_comment?: string | null;
        validation_notes?: string | null;
    };
    costs: Array<{
        id: string;
        category: string;
        sub_category?: string | null;
        amount: number;
        currency?: string | null;
        date?: string | null;
        notes?: string | null;
        is_flagged?: boolean | null;
        is_system_generated?: boolean | null;
    }>;
}

export interface TripPdfPayload {
    blob: Blob;
    fileName: string;
    url: string;
    file: File;
    base64: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = "USD"): string {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: currency || "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatDate(d: string | null | undefined): string {
    if (!d) return "—";
    try { return format(parseISO(d), "dd MMM yyyy"); } catch { return "—"; }
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error("Read failed"));
        reader.onload = () => {
            const result = reader.result as string;
            const idx = result.indexOf(",");
            resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.readAsDataURL(blob);
    });
}

// ─── Fetch full trip data ─────────────────────────────────────────────────────

export async function fetchTripExportData(tripId: string): Promise<TripExportData | null> {
    const [tripResult, costsResult] = await Promise.all([
        supabase
            .from("trips")
            .select(
                "id, trip_number, status, route, origin, destination, driver_name, client_name, load_type, departure_date, arrival_date, starting_km, ending_km, distance_km, empty_km, base_revenue, additional_revenue, additional_revenue_reason, revenue_type, rate_per_km, revenue_currency, zero_revenue_comment, validation_notes"
            )
            .eq("id", tripId)
            .single(),
        supabase
            .from("cost_entries")
            .select("id, category, sub_category, amount, currency, date, notes, is_flagged, is_system_generated")
            .eq("trip_id", tripId)
            .order("date", { ascending: true }),
    ]);

    if (tripResult.error || !tripResult.data) return null;

    return {
        trip: tripResult.data,
        costs: costsResult.data || [],
    };
}

// ─── PDF Builder ─────────────────────────────────────────────────────────────

export function buildTripPdf(data: TripExportData): { doc: jsPDF; fileName: string } {
    const { trip, costs } = data;

    const doc = new jsPDF() as jsPDF & { lastAutoTable: { finalY: number } };
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let yPos = 15;

    const totalRevenue = (trip.base_revenue || 0) + (trip.additional_revenue || 0);
    const totalExpenses = costs.reduce((sum, c) => sum + (c.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const currency = trip.revenue_currency || "USD";

    // ── Helper: section header ──
    const drawSectionHeader = (title: string, color: RGBColor = blue) => {
        if (yPos > 255) { doc.addPage(); yPos = 20; }
        doc.setFillColor(...color);
        doc.roundedRect(margin, yPos, contentWidth, 9, 1.5, 1.5, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...white);
        doc.text(title, margin + 4, yPos + 6.5);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        yPos += 13;
    };

    // ── Helper: two-column field row ──
    const drawField = (label: string, value: string, x: number, y: number, labelW = 38) => {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...gray600);
        doc.text(label, x, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(value, x + labelW, y);
    };

    // ═══════════════════════════════════════════════
    // HEADER BAR
    // ═══════════════════════════════════════════════
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 36, "F");

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text("TRIP REPORT", margin, 15);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`POD #${trip.trip_number}`, margin, 26);

    doc.setFontSize(8);
    doc.text(`MATANUSKA PTY LTD  |  Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, pageWidth - margin, 33, { align: "right" });

    // Status pill
    const statusText = (trip.status || "active").toUpperCase();
    const statusColor: RGBColor = trip.status === "completed" ? emerald : blue;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const pillW = doc.getTextWidth(statusText) + 10;
    doc.setFillColor(...statusColor);
    doc.roundedRect(pageWidth - margin - pillW, 8, pillW, 8, 2, 2, "F");
    doc.setTextColor(...white);
    doc.text(statusText, pageWidth - margin - pillW / 2, 13.5, { align: "center" });
    doc.setTextColor(0, 0, 0);

    yPos = 48;

    // ═══════════════════════════════════════════════
    // TRIP OVERVIEW
    // ═══════════════════════════════════════════════
    drawSectionHeader("Trip Overview");

    const col1 = margin + 4;
    const col2 = margin + contentWidth / 2 + 4;
    const rowH = 7;

    doc.setFontSize(9);
    let fy = yPos;

    drawField("POD Number:", trip.trip_number, col1, fy);
    drawField("Status:", (trip.status || "Active").toUpperCase(), col2, fy);
    fy += rowH;

    drawField("Route:", trip.route || "—", col1, fy);
    drawField("Load Type:", trip.load_type || "—", col2, fy);
    fy += rowH;

    drawField("Origin:", trip.origin || "—", col1, fy);
    drawField("Destination:", trip.destination || "—", col2, fy);
    fy += rowH;

    drawField("Departure:", formatDate(trip.departure_date), col1, fy);
    drawField("Arrival:", formatDate(trip.arrival_date), col2, fy);
    fy += rowH;

    yPos = fy + 4;

    // Divider
    doc.setDrawColor(...gray200);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, margin + contentWidth, yPos);
    yPos += 6;

    // ═══════════════════════════════════════════════
    // DRIVER & VEHICLE
    // ═══════════════════════════════════════════════
    drawSectionHeader("Driver & Vehicle");

    fy = yPos;
    drawField("Driver:", trip.driver_name || "—", col1, fy);
    drawField("Client:", trip.client_name || "—", col2, fy);
    fy += rowH;

    drawField("Fleet No:", trip.fleet_number || "—", col1, fy);
    fy += rowH;

    drawField("Starting KM:", trip.starting_km != null ? trip.starting_km.toLocaleString() : "—", col1, fy);
    drawField("Ending KM:", trip.ending_km != null ? trip.ending_km.toLocaleString() : "—", col2, fy);
    fy += rowH;

    drawField("Distance:", trip.distance_km != null ? `${trip.distance_km.toLocaleString()} km` : "—", col1, fy);
    drawField("Empty KM:", trip.empty_km != null ? `${trip.empty_km.toLocaleString()} km` : "—", col2, fy);
    fy += rowH;

    yPos = fy + 4;

    doc.setDrawColor(...gray200);
    doc.line(margin, yPos, margin + contentWidth, yPos);
    yPos += 6;

    // ═══════════════════════════════════════════════
    // REVENUE
    // ═══════════════════════════════════════════════
    drawSectionHeader("Revenue", emerald);

    fy = yPos;
    const revenueTypeLabel = trip.revenue_type === "per_km" ? "Per Kilometer" : "Per Load";

    drawField("Revenue Type:", revenueTypeLabel, col1, fy);
    if (trip.revenue_type === "per_km" && trip.rate_per_km) {
        drawField("Rate per KM:", formatCurrency(trip.rate_per_km, currency), col2, fy);
    }
    fy += rowH;

    drawField("Base Revenue:", trip.base_revenue != null ? formatCurrency(trip.base_revenue, currency) : "—", col1, fy);
    if (trip.additional_revenue && trip.additional_revenue > 0) {
        drawField("Additional:", formatCurrency(trip.additional_revenue, currency), col2, fy);
    }
    fy += rowH;

    if (trip.additional_revenue_reason) {
        drawField("Add. Reason:", trip.additional_revenue_reason, col1, fy);
        fy += rowH;
    }

    if (trip.zero_revenue_comment) {
        drawField("Zero Rev. Note:", trip.zero_revenue_comment, col1, fy);
        fy += rowH;
    }

    yPos = fy + 4;

    doc.setDrawColor(...gray200);
    doc.line(margin, yPos, margin + contentWidth, yPos);
    yPos += 6;

    // ═══════════════════════════════════════════════
    // EXPENSES
    // ═══════════════════════════════════════════════
    drawSectionHeader("Expenses", rose);

    if (costs.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(...gray600);
        doc.text("No expenses recorded for this trip.", col1, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 10;
    } else {
        const expenseRows = costs.map((c) => [
            formatDate(c.date),
            c.category.replace(/_/g, " "),
            c.sub_category ? c.sub_category.replace(/_/g, " ") : "—",
            c.notes || "—",
            formatCurrency(c.amount, c.currency || currency),
            c.is_flagged ? "⚠" : "",
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [["Date", "Category", "Sub-category", "Notes", "Amount", ""]],
            body: expenseRows,
            margin: { left: margin, right: margin },
            styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 30] },
            headStyles: { fillColor: [...rose], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 22 },
                4: { halign: "right", cellWidth: 28 },
                5: { cellWidth: 8, halign: "center" },
            },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            didParseCell: (hookData) => {
                if (hookData.section === "body" && hookData.column.index === 5 && hookData.cell.raw === "⚠") {
                    hookData.cell.styles.textColor = [220, 38, 38];
                    hookData.cell.styles.fontStyle = "bold";
                }
            },
        });

        yPos = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    // ═══════════════════════════════════════════════
    // FINANCIAL SUMMARY
    // ═══════════════════════════════════════════════
    if (yPos > 250) { doc.addPage(); yPos = 20; }

    drawSectionHeader("Financial Summary", navy);

    const summaryRows: [string, string, RGBColor][] = [
        ["Total Revenue", formatCurrency(totalRevenue, currency), emerald],
        ["Total Expenses", formatCurrency(totalExpenses, currency), rose],
        ["Net Profit / Loss", formatCurrency(netProfit, currency), netProfit >= 0 ? emerald : rose],
    ];

    const boxW = (contentWidth - 8) / 3;
    for (let i = 0; i < summaryRows.length; i++) {
        const bx = margin + i * (boxW + 4);
        const [label, value, color] = summaryRows[i];
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(bx, yPos, boxW, 20, 2, 2, "F");
        doc.setDrawColor(...gray200);
        doc.setLineWidth(0.3);
        doc.roundedRect(bx, yPos, boxW, 20, 2, 2, "S");

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...gray600);
        doc.text(label, bx + boxW / 2, yPos + 7, { align: "center" });

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...color);
        doc.text(value, bx + boxW / 2, yPos + 16, { align: "center" });
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    yPos += 28;

    // ═══════════════════════════════════════════════
    // NOTES
    // ═══════════════════════════════════════════════
    if (trip.validation_notes) {
        if (yPos > 255) { doc.addPage(); yPos = 20; }
        drawSectionHeader("Notes", amber);

        const lines = doc.splitTextToSize(trip.validation_notes, contentWidth - 8);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(lines, margin + 4, yPos);
        yPos += lines.length * 5 + 4;
    }

    // ─── Footer on every page ───────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(...gray600);
        doc.text(
            `Page ${i} of ${pageCount}  |  MATANUSKA PTY LTD  |  MATA Fleet Management`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 8,
            { align: "center" }
        );
    }

    const fileName = `Trip-${trip.trip_number}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    return { doc, fileName };
}

// ─── Full export: build + package as blob/base64 ─────────────────────────────

export async function buildTripPdfPayload(data: TripExportData): Promise<TripPdfPayload> {
    const { doc, fileName } = buildTripPdf(data);
    const blob = doc.output("blob");
    const base64 = await blobToBase64(blob);
    const url = URL.createObjectURL(blob);
    const file = new File([blob], fileName, { type: "application/pdf" });
    return { blob, fileName, url, file, base64 };
}

// ─── WhatsApp message builder ─────────────────────────────────────────────────

export function buildTripWhatsAppMessage(data: TripExportData): string {
    const { trip, costs } = data;
    const currency = trip.revenue_currency || "USD";
    const totalRevenue = (trip.base_revenue || 0) + (trip.additional_revenue || 0);
    const totalExpenses = costs.reduce((sum, c) => sum + (c.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const lines: string[] = [
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        "   🚛 *MATA Fleet — Trip Report*",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        `📋 *POD Number:* ${trip.trip_number}`,
        `📊 *Status:* ${(trip.status || "Active").toUpperCase()}`,
        "",
    ];

    if (trip.route || trip.origin || trip.destination) {
        lines.push("🗺️ *ROUTE*");
        lines.push("┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
        if (trip.route) lines.push(`🛣️ Route: ${trip.route}`);
        if (trip.origin) lines.push(`📍 From: ${trip.origin}`);
        if (trip.destination) lines.push(`🏁 To: ${trip.destination}`);
        lines.push("");
    }

    lines.push("👤 *DRIVER & VEHICLE*");
    lines.push("┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
    if (trip.driver_name) lines.push(`👤 Driver: ${trip.driver_name}`);
    if (trip.fleet_number) lines.push(`🚛 Fleet: ${trip.fleet_number}`);
    if (trip.client_name) lines.push(`🏢 Client: ${trip.client_name}`);
    if (trip.departure_date) lines.push(`📅 Departed: ${formatDate(trip.departure_date)}`);
    if (trip.arrival_date) lines.push(`📅 Arrived: ${formatDate(trip.arrival_date)}`);
    if (trip.distance_km != null) lines.push(`📏 Distance: ${trip.distance_km.toLocaleString()} km`);
    lines.push("");

    lines.push("💰 *FINANCIALS*");
    lines.push("┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
    lines.push(`💵 Revenue: ${formatCurrency(totalRevenue, currency)}`);
    lines.push(`💸 Expenses: ${formatCurrency(totalExpenses, currency)}`);
    const profitEmoji = netProfit >= 0 ? "✅" : "🔴";
    lines.push(`${profitEmoji} Net Profit: ${formatCurrency(netProfit, currency)}`);
    lines.push("");

    if (costs.length > 0) {
        lines.push(`📝 Expenses: ${costs.length} item${costs.length === 1 ? "" : "s"} recorded`);
        const flagged = costs.filter((c) => c.is_flagged).length;
        if (flagged > 0) lines.push(`⚠️ ${flagged} flagged item${flagged === 1 ? "" : "s"} require attention`);
        lines.push("");
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push(`🕐 ${format(new Date(), "dd MMM yyyy, HH:mm")}`);
    lines.push("");
    lines.push("_The PDF report has been downloaded — please attach it before sending._");

    return lines.join("\n");
}

export function normalizePhoneForWhatsApp(raw: string | null | undefined): string {
    if (!raw) return "";
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0") && digits.length === 10) digits = `27${digits.slice(1)}`;
    return digits;
}
