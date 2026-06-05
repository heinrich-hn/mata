import type { Load } from "@/hooks/useTrips";
import * as timeWindowLib from "@/lib/timeWindow";
import { timeToSASTMinutes } from "@/lib/timeWindow";
import { format, parseISO } from "date-fns";
import XLSX from "xlsx-js-style";
import {
  COMPANY_NAME,
  xlGoodVariance, xlBadVariance, xlNeutralVariance,
  xlTotalRow,
  applyHeaderStyle, applyTitleRows,
} from "@/lib/exportStyles";
import {
  bucketPunctuality,
  computeTotals,
  fmtPct,
  viewLabel,
  viewSlug,
  type PunctualityView,
} from "@/lib/punctualityPeriods";

/** Compute variance in minutes using SAST-aware conversion */
function minutesVariance(planned?: string, actual?: string): number | null {
  const pMin = timeToSASTMinutes(planned);
  const aMin = timeToSASTMinutes(actual);
  if (pMin === null || aMin === null) return null;
  return aMin - pMin;
}

function encodeCell(r: number, c: number): string {
  let col = "";
  let n = c;
  do { col = String.fromCharCode(65 + (n % 26)) + col; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return `${col}${r + 1}`;
}

function varianceStyle(v: number | null) {
  if (v === null) return undefined;
  if (v === 0) return xlNeutralVariance;
  return v > 0 ? xlBadVariance : xlGoodVariance;
}

function fmt(v: number | null): string | number {
  return v === null ? "" : Number(v.toFixed(1));
}

export function exportPunctualityToExcel(
  loads: Load[],
  timeRange: "3months" | "6months" | "12months",
  view: PunctualityView = "total",
) {
  const wb = XLSX.utils.book_new();
  const totals = computeTotals(loads);

  // Weekly report: trimmed single-sheet export with only the requested columns.
  if (view === "week") {
    const buckets = bucketPunctuality(loads, view);
    const headerRow = [
      "Weekly",
      "Loads",
      "On-Time",
      "Late",
      "% On-Time",
      "% Late",
      "% Late @ Loading",
      "% Late Dep Origin",
      "% Late @ Dest",
      "% Late Dep Dest",
    ];
    const aoa: (string | number)[][] = [
      [`${COMPANY_NAME} — Punctuality ${viewLabel(view)} (${timeRange})`],
      [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
      [],
      headerRow,
    ];
    for (const b of buckets) {
      aoa.push([
        b.label,
        b.count,
        b.onTime,
        b.late,
        fmtPct(b.daOnTime, b.daMeasured),
        fmtPct(b.daLate, b.daMeasured),
        fmtPct(b.oaLate, b.oaMeasured),
        fmtPct(b.odLate, b.odMeasured),
        fmtPct(b.daLate, b.daMeasured),
        fmtPct(b.ddLate, b.ddMeasured),
      ]);
    }
    aoa.push([
      "TOTAL",
      totals.count,
      totals.onTime,
      totals.late,
      fmtPct(totals.daOnTime, totals.daMeasured),
      fmtPct(totals.daLate, totals.daMeasured),
      fmtPct(totals.oaLate, totals.oaMeasured),
      fmtPct(totals.odLate, totals.odMeasured),
      fmtPct(totals.daLate, totals.daMeasured),
      fmtPct(totals.ddLate, totals.ddMeasured),
    ]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applyTitleRows(ws, headerRow.length, []);
    applyHeaderStyle(ws, 3, headerRow.length);
    const totalRowIdx = aoa.length - 1;
    for (let c = 0; c < headerRow.length; c++) {
      const ref = encodeCell(totalRowIdx, c);
      const cell = ws[ref];
      if (cell) cell.s = xlTotalRow;
    }
    ws["!cols"] = [
      { wch: 38 },
      { wch: 8 },
      { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 12 },
      { wch: 18 }, { wch: 18 },
      { wch: 16 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, viewLabel(view));

    const weekLabel = format(new Date(), "yyyyMMdd-HHmm");
    const weekFilename = `Punctuality-${viewSlug(view)}-${timeRange}-${weekLabel}.xlsx`;
    const weekBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const weekBlob = new Blob([weekBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const weekUrl = URL.createObjectURL(weekBlob);
    const weekLink = document.createElement("a");
    weekLink.href = weekUrl;
    weekLink.download = weekFilename;
    document.body.appendChild(weekLink);
    weekLink.click();
    document.body.removeChild(weekLink);
    URL.revokeObjectURL(weekUrl);
    return;
  }

  // -- Summary sheet --
  const summaryAoa: (string | number)[][] = [
    [`${COMPANY_NAME} — Punctuality ${viewLabel(view)} (${timeRange})`],
    [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
    [],
    ["Metric", "Value"],
    ["Total Loads", totals.count],
    ["Avg Origin Arrival Variance (min)", fmt(totals.avgOriginArr)],
    ["Avg Origin Departure Variance (min)", fmt(totals.avgOriginDep)],
    ["Avg Destination Arrival Variance (min)", fmt(totals.avgDestArr)],
    ["Avg Destination Departure Variance (min)", fmt(totals.avgDestDep)],
    ["On-Time Loads (early or ≤15m late)", totals.onTime],
    ["Late Loads (>15m)", totals.late],
    ["% On-Time (overall)", fmtPct(totals.onTime, totals.daMeasured)],
    ["% Late (overall)", fmtPct(totals.late, totals.daMeasured)],
    [],
    ["Loading Point Arrivals", ""],
    ["% On-Time at Loading", fmtPct(totals.oaOnTime, totals.oaMeasured)],
    ["% Late at Loading", fmtPct(totals.oaLate, totals.oaMeasured)],
    ["Destination Arrivals", ""],
    ["% On-Time at Destination", fmtPct(totals.daOnTime, totals.daMeasured)],
    ["% Late at Destination", fmtPct(totals.daLate, totals.daMeasured)],
    ["Origin Departures", ""],
    ["% Early Departures (Origin)", fmtPct(totals.odEarly, totals.odMeasured)],
    ["% Late Departures (Origin)", fmtPct(totals.odLate, totals.odMeasured)],
    ["Destination Departures", ""],
    ["% Early Departures (Destination)", fmtPct(totals.ddEarly, totals.ddMeasured)],
    ["% Late Departures (Destination)", fmtPct(totals.ddLate, totals.ddMeasured)],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
  applyTitleRows(summaryWs, 2, []);
  applyHeaderStyle(summaryWs, 3, 2);
  summaryWs["!cols"] = [{ wch: 42 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // -- Periods sheet (Weekly / Monthly) --
  if (view !== "total") {
    const buckets = bucketPunctuality(loads, view);
    const headerRow = [
      viewLabel(view),
      "Loads",
      "Avg O-Arr (m)",
      "Avg O-Dep (m)",
      "Avg D-Arr (m)",
      "Avg D-Dep (m)",
      "On-Time",
      "Late",
      "% On-Time",
      "% Late",
      "% On-Time @ Loading",
      "% Late @ Loading",
      "% On-Time @ Dest",
      "% Late @ Dest",
      "% Early Dep Origin",
      "% Late Dep Origin",
      "% Early Dep Dest",
      "% Late Dep Dest",
    ];
    const periodAoa: (string | number)[][] = [
      [`${COMPANY_NAME} — Punctuality ${viewLabel(view)} Breakdown`],
      [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
      [],
      headerRow,
    ];
    for (const b of buckets) {
      periodAoa.push([
        b.label,
        b.count,
        fmt(b.avgOriginArr),
        fmt(b.avgOriginDep),
        fmt(b.avgDestArr),
        fmt(b.avgDestDep),
        b.onTime,
        b.late,
        fmtPct(b.daOnTime, b.daMeasured),
        fmtPct(b.daLate, b.daMeasured),
        fmtPct(b.oaOnTime, b.oaMeasured),
        fmtPct(b.oaLate, b.oaMeasured),
        fmtPct(b.daOnTime, b.daMeasured),
        fmtPct(b.daLate, b.daMeasured),
        fmtPct(b.odEarly, b.odMeasured),
        fmtPct(b.odLate, b.odMeasured),
        fmtPct(b.ddEarly, b.ddMeasured),
        fmtPct(b.ddLate, b.ddMeasured),
      ]);
    }
    periodAoa.push([
      "TOTAL",
      totals.count,
      fmt(totals.avgOriginArr),
      fmt(totals.avgOriginDep),
      fmt(totals.avgDestArr),
      fmt(totals.avgDestDep),
      totals.onTime,
      totals.late,
      fmtPct(totals.daOnTime, totals.daMeasured),
      fmtPct(totals.daLate, totals.daMeasured),
      fmtPct(totals.oaOnTime, totals.oaMeasured),
      fmtPct(totals.oaLate, totals.oaMeasured),
      fmtPct(totals.daOnTime, totals.daMeasured),
      fmtPct(totals.daLate, totals.daMeasured),
      fmtPct(totals.odEarly, totals.odMeasured),
      fmtPct(totals.odLate, totals.odMeasured),
      fmtPct(totals.ddEarly, totals.ddMeasured),
      fmtPct(totals.ddLate, totals.ddMeasured),
    ]);
    const periodWs = XLSX.utils.aoa_to_sheet(periodAoa);
    applyTitleRows(periodWs, headerRow.length, []);
    applyHeaderStyle(periodWs, 3, headerRow.length);
    const totalRowIdx = periodAoa.length - 1;
    for (let c = 0; c < headerRow.length; c++) {
      const ref = encodeCell(totalRowIdx, c);
      const cell = periodWs[ref];
      if (cell) cell.s = xlTotalRow;
    }
    periodWs["!cols"] = [
      { wch: 38 },
      { wch: 8 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 12 },
      { wch: 18 }, { wch: 18 },
      { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 18 },
      { wch: 18 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, periodWs, viewLabel(view));
  }
  const detailsRows = loads.map((l) => {
    const t = timeWindowLib.parseTimeWindowOrNull(l.time_window);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {
      "Load ID": l.load_id,
      Vehicle: l.fleet_vehicle?.vehicle_id || "",
      Origin: l.origin,
      Destination: l.destination,
      "Loading Date": format(parseISO(l.loading_date), "yyyy-MM-dd"),
      "Offloading Date": format(parseISO(l.offloading_date), "yyyy-MM-dd"),
      Status: l.status,
    };
    if (t) {
      // Arrivals grouped together (Loading then Offloading)
      row["Loading Planned Arr"] = t.origin.plannedArrival || "";
      row["Loading Actual Arr"] = t.origin.actualArrival || "";
      row["Loading Var Arr (min)"] = minutesVariance(t.origin.plannedArrival, t.origin.actualArrival);
      row["Offloading Planned Arr"] = t.destination.plannedArrival || "";
      row["Offloading Actual Arr"] = t.destination.actualArrival || "";
      row["Offloading Var Arr (min)"] = minutesVariance(t.destination.plannedArrival, t.destination.actualArrival);
      // Departures grouped together (Loading then Offloading)
      row["Loading Planned Dep"] = t.origin.plannedDeparture || "";
      row["Loading Actual Dep"] = t.origin.actualDeparture || "";
      row["Loading Var Dep (min)"] = minutesVariance(t.origin.plannedDeparture, t.origin.actualDeparture);
      row["Offloading Planned Dep"] = t.destination.plannedDeparture || "";
      row["Offloading Actual Dep"] = t.destination.actualDeparture || "";
      row["Offloading Var Dep (min)"] = minutesVariance(t.destination.plannedDeparture, t.destination.actualDeparture);
    }
    return {
      row, variances: t ? {
        oaV: minutesVariance(t.origin.plannedArrival, t.origin.actualArrival),
        odV: minutesVariance(t.origin.plannedDeparture, t.origin.actualDeparture),
        daV: minutesVariance(t.destination.plannedArrival, t.destination.actualArrival),
        ddV: minutesVariance(t.destination.plannedDeparture, t.destination.actualDeparture),
      } : { oaV: null, odV: null, daV: null, ddV: null }
    };
  });

  const titleRow = [`${COMPANY_NAME} — Punctuality Details (${timeRange})`];
  const genRow = [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`];

  const detailsWs = XLSX.utils.aoa_to_sheet([titleRow, genRow, []]);
  XLSX.utils.sheet_add_json(detailsWs, detailsRows.map(d => d.row), { origin: "A4" });

  const colCount = Object.keys(detailsRows[0]?.row ?? {}).length || 19;
  const merges: XLSX.Range[] = [];
  applyTitleRows(detailsWs, colCount, merges);
  detailsWs["!merges"] = merges;
  applyHeaderStyle(detailsWs, 3, colCount);

  // Variance columns: 9, 12, 15, 18 (0-based among data cols).
  // After the regrouping (Arrivals first, then Departures) the variance
  // keys at those columns are: Loading Arr, Offloading Arr, Loading Dep, Offloading Dep.
  const varianceCols = [9, 12, 15, 18];
  const varianceKeys = ["oaV", "daV", "odV", "ddV"] as const;

  detailsRows.forEach((item, rowIdx) => {
    const excelRow = rowIdx + 4;
    varianceKeys.forEach((key, ki) => {
      const col = varianceCols[ki];
      const cellRef = encodeCell(excelRow, col);
      const cell = detailsWs[cellRef];
      if (cell) {
        const style = varianceStyle(item.variances[key]);
        if (style) cell.s = style;
      }
    });
  });

  detailsWs["!cols"] = [
    { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, detailsWs, "Details");

  const nowLabel = format(new Date(), "yyyyMMdd-HHmm");
  const filename = `Punctuality-${viewSlug(view)}-${timeRange}-${nowLabel}.xlsx`;
  // Use XLSX.write + Blob to avoid `fs` being pulled in by XLSX.writeFile in the browser.
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}