import { format } from "date-fns";
import jsPDF from "jspdf";

// Flexible type for PDF generation that accepts database records
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DriverBehaviorEventExtended = Record<string, any> & {
  id: string;
};

export const generateDriverCoachingPDF = (event: DriverBehaviorEventExtended) => {
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

  doc.text(`Location: ${event.location || "N/A"}`, margin + 5, detailsY + 21);
  if (event.points) {
    doc.text(`Points: ${event.points}`, pageWidth / 2 + 10, detailsY + 21);
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