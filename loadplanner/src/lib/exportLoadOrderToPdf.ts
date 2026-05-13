import type { Load } from "@/hooks/useTrips";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY_NAME, SYSTEM_NAME, pdfColors } from "@/lib/exportStyles";
import { format, parseISO } from "date-fns";
import { jsPDF } from "jspdf";

/**
 * Subcontractor / Supplier details printed on the Load Order.
 * All optional — anything missing renders as "—".
 */
export interface LoadOrderSubcontractor {
    name: string;
    contactPerson?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    taxId?: string | null;
}

export interface LoadOrderImageAttachment {
    /** Image bytes as a data URL (e.g. "data:image/jpeg;base64,...") */
    dataUrl: string;
    /** jsPDF image format hint, derived from MIME type. */
    format: "JPEG" | "PNG" | "WEBP" | "GIF";
    /** Optional caption shown above the image (e.g. original filename). */
    caption?: string;
}

export interface ExportLoadOrderOptions {
    /** Trip rate to print on the order. Required for a Load Order. */
    rate?: { amount: number; currency: string };
    /**
     * When false, the PDF is not auto-downloaded — the caller receives the
     * Blob and filename in the return value. Defaults to true.
     */
    download?: boolean;
    /**
     * Optional supporting image to embed as a final page in the PDF
     * (e.g. a scanned proof-of-delivery, signed manifest, or weighbridge slip).
     * PDF attachments are NOT merged here — callers should attach them
     * separately (e.g. as a second download or email attachment).
     */
    imageAttachment?: LoadOrderImageAttachment;
}

export interface ExportLoadOrderResult {
    blob: Blob;
    filename: string;
}

/**
 * The two legal clauses below MUST be reproduced verbatim on every
 * subcontractor Load Order. Do not edit — wording is legal-reviewed.
 */
const RESTRAINT_OF_TRADE_TITLE = "Restraint of Trade and Direct Engagement";
const RESTRAINT_OF_TRADE_PARAGRAPHS: string[] = [
    "The Client/Broker or Carrier (Subcontracted) shall not, during the currency of this Agreement, and in the event of this Agreement being terminated by Matanuska Pty Ltd due to default by the Client/Broker or Carrier (Subcontracted), or for any other reason whatsoever this Agreement is terminated by Matanuska Pty Ltd, for a period of 12 (twelve) months after such termination and within the Republic of South Africa, directly or indirectly and in any capacity or manner render any services to any of Matanuska Pty Ltd's principals without the prior written consent of Matanuska Pty Ltd. This excludes all principals serviced by the Client/Broker or Carrier (Subcontracted) upon conclusion of this Agreement.",
    "The Client/Broker or Carrier (Subcontracted) acknowledges and agrees that this restraint is reasonable in all respects and is reasonably necessary to protect the proprietary interests of Matanuska Pty Ltd. The Client/Broker or Carrier (Subcontracted) furthermore acknowledges that it has derived sufficient compensation for such restraint from Matanuska Pty Ltd through the rendering of the services herein.",
    "Irrespective of whether this restraint is enforceable or not, as a whole or in part, or if Matanuska Pty Ltd enforces its rights in terms of this restraint or not, the Client/Broker or Carrier (Subcontracted) shall, for the full duration of the restraint period, in any event be liable to Matanuska Pty Ltd for commission of 10% (ten percent) of the gross compensation received for logistical services rendered to any principal introduced to the Client/Broker or Carrier (Subcontracted) by Matanuska Pty Ltd. Such commission shall be payable on a monthly basis and Matanuska Pty Ltd shall have unfettered access to the records of the Client/Broker or Carrier (Subcontracted) for purposes of determining the nature and extent of such logistical services and the commission payable.",
];

const NON_SOLICITATION_TITLE = "Non-Solicitation of Personnel";
const NON_SOLICITATION_PARAGRAPHS: string[] = [
    "During the term of this Agreement and for a period of 12 (twelve) months following its termination, the customer shall not, directly or indirectly, solicit for employment, hire, or engage as an independent contractor any driver, employee, or contractor of Matanuska Pty Ltd who performed services for the customer.",
    "In the event of a breach of this section, the customer agrees to pay Matanuska Pty Ltd a recruitment fee equal to 30% (thirty percent) of the individual's new annual salary or projected annual earnings as liquidated damages.",
];

interface ParsedTimeWindow {
    origin?: { placeName?: string; address?: string; plannedArrival?: string; plannedDeparture?: string };
    destination?: { placeName?: string; address?: string; plannedArrival?: string; plannedDeparture?: string };
    subcontractor?: { supplierId?: string; supplierName?: string; cargoDescription?: string };
}

function parseTimeWindow(tw: unknown): ParsedTimeWindow {
    if (!tw) return {};
    if (typeof tw === "string") {
        try {
            return JSON.parse(tw) as ParsedTimeWindow;
        } catch {
            return {};
        }
    }
    return tw as ParsedTimeWindow;
}

