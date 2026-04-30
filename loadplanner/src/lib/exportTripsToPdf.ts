import type { Driver } from "@/hooks/useDrivers";
import type { FleetVehicle } from "@/hooks/useFleetVehicles";
import type { Load } from "@/hooks/useTrips";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY_NAME, SYSTEM_NAME, pdfColors } from "@/lib/exportStyles";
import * as timeWindowLib from "@/lib/timeWindow";
import { format, parseISO } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Status labels
const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// Cargo type labels
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

// Check if a load is a backload for another load
function findBackload(load: Load, allLoads: Load[]): Load | undefined {
  // Backloads have IDs starting with BL- followed by the original load ID
  const originalLoadIdPart = load.load_id.replace(/^LD-/, "");
  return allLoads.find(
    (l) => l.load_id.startsWith(`BL-${originalLoadIdPart}`) && l.id !== load.id,
  );
}

// Find parent load if this is a backload
function findParentLoad(load: Load, allLoads: Load[]): Load | undefined {
  if (!load.load_id.startsWith("BL-")) return undefined;

  // Extract original load ID from backload ID (BL-{originalId}-{timestamp})
  const parts = load.load_id.split("-");
  if (parts.length >= 2) {
    const originalIdPart = parts[1];
    return allLoads.find((l) => l.load_id === `LD-${originalIdPart}`);
  }
  return undefined;
}

/**
 * Fetch an image from a URL and return it as a base64 data URI.
 * Returns null if the fetch fails or the URL is empty.
 */
async function fetchImageAsBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Fetch full driver details from the database.
 */
