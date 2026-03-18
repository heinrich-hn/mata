import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import
  {
    CANDIDATE_STATUS_LABELS,
    DriverCandidate,
    EVALUATION_STEPS,
    EvaluationStatus,
  } from "@/types/recruitment";

/**
 * Get status color RGB values for PDF rendering
 */
function getStatusColor(status: string): [number, number, number] {
  switch (status) {
    case "new":
      return [59, 130, 246]; // Blue
    case "in_progress":
      return [245, 158, 11]; // Amber
    case "hired":
      return [34, 197, 94]; // Green
    case "rejected":
      return [239, 68, 68]; // Red
    case "withdrawn":
      return [107, 114, 128]; // Gray
    default:
      return [107, 114, 128]; // Gray
  }
}

/**
 * Get evaluation status color RGB values
 */
function getEvaluationStatusColor(status?: EvaluationStatus): [number, number, number] {
  switch (status) {
    case "passed":
      return [34, 197, 94]; // Green
    case "failed":
      return [239, 68, 68]; // Red
    case "scheduled":
      return [59, 130, 246]; // Blue
    case "pending":
    default:
      return [156, 163, 175]; // Gray
  }
}

/**
 * Get evaluation status label
 */
function getEvaluationStatusLabel(status?: EvaluationStatus): string {
  switch (status) {
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "scheduled":
      return "Scheduled";
    case "pending":
    default:
      return "Pending";
  }
}

/**
 * Add PDF header with branding
 */
function addHeader(doc: jsPDF, title: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 35, "F");

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Matanuska", 15, 15);

  // Report title
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(title, 15, 25);

  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, pageWidth - 15, 15, { align: "right" });

  return 45; // Return Y position after header
}

/**
 * Add page footer
 */
