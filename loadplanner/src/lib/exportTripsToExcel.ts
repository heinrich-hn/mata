import type { Load } from "@/hooks/useTrips";
import * as timeWindowLib from "@/lib/timeWindow";
import { computeTimeVariance } from "@/lib/timeWindow";
import { getLocationDisplayName } from "@/lib/utils";
import { addDays, differenceInDays, format, getWeek, isSameDay, parseISO, startOfWeek } from "date-fns";
import XLSX from "xlsx-js-style";
import {
  BRAND, COMPANY_NAME,
  xlHeader,
  xlMetricLabel, xlMetricValue,
  xlGoodVariance, xlBadVariance, xlNeutralVariance,
  applyHeaderStyle, applyTitleRows,
} from "@/lib/exportStyles";

// Status labels
const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  "in-transit": "In Transit",
  pending: "Pending",
  delivered: "Delivered",
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

interface ExportOptions {
  filename?: string;
  sheetName?: string;
  weekNumber?: number;
  year?: number;
}

// ---------------------------------------------------------------------------
// Variance helpers — use shared SAST-aware implementation
// ---------------------------------------------------------------------------

function computeVariance(
  planned: string | undefined | null,
  actual: string | undefined | null,
): { label: string; diffMin: number | null } {
  const v = computeTimeVariance(planned, actual);
  return { label: v.label, diffMin: v.diffMin };
}

// Cell style helpers — use shared professional styles
const greenFill = xlGoodVariance;
const redFill = xlBadVariance;
const onTimeFill = xlNeutralVariance;

function varianceStyle(diffMin: number | null) {
  if (diffMin === null) return undefined;
  if (diffMin === 0) return onTimeFill;
  return diffMin > 0 ? redFill : greenFill;
}