async function fetchFullDriver(driverId: string): Promise<Driver | null> {
  const { data, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", driverId)
    .single();
  if (error || !data) return null;
  return data as Driver;
}

/**
 * Fetch full fleet vehicle details from the database.
 */
async function fetchFullVehicle(vehicleId: string): Promise<FleetVehicle | null> {
  const { data, error } = await supabase
    .from("fleet_vehicles")
    .select("*")
    .eq("id", vehicleId)
    .single();
  if (error || !data) return null;
  return data as FleetVehicle;
}

/**
 * Format a date string for display, returning 'Not set' for null/undefined.
 */
function formatExpiryDate(dateString: string | null | undefined): string {
  if (!dateString) return "Not set";
  if (dateString === "9999-12-31") return "N/A";
  try {
    return format(parseISO(dateString), "dd MMM yyyy");
  } catch {
    return "Invalid date";
  }
}

/**
 * Optional extras supplied by the caller that affect only the rendered PDF
 * (never persisted to the load row).
 */
export interface ExportLoadToPdfOptions {
  /**
   * A rate to print on the Load Confirmation document. Display-only; not
   * stored anywhere. When omitted no rate row is rendered.
   */
  rate?: {
    amount: number;
    currency: string;
  };
  /**
   * When false, the PDF is not auto-downloaded — the caller receives the
   * Blob and filename in the return value and is responsible for handling
   * it (e.g. attaching to an email share sheet). Defaults to true.
   */
  download?: boolean;
}

export interface ExportLoadToPdfResult {
  blob: Blob;
  filename: string;
}

export async function exportLoadToPdf(
  load: Load,
  allLoads: Load[],
  options: ExportLoadToPdfOptions = {},
): Promise<ExportLoadToPdfResult> {
  const { rate, download = true } = options;
  // Fetch full driver and vehicle details in parallel
  const [fullDriver, fullVehicle] = await Promise.all([
    load.driver?.id ? fetchFullDriver(load.driver.id) : Promise.resolve(null),
    load.fleet_vehicle?.id ? fetchFullVehicle(load.fleet_vehicle.id) : Promise.resolve(null),
  ]);

  // Fetch linked trailers if the vehicle is a Horse
  const [linkedReefer, linkedInterlink] = await Promise.all([
    fullVehicle?.linked_reefer_id ? fetchFullVehicle(fullVehicle.linked_reefer_id) : Promise.resolve(null),
    fullVehicle?.linked_interlink_id ? fetchFullVehicle(fullVehicle.linked_interlink_id) : Promise.resolve(null),
  ]);

  // Pre-fetch images in parallel
  const [driverPhotoBase64, passportDocBase64] = await Promise.all([
    fetchImageAsBase64(fullDriver?.photo_url),
    fetchImageAsBase64(fullDriver?.passport_doc_url),
  ]);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Colors
  const headerBg: [number, number, number] = [241, 245, 249]; // Light gray
  const successColor: [number, number, number] = pdfColors.success;
  const warningColor: [number, number, number] = [234, 179, 8]; // Yellow/Orange

  // Helper to add section header
  const addSectionHeader = (
    title: string,
    color: [number, number, number] = pdfColors.blue,
  ): number => {
    doc.setFillColor(...color);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 4, yPos + 5.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    return yPos + 12;
  };

  // Helper to add key-value row
  const addKeyValue = (
    key: string,
    value: string,
    y: number,
    width = 60,
  ): number => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(key, margin + 4, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value || "-", margin + width, y);
    return y + 6;
  };

  const timeWindow = timeWindowLib.parseTimeWindow(load.time_window);

  // ========== HEADER ==========
  // Top accent strip
  doc.setFillColor(...pdfColors.navy);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Company name
  doc.setTextColor(...pdfColors.navy);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY_NAME, margin, 14);

  // System subtitle
  doc.setTextColor(...pdfColors.textMuted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(SYSTEM_NAME, margin, 19);

  // Document title (right-aligned)
  doc.setTextColor(...pdfColors.navy);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("LOAD CONFIRMATION", pageWidth - margin, 14, { align: "right" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...pdfColors.blue);
  doc.text(load.load_id, pageWidth - margin, 21, { align: "right" });

  // Status badge
  const statusText = statusLabels[load.status] || load.status;
  const statusWidth = doc.getTextWidth(statusText) + 10;
  doc.setFillColor(...pdfColors.lightBlue);
  doc.roundedRect(
    pageWidth - margin - statusWidth,
    24,
    statusWidth,
    8,
    2,
    2,
    "F",
  );
  doc.setTextColor(
    ...(load.status === "delivered" ? successColor : pdfColors.navy),
  );
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(statusText.toUpperCase(), pageWidth - margin - statusWidth + 5, 29);

  // Generated date
  doc.setTextColor(...pdfColors.textMuted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`,
    margin,
    24,
  );

  // Separator line
  doc.setDrawColor(...pdfColors.navy);
  doc.setLineWidth(0.5);
  doc.line(margin, 35, pageWidth - margin, 35);

  yPos = 42;
  doc.setTextColor(0, 0, 0);

  // ========== LOAD DETAILS ==========
  yPos = addSectionHeader("Load Details");

  // Two columns
  const _col1X = margin;
  const col2X = pageWidth / 2 + 5;
  let col1Y = yPos;
  let col2Y = yPos;

  // Column 1
  col1Y = addKeyValue("Load ID:", load.load_id, col1Y);
  col1Y = addKeyValue(
    "Cargo Type:",
    cargoLabels[load.cargo_type] || load.cargo_type,
    col1Y,
  );
  col1Y = addKeyValue("Quantity:", `${load.quantity} units`, col1Y);
  col1Y = addKeyValue("Weight:", `${load.weight} T`, col1Y);
  // Optional rate (display-only — never persisted to the load row).
  // Rendered in Load Details so it sits with the other commercial fields,
  // making it obvious this is a Load Confirmation document.
  if (rate && Number.isFinite(rate.amount) && rate.amount > 0) {
    const formattedAmount = rate.amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    col1Y = addKeyValue(
      "Rate:",
      `${rate.currency} ${formattedAmount}`,
      col1Y,
    );
  }

  // Column 2
  doc.setFontSize(9);
  const addKeyValueCol2 = (key: string, value: string): void => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(key, col2X, col2Y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value || "-", col2X + 55, col2Y);
    col2Y += 6;
  };

  addKeyValueCol2(
    "Loading Date:",
    format(parseISO(load.loading_date), "dd MMM yyyy"),
  );
  addKeyValueCol2(
    "Offloading Date:",
    format(parseISO(load.offloading_date), "dd MMM yyyy"),
  );
  addKeyValueCol2(
    "Created:",
    format(parseISO(load.created_at), "dd MMM yyyy HH:mm"),
  );
  addKeyValueCol2(
    "Last Updated:",
    format(parseISO(load.updated_at), "dd MMM yyyy HH:mm"),
  );

  yPos = Math.max(col1Y, col2Y) + 4;

  // Special Handling
  if (load.special_handling && load.special_handling.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Special Handling:", margin + 4, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(load.special_handling.join(", "), margin + 60, yPos);
    yPos += 8;
  }

  // ========== ROUTE ==========
  yPos = addSectionHeader("Route Information");

  // Origin
  doc.setFillColor(...headerBg);
  doc.rect(margin, yPos, (pageWidth - 2 * margin) / 2 - 5, 35, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...pdfColors.success);
  doc.text("ORIGIN", margin + 4, yPos + 6);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(load.origin, margin + 4, yPos + 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Planned Arr: ${timeWindow.origin.plannedArrival}`,
    margin + 4,
    yPos + 22,
  );
  doc.text(
    `Planned Dep: ${timeWindow.origin.plannedDeparture}`,
    margin + 4,
    yPos + 28,
  );

  // Destination
  const destX = margin + (pageWidth - 2 * margin) / 2 + 5;
  doc.setFillColor(...headerBg);
  doc.rect(destX, yPos, (pageWidth - 2 * margin) / 2 - 5, 35, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...pdfColors.blue);
  doc.text("DESTINATION", destX + 4, yPos + 6);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(load.destination, destX + 4, yPos + 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Planned Arr: ${timeWindow.destination.plannedArrival}`,
    destX + 4,
    yPos + 22,
  );
  doc.text(
    `Planned Dep: ${timeWindow.destination.plannedDeparture}`,
    destX + 4,
    yPos + 28,
  );

  // Arrow between origin and destination
  doc.setFillColor(...pdfColors.navy);
  const arrowX = margin + (pageWidth - 2 * margin) / 2 - 3;
  doc.triangle(
    arrowX,
    yPos + 17,
    arrowX + 6,
    yPos + 17,
    arrowX + 3,
    yPos + 14,
    "F",
  );
  doc.rect(arrowX + 1, yPos + 17, 4, 6, "F");

  yPos += 42;

  // ========== ACTUAL TIMES (if any exist) ==========
  const hasActualTimes =
    timeWindow.origin.actualArrival !== "" ||
    timeWindow.origin.actualDeparture !== "" ||
    timeWindow.destination.actualArrival !== "" ||
    timeWindow.destination.actualDeparture !== "";

  if (hasActualTimes) {
    yPos = addSectionHeader("Actual Times", successColor);

    autoTable(doc, {
      startY: yPos,
      head: [["Location", "Actual Arrival", "Actual Departure"]],
      body: [
        [
          "Origin (" + load.origin + ")",
          timeWindow.origin.actualArrival ?? "",
          timeWindow.origin.actualDeparture ?? "",
        ],
        [
          "Destination (" + load.destination + ")",
          timeWindow.destination.actualArrival ?? "",
          timeWindow.destination.actualDeparture ?? "",
        ],
      ],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: successColor, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    yPos =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 8;
  }

  // ========== ASSIGNMENT ==========
  yPos = addSectionHeader("Assignment Details");

  // Vehicle
  doc.setFontSize(9);
  yPos = addKeyValue(
    "Vehicle ID:",
    load.fleet_vehicle?.vehicle_id || "Unassigned",
    yPos,
  );
  yPos = addKeyValue("Vehicle Type:", load.fleet_vehicle?.type || "-", yPos);
  yPos = addKeyValue("Driver:", load.driver?.name || "Unassigned", yPos);
  yPos = addKeyValue("Driver Contact:", load.driver?.contact || "-", yPos);

  yPos += 4;

  // ========== DRIVER DETAILS (full) ==========
  if (fullDriver) {
    // Check if we need a new page
    if (yPos > 180) {
      doc.addPage();
      yPos = 20;
    }

    yPos = addSectionHeader("Driver Details", pdfColors.navy);

    // Driver photo and basic info row
    const infoStartX = margin + 4;
    let photoWidth = 0;

    if (driverPhotoBase64) {
      try {
        doc.addImage(driverPhotoBase64, "JPEG", margin + 4, yPos, 30, 36);
        photoWidth = 36; // photo width + gap
      } catch {
        // Image failed — skip silently
      }
    }

    const detailX = infoStartX + photoWidth;
    let detailY = yPos;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...pdfColors.navy);
    doc.text(fullDriver.name, detailX, detailY + 5);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    detailY += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Contact:", detailX, detailY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(fullDriver.contact || "-", detailX + 40, detailY);

    detailY += 6;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("ID Number:", detailX, detailY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(fullDriver.id_number || "-", detailX + 40, detailY);

    detailY += 6;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Availability:", detailX, detailY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(fullDriver.available ? "Available" : "On Route", detailX + 40, detailY);

    yPos = Math.max(yPos + (driverPhotoBase64 ? 40 : 0), detailY + 6) + 4;

    // Passport Information
    const passportData: string[][] = [
      ["Passport Number", fullDriver.passport_number || "Not set"],
      ["Passport Expiry", formatExpiryDate(fullDriver.passport_expiry)],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [["Passport Details", ""]],
      body: passportData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: pdfColors.blue, textColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 60 },
        1: { cellWidth: "auto" },
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    yPos =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 6;

    // Passport Document Image
    if (passportDocBase64) {
      if (yPos > 160) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...pdfColors.blue);
      doc.text("Passport Document:", margin + 4, yPos);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      yPos += 4;

      try {
        // Add passport image — landscape oriented, max width 120mm
        const imgWidth = 120;
        const imgHeight = 80;
        doc.addImage(passportDocBase64, "JPEG", margin + 4, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 6;
      } catch {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("(Passport image could not be loaded)", margin + 4, yPos + 4);
        yPos += 10;
      }
    }

    // License & Certificate Expiry Dates
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    const licenseData: string[][] = [
      ["Driver's License", fullDriver.drivers_license || "Not set"],
      ["License Expiry", formatExpiryDate(fullDriver.drivers_license_expiry)],
      ["Retest Certificate Expiry", formatExpiryDate(fullDriver.retest_certificate_expiry)],
      ["Medical Certificate Expiry", formatExpiryDate(fullDriver.medical_certificate_expiry)],
      ["Int'l Driving Permit Expiry", formatExpiryDate(fullDriver.international_driving_permit_expiry)],
      ["Defensive Driving Expiry", formatExpiryDate(fullDriver.defensive_driving_permit_expiry)],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [["Licenses & Certificates", ""]],
      body: licenseData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: pdfColors.blue, textColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 60 },
        1: { cellWidth: "auto" },
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    yPos =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 8;
  }

  // ========== VEHICLE DETAILS (full) ==========
  if (fullVehicle) {
    if (yPos > 180) {
      doc.addPage();
      yPos = 20;
    }

    yPos = addSectionHeader("Vehicle Details", pdfColors.navy);

    // Vehicle identification table
    const vehicleIdData: string[][] = [
      ["Registration / Fleet No.", fullVehicle.vehicle_id],
      ["Registration Number", fullVehicle.registration_number || "Not set"],
      ["Vehicle Type", fullVehicle.type || "-"],
      ["Make & Model", fullVehicle.make_model || "Not set"],
      ["VIN Number", fullVehicle.vin_number || "Not set"],
      ["Engine Number", fullVehicle.engine_number || "Not set"],
      ["Engine Size", fullVehicle.engine_size || "Not set"],
      ["Capacity", fullVehicle.capacity ? `${fullVehicle.capacity} Tons` : "Not set"],
      ["Status", fullVehicle.available ? "Available" : "Unavailable"],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [["Vehicle Information", ""]],
      body: vehicleIdData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: pdfColors.blue, textColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 60 },
        1: { cellWidth: "auto" },
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    yPos =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 6;

    // Vehicle Document Expiry Dates
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    const vehicleDocsData: string[][] = [
      ["License Disk Expiry", formatExpiryDate(fullVehicle.license_expiry)],
      ["COF Expiry", formatExpiryDate(fullVehicle.cof_expiry)],
      ["Insurance Expiry", formatExpiryDate(fullVehicle.insurance_expiry)],
      ["Radio License Expiry", formatExpiryDate(fullVehicle.radio_license_expiry)],
      ["SVG Expiry", formatExpiryDate(fullVehicle.svg_expiry)],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [["Vehicle Document Expiry Dates", ""]],
      body: vehicleDocsData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: pdfColors.blue, textColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 60 },
        1: { cellWidth: "auto" },
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    yPos =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 8;
  }

  // ========== LINKED TRAILERS (Horse vehicles only) ==========
  if (fullVehicle?.type === 'Horse' && (linkedReefer || linkedInterlink)) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    yPos = addSectionHeader("Linked Trailers", pdfColors.navy);

    const trailerSections: { label: string; trailer: FleetVehicle }[] = [];
    if (linkedReefer) trailerSections.push({ label: "Reefer", trailer: linkedReefer });
    if (linkedInterlink) trailerSections.push({ label: "Interlink", trailer: linkedInterlink });

    for (const { label, trailer } of trailerSections) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      const trailerData: string[][] = [
        ["Vehicle ID", trailer.vehicle_id],
        ["Registration Number", trailer.registration_number || "Not set"],
        ["Type", trailer.type || "-"],
        ["Make & Model", trailer.make_model || "Not set"],
        ["VIN Number", trailer.vin_number || "Not set"],
        ["Engine Number", trailer.engine_number || "Not set"],
        ["Capacity", trailer.capacity ? `${trailer.capacity} Tons` : "Not set"],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [[`${label} Trailer`, ""]],
        body: trailerData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        headStyles: { fillColor: pdfColors.blue, textColor: [255, 255, 255] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 60 },
          1: { cellWidth: "auto" },
        },
        alternateRowStyles: { fillColor: [241, 245, 249] },
      });

      yPos =
        (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 6;

      // Trailer expiry dates
      const trailerDocsData: string[][] = [
        ["License Disk Expiry", formatExpiryDate(trailer.license_expiry)],
        ["COF Expiry", formatExpiryDate(trailer.cof_expiry)],
        ["Insurance Expiry", formatExpiryDate(trailer.insurance_expiry)],
        ["Radio License Expiry", formatExpiryDate(trailer.radio_license_expiry)],
        ["SVG Expiry", formatExpiryDate(trailer.svg_expiry)],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [[`${label} Document Expiry Dates`, ""]],
        body: trailerDocsData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        headStyles: { fillColor: pdfColors.blue, textColor: [255, 255, 255] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 60 },
          1: { cellWidth: "auto" },
        },
        alternateRowStyles: { fillColor: [241, 245, 249] },
      });

      yPos =
        (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 6;
    }

    yPos += 2;
  }

  // ========== NOTES ==========
  if (load.notes) {
    yPos = addSectionHeader("Notes");

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    // Split notes into lines
    const splitNotes = doc.splitTextToSize(
      load.notes,
      pageWidth - 2 * margin - 8,
    );
    doc.text(splitNotes, margin + 4, yPos);
    yPos += splitNotes.length * 5 + 8;
  }

  // ========== PLANNED BACKLOAD SECTION (from time_window.backload) ==========
  if (timeWindow.backload?.enabled) {
    // Check if we need a new page
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    yPos = addSectionHeader("Planned Backload", warningColor);

    const backloadData: string[][] = [
      ["Backload Destination", timeWindow.backload.destination],
      [
        "Cargo Type",
        cargoLabels[timeWindow.backload.cargoType] ||
        timeWindow.backload.cargoType,
      ],
      ["Offloading Date", timeWindow.backload.offloadingDate],
    ];

    // Add quantities if present
    if (timeWindow.backload.quantities) {
      const { bins, crates, pallets } = timeWindow.backload.quantities;
      const quantityParts: string[] = [];
      if (bins > 0) quantityParts.push(`${bins} bins`);
      if (crates > 0) quantityParts.push(`${crates} crates`);
      if (pallets > 0) quantityParts.push(`${pallets} pallets`);
      if (quantityParts.length > 0) {
        backloadData.push(["Quantities", quantityParts.join(", ")]);
      }
    }

    // Add backload notes if present
    if (timeWindow.backload.notes) {
      backloadData.push(["Notes", timeWindow.backload.notes]);
    }

    autoTable(doc, {
      startY: yPos,
      head: [["Field", "Value"]],
      body: backloadData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: warningColor, textColor: [0, 0, 0] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { cellWidth: "auto" },
      },
      alternateRowStyles: { fillColor: [255, 251, 235] },
    });

    yPos =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 8;
  }

  // ========== BACKLOAD SECTION ==========
  const backload = findBackload(load, allLoads);
  const parentLoad = findParentLoad(load, allLoads);

  // If this load has a backload
  if (backload) {
    // Check if we need a new page
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    yPos = addSectionHeader("Associated Backload", warningColor);

    const backloadTimeWindow = timeWindowLib.parseTimeWindow(backload.time_window);

    autoTable(doc, {
      startY: yPos,
      head: [["Field", "Value"]],
      body: [
        ["Backload ID", backload.load_id],
        ["Status", statusLabels[backload.status] || backload.status],
        ["Cargo Type", cargoLabels[backload.cargo_type] || backload.cargo_type],
        ["Origin", backload.origin],
        ["Destination", backload.destination],
        [
          "Loading Date",
          format(parseISO(backload.loading_date), "dd MMM yyyy"),
        ],
        [
          "Offloading Date",
          format(parseISO(backload.offloading_date), "dd MMM yyyy"),
        ],
        ["Quantity", `${backload.quantity} units`],
        ["Driver", backload.driver?.name || "Same as main load"],
        ["Vehicle", backload.fleet_vehicle?.vehicle_id || "Same as main load"],
      ],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: warningColor, textColor: [0, 0, 0] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { cellWidth: "auto" },
      },
      alternateRowStyles: { fillColor: [255, 251, 235] },
    });

    yPos =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 8;

    // Backload times
    if (
      backloadTimeWindow.origin.plannedArrival !== "-" ||
      backloadTimeWindow.destination.plannedArrival !== "-"
    ) {
      autoTable(doc, {
        startY: yPos,
        head: [["Backload Location", "Planned Arrival", "Planned Departure"]],
        body: [
          [
            "Origin (" + backload.origin + ")",
            backloadTimeWindow.origin.plannedArrival ?? "",
            backloadTimeWindow.origin.plannedDeparture ?? "",
          ],
          [
            "Destination (" + backload.destination + ")",
            backloadTimeWindow.destination.plannedArrival ?? "",
            backloadTimeWindow.destination.plannedDeparture ?? "",
          ],
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        headStyles: { fillColor: warningColor, textColor: [0, 0, 0] },
        alternateRowStyles: { fillColor: [255, 251, 235] },
      });

      yPos =
        (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 8;
    }

    // Backload notes
    if (backload.notes) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("Backload Notes:", margin + 4, yPos);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);

      const splitBackloadNotes = doc.splitTextToSize(
        backload.notes,
        pageWidth - 2 * margin - 8,
      );
      doc.text(splitBackloadNotes, margin + 4, yPos + 5);
      yPos += splitBackloadNotes.length * 5 + 12;
    }
  }

  // If this is a backload, show parent load reference
  if (parentLoad) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    yPos = addSectionHeader("Parent Load Reference", pdfColors.navy);

    autoTable(doc, {
      startY: yPos,
      head: [["Field", "Value"]],
      body: [
        ["Parent Load ID", parentLoad.load_id],
        ["Status", statusLabels[parentLoad.status] || parentLoad.status],
        ["Origin", parentLoad.origin],
        ["Destination", parentLoad.destination],
        [
          "Cargo Type",
          cargoLabels[parentLoad.cargo_type] || parentLoad.cargo_type,
        ],
        [
          "Loading Date",
          format(parseISO(parentLoad.loading_date), "dd MMM yyyy"),
        ],
        [
          "Offloading Date",
          format(parseISO(parentLoad.offloading_date), "dd MMM yyyy"),
        ],
      ],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: pdfColors.navy, textColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { cellWidth: "auto" },
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });
  }

  // ========== FOOTER ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" },
    );
    doc.text(
      SYSTEM_NAME,
      margin,
      doc.internal.pageSize.getHeight() - 10,
    );
  }

  // Save the PDF as "Load Confirmation" so the filename matches the
  // document title shown in the header. The same blob is returned so the
  // caller can also attach it to a share sheet (e.g. email via Outlook).
  const filename = `Load-Confirmation-${load.load_id}.pdf`;
  if (download) {
    doc.save(filename);
  }
  const blob = doc.output("blob");
  return { blob, filename };
}