function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setDrawColor(200, 200, 200);
  doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(8);
  doc.text(
    `Page ${pageNum} of ${totalPages}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );
  doc.text(
    "Confidential - Matanuska HR Recruitment",
    15,
    pageHeight - 8
  );
}

/**
 * Generate PDF for a single candidate
 */
export function generateSingleCandidatePDF(candidate: DriverCandidate): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const fullName = `${candidate.first_name} ${candidate.last_name}`;
  let yPos = addHeader(doc, `Candidate Profile - ${fullName}`);

  // Status badge
  const statusColor = getStatusColor(candidate.status);
  doc.setFillColor(...statusColor);
  doc.roundedRect(15, yPos, 45, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(CANDIDATE_STATUS_LABELS[candidate.status].toUpperCase(), 37.5, yPos + 5.5, { align: "center" });

  yPos += 18;

  // Personal Information Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Personal Information", 15, yPos);
  yPos += 8;

  const personalDetails = [
    ["Candidate Number", candidate.candidate_number],
    ["Full Name", fullName],
    ["Phone", candidate.phone],
    ["Email", candidate.email || "N/A"],
    ["Address", candidate.address || "N/A"],
    ["City", candidate.city || "N/A"],
    ["Application Date", format(new Date(candidate.application_date), "dd MMM yyyy")],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: personalDetails,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 50 },
      1: { textColor: [30, 41, 59] },
    },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // License Information Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("License Information", 15, yPos);
  yPos += 8;

  const licenseDetails = [
    ["License Number", candidate.license_number],
    ["License Class", candidate.license_class],
    ["License Expiry", format(new Date(candidate.license_expiry), "dd MMM yyyy")],
    ["Years of Experience", `${candidate.years_experience} years`],
    ["Previous Employer", candidate.previous_employer || "N/A"],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: licenseDetails,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 50 },
      1: { textColor: [30, 41, 59] },
    },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Evaluation Progress Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Evaluation Progress", 15, yPos);
  yPos += 8;

  const evaluationData = [
    [
      "Interview",
      getEvaluationStatusLabel(candidate.interview_result?.status),
      candidate.interview_result?.evaluator_name || "-",
      candidate.interview_result?.completed_date
        ? format(new Date(candidate.interview_result.completed_date), "dd MMM yyyy")
        : "-",
      candidate.interview_result?.score?.toString() || "-",
    ],
    [
      "Yard Test",
      getEvaluationStatusLabel(candidate.yard_test_result?.status),
      candidate.yard_test_result?.evaluator_name || "-",
      candidate.yard_test_result?.completed_date
        ? format(new Date(candidate.yard_test_result.completed_date), "dd MMM yyyy")
        : "-",
      candidate.yard_test_result?.score?.toString() || "-",
    ],
    [
      "Road Test",
      getEvaluationStatusLabel(candidate.road_test_result?.status),
      candidate.road_test_result?.evaluator_name || "-",
      candidate.road_test_result?.completed_date
        ? format(new Date(candidate.road_test_result.completed_date), "dd MMM yyyy")
        : "-",
      candidate.road_test_result?.score?.toString() || "-",
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Step", "Status", "Evaluator", "Date", "Score"]],
    body: evaluationData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      4: { halign: "center" },
    },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Notes Section (if any)
  if (candidate.notes) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Notes", 15, yPos);
    yPos += 8;

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);

    const noteLines = doc.splitTextToSize(candidate.notes, pageWidth - 40);
    const noteHeight = Math.max(noteLines.length * 5 + 10, 20);
    doc.roundedRect(15, yPos, pageWidth - 30, noteHeight, 3, 3, "FD");

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text(noteLines, 20, yPos + 8);
  }

  // Add footer
  addFooter(doc, 1, 1);

  // Save the PDF
  doc.save(`candidate_${candidate.candidate_number}_${fullName.replace(/\s+/g, "_")}.pdf`);
}

/**
 * Generate PDF for the candidate list
 */
export function generateCandidateListPDF(
  candidates: DriverCandidate[],
  filters?: { status?: string; searchQuery?: string }
): void {
  const doc = new jsPDF("landscape");

  let yPos = addHeader(doc, "Driver Recruitment - Candidate List");

  // Filter summary
  if (filters?.status && filters.status !== "all") {
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text(`Filtered by status: ${CANDIDATE_STATUS_LABELS[filters.status as keyof typeof CANDIDATE_STATUS_LABELS] || filters.status}`, 15, yPos);
    yPos += 8;
  }

  if (filters?.searchQuery) {
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text(`Search: "${filters.searchQuery}"`, 15, yPos);
    yPos += 8;
  }

  // Summary statistics
  const stats = {
    total: candidates.length,
    new: candidates.filter((c) => c.status === "new").length,
    inProgress: candidates.filter((c) => c.status === "in_progress").length,
    hired: candidates.filter((c) => c.status === "hired").length,
    rejected: candidates.filter((c) => c.status === "rejected").length,
  };

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total: ${stats.total} | New: ${stats.new} | In Progress: ${stats.inProgress} | Hired: ${stats.hired} | Rejected: ${stats.rejected}`,
    15,
    yPos
  );
  yPos += 10;

  // Table data
  const tableData = candidates.map((candidate) => {
    const currentStepInfo = EVALUATION_STEPS.find((s) => s.value === candidate.current_step);
    return [
      candidate.candidate_number,
      `${candidate.first_name} ${candidate.last_name}`,
      candidate.phone,
      candidate.license_number,
      candidate.license_class,
      `${candidate.years_experience} yrs`,
      currentStepInfo?.label || candidate.current_step,
      getEvaluationStatusLabel(candidate.interview_result?.status),
      getEvaluationStatusLabel(candidate.yard_test_result?.status),
      getEvaluationStatusLabel(candidate.road_test_result?.status),
      CANDIDATE_STATUS_LABELS[candidate.status],
      format(new Date(candidate.application_date), "dd MMM yyyy"),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        "Candidate #",
        "Name",
        "Phone",
        "License #",
        "Class",
        "Exp",
        "Current Step",
        "Interview",
        "Yard Test",
        "Road Test",
        "Status",
        "Applied",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 35 },
      2: { cellWidth: 28 },
      3: { cellWidth: 25 },
      4: { cellWidth: 15, halign: "center" },
      5: { cellWidth: 15, halign: "center" },
      6: { cellWidth: 25 },
      7: { cellWidth: 20, halign: "center" },
      8: { cellWidth: 20, halign: "center" },
      9: { cellWidth: 20, halign: "center" },
      10: { cellWidth: 22 },
      11: { cellWidth: 22 },
    },
    margin: { left: 10, right: 10 },
    didParseCell: (data) => {
      // Color code the status column
      if (data.section === "body" && data.column.index === 10) {
        const status = candidates[data.row.index]?.status;
        if (status) {
          const color = getStatusColor(status);
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Color code evaluation columns (7, 8, 9)
      if (data.section === "body" && [7, 8, 9].includes(data.column.index)) {
        const candidate = candidates[data.row.index];
        let evalStatus: EvaluationStatus | undefined;
        if (data.column.index === 7) evalStatus = candidate?.interview_result?.status;
        if (data.column.index === 8) evalStatus = candidate?.yard_test_result?.status;
        if (data.column.index === 9) evalStatus = candidate?.road_test_result?.status;
        if (evalStatus) {
          const color = getEvaluationStatusColor(evalStatus);
          data.cell.styles.textColor = color;
        }
      }
    },
    didDrawPage: (_data) => {
      // Add footer on each page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        addFooter(doc, i, pageCount);
      }
    },
  });

  // Save the PDF
  const dateStr = format(new Date(), "yyyy-MM-dd");
  doc.save(`candidate_list_${dateStr}.pdf`);
}