function safeFormatDate(iso?: string | null): string {
    if (!iso) return "—";
    try {
        return format(parseISO(iso), "dd MMM yyyy");
    } catch {
        return iso;
    }
}

async function fetchSupplierFromTimeWindow(load: Load): Promise<LoadOrderSubcontractor | null> {
    const tw = parseTimeWindow(load.time_window);
    const supplierId = tw.subcontractor?.supplierId;
    if (!supplierId) {
        // Fall back to whatever name is embedded in the time_window
        const name = tw.subcontractor?.supplierName;
        return name ? { name } : null;
    }
    const { data, error } = await supabase
        .from("suppliers")
        .select("name, contact_person, contact_phone, contact_email, address, city, country, tax_id")
        .eq("id", supplierId)
        .single();
    if (error || !data) {
        const name = tw.subcontractor?.supplierName;
        return name ? { name } : null;
    }
    return {
        name: data.name,
        contactPerson: data.contact_person,
        contactPhone: data.contact_phone,
        contactEmail: data.contact_email,
        address: data.address,
        city: data.city,
        country: data.country,
        taxId: data.tax_id,
    };
}

/**
 * Render a single Load Order PDF.
 *
 * The document intentionally contains ONLY:
 *  - Subcontractor details
 *  - Trip rate
 *  - Loading point
 *  - Offloading point
 *  - The two legal clauses (verbatim, MUST NOT be modified)
 *
 * No driver, vehicle, cargo or client information is shown.
 */
