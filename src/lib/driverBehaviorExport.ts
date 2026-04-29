import { format } from "date-fns";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Type for driver behavior events used in PDF/Excel generation
interface DriverBehaviorEventExtended {
  id: string;
  driver_name: string;
  event_date: string;
  event_time?: string | null;
  event_type: string;
  fleet_number?: string | null;
  severity?: string | null;
  location?: string | null;
  points?: number | null;
  risk_score?: number | null;
  description?: string | null;
  status?: string | null;
  debriefed_at?: string | null;
  debrief_conducted_by?: string | null;
  debrief_notes?: string | null;
  coaching_action_plan?: string | null;
  driver_signature?: string | null;
  debriefer_signature?: string | null;
  witness_signature?: string | null;
  driver_acknowledged?: boolean | null;
  corrective_action_taken?: string | null;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Surfsight media helpers for exports
// ─────────────────────────────────────────────────────────────────────────────

export interface EventMediaInfo {
  imei: string;
  fileId: string;
}

/**
 * Fetch a Surfsight presigned S3 URL for an event snapshot via the edge function.
 * Returns the URL string or null on failure.
 */
export async function fetchSnapshotUrl(
  supabaseInvoke: (name: string, options: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>,
  mediaInfo: EventMediaInfo,
  cameraId: number = 1,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseInvoke("surfsight-proxy", {
      body: {
        action: "event-media-link",
        imei: mediaInfo.imei,
        fileId: mediaInfo.fileId,
        cameraId: String(cameraId),
        fileType: "snapshot",
      },
    });
    if (error || !data) return null;
    const result = data as { data?: { url?: string } };
    return result.data?.url || null;
  } catch {
    return null;
  }
}

/**
 * Fetch an image URL and convert to base64 data URL for embedding in PDFs.
 * Uses a canvas to avoid CORS issues with direct fetch.
 * Returns base64 data URL string or null on failure.
 */
export async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Fetch Surfsight presigned S3 URLs for BOTH cameras (front + cabin) as base64.
 * Returns { front, cabin } with base64 data URLs or null per camera.
 */
export async function fetchAllSnapshotsBase64(
  supabaseInvoke: (name: string, options: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>,
  mediaInfo: EventMediaInfo,
): Promise<{ front: string | null; cabin: string | null }> {
  const [frontUrl, cabinUrl] = await Promise.all([
    fetchSnapshotUrl(supabaseInvoke, mediaInfo, 1),
    fetchSnapshotUrl(supabaseInvoke, mediaInfo, 2),
  ]);
  const [front, cabin] = await Promise.all([
    frontUrl ? imageUrlToBase64(frontUrl) : Promise.resolve(null),
    cabinUrl ? imageUrlToBase64(cabinUrl) : Promise.resolve(null),
  ]);
  return { front, cabin };
}

/**
 * Fetch snapshot images as Blob files for native sharing (Web Share API).
 * Returns { front, cabin, frontUrl, cabinUrl } with Blob files and original URLs.
 */
export async function fetchSnapshotBlobs(
  supabaseInvoke: (name: string, options: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>,
  mediaInfo: EventMediaInfo,
): Promise<{ front: File | null; cabin: File | null; frontUrl: string | null; cabinUrl: string | null }> {
  const [frontUrl, cabinUrl] = await Promise.all([
    fetchSnapshotUrl(supabaseInvoke, mediaInfo, 1),
    fetchSnapshotUrl(supabaseInvoke, mediaInfo, 2),
  ]);

  async function urlToFile(url: string | null, label: string): Promise<File | null> {
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new File([blob], `${label}.jpg`, { type: 'image/jpeg' });
    } catch {
      return null;
    }
  }

  const [front, cabin] = await Promise.all([
    urlToFile(frontUrl, 'front-camera'),
    urlToFile(cabinUrl, 'cabin-camera'),
  ]);
  return { front, cabin, frontUrl, cabinUrl };
}

export interface SnapshotMedia {
  front: string | null;
  cabin: string | null;
}

export const generateDriverCoachingPDF = (event: DriverBehaviorEventExtended, snapshots?: SnapshotMedia | null) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 20;

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 7) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("DRIVER COACHING ACKNOWLEDGMENT FORM", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Form #: DBE-${event.id.split("-")[0].toUpperCase()}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Event Details Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("EVENT DETAILS", margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos - 2, contentWidth, 35);

  const detailsY = yPos + 3;
  doc.text(`Driver Name: ${event.driver_name}`, margin + 5, detailsY);
  doc.text(`Date: ${format(new Date(event.event_date), "MMM dd, yyyy")}`, pageWidth / 2 + 10, detailsY);

  doc.text(`Fleet Number: ${event.fleet_number || "N/A"}`, margin + 5, detailsY + 7);
  doc.text(`Time: ${event.event_time || "N/A"}`, pageWidth / 2 + 10, detailsY + 7);

  doc.text(`Event Type: ${event.event_type}`, margin + 5, detailsY + 14);
  doc.text(`Severity: ${event.severity || "medium"}`, pageWidth / 2 + 10, detailsY + 14);

  const locationDisplay = event.location && /^https?:\/\//i.test(event.location) ? "See snapshots below" : (event.location || "N/A");
  doc.text(`Location: ${locationDisplay}`, margin + 5, detailsY + 21);
  if (event.points) {
    doc.text(`Points: ${event.points}`, pageWidth / 2 + 10, detailsY + 21);
  }
  if (event.risk_score != null) {
    doc.text(`Risk Score: ${event.risk_score}/5`, margin + 5, detailsY + 28);
  }

  yPos += 40;

  // Incident Description
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("INCIDENT DESCRIPTION", margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  yPos = addWrappedText(event.description, margin, yPos, contentWidth);
  yPos += 10;

  // Event Snapshots (front + cabin cameras)
  const hasFront = snapshots?.front;
  const hasCabin = snapshots?.cabin;
  if (hasFront || hasCabin) {
    // Helper to embed one image
    const addSnapshot = (label: string, base64: string) => {
      if (yPos > 140) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(label, margin, yPos);
      yPos += 6;

      try {
        const imgWidth = contentWidth;
        const imgHeight = imgWidth * 0.56; // ~16:9 aspect ratio
        doc.addImage(base64, "JPEG", margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 3;

        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(128, 128, 128);
        doc.text("Surfsight dashcam — captured at time of event", margin, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 8;
      } catch {
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text("Snapshot could not be embedded.", margin, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 8;
      }
    };

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("EVENT SNAPSHOTS", margin, yPos);
    yPos += 8;

    if (hasFront) addSnapshot("📷 Front Camera (Road View)", hasFront);
    if (hasCabin) addSnapshot("📷 Cabin Camera (In-Cab View)", hasCabin);
  }

  // Video/Media Link (if present)
  if (event.location && /^https?:\/\//i.test(event.location)) {
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("EVENT VIDEO LINK:", margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(37, 99, 235);
    doc.textWithLink(event.location.substring(0, 80) + (event.location.length > 80 ? "..." : ""), margin, yPos + 6, { url: event.location });
    doc.setTextColor(0, 0, 0);
    yPos += 16;
  }

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Coaching Discussion (if debriefed)
  if (event.debriefed_at) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("COACHING DISCUSSION", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Conducted By: ${event.debrief_conducted_by}`, margin, yPos);
    yPos += 7;
    doc.text(`Date: ${format(new Date(event.debriefed_at), "MMM dd, yyyy")}`, margin, yPos);
    yPos += 10;

    if (event.debrief_notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", margin, yPos);
      yPos += 7;
      doc.setFont("helvetica", "normal");
      yPos = addWrappedText(event.debrief_notes, margin, yPos, contentWidth);
      yPos += 10;
    }

    // Check if we need a new page
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    // Corrective Action Plan
    if (event.coaching_action_plan) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("CORRECTIVE ACTION PLAN", margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      yPos = addWrappedText(event.coaching_action_plan, margin, yPos, contentWidth);
      yPos += 10;
    }
  }

  // Check if we need a new page for signatures
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  // Signatures Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("ACKNOWLEDGMENT & SIGNATURES", margin, yPos);
  yPos += 10;

  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos, contentWidth, 70);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Driver Signature
  doc.text("Driver Signature:", margin + 5, yPos + 8);
  doc.line(margin + 35, yPos + 10, pageWidth - margin - 40, yPos + 10);
  if (event.driver_signature) {
    doc.setFont("helvetica", "italic");
    doc.text(event.driver_signature, margin + 35, yPos + 9);
    doc.setFont("helvetica", "normal");
  }
  doc.text(`Date: ${format(new Date(), "MMM dd, yyyy")}`, pageWidth - margin - 35, yPos + 8);

  doc.setFontSize(8);
  doc.text(
    "I acknowledge that I have been coached regarding this incident and understand the corrective actions required.",
    margin + 5,
    yPos + 16,
    { maxWidth: contentWidth - 10 }
  );

  // Debriefer Signature
  doc.setFontSize(9);
  doc.text("Debriefer Signature:", margin + 5, yPos + 28);
  doc.line(margin + 35, yPos + 30, pageWidth - margin - 40, yPos + 30);
  if (event.debriefer_signature) {
    doc.setFont("helvetica", "italic");
    doc.text(event.debriefer_signature, margin + 35, yPos + 29);
    doc.setFont("helvetica", "normal");
  }
  doc.text(`Date: ${format(new Date(), "MMM dd, yyyy")}`, pageWidth - margin - 35, yPos + 28);

  doc.setFontSize(8);
  doc.text(
    "I confirm the coaching session was conducted and documented accurately.",
    margin + 5,
    yPos + 36,
    { maxWidth: contentWidth - 10 }
  );

  // Witness Signature (optional)
  doc.setFontSize(9);
  doc.text("Witness Signature (if applicable):", margin + 5, yPos + 48);
  doc.line(margin + 50, yPos + 50, pageWidth - margin - 40, yPos + 50);
  if (event.witness_signature) {
    doc.setFont("helvetica", "italic");
    doc.text(event.witness_signature, margin + 50, yPos + 49);
    doc.setFont("helvetica", "normal");
  }
  doc.text(`Date: ${format(new Date(), "MMM dd, yyyy")}`, pageWidth - margin - 35, yPos + 48);

  // Footer
  yPos = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")} | Form Reference: DBE-${event.id.split("-")[0]}`,
    pageWidth / 2,
    yPos,
    { align: "center" }
  );

  // Save the PDF
  const fileName = `driver-coaching-${event.driver_name.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
};

// ─────────────────────────────────────────────────────────────────────────────
// Professional Excel + PDF exports for driver behavior events
// ─────────────────────────────────────────────────────────────────────────────

const XC = {
  navy: 'FF1E3A5F',
  red: 'FFDC2626',
  redLight: 'FFFEF2F2',
  orange: 'FFF97316',
  orangeLight: 'FFFFF7ED',
  amber: 'FFD97706',
  amberLight: 'FFFFFBEB',
  green: 'FF16A34A',
  greenLight: 'FFF0FDF4',
  blue: 'FF2563EB',
  altRow: 'FFF3F4F6',
  white: 'FFFFFFFF',
  darkText: 'FF111827',
  grayText: 'FF6B7280',
  totalBg: 'FFD1FAE5',
  totalText: 'FF065F46',
  subtitleBg: 'FFE8EEF6',
} as const;

type XCell = ExcelJS.Cell;

const xlFill = (cell: XCell, argb: string) => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
};
const xlFont = (cell: XCell, bold: boolean, size: number, argb: string) => {
  cell.font = { name: 'Calibri', bold, size, color: { argb } };
};
const xlBorder = (cell: XCell, argb = 'FFD9D9D9') => {
  const s = { style: 'thin' as const, color: { argb } };
  cell.border = { top: s, bottom: s, left: s, right: s };
};

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const severityColor: Record<string, string> = {
  critical: XC.red,
  high: XC.orange,
  medium: XC.amber,
  low: XC.blue,
};
const severityBgColor: Record<string, string> = {
  critical: XC.redLight,
  high: XC.orangeLight,
  medium: XC.amberLight,
  low: 'FFE0F2FE',
};

/**
 * Professional Excel export of driver behavior events.
 * Separate sheets for pending and debriefed events with summary.
 */
export const generateDriverBehaviorExcel = async (
  events: DriverBehaviorEventExtended[],
  type: 'pending' | 'debriefed' | 'all' = 'all',
): Promise<void> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Car Craft Co — Fleet Management';
  wb.created = new Date();
  const generatedOn = format(new Date(), 'MMM dd, yyyy HH:mm');
  const dateStamp = format(new Date(), 'yyyy-MM-dd');

  const pending = events.filter(e => !e.debriefed_at);
  const debriefed = events.filter(e => !!e.debriefed_at);

  // ── Summary Sheet ─────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Summary');
  ws.columns = [{ key: 'a', width: 30 }, { key: 'b', width: 20 }];

  ws.addRow([]);
  const titleRow = ws.addRow(['DRIVER BEHAVIOR REPORT']);
  ws.mergeCells(titleRow.number, 1, titleRow.number, 2);
  xlFill(titleRow.getCell(1), XC.navy);
  xlFont(titleRow.getCell(1), true, 14, XC.white);
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 30;

  const subRow = ws.addRow([`Generated: ${generatedOn}`]);
  ws.mergeCells(subRow.number, 1, subRow.number, 2);
  xlFill(subRow.getCell(1), XC.subtitleBg);
  xlFont(subRow.getCell(1), false, 9, XC.grayText);
  subRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.addRow([]);

  const stats = [
    ['Total Events', events.length],
    ['Pending Debrief', pending.length],
    ['Debriefed', debriefed.length],
    ['Critical', events.filter(e => e.severity === 'critical').length],
    ['High', events.filter(e => e.severity === 'high').length],
    ['Medium', events.filter(e => e.severity === 'medium').length],
    ['Low', events.filter(e => e.severity === 'low').length],
  ];

  stats.forEach(([label, value], idx) => {
    const r = ws.addRow([label, value]);
    r.height = 22;
    xlBorder(r.getCell(1)); xlBorder(r.getCell(2));
    xlFont(r.getCell(1), true, 11, XC.darkText);
    r.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };

    if (idx === 1) xlFont(r.getCell(2), true, 12, XC.red);
    else if (idx === 2) xlFont(r.getCell(2), true, 12, XC.green);
    else if (idx === 3) xlFont(r.getCell(2), true, 12, XC.red);
    else if (idx === 4) xlFont(r.getCell(2), true, 12, XC.orange);
    else xlFont(r.getCell(2), true, 12, XC.darkText);

    if (idx % 2 === 1) { xlFill(r.getCell(1), XC.altRow); xlFill(r.getCell(2), XC.altRow); }
  });

  // Driver breakdown
  const driverMap = new Map<string, { pending: number; debriefed: number; totalPoints: number }>();
  events.forEach(e => {
    const name = e.driver_name;
    const v = driverMap.get(name) || { pending: 0, debriefed: 0, totalPoints: 0 };
    if (e.debriefed_at) v.debriefed++; else v.pending++;
    v.totalPoints += (e.points || 0);
    driverMap.set(name, v);
  });

  ws.addRow([]); ws.addRow([]);
  const secRow = ws.addRow(['Driver Breakdown']);
  ws.mergeCells(secRow.number, 1, secRow.number, 2);
  xlFill(secRow.getCell(1), XC.blue);
  xlFont(secRow.getCell(1), true, 11, XC.white);
  secRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  secRow.height = 22;

  const dbCols = ['Driver', 'Pending', 'Debriefed', 'Total Points'];
  const dbHRow = ws.addRow(dbCols);
  dbHRow.height = 20;
  dbCols.forEach((_, i) => {
    const c = dbHRow.getCell(i + 1);
    xlFill(c, XC.navy); xlFont(c, true, 10, XC.white);
    c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    xlBorder(c);
  });

  let dIdx = 0;
  [...driverMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, counts]) => {
    const r = ws.addRow([name, counts.pending, counts.debriefed, counts.totalPoints]);
    r.height = 18;
    for (let c = 1; c <= 4; c++) {
      const cell = r.getCell(c);
      xlBorder(cell); xlFont(cell, false, 10, XC.darkText);
      cell.alignment = { horizontal: c === 1 ? 'left' : 'center', vertical: 'middle' };
      if (dIdx % 2 === 1) xlFill(cell, XC.altRow);
      if (c === 2 && counts.pending > 0) xlFont(cell, true, 10, XC.red);
      if (c === 3 && counts.debriefed > 0) xlFont(cell, true, 10, XC.green);
    }
    dIdx++;
  });

  // ── Data sheets ───────────────────────────────────────────────────────
  const headers = [
    'Date', 'Time', 'Driver', 'Fleet Number', 'Event Type', 'Description',
    'Video/Media Link', 'Severity', 'Points', 'Risk Score', 'Status',
    'Debriefed On', 'Debriefed By', 'Coaching Notes', 'Action Plan',
  ];
  const colWidths = [13, 10, 20, 14, 20, 35, 30, 12, 10, 11, 12, 13, 18, 35, 35];

  const addDataSheet = (name: string, sheetEvents: DriverBehaviorEventExtended[], statusColor: string) => {
    if (sheetEvents.length === 0) return;

    const ws2 = wb.addWorksheet(name);
    ws2.columns = colWidths.map((w, i) => ({ key: `c${i}`, width: w }));

    ws2.addRow([]);
    const tRow = ws2.addRow([name.toUpperCase()]);
    ws2.mergeCells(tRow.number, 1, tRow.number, headers.length);
    xlFill(tRow.getCell(1), statusColor);
    xlFont(tRow.getCell(1), true, 13, XC.white);
    tRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    tRow.height = 28;

    const sRow = ws2.addRow([`${sheetEvents.length} events • Generated: ${generatedOn}`]);
    ws2.mergeCells(sRow.number, 1, sRow.number, headers.length);
    xlFill(sRow.getCell(1), XC.subtitleBg);
    xlFont(sRow.getCell(1), false, 9, XC.grayText);
    sRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws2.addRow([]);

    const hRow = ws2.addRow(headers);
    hRow.height = 22;
    headers.forEach((_, i) => {
      const c = hRow.getCell(i + 1);
      xlFill(c, XC.navy); xlFont(c, true, 9, XC.white);
      c.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      xlBorder(c, XC.navy);
    });

    ws2.views = [{ state: 'frozen', ySplit: hRow.number, xSplit: 3 }];

    const sorted = [...sheetEvents].sort((a, b) =>
      (severityOrder[a.severity ?? 'low'] ?? 3) - (severityOrder[b.severity ?? 'low'] ?? 3)
      || new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );

    sorted.forEach((ev, idx) => {
      const sev = (ev.severity || 'medium').toLowerCase();
      const videoLink = ev.location && /^https?:\/\//i.test(ev.location) ? ev.location : '';
      const row = ws2.addRow([
        format(new Date(ev.event_date), 'MMM dd, yyyy'),
        ev.event_time || '',
        ev.driver_name,
        ev.fleet_number || '',
        ev.event_type,
        (ev.description || '').substring(0, 200),
        videoLink ? 'View Video' : '',
        (sev).charAt(0).toUpperCase() + sev.slice(1),
        ev.points ?? 0,
        ev.risk_score != null ? `${ev.risk_score}/5` : '',
        ev.status || 'open',
        ev.debriefed_at ? format(new Date(ev.debriefed_at), 'MMM dd, yyyy') : '',
        ev.debrief_conducted_by || '',
        (ev.debrief_notes || '').substring(0, 200),
        (ev.coaching_action_plan || '').substring(0, 200),
      ]);
      row.height = 20;

      // Make video link clickable
      if (videoLink) {
        const linkCell = row.getCell(7);
        linkCell.value = { text: 'View Video', hyperlink: videoLink };
        linkCell.font = { name: 'Calibri', size: 9, color: { argb: XC.blue }, underline: true };
      }

      for (let c = 1; c <= headers.length; c++) {
        const cell = row.getCell(c);
        xlBorder(cell);
        if (c !== 7 || !videoLink) xlFont(cell, false, 9, XC.darkText);
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: c === 6 || c === 14 || c === 15 };

        if (idx % 2 === 1) xlFill(cell, XC.altRow);

        // Severity colouring
        if (c === 8) {
          xlFont(cell, true, 9, severityColor[sev] || XC.darkText);
          xlFill(cell, severityBgColor[sev] || XC.altRow);
        }
        // Risk score emphasis
        if (c === 10 && ev.risk_score != null) {
          xlFont(cell, true, 9, 'FF7E22CE');
        }
      }
    });

    // Total row
    const totalPoints = sheetEvents.reduce((s, e) => s + (e.points || 0), 0);
    const totRow = ws2.addRow([
      'TOTAL', '', '', '', '', '', '', '',
      totalPoints, '', `${sheetEvents.length} events`, '', '', '', '',
    ]);
    totRow.height = 22;
    for (let c = 1; c <= headers.length; c++) {
      const cell = totRow.getCell(c);
      xlFill(cell, XC.totalBg);
      xlFont(cell, true, 10, XC.totalText);
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      xlBorder(cell, XC.totalText);
    }
  };

  if (type === 'pending' || type === 'all') addDataSheet('Pending Events', pending, XC.red);
  if (type === 'debriefed' || type === 'all') addDataSheet('Debriefed Events', debriefed, XC.green);

  const label = type === 'pending' ? 'pending' : type === 'debriefed' ? 'debriefed' : 'all';
  const filename = `driver_behavior_${label}_${dateStamp}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
};

/**
 * Professional PDF export of driver behavior events.
 * Groups by driver with severity colour coding.
 */
export const generateDriverBehaviorPDF = (
  events: DriverBehaviorEventExtended[],
  type: 'pending' | 'debriefed' | 'all' = 'all',
): void => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  const pending = events.filter(e => !e.debriefed_at);
  const debriefed = events.filter(e => !!e.debriefed_at);
  const totalPoints = events.reduce((s, e) => s + (e.points || 0), 0);

  const typeLabel = type === 'pending' ? 'PENDING DRIVER BEHAVIOR EVENTS'
    : type === 'debriefed' ? 'DEBRIEFED DRIVER BEHAVIOR EVENTS'
      : 'DRIVER BEHAVIOR REPORT';

  const generatedOn = format(new Date(), 'MMM dd, yyyy HH:mm');

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Car Craft Co • Driver Behavior Report • Generated: ${generatedOn}`,
      pageWidth / 2, pageHeight - 8, { align: 'center' }
    );
    doc.setTextColor(0, 0, 0);
  };

  // Title
  doc.setFillColor(30, 58, 95);
  doc.rect(margin, 12, pageWidth - 2 * margin, 14, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(typeLabel, pageWidth / 2, 22, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${generatedOn}  •  ${events.length} events  •  ${totalPoints} total points`, pageWidth / 2, 32, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Summary box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, 36, pageWidth - 2 * margin, 14, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const bw = (pageWidth - 2 * margin) / 5;
  const by = 43;

  const critical = events.filter(e => e.severity === 'critical').length;
  const high = events.filter(e => e.severity === 'high').length;

  doc.text('Pending:', margin + 10, by);
  doc.setTextColor(220, 38, 38);
  doc.text(String(pending.length), margin + 35, by);
  doc.setTextColor(0, 0, 0);

  doc.text('Debriefed:', margin + bw + 10, by);
  doc.setTextColor(22, 163, 74);
  doc.text(String(debriefed.length), margin + bw + 42, by);
  doc.setTextColor(0, 0, 0);

  doc.text('Critical:', margin + 2 * bw + 10, by);
  doc.setTextColor(220, 38, 38);
  doc.text(String(critical), margin + 2 * bw + 35, by);
  doc.setTextColor(0, 0, 0);

  doc.text('High:', margin + 3 * bw + 10, by);
  doc.setTextColor(249, 115, 22);
  doc.text(String(high), margin + 3 * bw + 28, by);
  doc.setTextColor(0, 0, 0);

  doc.text('Total Points:', margin + 4 * bw + 10, by);
  doc.text(String(totalPoints), margin + 4 * bw + 48, by);

  // Auto table for events
  const tableHeaders = type === 'debriefed'
    ? ['Date', 'Driver', 'Fleet', 'Event Type', 'Severity', 'Pts', 'Risk', 'Media', 'Debriefed On', 'By', 'Coaching Notes']
    : type === 'pending'
      ? ['Date', 'Driver', 'Fleet', 'Event Type', 'Description', 'Severity', 'Pts', 'Risk', 'Media', 'Status']
      : ['Date', 'Driver', 'Fleet', 'Event Type', 'Severity', 'Pts', 'Risk', 'Media', 'Status', 'Debriefed On'];

  const sorted = [...events].sort((a, b) =>
    (severityOrder[a.severity ?? 'low'] ?? 3) - (severityOrder[b.severity ?? 'low'] ?? 3)
    || new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );

  const tableData = sorted.map(ev => {
    const sev = (ev.severity || 'medium').charAt(0).toUpperCase() + (ev.severity || 'medium').slice(1);
    const dateStr = format(new Date(ev.event_date), 'MMM dd');
    const hasMedia = ev.location && /^https?:\/\//i.test(ev.location) ? '📹 Yes' : '';
    const risk = ev.risk_score != null ? `${ev.risk_score}/5` : '';

    if (type === 'debriefed') {
      return [
        dateStr, ev.driver_name, ev.fleet_number || '', ev.event_type, sev,
        ev.points ?? 0,
        risk,
        hasMedia,
        ev.debriefed_at ? format(new Date(ev.debriefed_at), 'MMM dd') : '',
        ev.debrief_conducted_by || '',
        (ev.debrief_notes || '').substring(0, 60),
      ];
    } else if (type === 'pending') {
      return [
        dateStr, ev.driver_name, ev.fleet_number || '', ev.event_type,
        (ev.description || '').substring(0, 50),
        sev, ev.points ?? 0, risk, hasMedia, ev.status || 'open',
      ];
    }
    return [
      dateStr, ev.driver_name, ev.fleet_number || '', ev.event_type, sev,
      ev.points ?? 0, risk, hasMedia, ev.status || 'open',
      ev.debriefed_at ? format(new Date(ev.debriefed_at), 'MMM dd') : '',
    ];
  });

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 55,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      // Severity column colour
      const sevColIdx = type === 'pending' ? 5 : 4;
      if (data.column.index === sevColIdx) {
        const val = (data.cell.raw as string || '').toLowerCase();
        if (val === 'critical') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
        else if (val === 'high') { data.cell.styles.textColor = [249, 115, 22]; data.cell.styles.fontStyle = 'bold'; }
        else if (val === 'medium') { data.cell.styles.textColor = [217, 119, 6]; }
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  const label = type === 'pending' ? 'pending' : type === 'debriefed' ? 'debriefed' : 'all';
  doc.save(`driver_behavior_${label}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// ──────────────────────────────────────────────────────────────────────────────
// Weekly Driver Behavior Debrief Export — Last 7 days per driver with signature
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate a PDF containing the last 7 days of debriefed driver behavior events
 * grouped by driver, with an acknowledgment & signature section per driver.
 * Only includes events that have been debriefed (debriefed_at is non-null).
 */
export const generateWeeklyDriverDebriefsPDF = (events: DriverBehaviorEventExtended[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const rangeStart = format(sevenDaysAgo, 'yyyy-MM-dd');
  const rangeEnd = format(now, 'yyyy-MM-dd');

  // Filter: debriefed events within the last 7 days
  const filtered = events.filter(e =>
    e.debriefed_at &&
    e.event_date >= rangeStart &&
    e.event_date <= rangeEnd,
  );

  // Group by driver
  const byDriver: Record<string, DriverBehaviorEventExtended[]> = {};
  for (const e of filtered) {
    const driver = e.driver_name || 'Unknown';
    if (!byDriver[driver]) byDriver[driver] = [];
    byDriver[driver].push(e);
  }
  // Sort each group by date ascending
  for (const driver of Object.keys(byDriver)) {
    byDriver[driver].sort((a, b) => a.event_date.localeCompare(b.event_date));
  }
  const driverNames = Object.keys(byDriver).sort();

  if (driverNames.length === 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('No debriefed behavior events found for the last 7 days.', pageWidth / 2, 40, { align: 'center' });
    doc.save(`weekly-driver-debriefs-${format(now, 'yyyy-MM-dd')}.pdf`);
    return;
  }

  let yPos = 0;

  const checkPageBreak = (space: number) => {
    if (yPos + space > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Generated: ${format(now, 'MMM dd, yyyy HH:mm')} | Weekly Driver Behavior Debrief Report`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' },
    );
    doc.setTextColor(0, 0, 0);
  };

  const severityColor = (s: string | null): [number, number, number] => {
    switch (s) {
      case 'critical': return [220, 38, 38];
      case 'high': return [234, 88, 12];
      case 'medium': return [202, 138, 4];
      case 'low': return [37, 99, 235];
      default: return [100, 100, 100];
    }
  };

  // ── One page (or more) per driver ──
  driverNames.forEach((driver, driverIdx) => {
    if (driverIdx > 0) doc.addPage();
    yPos = 20;

    const driverEvents = byDriver[driver];
    const totalPoints = driverEvents.reduce((s, e) => s + (e.points || 0), 0);

    // ── Title ──
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('WEEKLY DRIVER BEHAVIOR DEBRIEF', pageWidth / 2, yPos, { align: 'center' });
    yPos += 9;

    doc.setFontSize(11);
    doc.text(`Driver: ${driver}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Period: ${format(sevenDaysAgo, 'dd MMM yyyy')} – ${format(now, 'dd MMM yyyy')}`,
      pageWidth / 2,
      yPos,
      { align: 'center' },
    );
    yPos += 5;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${format(now, 'dd MMM yyyy HH:mm')}`, pageWidth / 2, yPos, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPos += 10;

    // ── Summary box ──
    doc.setFillColor(240, 245, 255);
    doc.roundedRect(margin, yPos, contentWidth, 14, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary:', margin + 4, yPos + 5);
    doc.setFont('helvetica', 'normal');
    const fleetNums = [...new Set(driverEvents.map(e => e.fleet_number).filter(Boolean))].join(', ') || 'N/A';
    doc.text(
      `Events: ${driverEvents.length}  |  Total Points: ${totalPoints}  |  Fleet: ${fleetNums}`,
      margin + 28,
      yPos + 5,
    );
    const conductors = [...new Set(driverEvents.map(e => e.debrief_conducted_by).filter(Boolean))].join(', ');
    if (conductors) {
      doc.setFontSize(8);
      doc.text(`Debriefed by: ${conductors}`, margin + 4, yPos + 11);
    }
    yPos += 18;

    // ── Table header ──
    const colWidths = [20, 32, 18, 18, 14, 35, 33];
    const headers = ['Date', 'Event Type', 'Severity', 'Points', 'Ack.', 'Conducted By', 'Action Plan'];

    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    let xPos = margin + 2;
    headers.forEach((h, i) => {
      doc.text(h, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    doc.setTextColor(0, 0, 0);
    yPos += 10;

    // ── Table rows ──
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    driverEvents.forEach((event, rowIdx) => {
      checkPageBreak(16);

      if (rowIdx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, yPos - 3, contentWidth, 8, 'F');
      }

      xPos = margin + 2;

      // Date
      doc.text(format(new Date(event.event_date), 'dd MMM'), xPos, yPos);
      xPos += colWidths[0];

      // Event type
      doc.text((event.event_type || '').substring(0, 18), xPos, yPos);
      xPos += colWidths[1];

      // Severity (colour-coded)
      const sevCol = severityColor(event.severity);
      doc.setTextColor(sevCol[0], sevCol[1], sevCol[2]);
      doc.text((event.severity || 'N/A').toUpperCase(), xPos, yPos);
      doc.setTextColor(0, 0, 0);
      xPos += colWidths[2];

      // Points
      doc.text(String(event.points ?? 0), xPos, yPos);
      xPos += colWidths[3];

      // Acknowledged
      doc.text(event.driver_acknowledged ? 'Yes' : 'No', xPos, yPos);
      xPos += colWidths[4];

      // Conducted by
      doc.text((event.debrief_conducted_by || 'N/A').substring(0, 18), xPos, yPos);
      xPos += colWidths[5];

      // Action plan (truncated)
      const plan = (event.coaching_action_plan || '—').substring(0, 20) + ((event.coaching_action_plan || '').length > 20 ? '...' : '');
      doc.text(plan, xPos, yPos);

      yPos += 7;

      // Debrief notes sub-row
      if (event.debrief_notes) {
        checkPageBreak(8);
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        const noteText = `Notes: ${event.debrief_notes.substring(0, 100)}${event.debrief_notes.length > 100 ? '...' : ''}`;
        doc.text(noteText, margin + 4, yPos);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7.5);
        yPos += 5;
      }

      // Separator
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, yPos - 1, margin + contentWidth, yPos - 1);
    });

    yPos += 6;

    // ── Event details section (descriptions + corrective actions) ──
    checkPageBreak(16 + driverEvents.length * 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('EVENT DETAILS & CORRECTIVE ACTIONS', margin, yPos);
    yPos += 7;

    driverEvents.forEach((event, idx) => {
      checkPageBreak(22);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`${idx + 1}. ${event.event_type} — ${format(new Date(event.event_date), 'dd MMM yyyy')}`, margin + 2, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      if (event.description) {
        const desc = doc.splitTextToSize(`Description: ${event.description}`, contentWidth - 8);
        doc.text(desc, margin + 4, yPos);
        yPos += desc.length * 4 + 2;
      }
      if (event.corrective_action_taken) {
        const action = doc.splitTextToSize(`Corrective Action: ${event.corrective_action_taken}`, contentWidth - 8);
        doc.text(action, margin + 4, yPos);
        yPos += action.length * 4 + 2;
      }
      if (event.coaching_action_plan) {
        const plan = doc.splitTextToSize(`Action Plan: ${event.coaching_action_plan}`, contentWidth - 8);
        doc.text(plan, margin + 4, yPos);
        yPos += plan.length * 4 + 2;
      }
      yPos += 3;
    });

    // ──────────────────────────────────────────────
    // DRIVER ACKNOWLEDGMENT & SIGNATURE SECTION
    // ──────────────────────────────────────────────
    checkPageBreak(85);

    yPos += 4;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ACKNOWLEDGMENT & SIGNATURES', margin, yPos + 2);
    yPos += 8;

    doc.setDrawColor(180, 180, 180);
    doc.rect(margin, yPos, contentWidth, 74);

    const sigStartY = yPos + 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'I, the undersigned driver, acknowledge that I have been debriefed on the above behavioral',
      margin + 4,
      sigStartY,
    );
    doc.text(
      'events for the stated period. I understand the corrective actions discussed and commit to',
      margin + 4,
      sigStartY + 5,
    );
    doc.text(
      'improving my driving behavior accordingly.',
      margin + 4,
      sigStartY + 10,
    );

    const sig1Y = sigStartY + 20;
    const sig2Y = sig1Y + 24;

    // Driver signature
    doc.setFont('helvetica', 'bold');
    doc.text('Driver:', margin + 4, sig1Y);
    doc.setFont('helvetica', 'normal');
    doc.text('Name:', margin + 4, sig1Y + 7);
    doc.line(margin + 18, sig1Y + 8, margin + 80, sig1Y + 8);
    doc.text('Signature:', margin + 85, sig1Y + 7);
    doc.line(margin + 103, sig1Y + 8, margin + contentWidth - 4, sig1Y + 8);
    doc.text('Date:', margin + 4, sig1Y + 14);
    doc.line(margin + 16, sig1Y + 15, margin + 55, sig1Y + 15);

    // Fleet Manager / Debriefer signature
    doc.setFont('helvetica', 'bold');
    doc.text('Fleet Manager / Debriefer:', margin + 4, sig2Y);
    doc.setFont('helvetica', 'normal');
    doc.text('Name:', margin + 4, sig2Y + 7);
    doc.line(margin + 18, sig2Y + 8, margin + 80, sig2Y + 8);
    doc.text('Signature:', margin + 85, sig2Y + 7);
    doc.line(margin + 103, sig2Y + 8, margin + contentWidth - 4, sig2Y + 8);
    doc.text('Date:', margin + 4, sig2Y + 14);
    doc.line(margin + 16, sig2Y + 15, margin + 55, sig2Y + 15);

    addFooter();
  });

  const fileName = `weekly-driver-debriefs-${format(now, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};