import type { Load } from "@/hooks/useTrips";
import * as timeWindowLib from "@/lib/timeWindow";
import { computeTimeVariance, getSubcontractorInfo } from "@/lib/timeWindow";
import { getLocationDisplayName } from "@/lib/utils";
import { addDays, differenceInDays, format, getWeek, isSameDay, parseISO, startOfWeek } from "date-fns";
import XLSX from "xlsx-js-style";
import {
  BRAND, COMPANY_NAME,
  xlHeader,
  xlMetricLabel, xlMetricValue,
  xlGoodVariance, xlBadVariance, xlNeutralVariance,
  xlSectionHeader,
  applyHeaderStyle, applyTitleRows,
} from "@/lib/exportStyles";
// `DateChangeEntry` describes a single audit entry recorded when a load's
// loading_date or offloading_date is edited. The history is appended to
// `time_window.dateChangeHistory` and rendered into exports by
// `formatDateChangeHistory` below.
import type { DateChangeEntry } from "@/types/Trips";

// Format a load's date-change history into a single human-readable cell.
function formatDateChangeHistory(history: DateChangeEntry[] | undefined): string {
  if (!history || history.length === 0) return "";
  return history
    .map((e) => {
      const fieldLabel = e.field === "loading_date" ? "Loading" : "Offloading";
      let when = "";
      try {
        when = format(parseISO(e.changedAt), "dd/MM/yyyy HH:mm");
      } catch {
        when = e.changedAt;
      }
      return `[${when}] ${fieldLabel}: ${e.oldValue} → ${e.newValue} — ${e.reason}`;
    })
    .join("\n");
}

// Status labels
const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  "in-transit": "In Transit",
  pending: "Pending",
  delivered: "Delivered",
  "at-loading": "At Loading Point",
  "at-offloading": "At Offloading Point",
};

/**
 * Derive a more accurate display status from the load's actual geofence
 * timestamps. A load with an Origin actual arrival time can no longer be
 * "Scheduled" — it is at least at the loading point. Likewise, once the
 * truck has departed loading we treat it as in-transit even if the DB
 * status hasn't been promoted yet.
 */
function getEffectiveStatus(load: Load): string {
  if (load.status === "delivered" || load.actual_offloading_departure) {
    return "delivered";
  }
  if (load.actual_offloading_arrival) return "at-offloading";
  if (load.status === "in-transit" || load.actual_loading_departure) {
    return "in-transit";
  }
  if (load.actual_loading_arrival) return "at-loading";
  return load.status;
}

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

// Row-level highlight fills based on load status.
//   Delivered          → soft green
//   In Transit         → soft yellow
//   At Loading Point   → soft orange
//   At Offloading Point→ soft purple/violet
const deliveredRowFill = {
  fill: { fgColor: { rgb: BRAND.successBg } },
};
const inTransitRowFill = {
  fill: { fgColor: { rgb: "FFEB9C" } }, // soft yellow (Excel "neutral" tone)
};
const atLoadingRowFill = {
  fill: { fgColor: { rgb: "FCD9B6" } }, // soft orange
};
const atOffloadingRowFill = {
  fill: { fgColor: { rgb: "E2D0F8" } }, // soft violet
};

function rowFillForStatus(status: string) {
  if (status === "delivered") return deliveredRowFill;
  if (status === "in-transit" || status === "in_transit") return inTransitRowFill;
  if (status === "at-loading") return atLoadingRowFill;
  if (status === "at-offloading") return atOffloadingRowFill;
  return undefined;
}

// Override the title row (row 1) with a more prominent style: larger font,
// centered, taller row height. The base navy fill from `applyTitleRows`
// remains via the same color palette.
const xlTitleProminent = {
  font: { bold: true, sz: 22, name: "Calibri", color: { rgb: BRAND.white } },
  fill: { fgColor: { rgb: BRAND.navy } },
  alignment: {
    horizontal: "center" as const,
    vertical: "center" as const,
  },
  border: {
    bottom: { style: "medium" as const, color: { rgb: BRAND.accent } },
  },
};