export async function exportLoadOrderToPdf(
    load: Load,
    options: ExportLoadOrderOptions = {},
): Promise<ExportLoadOrderResult> {
    const { rate, download = true, imageAttachment } = options;

    const subcontractor = await fetchSupplierFromTimeWindow(load);
    const tw = parseTimeWindow(load.time_window);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    let yPos = 20;

    // ─────────────────────────────────────────────────────────────────────
    // Banner
    // ─────────────────────────────────────────────────────────────────────
    const bannerHeight = 24;
    doc.setFillColor(...pdfColors.navy);
    doc.rect(0, 0, pageWidth, bannerHeight, "F");
    doc.setFillColor(...pdfColors.accent);
    doc.rect(0, bannerHeight, pageWidth, 1.2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(COMPANY_NAME, margin, 13);

    doc.setTextColor(214, 228, 240);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(SYSTEM_NAME, margin, 19);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("LOAD ORDER", pageWidth - margin, 13, { align: "right" });

    doc.setTextColor(214, 228, 240);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(load.load_id, pageWidth - margin, 19, { align: "right" });

    yPos = bannerHeight + 14;

    // ─────────────────────────────────────────────────────────────────────
    // Document meta
    // ─────────────────────────────────────────────────────────────────────
    doc.setTextColor(...pdfColors.textMuted);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
        `Issued: ${format(new Date(), "dd MMMM yyyy, HH:mm")}`,
        pageWidth - margin,
        yPos,
        { align: "right" },
    );
    yPos += 8;

    // ─────────────────────────────────────────────────────────────────────
    // Section helper
    // ─────────────────────────────────────────────────────────────────────
    const addSectionHeader = (title: string) => {
        doc.setFillColor(...pdfColors.navy);
        doc.rect(margin, yPos - 3, 2.5, 7, "F");
        doc.setTextColor(...pdfColors.navy);
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), margin + 6, yPos + 1.5);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos + 5, pageWidth - margin, yPos + 5);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        yPos += 11;
    };

    const addKeyValue = (key: string, value: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...pdfColors.textPrimary);
        doc.text(`${key}:`, margin + 2, yPos);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...pdfColors.textPrimary);
        const wrapped = doc.splitTextToSize(value || "—", pageWidth - margin * 2 - 50);
        doc.text(wrapped, margin + 50, yPos);
        yPos += Math.max(6, wrapped.length * 5);
    };

    // ─────────────────────────────────────────────────────────────────────
    // Subcontractor details
    // ─────────────────────────────────────────────────────────────────────
    addSectionHeader("Subcontractor");
    if (subcontractor) {
        addKeyValue("Name", subcontractor.name);
        if (subcontractor.contactPerson) addKeyValue("Contact Person", subcontractor.contactPerson);
        if (subcontractor.contactPhone) addKeyValue("Phone", subcontractor.contactPhone);
        if (subcontractor.contactEmail) addKeyValue("Email", subcontractor.contactEmail);
        const addressLine = [
            subcontractor.address,
            subcontractor.city,
            subcontractor.country,
        ]
            .filter((p) => p && p.trim())
            .join(", ");
        if (addressLine) addKeyValue("Address", addressLine);
        if (subcontractor.taxId) addKeyValue("Tax / VAT No.", subcontractor.taxId);
    } else {
        addKeyValue("Name", "—");
    }
    yPos += 4;

    // ─────────────────────────────────────────────────────────────────────
    // Trip rate
    // ─────────────────────────────────────────────────────────────────────
    addSectionHeader("Trip Rate");
    if (rate) {
        const formatted = `${rate.currency} ${rate.amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
        addKeyValue("Agreed Rate", formatted);
    } else {
        addKeyValue("Agreed Rate", "To be confirmed");
    }
    yPos += 4;

    // ─────────────────────────────────────────────────────────────────────
    // Loading point
    // ─────────────────────────────────────────────────────────────────────
    addSectionHeader("Loading Point");
    addKeyValue("Location", tw.origin?.placeName || load.origin || "—");
    if (tw.origin?.address) addKeyValue("Address", tw.origin.address);
    addKeyValue("Loading Date", safeFormatDate(load.loading_date));
    if (tw.origin?.plannedArrival) addKeyValue("Planned Arrival", tw.origin.plannedArrival);
    if (tw.origin?.plannedDeparture) addKeyValue("Planned Departure", tw.origin.plannedDeparture);
    yPos += 4;

    // ─────────────────────────────────────────────────────────────────────
    // Offloading point
    // ─────────────────────────────────────────────────────────────────────
    addSectionHeader("Offloading Point");
    addKeyValue("Location", tw.destination?.placeName || load.destination || "—");
    if (tw.destination?.address) addKeyValue("Address", tw.destination.address);
    addKeyValue("Offloading Date", safeFormatDate(load.offloading_date));
    if (tw.destination?.plannedArrival) addKeyValue("Planned Arrival", tw.destination.plannedArrival);
    if (tw.destination?.plannedDeparture) addKeyValue("Planned Departure", tw.destination.plannedDeparture);
    yPos += 8;

    // ─────────────────────────────────────────────────────────────────────
    // Legal terms — verbatim, must not be modified.
    // ─────────────────────────────────────────────────────────────────────
    const renderLegalSection = (title: string, paragraphs: string[]) => {
        // Page break if not enough room for the title
        if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 20;
        }
        addSectionHeader(title);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...pdfColors.textPrimary);
        const maxWidth = pageWidth - margin * 2;
        const lineHeight = 4.2;
        for (const para of paragraphs) {
            const wrapped: string[] = doc.splitTextToSize(para, maxWidth);
            for (const line of wrapped) {
                if (yPos > pageHeight - 15) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.text(line, margin, yPos);
                yPos += lineHeight;
            }
            yPos += 2.5;
        }
        yPos += 3;
    };

    renderLegalSection(RESTRAINT_OF_TRADE_TITLE, RESTRAINT_OF_TRADE_PARAGRAPHS);
    renderLegalSection(NON_SOLICITATION_TITLE, NON_SOLICITATION_PARAGRAPHS);

    // ─────────────────────────────────────────────────────────────────────
    // Optional supporting image (proof-of-delivery, signed manifest, etc.)
    // Always rendered on its own page so it doesn't disrupt the layout.
    // ─────────────────────────────────────────────────────────────────────
    if (imageAttachment) {
        try {
            doc.addPage();
            yPos = 20;
            addSectionHeader("Supporting Document");
            if (imageAttachment.caption) {
                doc.setFontSize(8.5);
                doc.setFont("helvetica", "italic");
                doc.setTextColor(...pdfColors.textMuted);
                doc.text(imageAttachment.caption, margin, yPos);
                yPos += 5;
            }
            // Probe natural dimensions so we can preserve aspect ratio.
            const dims = await new Promise<{ w: number; h: number }>((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => resolve({ w: 1, h: 1 });
                img.src = imageAttachment.dataUrl;
            });
            const maxW = pageWidth - margin * 2;
            const maxH = pageHeight - yPos - 15;
            const ratio = Math.min(maxW / dims.w, maxH / dims.h);
            const drawW = Math.max(10, dims.w * ratio);
            const drawH = Math.max(10, dims.h * ratio);
            doc.addImage(
                imageAttachment.dataUrl,
                imageAttachment.format,
                margin + (maxW - drawW) / 2,
                yPos,
                drawW,
                drawH,
            );
        } catch (err) {
            console.warn("[exportLoadOrderToPdf] failed to embed image attachment", err);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Footer on every page
    // ─────────────────────────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...pdfColors.textMuted);
        doc.text(
            `${COMPANY_NAME} • ${SYSTEM_NAME}`,
            margin,
            pageHeight - 8,
        );
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth - margin,
            pageHeight - 8,
            { align: "right" },
        );
    }

    const filename = `LoadOrder-${load.load_id}.pdf`;
    const blob = doc.output("blob");
    if (download) {
        doc.save(filename);
    }
    return { blob, filename };
}