/**
 * Generate summary report PDF
 */
export function generateRecruitmentSummaryPDF(candidates: DriverCandidate[]): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let yPos = addHeader(doc, "Driver Recruitment - Summary Report");

  // Statistics Overview
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Pipeline Overview", 15, yPos);
  yPos += 12;

  const stats = {
    total: candidates.length,
    new: candidates.filter((c) => c.status === "new").length,
    inProgress: candidates.filter((c) => c.status === "in_progress").length,
    hired: candidates.filter((c) => c.status === "hired").length,
    rejected: candidates.filter((c) => c.status === "rejected").length,
    withdrawn: candidates.filter((c) => c.status === "withdrawn").length,
    atInterview: candidates.filter((c) => c.current_step === "interview" && c.status === "in_progress").length,
    atYardTest: candidates.filter((c) => c.current_step === "yard_test" && c.status === "in_progress").length,
    atRoadTest: candidates.filter((c) => c.current_step === "road_test" && c.status === "in_progress").length,
  };

  // Status breakdown
  const statusData = [
    ["Total Candidates", stats.total.toString()],
    ["New Applications", stats.new.toString()],
    ["In Progress", stats.inProgress.toString()],
    ["Hired", stats.hired.toString()],
    ["Rejected", stats.rejected.toString()],
    ["Withdrawn", stats.withdrawn.toString()],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Status", "Count"]],
    body: statusData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
    },
    margin: { left: 15, right: pageWidth / 2 + 5 },
    tableWidth: pageWidth / 2 - 20,
  });

  // Pipeline stage breakdown
  const pipelineData = [
    ["At Interview Stage", stats.atInterview.toString()],
    ["At Yard Test Stage", stats.atYardTest.toString()],
    ["At Road Test Stage", stats.atRoadTest.toString()],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Pipeline Stage", "Count"]],
    body: pipelineData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
    },
    margin: { left: pageWidth / 2 + 5, right: 15 },
    tableWidth: pageWidth / 2 - 20,
  });

  yPos = Math.max(
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY,
    yPos + 80
  ) + 15;

  // Recent Applications (last 10)
  const recentCandidates = [...candidates]
    .sort((a, b) => new Date(b.application_date).getTime() - new Date(a.application_date).getTime())
    .slice(0, 10);

  if (recentCandidates.length > 0) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Recent Applications", 15, yPos);
    yPos += 8;

    const recentData = recentCandidates.map((c) => [
      c.candidate_number,
      `${c.first_name} ${c.last_name}`,
      c.license_class,
      CANDIDATE_STATUS_LABELS[c.status],
      format(new Date(c.application_date), "dd MMM yyyy"),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Candidate #", "Name", "License Class", "Status", "Applied"]],
      body: recentData,
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      margin: { left: 15, right: 15 },
    });
  }

  // Add footer
  addFooter(doc, 1, 1);

  // Save the PDF
  const dateStr = format(new Date(), "yyyy-MM-dd");
  doc.save(`recruitment_summary_${dateStr}.pdf`);
}