export function exportLoadsToExcel(
  loads: Load[],
  options: ExportOptions = {},
): void {
  const weekNum = options.weekNumber ?? getWeek(new Date(), { weekStartsOn: 1 });
  const yr = options.year ?? new Date().getFullYear();
  const {
    filename = `loads-week-${weekNum}-${yr}`,
    sheetName = `Week ${weekNum}`,
  } = options;

  // Transform loads data for Excel
  const excelData = loads.map((load) => {
    const timeWindow = timeWindowLib.parseTimeWindow(load.time_window);
    const isBackload = load.load_id.startsWith("BL-");

    // Build backload quantities string
    let backloadQuantities = "";
    if (timeWindow.backload?.quantities) {
      const { bins, crates, pallets } = timeWindow.backload.quantities;
      const parts: string[] = [];
      if (bins > 0) parts.push(`${bins} bins`);
      if (crates > 0) parts.push(`${crates} crates`);
      if (pallets > 0) parts.push(`${pallets} pallets`);
      backloadQuantities = parts.join(", ");
    }

    // Compute variances
    const oArrVar = computeVariance(timeWindow.origin.plannedArrival, timeWindow.origin.actualArrival);
    const oDepVar = computeVariance(timeWindow.origin.plannedDeparture, timeWindow.origin.actualDeparture);
    const dArrVar = computeVariance(timeWindow.destination.plannedArrival, timeWindow.destination.actualArrival);
    const dDepVar = computeVariance(timeWindow.destination.plannedDeparture, timeWindow.destination.actualDeparture);

    return {
      row: {
        "Load ID": load.load_id,
        Type: isBackload ? "Backload" : "Primary",
        Status: statusLabels[load.status] || load.status,
        Origin: load.origin,
        Destination: load.destination,
        "Cargo Type": cargoLabels[load.cargo_type] || load.cargo_type,
        Quantity: load.quantity,
        "Weight (T)": load.weight,
        "Loading Date": format(parseISO(load.loading_date), "dd/MM/yyyy"),
        "Offloading Date": format(parseISO(load.offloading_date), "dd/MM/yyyy"),
        // Origin times: planned → actual → variance
        "Origin Planned Arrival": timeWindow.origin.plannedArrival,
        "Origin Actual Arrival": timeWindow.origin.actualArrival,
        "Origin Arrival Variance": oArrVar.label,
        "Origin Planned Departure": timeWindow.origin.plannedDeparture,
        "Origin Actual Departure": timeWindow.origin.actualDeparture,
        "Origin Departure Variance": oDepVar.label,
        // Destination times: planned → actual → variance
        "Dest Planned Arrival": timeWindow.destination.plannedArrival,
        "Dest Actual Arrival": timeWindow.destination.actualArrival,
        "Dest Arrival Variance": dArrVar.label,
        "Dest Planned Departure": timeWindow.destination.plannedDeparture,
        "Dest Actual Departure": timeWindow.destination.actualDeparture,
        "Dest Departure Variance": dDepVar.label,
        // Other columns
        Vehicle: load.fleet_vehicle?.vehicle_id || "",
        "Vehicle Type": load.fleet_vehicle?.type || "",
        Driver: load.driver?.name || "",
        "Driver Contact": load.driver?.contact || "",
        "Special Handling": load.special_handling?.join(", ") || "",
        Notes: load.notes || "",
        "Has Planned Backload": timeWindow.backload?.enabled ? "Yes" : "No",
        "Backload Destination": timeWindow.backload?.destination || "",
        "Backload Cargo Type": timeWindow.backload?.cargoType
          ? cargoLabels[timeWindow.backload.cargoType] ||
          timeWindow.backload.cargoType
          : "",
        "Backload Offloading Date": timeWindow.backload?.offloadingDate || "",
        "Backload Quantities": backloadQuantities,
        "Backload Notes": timeWindow.backload?.notes || "",
        "Variance Reason": timeWindow.varianceReason || "",
      },
      variances: { oArrVar, oDepVar, dArrVar, dDepVar },
    };
  });

  // Variance column indices (0-based within the data columns)
  // Columns: 0-Load ID ... 12-Origin Arrival Variance, 15-Origin Departure Variance,
  //          18-Dest Arrival Variance, 21-Dest Departure Variance
  const varianceCols = [12, 15, 18, 21];
  const varianceKeys = ["oArrVar", "oDepVar", "dArrVar", "dDepVar"] as const;

  // Week info for title
  const titleRow = [
    `${COMPANY_NAME} — Load Planning — Week ${weekNum}, ${yr}`,
  ];
  const genRow = [
    `Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
  ];

  // Create workbook and worksheet with title row
  const workbook = XLSX.utils.book_new();

  // Create worksheet with title + generated date rows
  const worksheet = XLSX.utils.aoa_to_sheet([titleRow, genRow, []]);

  // Add the data starting from row 4 (after title, generated, and blank row)
  XLSX.utils.sheet_add_json(worksheet, excelData.map(d => d.row), { origin: "A4" });

  // Apply professional title/subtitle/header styles
  const colCount = Object.keys(excelData[0]?.row ?? {}).length || 35;
  const mergeRanges: XLSX.Range[] = [];
  applyTitleRows(worksheet, colCount, mergeRanges);
  worksheet["!merges"] = mergeRanges;
  applyHeaderStyle(worksheet, 3, colCount);

  // Apply conditional fill to variance cells
  // Data starts at row index 4 (0-based: row 0=title, 1=generated, 2=blank, 3=headers, 4+=data)
  excelData.forEach((item, rowIdx) => {
    const excelRow = rowIdx + 4; // 0-based sheet row
    varianceKeys.forEach((key, ki) => {
      const col = varianceCols[ki];
      const cellRef = XLSX.utils.encode_cell({ r: excelRow, c: col });
      const cell = worksheet[cellRef];
      if (cell) {
        const style = varianceStyle(item.variances[key].diffMin);
        if (style) cell.s = style;
      }
    });
  });

  // Set column widths
  const columnWidths = [
    { wch: 15 }, // Load ID
    { wch: 10 }, // Type
    { wch: 12 }, // Status
    { wch: 20 }, // Origin
    { wch: 20 }, // Destination
    { wch: 18 }, // Cargo Type
    { wch: 10 }, // Quantity
    { wch: 10 }, // Weight
    { wch: 12 }, // Loading Date
    { wch: 14 }, // Offloading Date
    { wch: 14 }, // Origin Planned Arr
    { wch: 14 }, // Origin Actual Arr
    { wch: 18 }, // Origin Arr Variance
    { wch: 14 }, // Origin Planned Dep
    { wch: 14 }, // Origin Actual Dep
    { wch: 18 }, // Origin Dep Variance
    { wch: 14 }, // Dest Planned Arr
    { wch: 14 }, // Dest Actual Arr
    { wch: 18 }, // Dest Arr Variance
    { wch: 14 }, // Dest Planned Dep
    { wch: 14 }, // Dest Actual Dep
    { wch: 18 }, // Dest Dep Variance
    { wch: 12 }, // Vehicle
    { wch: 12 }, // Vehicle Type
    { wch: 20 }, // Driver
    { wch: 15 }, // Driver Contact
    { wch: 25 }, // Special Handling
    { wch: 40 }, // Notes
    { wch: 18 }, // Has Planned Backload
    { wch: 20 }, // Backload Destination
    { wch: 18 }, // Backload Cargo Type
    { wch: 18 }, // Backload Offloading Date
    { wch: 25 }, // Backload Quantities
    { wch: 40 }, // Backload Notes
    { wch: 40 }, // Variance Reason
  ];
  worksheet["!cols"] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Create summary sheet
  // Count loads with planned backloads
  const loadsWithPlannedBackloads = loads.filter((l) => {
    const tw = timeWindowLib.parseTimeWindow(l.time_window);  // FIXED: Added timeWindowLib.
    return tw.backload?.enabled;
  }).length;

  const summaryData = [
    { Metric: "Total Loads", Value: loads.length },
    {
      Metric: "Week Start",
      Value: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "dd/MM/yyyy"),
    },
    {
      Metric: "Scheduled",
      Value: loads.filter((l) => l.status === "scheduled").length,
    },
    {
      Metric: "In Transit",
      Value: loads.filter((l) => l.status === "in-transit").length,
    },
    {
      Metric: "Pending",
      Value: loads.filter((l) => l.status === "pending").length,
    },
    {
      Metric: "Delivered",
      Value: loads.filter((l) => l.status === "delivered").length,
    },
    { Metric: "", Value: "" },
    {
      Metric: "Total Quantity",
      Value: loads.reduce((sum, l) => sum + l.quantity, 0),
    },
    {
      Metric: "Total Weight (T)",
      Value: loads.reduce((sum, l) => sum + l.weight, 0),
    },
    { Metric: "", Value: "" },
    {
      Metric: "Primary Loads",
      Value: loads.filter((l) => !l.load_id.startsWith("BL-")).length,
    },
    {
      Metric: "Backloads (Scheduled)",
      Value: loads.filter((l) => l.load_id.startsWith("BL-")).length,
    },
    {
      Metric: "Loads with Planned Backload",
      Value: loadsWithPlannedBackloads,
    },
    { Metric: "", Value: "" },
    {
      Metric: "Date Span (Days)",
      Value: loads.length > 0
        ? differenceInDays(
          parseISO(loads[loads.length - 1].offloading_date),
          parseISO(loads[0].loading_date),
        ) + 1
        : 0,
    },
    {
      Metric: "Report Generated",
      Value: format(new Date(), "dd/MM/yyyy HH:mm"),
    },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 26 }, { wch: 25 }];

  // Style summary header row
  const smH0 = "A1";
  const smH1 = "B1";
  if (summarySheet[smH0]) summarySheet[smH0].s = xlHeader;
  if (summarySheet[smH1]) summarySheet[smH1].s = xlHeader;

  // Style summary data rows
  for (let r = 1; r <= summaryData.length; r++) {
    const rA = XLSX.utils.encode_cell({ r, c: 0 });
    const rB = XLSX.utils.encode_cell({ r, c: 1 });
    if (summarySheet[rA] && summarySheet[rA].v !== "" && summarySheet[rA].v !== undefined) {
      summarySheet[rA].s = xlMetricLabel;
    }
    if (summarySheet[rB] && summarySheet[rA]?.v !== "" && summarySheet[rA]?.v !== undefined) {
      summarySheet[rB].s = xlMetricValue;
    }
  }

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Generate and download the file
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Export loads for a specific week
export function exportWeeklyLoadsToExcel(
  loads: Load[],
  weekNumber: number,
  year: number,
  _weekStart: Date,
  _weekEnd: Date,
): void {
  exportLoadsToExcel(loads, {
    filename: `loads-week-${weekNumber}-${year}`,
    sheetName: `Week ${weekNumber}`,
  });
}

// Simplified export with fewer columns (excludes timing, status details, etc.)
export function exportLoadsToExcelSimplified(
  loads: Load[],
  options: ExportOptions = {},
): void {
  const weekNum = options.weekNumber ?? getWeek(new Date(), { weekStartsOn: 1 });
  const yr = options.year ?? new Date().getFullYear();
  const {
    filename = `loads-simplified-week-${weekNum}-${yr}`,
    sheetName = `Week ${weekNum}`,
  } = options;

  // Transform loads data for simplified Excel export
  const excelData = loads.map((load) => {
    const timeWindow = timeWindowLib.parseTimeWindow(load.time_window);  // FIXED: Added timeWindowLib.

    // Build backload quantities string
    let backloadQuantities = "";
    if (timeWindow.backload?.quantities) {
      const { bins, crates, pallets } = timeWindow.backload.quantities;
      const parts: string[] = [];
      if (bins > 0) parts.push(`${bins} bins`);
      if (crates > 0) parts.push(`${crates} crates`);
      if (pallets > 0) parts.push(`${pallets} pallets`);
      backloadQuantities = parts.join(", ");
    }

    return {
      "Load ID": load.load_id,
      Origin: load.origin,
      Destination: load.destination,
      "Cargo Type": cargoLabels[load.cargo_type] || load.cargo_type,
      "Loading Date": format(parseISO(load.loading_date), "dd/MM/yyyy"),
      "Offloading Date": format(parseISO(load.offloading_date), "dd/MM/yyyy"),
      Vehicle: load.fleet_vehicle?.vehicle_id || "",
      "Vehicle Type": load.fleet_vehicle?.type || "",
      Driver: load.driver?.name || "",
      "Backload Destination": timeWindow.backload?.destination || "",
      "Backload Cargo Type": timeWindow.backload?.cargoType
        ? cargoLabels[timeWindow.backload.cargoType] ||
        timeWindow.backload.cargoType
        : "",
      "Backload Offloading Date": timeWindow.backload?.offloadingDate || "",
      "Backload Quantities": backloadQuantities,
    };
  });

  // Week info for title
  const titleRow = [
    `${COMPANY_NAME} — Load Planning (Simplified) — Week ${weekNum}, ${yr}`,
  ];
  const genRow = [
    `Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
  ];

  // Create workbook and worksheet with title row
  const workbook = XLSX.utils.book_new();

  // Create worksheet with title + generated date rows
  const worksheet = XLSX.utils.aoa_to_sheet([titleRow, genRow, []]);

  // Add the data starting from row 4 (after title, generated, and blank row)
  XLSX.utils.sheet_add_json(worksheet, excelData, { origin: "A4" });

  // Apply professional title/subtitle/header styles
  const simpColCount = 13;
  const simpMerges: XLSX.Range[] = [];
  applyTitleRows(worksheet, simpColCount, simpMerges);
  worksheet["!merges"] = simpMerges;
  applyHeaderStyle(worksheet, 3, simpColCount);

  // Set column widths for simplified version
  const columnWidths = [
    { wch: 15 }, // Load ID
    { wch: 20 }, // Origin
    { wch: 20 }, // Destination
    { wch: 18 }, // Cargo Type
    { wch: 12 }, // Loading Date
    { wch: 14 }, // Offloading Date
    { wch: 12 }, // Vehicle
    { wch: 12 }, // Vehicle Type
    { wch: 20 }, // Driver
    { wch: 20 }, // Backload Destination
    { wch: 18 }, // Backload Cargo Type
    { wch: 18 }, // Backload Offloading Date
    { wch: 25 }, // Backload Quantities
  ];
  worksheet["!cols"] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate and download the file
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Export simplified version for a specific week
export function exportWeeklyLoadsToExcelSimplified(
  loads: Load[],
  weekNumber: number,
  year: number,
): void {
  exportLoadsToExcelSimplified(loads, {
    filename: `loads-simplified-week-${weekNumber}-${year}`,
    sheetName: `Week ${weekNumber}`,
  });
}

// ---------------------------------------------------------------------------
// Calendar-layout export — mirrors the weekly planner Gantt view
// ---------------------------------------------------------------------------

/** Shared cell styles — using corporate brand palette */
const calStyles = {
  title: {
    font: { bold: true, sz: 16, color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.navy } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
  },
  subtitle: {
    font: { sz: 11, color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.navy } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
  },
  dayHeader: {
    font: { bold: true, sz: 11, color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.blue } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: {
      bottom: { style: "thin" as const, color: { rgb: BRAND.white } },
      right: { style: "thin" as const, color: { rgb: BRAND.white } },
    },
  },
  todayHeader: {
    font: { bold: true, sz: 11, color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.accent } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: {
      bottom: { style: "thin" as const, color: { rgb: BRAND.white } },
      right: { style: "thin" as const, color: { rgb: BRAND.white } },
    },
  },
  truckHeader: {
    font: { bold: true, sz: 11, color: { rgb: BRAND.navy } },
    fill: { fgColor: { rgb: BRAND.lightBlue } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: {
      bottom: { style: "thin" as const, color: { rgb: BRAND.midGray } },
      right: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    },
  },
  emptyCell: {
    fill: { fgColor: { rgb: BRAND.lightGray } },
    border: {
      bottom: { style: "thin" as const, color: { rgb: BRAND.midGray } },
      right: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    },
  },
  weekendEmpty: {
    fill: { fgColor: { rgb: BRAND.midGray } },
    border: {
      bottom: { style: "thin" as const, color: { rgb: BRAND.midGray } },
      right: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    },
  },
};

const loadStatusColors: Record<string, { bg: string; fg: string }> = {
  delivered: { bg: BRAND.successBg, fg: BRAND.successDk },
  "in-transit": { bg: BRAND.lightBlue, fg: BRAND.navy },
  scheduled: { bg: "E2D0F8", fg: "5B2C8E" },
  pending: { bg: BRAND.warningBg, fg: BRAND.warningDk },
};

function loadCellStyle(status: string) {
  const colors = loadStatusColors[status] ?? { bg: "FFF2CC", fg: "7F6000" };
  return {
    font: { sz: 9, color: { rgb: colors.fg }, wrapText: true },
    fill: { fgColor: { rgb: colors.bg } },
    alignment: { vertical: "top" as const, wrapText: true },
    border: {
      bottom: { style: "thin" as const, color: { rgb: "B4C6E7" } },
      right: { style: "thin" as const, color: { rgb: "B4C6E7" } },
      top: { style: "thin" as const, color: { rgb: "B4C6E7" } },
      left: { style: "thin" as const, color: { rgb: "B4C6E7" } },
    },
  };
}

/**
 * Export the weekly planner as a calendar-layout Excel file.
 * Layout: rows = trucks, columns = days of the week (Mon–Sun).
 * Each cell contains the load details for that truck on that day.
 */
export function exportCalendarToExcel(
  loads: Load[],
  options: {
    weekStart: Date;
    weekNumber: number;
    year: number;
    filename?: string;
  },
): void {
  const { weekStart, weekNumber, year } = options;
  const filename = options.filename ?? `weekly-planner-week-${weekNumber}-${year}`;
  const today = new Date();

  // Build 7-day array (Mon–Sun)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];

  // Filter loads in this week
  const weekLoads = loads.filter((load) => {
    try {
      const ld = parseISO(load.loading_date);
      const od = parseISO(load.offloading_date);
      return (
        (ld >= weekStart && ld <= weekEnd) ||
        (od >= weekStart && od <= weekEnd) ||
        (ld <= weekStart && od >= weekEnd)
      );
    } catch {
      return false;
    }
  });

  // Group by truck
  const grouped: Record<string, Load[]> = {};
  weekLoads.forEach((load) => {
    const truckId = load.fleet_vehicle?.vehicle_id || "Unassigned";
    if (!grouped[truckId]) grouped[truckId] = [];
    grouped[truckId].push(load);
  });

  // Sort trucks alphabetically, Unassigned last
  const truckIds = Object.keys(grouped).sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
  });

  // Sort loads per truck by loading date
  truckIds.forEach((t) =>
    grouped[t].sort((a, b) => parseISO(a.loading_date).getTime() - parseISO(b.loading_date).getTime()),
  );

  // --- Build the sheet as an array-of-arrays ---
  const ws_data: (string | null)[][] = [];
  // Track cell styles: key = "R,C" → style object
  const cellStyles: Record<string, object> = {};
  const merges: XLSX.Range[] = [];

  // Row 0 — Title (merged across all 8 columns)
  const titleText = `Weekly Planner — Week ${weekNumber}, ${year}`;
  ws_data.push([titleText, null, null, null, null, null, null, null]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
  for (let c = 0; c <= 7; c++) cellStyles["0," + c] = calStyles.title;

  // Row 1 — Date range subtitle
  const subtitleText = `${format(weekStart, "d MMM yyyy")} — ${format(weekEnd, "d MMM yyyy")}  |  ${weekLoads.length} load${weekLoads.length !== 1 ? "s" : ""} across ${truckIds.length} truck${truckIds.length !== 1 ? "s" : ""}`;
  ws_data.push([subtitleText, null, null, null, null, null, null, null]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } });
  for (let c = 0; c <= 7; c++) cellStyles["1," + c] = calStyles.subtitle;

  // Row 2 — Blank spacer
  ws_data.push([null, null, null, null, null, null, null, null]);

  // Row 3 — Day headers (col 0 = "Truck", cols 1-7 = days)
  const headerRow: (string | null)[] = ["Truck"];
  weekDays.forEach((day) => {
    const dayLabel = format(day, "EEE d MMM");
    headerRow.push(dayLabel);
  });
  ws_data.push(headerRow);
  const headerRowIdx = 3;
  cellStyles[headerRowIdx + ",0"] = calStyles.truckHeader;
  weekDays.forEach((day, i) => {
    const isToday = isSameDay(day, today);
    cellStyles[headerRowIdx + "," + (i + 1)] = isToday ? calStyles.todayHeader : calStyles.dayHeader;
  });

  // --- Data rows: one row per truck ---
  truckIds.forEach((truckId) => {
    const truckLoads = grouped[truckId];
    const rowIdx = ws_data.length;
    const row: (string | null)[] = [truckId];

    // For each day, collect loads that span this day
    weekDays.forEach((day, dayIdx) => {
      const dayLoads = truckLoads.filter((load) => {
        try {
          const ld = parseISO(load.loading_date);
          const od = parseISO(load.offloading_date);
          return day >= ld && day <= od;
        } catch {
          return false;
        }
      });

      if (dayLoads.length === 0) {
        row.push("");
        const isWeekend = dayIdx >= 5;
        cellStyles[rowIdx + "," + (dayIdx + 1)] = isWeekend ? calStyles.weekendEmpty : calStyles.emptyCell;
      } else {
        // Build cell text for all loads on this day
        const parts = dayLoads.map((load) => {
          const tw = timeWindowLib.parseTimeWindow(load.time_window);
          const origin = getLocationDisplayName(load.origin);
          const dest = getLocationDisplayName(load.destination);
          const status = statusLabels[load.status] || load.status;
          const driver = load.driver?.name || "No driver";
          const cargo = cargoLabels[load.cargo_type] || load.cargo_type;

          const ld = parseISO(load.loading_date);
          const od = parseISO(load.offloading_date);
          const isLoadingDay = isSameDay(day, ld);
          const isOffloadingDay = isSameDay(day, od);

          const lines: string[] = [];
          lines.push(`${load.load_id} [${status}]`);
          lines.push(`${origin} → ${dest}`);
          lines.push(`${cargo} | ${driver}`);

          if (isLoadingDay) {
            const depTime = tw.origin.plannedDeparture || tw.origin.plannedArrival || "";
            lines.push(depTime ? `Loading: ${depTime}` : "Loading");
          }
          if (isOffloadingDay) {
            const arrTime = tw.destination.plannedArrival || tw.destination.plannedDeparture || "";
            lines.push(arrTime ? `Offloading: ${arrTime}` : "Offloading");
          }
          if (!isLoadingDay && !isOffloadingDay) {
            lines.push("In transit");
          }

          // Backload info
          if (tw.backload?.enabled) {
            lines.push(`↩ BL: ${getLocationDisplayName(tw.backload.destination)} (${tw.backload.cargoType || ""})`);
          }

          return lines.join("\n");
        });

        row.push(parts.join("\n\n"));
        // Use the status colour of the first (primary) load
        cellStyles[rowIdx + "," + (dayIdx + 1)] = loadCellStyle(dayLoads[0].status);
      }
    });

    ws_data.push(row);
    cellStyles[rowIdx + ",0"] = calStyles.truckHeader;
  });

  // --- Create workbook ---
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Apply styles
  for (const [key, style] of Object.entries(cellStyles)) {
    const [r, c] = key.split(",").map(Number);
    const addr = XLSX.utils.encode_cell({ r, c });
    if (!ws[addr]) ws[addr] = { v: "", t: "s" };
    ws[addr].s = style;
  }

  // Apply merges
  ws["!merges"] = merges;

  // Column widths: Truck col narrower, day cols wide
  ws["!cols"] = [
    { wch: 14 }, // Truck
    { wch: 30 }, // Mon
    { wch: 30 }, // Tue
    { wch: 30 }, // Wed
    { wch: 30 }, // Thu
    { wch: 30 }, // Fri
    { wch: 30 }, // Sat
    { wch: 30 }, // Sun
  ];

  // Row heights: header row = 30, data rows taller for wrapped text
  const rowHeights: XLSX.RowInfo[] = [];
  rowHeights[0] = { hpt: 30 }; // Title
  rowHeights[1] = { hpt: 20 }; // Subtitle
  rowHeights[headerRowIdx] = { hpt: 35 }; // Day headers
  truckIds.forEach((_, i) => {
    rowHeights[headerRowIdx + 1 + i] = { hpt: 100 };
  });
  ws["!rows"] = rowHeights;

  XLSX.utils.book_append_sheet(wb, ws, `Week ${weekNumber}`);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}