function emphasizeTitleRow(ws: XLSX.WorkSheet, colCount: number) {
  for (let c = 0; c < colCount - 1; c++) {
    const ref = XLSX.utils.encode_cell({ r: 1, c });
    if (!ws[ref]) ws[ref] = { v: "", t: "s" };
    ws[ref].s = xlTitleProminent;
  }
  // Increase the title row height for visual prominence
  const rows = (ws["!rows"] as XLSX.RowInfo[] | undefined) ?? [];
  rows[1] = { hpt: 36 };
  ws["!rows"] = rows;
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

  // Transform loads data for Excel — keep the source load so we can sort
  // and group by loading date when writing the sheet below.
  const excelData = loads.map((load) => {
    const timeWindow = timeWindowLib.parseTimeWindow(load.time_window);
    const subcontractor = getSubcontractorInfo(load);

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
      load,
      effectiveStatus: getEffectiveStatus(load),
      row: {
        "Load ID": load.load_id,
        Status: statusLabels[getEffectiveStatus(load)] || load.status,
        Origin: load.origin,
        Destination: load.destination,
        Vehicle: load.fleet_vehicle?.vehicle_id || "",
        "Cargo Type": cargoLabels[load.cargo_type] || load.cargo_type,
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
        "Backload Destination": timeWindow.backload?.destination || "",
        "Backload Offloading Date": timeWindow.backload?.offloadingDate || "",
        "Backload Quantities": backloadQuantities,
        "Variance Reason": timeWindow.varianceReason || "",
        "Subcontracted": subcontractor ? "Yes" : "No",
        "Subcontractor": subcontractor?.name || "",
        "Subcontractor Cargo": timeWindow.subcontractor?.cargoDescription || "",
      },
      variances: { oArrVar, oDepVar, dArrVar, dDepVar },
    };
  });

  // Variance column indices (0-based within the data columns)
  // Columns: 0-Load ID, 1-Status, 2-Origin, 3-Destination, 4-Vehicle,
  //          5-Cargo Type, 6-Loading Date, 7-Offloading Date,
  //          10-Origin Arrival Variance, 13-Origin Departure Variance,
  //          16-Dest Arrival Variance, 19-Dest Departure Variance
  const varianceCols = [10, 13, 16, 19];
  const varianceKeys = ["oArrVar", "oDepVar", "dArrVar", "dDepVar"] as const;

  // Week info for title
  const titleRow = [
    `${COMPANY_NAME} — Load Planning — Week ${weekNum}, ${yr}`,
  ];

  // Create workbook and worksheet with title row
  const workbook = XLSX.utils.book_new();

  // Create worksheet with title row only (Generated timestamp removed)
  const worksheet = XLSX.utils.aoa_to_sheet([titleRow, [], []]);

  // Sort by loading date so date-grouped sections appear chronologically
  excelData.sort((a, b) => a.load.loading_date.localeCompare(b.load.loading_date));

  // Write column headers at row index 3 (0-based)
  const columnKeys = Object.keys(excelData[0]?.row ?? {}) as (keyof typeof excelData[0]["row"])[];
  XLSX.utils.sheet_add_aoa(worksheet, [columnKeys as string[]], { origin: { r: 3, c: 0 } });

  // Apply professional title/subtitle/header styles
  const colCount = columnKeys.length || 32;
  const mergeRanges: XLSX.Range[] = [];
  applyTitleRows(worksheet, colCount, mergeRanges);
  // Make the main title row more prominent: larger font, centered, taller row
  emphasizeTitleRow(worksheet, colCount);
  applyHeaderStyle(worksheet, 3, colCount);

  // Write data rows, inserting a date separator row at the start of each new
  // loading-date group. The separator is merged across all columns and styled
  // with the section-header style for clear visual grouping.
  let currentRow = 4; // 0-based; row 3 is the column header row
  let prevDateKey: string | null = null;
  excelData.forEach((item) => {
    const dateKey = item.load.loading_date; // ISO yyyy-MM-dd
    if (dateKey !== prevDateKey) {
      let label = dateKey;
      try {
        label = format(parseISO(dateKey), "EEEE dd/MM/yyyy");
      } catch {
        // Fall back to raw key if it isn't a valid ISO date
      }
      XLSX.utils.sheet_add_aoa(worksheet, [[label]], {
        origin: { r: currentRow, c: 0 },
      });
      const headerCellRef = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
      if (worksheet[headerCellRef]) {
        worksheet[headerCellRef].s = xlSectionHeader;
      }
      mergeRanges.push({
        s: { r: currentRow, c: 0 },
        e: { r: currentRow, c: colCount - 1 },
      });
      currentRow += 1;
      prevDateKey = dateKey;
    }

    // Write the load row
    const values = columnKeys.map((k) => (item.row as Record<string, string | number | undefined>)[k as string]);
    XLSX.utils.sheet_add_aoa(worksheet, [values], {
      origin: { r: currentRow, c: 0 },
    });

    // Apply status-based row fill (delivered → green, in-transit → yellow)
    const rowFill = rowFillForStatus(item.effectiveStatus);
    if (rowFill) {
      for (let c = 0; c < colCount; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: currentRow, c });
        if (!worksheet[cellRef]) worksheet[cellRef] = { v: "", t: "s" };
        worksheet[cellRef].s = { ...rowFill };
      }
    }

    // Apply conditional fill to variance cells on this exact row
    varianceKeys.forEach((key, ki) => {
      const col = varianceCols[ki];
      const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
      const cell = worksheet[cellRef];
      if (cell) {
        const style = varianceStyle(item.variances[key].diffMin);
        if (style) cell.s = style;
      }
    });

    currentRow += 1;
  });

  worksheet["!merges"] = mergeRanges;

  // Extend the worksheet range to cover everything we wrote
  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(currentRow - 1, 3), c: colCount - 1 },
  });

  // Set column widths
  const columnWidths = [
    { wch: 15 }, // Load ID
    { wch: 12 }, // Status
    { wch: 20 }, // Origin
    { wch: 20 }, // Destination
    { wch: 12 }, // Vehicle
    { wch: 18 }, // Cargo Type
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
    { wch: 20 }, // Backload Destination
    { wch: 18 }, // Backload Offloading Date
    { wch: 25 }, // Backload Quantities
    { wch: 40 }, // Variance Reason
    { wch: 50 }, // Date Change Reasons
    { wch: 14 }, // Subcontracted
    { wch: 24 }, // Subcontractor
    { wch: 28 }, // Subcontractor Cargo
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

  // Count subcontracted loads
  const subcontractedLoads = loads.filter((l) => getSubcontractorInfo(l) !== null).length;

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
    {
      Metric: "Subcontracted Loads",
      Value: subcontractedLoads,
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
    const subcontractor = getSubcontractorInfo(load);
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
      load,
      row: {
        "Load ID": load.load_id,
        Origin: load.origin,
        Destination: load.destination,
        Vehicle: load.fleet_vehicle?.vehicle_id || "",
        "Cargo Type": cargoLabels[load.cargo_type] || load.cargo_type,
        "Loading Date": format(parseISO(load.loading_date), "dd/MM/yyyy"),
        "Offloading Date": format(parseISO(load.offloading_date), "dd/MM/yyyy"),
        Subcontractor: subcontractor?.name || "",
        "Backload Destination": timeWindow.backload?.destination || "",
        "Backload Offloading Date": timeWindow.backload?.offloadingDate || "",
        "Backload Quantities": backloadQuantities,
        "Date Change Reasons": formatDateChangeHistory(timeWindow.dateChangeHistory),
      },
    };
  });

  // Week info for title
  const titleRow = [
    `${COMPANY_NAME} — Load Planning (Simplified) — Week ${weekNum}, ${yr}`,
  ];

  // Create workbook and worksheet with title row
  const workbook = XLSX.utils.book_new();

  // Create worksheet with title row only (Generated timestamp removed)
  const worksheet = XLSX.utils.aoa_to_sheet([titleRow, [], []]);

  // Sort by loading date so date-grouped sections appear chronologically
  excelData.sort((a, b) => a.load.loading_date.localeCompare(b.load.loading_date));

  // Write column headers at row index 3 (0-based)
  const simpColumnKeys = Object.keys(excelData[0]?.row ?? {}) as string[];
  XLSX.utils.sheet_add_aoa(worksheet, [simpColumnKeys], { origin: { r: 3, c: 0 } });

  // Apply professional title/subtitle/header styles
  const simpColCount = simpColumnKeys.length || 14;
  const simpMerges: XLSX.Range[] = [];
  applyTitleRows(worksheet, simpColCount, simpMerges);
  emphasizeTitleRow(worksheet, simpColCount);
  applyHeaderStyle(worksheet, 3, simpColCount);

  // Write data rows, inserting a date separator row at the start of each new
  // loading-date group.
  let simpRow = 4;
  let simpPrevDateKey: string | null = null;
  excelData.forEach((item) => {
    const dateKey = item.load.loading_date;
    if (dateKey !== simpPrevDateKey) {
      let label = dateKey;
      try {
        label = format(parseISO(dateKey), "EEEE dd/MM/yyyy");
      } catch {
        // Fall back to raw key if it isn't a valid ISO date
      }
      XLSX.utils.sheet_add_aoa(worksheet, [[label]], {
        origin: { r: simpRow, c: 0 },
      });
      const headerCellRef = XLSX.utils.encode_cell({ r: simpRow, c: 0 });
      if (worksheet[headerCellRef]) {
        worksheet[headerCellRef].s = xlSectionHeader;
      }
      simpMerges.push({
        s: { r: simpRow, c: 0 },
        e: { r: simpRow, c: simpColCount - 1 },
      });
      simpRow += 1;
      simpPrevDateKey = dateKey;
    }

    const values = simpColumnKeys.map((k) => (item.row as Record<string, string | number>)[k]);
    XLSX.utils.sheet_add_aoa(worksheet, [values], {
      origin: { r: simpRow, c: 0 },
    });

    // Apply status-based row fill (delivered → green, in-transit → yellow)
    const rowFill = rowFillForStatus(getEffectiveStatus(item.load));
    if (rowFill) {
      for (let c = 0; c < simpColCount; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: simpRow, c });
        if (!worksheet[cellRef]) worksheet[cellRef] = { v: "", t: "s" };
        worksheet[cellRef].s = { ...rowFill };
      }
    }

    simpRow += 1;
  });

  worksheet["!merges"] = simpMerges;
  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(simpRow - 1, 3), c: simpColCount - 1 },
  });

  // Set column widths for simplified version
  const columnWidths = [
    { wch: 15 }, // Load ID
    { wch: 20 }, // Origin
    { wch: 20 }, // Destination
    { wch: 12 }, // Vehicle
    { wch: 18 }, // Cargo Type
    { wch: 12 }, // Loading Date
    { wch: 14 }, // Offloading Date
    { wch: 24 }, // Subcontractor
    { wch: 20 }, // Backload Destination
    { wch: 18 }, // Backload Offloading Date
    { wch: 25 }, // Backload Quantities
    { wch: 50 }, // Date Change Reasons
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
// Unverified / Missing Times export
// ---------------------------------------------------------------------------
// Lists every load that has at least one actual time that is either missing
// (no value recorded) or unverified (recorded automatically by geofence but
// not yet confirmed by an operator). Each of the four actual time slots gets
// its own value column plus a status column ("Missing" / "Unverified" /
// "Verified") so reviewers can quickly see what still needs attention.

type TimeSlotKey =
  | "actual_loading_arrival"
  | "actual_loading_departure"
  | "actual_offloading_arrival"
  | "actual_offloading_departure";

const TIME_SLOTS: Array<{ key: TimeSlotKey; verifiedKey: `${TimeSlotKey}_verified`; sourceKey: `${TimeSlotKey}_source`; label: string }> = [
  { key: "actual_loading_arrival", verifiedKey: "actual_loading_arrival_verified", sourceKey: "actual_loading_arrival_source", label: "Loading Arrival" },
  { key: "actual_loading_departure", verifiedKey: "actual_loading_departure_verified", sourceKey: "actual_loading_departure_source", label: "Loading Departure" },
  { key: "actual_offloading_arrival", verifiedKey: "actual_offloading_arrival_verified", sourceKey: "actual_offloading_arrival_source", label: "Offloading Arrival" },
  { key: "actual_offloading_departure", verifiedKey: "actual_offloading_departure_verified", sourceKey: "actual_offloading_departure_source", label: "Offloading Departure" },
];

function getTimeSlotStatus(load: Load, slot: typeof TIME_SLOTS[number]): "Missing" | "Unverified" | "Verified" {
  const value = load[slot.key];
  if (!value) return "Missing";
  return load[slot.verifiedKey] ? "Verified" : "Unverified";
}

function formatActualTime(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm");
  } catch {
    return value;
  }
}

