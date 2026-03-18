
import type { IncidentDocument, IncidentTimelineEvent } from "@/hooks/useIncidentDocuments";
import type { Incident } from "@/hooks/useIncidents";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { listIncidentStorageFiles } from "./recoverIncidentImages";

interface IncidentPDFData {
  incident: Incident;
  documents?: IncidentDocument[];
  timeline?: IncidentTimelineEvent[];
}

const formatIncidentType = (type: string): string => {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const formatWeatherCondition = (condition: string | null): string => {
  if (!condition) return "Unknown";
  return condition
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const formatStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getSeverityText = (rating: number | null): string => {
  if (!rating) return "Not Rated";
  const levels = ["", "Minor", "Low", "Medium", "High", "Critical"];
  return `${rating} - ${levels[rating]}`;
};

// Extract storage path from Supabase public URL
const extractStoragePath = (url: string): { bucket: string; path: string } | null => {
  try {
    // Match Supabase storage URL pattern: /storage/v1/object/public/{bucket}/{path}
    const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (match) {
      return { bucket: match[1], path: decodeURIComponent(match[2]) };
    }
    return null;
  } catch {
    return null;
  }
};

// Download image via Supabase client (authenticated, bypasses CORS)
const downloadViaSupabase = async (bucket: string, path: string): Promise<string | null> => {
  try {
    const { data: blobData, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (!error && blobData) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blobData);
      });
    }
    console.log("Supabase download error:", error?.message);
    return null;
  } catch (e) {
    console.log("Supabase download exception:", e);
    return null;
  }
};

// Load image using HTML Image element and canvas (bypasses CORS for display)
const loadImageViaCanvas = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Try to request CORS permission

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      } catch (e) {
        console.log("Canvas conversion failed (likely CORS):", e);
        resolve(null);
      }
    };

    img.onerror = () => {
      console.log("Image load failed:", url);
      resolve(null);
    };

    // Set timeout for slow images
    setTimeout(() => resolve(null), 10000);

    img.src = url;
  });
};

// Convert image URL to base64 for embedding in PDF
// Priority order: Supabase download (bypasses CORS) -> Signed URL -> Canvas -> Direct fetch
const imageUrlToBase64 = async (url: string): Promise<string | null> => {
  console.log("PDF Image Loader - Attempting to load:", url);

  // First try: Download via Supabase client (authenticated, bypasses CORS entirely)
  const storagePath = extractStoragePath(url);
  if (storagePath) {
    console.log("PDF Image Loader - Trying Supabase download for:", storagePath);
    const supabaseResult = await downloadViaSupabase(storagePath.bucket, storagePath.path);
    if (supabaseResult) {
      console.log("PDF Image Loader - Supabase download SUCCESS");
      return supabaseResult;
    }

    // Second try: Create a signed URL and download via Supabase
    try {
      console.log("PDF Image Loader - Trying signed URL");
      const { data: signedData, error: signedError } = await supabase.storage
        .from(storagePath.bucket)
        .createSignedUrl(storagePath.path, 120); // 2 minute expiry

      if (signedError) {
        console.log("PDF Image Loader - Signed URL error:", signedError.message);
      } else if (signedData?.signedUrl) {
        // Try to fetch the signed URL (this has different CORS behavior)
        try {
          const response = await fetch(signedData.signedUrl);
          if (response.ok) {
            const blob = await response.blob();
            const result = await new Promise<string | null>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
            if (result) {
              console.log("PDF Image Loader - Signed URL fetch SUCCESS");
              return result;
            }
          }
        } catch (e) {
          console.log("PDF Image Loader - Signed URL fetch failed:", e);
        }

        // Try canvas with signed URL
        const signedCanvasResult = await loadImageViaCanvas(signedData.signedUrl);
        if (signedCanvasResult) {
          console.log("PDF Image Loader - Signed URL canvas SUCCESS");
          return signedCanvasResult;
        }
      }
    } catch (e) {
      console.log("PDF Image Loader - Signed URL error:", e);
    }
  }

  // Third try: Load via Image element and canvas (works for public images with CORS)
  console.log("PDF Image Loader - Trying canvas approach");
  const canvasResult = await loadImageViaCanvas(url);
  if (canvasResult) {
    console.log("PDF Image Loader - Canvas SUCCESS");
    return canvasResult;
  }

  // Fourth try: Direct fetch (works if bucket is public and CORS is configured)
  try {
    console.log("PDF Image Loader - Trying direct fetch");
    const response = await fetch(url, { mode: "cors" });
    if (response.ok) {
      const blob = await response.blob();
      const result = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (result) {
        console.log("PDF Image Loader - Direct fetch SUCCESS");
        return result;
      }
    }
  } catch (e) {
    console.log("PDF Image Loader - Direct fetch failed:", e);
  }

  console.warn("PDF Image Loader - All methods FAILED for:", url);
  return null;
};