export function exportLoadsWithUnverifiedTimesToExcel(
  loads: Load[],
  options: ExportOptions = {},
): void {
  const weekNum = options.weekNumber ?? getWeek(new Date(), { weekStartsOn: 1 });
  const yr = options.year ?? new Date().getFullYear();
  const {
    filename = `loads-unverified-times-week-${weekNum}-${yr}`,
    sheetName = `Unverified Times W${weekNum}`,
  } = options;

  // Only loads with at least one missing or unverified actual time
  const flagged = loads.filter((load) =>
    TIME_SLOTS.some((slot) => getTimeSlotStatus(load, slot) !== "Verified"),
  );

  const rows = flagged.map((load) => {
    const slotResults = TIME_SLOTS.map((slot) => ({
      slot,
      status: getTimeSlotStatus(load, slot),
      value: formatActualTime(load[slot.key] as string | null | undefined),
      source: (load[slot.sourceKey] as string | undefined) ?? "",
    }));

    const issues = slotResults.filter((r) => r.status !== "Verified");

    return {
      load,
      row: {
        "Load ID": load.load_id,
        Status: statusLabels[getEffectiveStatus(load)] || load.status,
        Origin: load.origin,
        Destination: load.destination,
        Vehicle: load.fleet_vehicle?.vehicle_id || "",
        "Loading Date": format(parseISO(load.loading_date), "dd/MM/yyyy"),
        "Offloading Date": format(parseISO(load.offloading_date), "dd/MM/yyyy"),
        "Loading Arrival": slotResults[0].value,
        "Loading Arrival Status": slotResults[0].status,
        "Loading Arrival Source": slotResults[0].source,
        "Loading Departure": slotResults[1].value,
        "Loading Departure Status": slotResults[1].status,
        "Loading Departure Source": slotResults[1].source,
        "Offloading Arrival": slotResults[2].value,
        "Offloading Arrival Status": slotResults[2].status,
        "Offloading Arrival Source": slotResults[2].source,
        "Offloading Departure": slotResults[3].value,
        "Offloading Departure Status": slotResults[3].status,
        "Offloading Departure Source": slotResults[3].source,
        "Issues": issues.length,
        "Missing / Unverified": issues
          .map((r) => `${r.slot.label}: ${r.status}`)
          .join("; "),
      },
    };
  });

  // Sort by loading date ascending
  rows.sort((a, b) => a.load.loading_date.localeCompare(b.load.loading_date));

  const titleRow = [`${COMPANY_NAME} — Unverified / Missing Times — Week ${weekNum}, ${yr}`];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([titleRow, [], []]);

  if (rows.length === 0) {
    XLSX.utils.sheet_add_aoa(worksheet, [["No loads with missing or unverified times for this period."]], {
      origin: { r: 3, c: 0 },
    });
    applyTitleRows(worksheet, 1, []);
    emphasizeTitleRow(worksheet, 1);
    worksheet["!cols"] = [{ wch: 80 }];
    worksheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 3, c: 0 } });
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return;
  }

  const columnKeys = Object.keys(rows[0].row) as string[];
  const colCount = columnKeys.length;
  const merges: XLSX.Range[] = [];

  XLSX.utils.sheet_add_aoa(worksheet, [columnKeys], { origin: { r: 3, c: 0 } });
  applyTitleRows(worksheet, colCount, merges);
  emphasizeTitleRow(worksheet, colCount);
  applyHeaderStyle(worksheet, 3, colCount);

  const statusColIndices = columnKeys
    .map((k, i) => (k.endsWith("Status") ? i : -1))
    .filter((i) => i >= 0);

  let r = 4;
  rows.forEach((item) => {
    const values = columnKeys.map((k) => (item.row as Record<string, string | number>)[k]);
    XLSX.utils.sheet_add_aoa(worksheet, [values], { origin: { r, c: 0 } });

    // Tint each *Status* cell based on its value
    statusColIndices.forEach((c) => {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[cellRef];
      if (!cell) return;
      const v = String(cell.v ?? "");
      if (v === "Missing") cell.s = xlBadVariance;
      else if (v === "Unverified") cell.s = xlNeutralVariance;
      else if (v === "Verified") cell.s = xlGoodVariance;
    });

    r += 1;
  });

  worksheet["!merges"] = merges;
  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(r - 1, 3), c: colCount - 1 },
  });

  worksheet["!cols"] = [
    { wch: 15 }, // Load ID
    { wch: 14 }, // Status
    { wch: 20 }, // Origin
    { wch: 20 }, // Destination
    { wch: 12 }, // Vehicle
    { wch: 12 }, // Loading Date
    { wch: 14 }, // Offloading Date
    { wch: 18 }, { wch: 12 }, { wch: 10 }, // Loading Arrival x3
    { wch: 18 }, { wch: 12 }, { wch: 10 }, // Loading Departure x3
    { wch: 18 }, { wch: 12 }, { wch: 10 }, // Offloading Arrival x3
    { wch: 18 }, { wch: 12 }, { wch: 10 }, // Offloading Departure x3
    { wch: 8 },  // Issues count
    { wch: 60 }, // Missing / Unverified summary
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
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

// ---------------------------------------------------------------------------
// Daily on-time export — same layout as the weekly Excel, but for a single
// day, and with the four Planned/Actual/Variance triples collapsed into four
// per-leg "On Time" Yes/No/N/A columns.
// ---------------------------------------------------------------------------

type LegOnTime = { label: "Yes" | "No" | "N/A"; isOnTime: boolean | null };

/**
 * On-time status for a single leg. Returns "N/A" when no actual time has been
 * recorded yet (i.e. not yet confirmed through location monitoring / tracking),
 * "No" if the actual time is more than 15 minutes late, otherwise "Yes".
 */
function computeLegOnTime(
  planned: string | null | undefined,
  actual: string | null | undefined,
): LegOnTime {
  const v = computeTimeVariance(planned, actual);
  if (v.diffMin === null) return { label: "N/A", isOnTime: null };
  return v.diffMin > 15 ? { label: "No", isOnTime: false } : { label: "Yes", isOnTime: true };
}

/**
 * Per-leg on-time labels for a load, in column order:
 * [loading/depot arrival, origin departure, destination/offload arrival,
 * destination/offload departure].
 */
function computeLegOnTimeLabels(load: Load): {
  arrLoading: LegOnTime;
  depOrigin: LegOnTime;
  arrDest: LegOnTime;
  depDest: LegOnTime;
} {
  const tw = timeWindowLib.parseTimeWindow(load.time_window);
  return {
    arrLoading: computeLegOnTime(
      tw.origin.plannedArrival,
      load.actual_loading_arrival || tw.origin.actualArrival,
    ),
    depOrigin: computeLegOnTime(
      tw.origin.plannedDeparture,
      load.actual_loading_departure || tw.origin.actualDeparture,
    ),
    arrDest: computeLegOnTime(
      tw.destination.plannedArrival,
      load.actual_offloading_arrival || tw.destination.actualArrival,
    ),
    depDest: computeLegOnTime(
      tw.destination.plannedDeparture,
      load.actual_offloading_departure || tw.destination.actualDeparture,
    ),
  };
}

interface DayOnTimeOptions {
  filename?: string;
  sheetName?: string;
}

export function exportLoadsForDayOnTimeExcel(
  loads: Load[],
  dayIso: string,
  options: DayOnTimeOptions = {},
): void {
  const dayLabel = (() => {
    try { return format(parseISO(dayIso), "EEEE dd/MM/yyyy"); } catch { return dayIso; }
  })();
  const {
    filename = `daily-load-plan-on-time-${dayIso}`,
    sheetName = format(parseISO(dayIso), "dd MMM yyyy"),
  } = options;

  const excelData = loads.map((load) => {
    const timeWindow = timeWindowLib.parseTimeWindow(load.time_window);
    const subcontractor = getSubcontractorInfo(load);

    let backloadQuantities = "";
    if (timeWindow.backload?.quantities) {
      const { bins, crates, pallets } = timeWindow.backload.quantities;
      const parts: string[] = [];
      if (bins > 0) parts.push(`${bins} bins`);
      if (crates > 0) parts.push(`${crates} crates`);
      if (pallets > 0) parts.push(`${pallets} pallets`);
      backloadQuantities = parts.join(", ");
    }

    const legs = computeLegOnTimeLabels(load);

    return {
      load,
      effectiveStatus: getEffectiveStatus(load),
      legs,
      row: {
        "Load ID": load.load_id,
        Status: statusLabels[getEffectiveStatus(load)] || load.status,
        Origin: load.origin,
        Destination: load.destination,
        Vehicle: load.fleet_vehicle?.vehicle_id || "",
        Driver: load.driver?.name || "",
        "Cargo Type": cargoLabels[load.cargo_type] || load.cargo_type,
        "Loading Date": format(parseISO(load.loading_date), "dd/MM/yyyy"),
        "Offloading Date": format(parseISO(load.offloading_date), "dd/MM/yyyy"),
        "Arrived Loading On Time": legs.arrLoading.label,
        "Departed Origin On Time": legs.depOrigin.label,
        "Arrived Dest/Offload On Time": legs.arrDest.label,
        "Departed Dest/Offload On Time": legs.depDest.label,
        "Backload Destination": timeWindow.backload?.destination || "",
        "Backload Offloading Date": timeWindow.backload?.offloadingDate || "",
        "Backload Quantities": backloadQuantities,
        "Variance Reason": timeWindow.varianceReason || "",
        "Subcontracted": subcontractor ? "Yes" : "No",
        "Subcontractor": subcontractor?.name || "",
        "Subcontractor Cargo": timeWindow.subcontractor?.cargoDescription || "",
      },
    };
  });

  // Indices of the four on-time columns within the row above
  const onTimeCols = [9, 10, 11, 12];

  const titleRow = [
    `${COMPANY_NAME} — Daily Load Plan (On-Time) — ${dayLabel}`,
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([titleRow, [], []]);

  excelData.sort((a, b) =>
    (a.load.fleet_vehicle?.vehicle_id || "zzz").localeCompare(
      b.load.fleet_vehicle?.vehicle_id || "zzz",
      undefined,
      { numeric: true },
    ) || a.load.load_id.localeCompare(b.load.load_id),
  );

  const columnKeys = Object.keys(excelData[0]?.row ?? {}) as (keyof typeof excelData[0]["row"])[];
  XLSX.utils.sheet_add_aoa(worksheet, [columnKeys as string[]], { origin: { r: 3, c: 0 } });

  const colCount = columnKeys.length || 17;
  const mergeRanges: XLSX.Range[] = [];
  applyTitleRows(worksheet, colCount, mergeRanges);
  emphasizeTitleRow(worksheet, colCount);
  applyHeaderStyle(worksheet, 3, colCount);

  let currentRow = 4;
  excelData.forEach((item) => {
    const values = columnKeys.map((k) => (item.row as Record<string, string | number | undefined>)[k as string]);
    XLSX.utils.sheet_add_aoa(worksheet, [values], { origin: { r: currentRow, c: 0 } });

    const rowFill = rowFillForStatus(item.effectiveStatus);
    if (rowFill) {
      for (let c = 0; c < colCount; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: currentRow, c });
        if (!worksheet[cellRef]) worksheet[cellRef] = { v: "", t: "s" };
        worksheet[cellRef].s = { ...rowFill };
      }
    }

    // Colour each on-time cell: green for Yes, red for No, neutral for N/A
    const legCells = [item.legs.arrLoading, item.legs.depOrigin, item.legs.arrDest, item.legs.depDest];
    onTimeCols.forEach((col, i) => {
      const ref = XLSX.utils.encode_cell({ r: currentRow, c: col });
      const cell = worksheet[ref];
      if (cell) {
        const leg = legCells[i];
        if (leg.isOnTime === true) cell.s = greenFill;
        else if (leg.isOnTime === false) cell.s = redFill;
        else cell.s = onTimeFill;
      }
    });

    currentRow += 1;
  });

  worksheet["!merges"] = mergeRanges;
  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(currentRow - 1, 3), c: colCount - 1 },
  });

  worksheet["!cols"] = [
    { wch: 15 }, // Load ID
    { wch: 14 }, // Status
    { wch: 22 }, // Origin
    { wch: 22 }, // Destination
    { wch: 12 }, // Vehicle
    { wch: 22 }, // Driver
    { wch: 18 }, // Cargo Type
    { wch: 12 }, // Loading Date
    { wch: 14 }, // Offloading Date
    { wch: 16 }, // Arrived Loading On Time
    { wch: 16 }, // Departed Origin On Time
    { wch: 18 }, // Arrived Dest/Offload On Time
    { wch: 18 }, // Departed Dest/Offload On Time
    { wch: 22 }, // Backload Destination
    { wch: 18 }, // Backload Offloading Date
    { wch: 24 }, // Backload Quantities
    { wch: 32 }, // Variance Reason
    { wch: 14 }, // Subcontracted
    { wch: 24 }, // Subcontractor
    { wch: 28 }, // Subcontractor Cargo
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}