export const generateIncidentPDF = async ({
  incident,
  documents = [],
  timeline = [],
}: IncidentPDFData): Promise<void> => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Helper function to add new page if needed
  const checkNewPage = (requiredSpace: number = 30) => {
    if (yPos > pdf.internal.pageSize.getHeight() - requiredSpace) {
      pdf.addPage();
      yPos = 20;
    }
  };

  // Header
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(33, 33, 33);
  pdf.text("INCIDENT REPORT", pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 100, 100);
  pdf.text(incident.incident_number, pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  // Status badge
  pdf.setFontSize(11);
  const statusColor = {
    open: [220, 53, 69],
    processing: [255, 193, 7],
    closed: [108, 117, 125],
    claimed: [40, 167, 69],
  }[incident.status] || [108, 117, 125];

  pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  pdf.text(`Status: ${formatStatus(incident.status)}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Horizontal line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Section: Basic Information
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(33, 33, 33);
  pdf.text("Incident Details", margin, yPos);
  yPos += 8;

  const basicInfoData = [
    ["Date", formatDate(incident.incident_date)],
    ["Time", incident.incident_time],
    ["Location", incident.location],
    ["Incident Type", formatIncidentType(incident.incident_type)],
    ["Weather Condition", formatWeatherCondition(incident.weather_condition)],
    ["Severity Rating", getSeverityText(incident.severity_rating)],
  ];

  autoTable(pdf, {
    startY: yPos,
    head: [],
    body: basicInfoData,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { cellWidth: pageWidth - margin * 2 - 50 },
    },
    margin: { left: margin, right: margin },
  });

  yPos = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Section: Vehicle & Personnel
  checkNewPage();
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Vehicle & Personnel", margin, yPos);
  yPos += 8;

  const vehicleData = [
    [
      "Vehicle",
      incident.vehicles
        ? `${incident.vehicles.registration_number} (${incident.vehicles.make} ${incident.vehicles.model})`
        : incident.vehicle_number || "Not specified",
    ],
    ["Fleet Number", incident.vehicles?.fleet_number || "N/A"],
    ["Driver", incident.driver_name || "Not specified"],
    ["Reported By", incident.reported_by],
  ];

  autoTable(pdf, {
    startY: yPos,
    head: [],
    body: vehicleData,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { cellWidth: pageWidth - margin * 2 - 50 },
    },
    margin: { left: margin, right: margin },
  });

  yPos = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Section: Description
  if (incident.description) {
    checkNewPage(50);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Description", margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const descriptionLines = pdf.splitTextToSize(
      incident.description,
      pageWidth - margin * 2
    );
    pdf.text(descriptionLines, margin, yPos);
    yPos += descriptionLines.length * 5 + 10;
  }

  // Section: Insurance & Financial Details
  if (incident.insurance_number || incident.total_cost || incident.insurance_claim_amount) {
    checkNewPage();
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Financial Details", margin, yPos);
    yPos += 8;

    const financialData: string[][] = [];
    if (incident.insurance_number) {
      financialData.push(["Insurance Number", incident.insurance_number]);
    }
    if (incident.total_cost !== null) {
      financialData.push(["Total Cost", `$${incident.total_cost.toFixed(2)}`]);
    }
    if (incident.insurance_claim_amount !== null) {
      financialData.push(["Claim Amount", `$${incident.insurance_claim_amount.toFixed(2)}`]);
    }

    if (financialData.length > 0) {
      autoTable(pdf, {
        startY: yPos,
        head: [],
        body: financialData,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 50 },
          1: { cellWidth: pageWidth - margin * 2 - 50 },
        },
        margin: { left: margin, right: margin },
      });

      yPos = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }
  }

  // Section: Resolution Notes
  if (incident.resolution_notes) {
    checkNewPage(50);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Resolution Notes", margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const resolutionLines = pdf.splitTextToSize(
      incident.resolution_notes,
      pageWidth - margin * 2
    );
    pdf.text(resolutionLines, margin, yPos);
    yPos += resolutionLines.length * 5 + 5;

    if (incident.closed_at) {
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Closed on ${formatDateTime(incident.closed_at)}${incident.closed_by ? ` by ${incident.closed_by}` : ""}`,
        margin,
        yPos
      );
      pdf.setTextColor(33, 33, 33);
      yPos += 10;
    }
  }

  // Section: Photos
  console.log("PDF Generator - Raw incident.images:", incident.images, "Type:", typeof incident.images);

  // Handle case where images might be stored as string instead of array
  let images: Array<{ url: string; name?: string }> = [];
  if (Array.isArray(incident.images)) {
    images = incident.images;
  } else if (typeof incident.images === "string") {
    try {
      const parsed = JSON.parse(incident.images);
      if (Array.isArray(parsed)) {
        images = parsed;
      }
    } catch {
      console.log("PDF Generator - Could not parse images string");
    }
  }

  // If no images in database, check storage for orphaned files
  if (images.length === 0) {
    console.log("PDF Generator - No images in database, checking storage for orphaned files...");
    const storageResult = await listIncidentStorageFiles(incident.id);
    if (storageResult.files.length > 0) {
      console.log("PDF Generator - Found orphaned images in storage:", storageResult.files);
      images = storageResult.files.map(f => ({ url: f.url, name: f.name }));
    } else {
      console.log("PDF Generator - No orphaned images found in storage");
    }
  }

  const failedImages: string[] = [];

  console.log("PDF Generator - Processing images:", images.length, images);

  if (images.length > 0) {
    checkNewPage(80);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Photos (${images.length})`, margin, yPos);
    yPos += 10;

    const imageWidth = 55;
    const imageHeight = 45;
    const imagesPerRow = 3;
    let xPos = margin;
    let imagesInRow = 0;

    for (const image of images) {
      console.log("PDF Generator - Loading image:", image.url);

      if (imagesInRow >= imagesPerRow) {
        xPos = margin;
        yPos += imageHeight + 5;
        imagesInRow = 0;
      }

      checkNewPage(imageHeight + 20);

      const base64 = await imageUrlToBase64(image.url);
      console.log("PDF Generator - Image base64 result:", base64 ? `Got ${base64.length} chars` : "FAILED");

      if (base64) {
        try {
          // Detect image format from base64 header
          const format = base64.includes("data:image/png") ? "PNG" : "JPEG";
          pdf.addImage(base64, format, xPos, yPos, imageWidth, imageHeight);
        } catch (e) {
          console.error("Failed to add image to PDF:", e);
          // If image fails, draw placeholder
          pdf.setDrawColor(200, 200, 200);
          pdf.setFillColor(245, 245, 245);
          pdf.rect(xPos, yPos, imageWidth, imageHeight, "FD");
          pdf.setFontSize(8);
          pdf.setTextColor(150, 150, 150);
          pdf.text("Image Error", xPos + imageWidth / 2, yPos + imageHeight / 2, { align: "center" });
          pdf.setTextColor(33, 33, 33);
          failedImages.push(image.name || "Unknown");
        }
      } else {
        // No base64 - show placeholder with image name
        pdf.setDrawColor(200, 200, 200);
        pdf.setFillColor(250, 250, 250);
        pdf.rect(xPos, yPos, imageWidth, imageHeight, "FD");
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        pdf.text("Could not load:", xPos + 3, yPos + imageHeight / 2 - 5);
        const truncatedName = (image.name || "image").substring(0, 15);
        pdf.text(truncatedName, xPos + 3, yPos + imageHeight / 2 + 3);
        pdf.setTextColor(33, 33, 33);
        failedImages.push(image.name || "Unknown");
      }

      xPos += imageWidth + 5;
      imagesInRow++;
    }

    yPos += imageHeight + 15;

    // Show warning if some images failed
    if (failedImages.length > 0) {
      pdf.setFontSize(9);
      pdf.setTextColor(180, 100, 50);
      pdf.text(
        `Note: ${failedImages.length} image(s) could not be loaded. They may be stored in a private bucket.`,
        margin,
        yPos
      );
      pdf.setTextColor(33, 33, 33);
      yPos += 10;
    }
  }

  // Section: Documents
  if (documents.length > 0) {
    checkNewPage();
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Attached Documents (${documents.length})`, margin, yPos);
    yPos += 8;

    const docData = documents.map((doc) => [
      doc.name,
      doc.document_type.replace(/_/g, " "),
      formatDateTime(doc.uploaded_at),
      doc.uploaded_by,
    ]);

    autoTable(pdf, {
      startY: yPos,
      head: [["Document Name", "Type", "Uploaded", "By"]],
      body: docData,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: margin, right: margin },
    });

    yPos = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Section: Timeline
  if (timeline.length > 0) {
    checkNewPage();
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Incident Timeline", margin, yPos);
    yPos += 8;

    const timelineData = timeline.map((event) => [
      formatDateTime(event.created_at),
      event.event_title,
      event.event_description || "",
      event.performed_by,
    ]);

    autoTable(pdf, {
      startY: yPos,
      head: [["Date/Time", "Event", "Details", "By"]],
      body: timelineData,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 35 },
        2: { cellWidth: pageWidth - margin * 2 - 110 },
        3: { cellWidth: 35 },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Footer on each page
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pdf.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    pdf.text(
      `Incident Report: ${incident.incident_number}`,
      margin,
      pdf.internal.pageSize.getHeight() - 10
    );
  }

  // Save the PDF
  pdf.save(`Incident_Report_${incident.incident_number}.pdf`);
};

export default generateIncidentPDF;