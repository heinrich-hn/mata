import type { Load } from "@/hooks/useTrips";
import * as timeWindowLib from "@/lib/timeWindow";
import { timeToSASTMinutes } from "@/lib/timeWindow";
import { eachWeekOfInterval, format, parseISO, subMonths } from "date-fns";
import XLSX from "xlsx-js-style";
import {
  COMPANY_NAME,
  xlGoodVariance, xlBadVariance, xlNeutralVariance,
  applyHeaderStyle, applyTitleRows,
} from "@/lib/exportStyles";

type TimeRange = "3months" | "6months" | "12months";

/** Compute variance in minutes using SAST-aware conversion */
function calcVar(planned: string | undefined, actual: string | undefined): number | null {
  const pMin = timeToSASTMinutes(planned);
  const aMin = timeToSASTMinutes(actual);
  if (pMin === null || aMin === null) return null;
  return aMin - pMin;
}

function filtered(loads: Load[], timeRange: TimeRange): Load[] {
  const now = new Date();
  const months = timeRange === "3months" ? 3 : timeRange === "6months" ? 6 : 12;
  const start = subMonths(now, months);
  return loads.filter((l) => {
    const d = parseISO(l.loading_date);
    return d >= start && d <= now;
  });
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

export function exportVarianceToExcel(loads: Load[], timeRange: TimeRange = "3months") {
  const data = filtered(loads, timeRange);
  const wb = XLSX.utils.book_new();

  // Sheet 1: Per-load detail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detailRows: any[] = [];
  for (const l of data) {
    const tw = timeWindowLib.parseTimeWindowOrNull(l.time_window);
    if (!tw) continue;
    const oa = calcVar(tw.origin.plannedArrival, tw.origin.actualArrival);
    const od = calcVar(tw.origin.plannedDeparture, tw.origin.actualDeparture);
    const da = calcVar(tw.destination.plannedArrival, tw.destination.actualArrival);
    const dd = calcVar(tw.destination.plannedDeparture, tw.destination.actualDeparture);
    detailRows.push({
      Date: format(parseISO(l.loading_date), "yyyy-MM-dd"),
      Week: format(parseISO(l.loading_date), "I"),
      "Load ID": l.load_id,
      Origin: l.origin,
      Destination: l.destination,
      "Origin Plan Arr": tw.origin.plannedArrival,
      "Origin Act Arr": tw.origin.actualArrival,
      "Var OA (min)": oa,
      "Origin Plan Dep": tw.origin.plannedDeparture,
      "Origin Act Dep": tw.origin.actualDeparture,
      "Var OD (min)": od,
      "Dest Plan Arr": tw.destination.plannedArrival,
      "Dest Act Arr": tw.destination.actualArrival,
      "Var DA (min)": da,
      "Dest Plan Dep": tw.destination.plannedDeparture,
      "Dest Act Dep": tw.destination.actualDeparture,
      "Var DD (min)": dd,
      Status: l.status,
    });
  }
  const wsDetail = XLSX.utils.aoa_to_sheet([
    [`${COMPANY_NAME} — Variance Report (${timeRange})`],
    [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
    [],
  ]);
  XLSX.utils.sheet_add_json(wsDetail, detailRows, { origin: "A4" });
  const detailColCount = Object.keys(detailRows[0] ?? {}).length || 18;
  const detailMerges: XLSX.Range[] = [];
  applyTitleRows(wsDetail, detailColCount, detailMerges);
  wsDetail["!merges"] = detailMerges;
  applyHeaderStyle(wsDetail, 3, detailColCount);

  // Variance columns: 7 (Var OA), 10 (Var OD), 13 (Var DA), 16 (Var DD) — 0-based within data
  const varianceDataCols = [7, 10, 13, 16];
  detailRows.forEach((row, rowIdx) => {
    const excelRow = rowIdx + 4;
    varianceDataCols.forEach((col) => {
      const cellRef = encodeCell(excelRow, col);
      const cell = wsDetail[cellRef];
      if (cell && cell.v !== null && cell.v !== undefined) {
        const style = varianceStyle(typeof cell.v === "number" ? cell.v : null);
        if (style) cell.s = style;
      }
    });
  });

  wsDetail["!cols"] = [
    { wch: 12 }, { wch: 6 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, "Per-Load Variance");

  // Sheet 2: Daily summary
  const byDay = new Map<string, { loads: number; oa: number; oaN: number; od: number; odN: number; da: number; daN: number; dd: number; ddN: number; oLate: number; dLate: number }>();
  for (const l of data) {
    const k = format(parseISO(l.loading_date), "yyyy-MM-dd");
    const tw = timeWindowLib.parseTimeWindowOrNull(l.time_window); if (!tw) continue;
    const oa = calcVar(tw.origin.plannedArrival, tw.origin.actualArrival);
    const od = calcVar(tw.origin.plannedDeparture, tw.origin.actualDeparture);
    const da = calcVar(tw.destination.plannedArrival, tw.destination.actualArrival);
    const dd = calcVar(tw.destination.plannedDeparture, tw.destination.actualDeparture);
    if (!byDay.has(k)) byDay.set(k, { loads: 0, oa: 0, oaN: 0, od: 0, odN: 0, da: 0, daN: 0, dd: 0, ddN: 0, oLate: 0, dLate: 0 });
    const agg = byDay.get(k)!; agg.loads += 1;
    if (oa !== null) { agg.oa += oa; agg.oaN++; if (oa > 15) agg.oLate++; }
    if (od !== null) { agg.od += od; agg.odN++; if (od > 15) agg.oLate++; }
    if (da !== null) { agg.da += da; agg.daN++; if (da > 15) agg.dLate++; }
    if (dd !== null) { agg.dd += dd; agg.ddN++; if (dd > 15) agg.dLate++; }
  }
  const dayRows = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({
    Date: date,
    Loads: v.loads,
    "Avg OA": v.oaN ? Math.round(v.oa / v.oaN) : null,
    "Avg OD": v.odN ? Math.round(v.od / v.odN) : null,
    "Avg DA": v.daN ? Math.round(v.da / v.daN) : null,
    "Avg DD": v.ddN ? Math.round(v.dd / v.ddN) : null,
    "Origin Late Cnt": v.oLate,
    "Dest Late Cnt": v.dLate,
  }));
  const wsDaily = XLSX.utils.aoa_to_sheet([
    [`${COMPANY_NAME} — Daily Summary (${timeRange})`],
    [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
    [],
  ]);
  XLSX.utils.sheet_add_json(wsDaily, dayRows, { origin: "A4" });
  const dailyColCount = Object.keys(dayRows[0] ?? {}).length || 8;
  const dailyMerges: XLSX.Range[] = [];
  applyTitleRows(wsDaily, dailyColCount, dailyMerges);
  wsDaily["!merges"] = dailyMerges;
  applyHeaderStyle(wsDaily, 3, dailyColCount);
  XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Summary");

  // Sheet 3: Weekly summary
  const now = new Date();
  const months = timeRange === "3months" ? 3 : timeRange === "6months" ? 6 : 12;
  const start = subMonths(now, months);
  const weeks = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 });
  const byWeek = new Map<string, { label: string; loads: number; oa: number; oaN: number; od: number; odN: number; da: number; daN: number; dd: number; ddN: number; oLate: number; dLate: number }>();
  for (const w of weeks) {
    const key = format(w, "yyyy-MM-dd");
    byWeek.set(key, { label: format(w, "MMM d"), loads: 0, oa: 0, oaN: 0, od: 0, odN: 0, da: 0, daN: 0, dd: 0, ddN: 0, oLate: 0, dLate: 0 });
  }
  for (const l of data) {
    const d = parseISO(l.loading_date);
    const ws = eachWeekOfInterval({ start: d, end: d }, { weekStartsOn: 1 })[0];
    const key = format(ws, "yyyy-MM-dd");
    if (!byWeek.has(key)) continue;
    const tw = timeWindowLib.parseTimeWindowOrNull(l.time_window); if (!tw) continue;
    const oa = calcVar(tw.origin.plannedArrival, tw.origin.actualArrival);
    const od = calcVar(tw.origin.plannedDeparture, tw.origin.actualDeparture);
    const da = calcVar(tw.destination.plannedArrival, tw.destination.actualArrival);
    const dd = calcVar(tw.destination.plannedDeparture, tw.destination.actualDeparture);
    const agg = byWeek.get(key)!; agg.loads++;
    if (oa !== null) { agg.oa += oa; agg.oaN++; if (oa > 15) agg.oLate++; }
    if (od !== null) { agg.od += od; agg.odN++; if (od > 15) agg.oLate++; }
    if (da !== null) { agg.da += da; agg.daN++; if (da > 15) agg.dLate++; }
    if (dd !== null) { agg.dd += dd; agg.ddN++; if (dd > 15) agg.dLate++; }
  }
  const weekRows = Array.from(byWeek.values()).map((v) => ({
    Week: v.label,
    Loads: v.loads,
    "Avg OA": v.oaN ? Math.round(v.oa / v.oaN) : null,
    "Avg OD": v.odN ? Math.round(v.od / v.odN) : null,
    "Avg DA": v.daN ? Math.round(v.da / v.daN) : null,
    "Avg DD": v.ddN ? Math.round(v.dd / v.ddN) : null,
    "Origin Late Cnt": v.oLate,
    "Dest Late Cnt": v.dLate,
  }));
  const wsWeekly = XLSX.utils.aoa_to_sheet([
    [`${COMPANY_NAME} — Weekly Summary (${timeRange})`],
    [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
    [],
  ]);
  XLSX.utils.sheet_add_json(wsWeekly, weekRows, { origin: "A4" });
  const weeklyColCount = Object.keys(weekRows[0] ?? {}).length || 8;
  const weeklyMerges: XLSX.Range[] = [];
  applyTitleRows(wsWeekly, weeklyColCount, weeklyMerges);
  wsWeekly["!merges"] = weeklyMerges;
  applyHeaderStyle(wsWeekly, 3, weeklyColCount);
  XLSX.utils.book_append_sheet(wb, wsWeekly, "Weekly Summary");

  // Sheet 4: Delay summary by Origin/Destination names
  const originSums: Record<string, number> = {};
  const destSums: Record<string, number> = {};
  for (const l of data) {
    const tw = timeWindowLib.parseTimeWindowOrNull(l.time_window); if (!tw) continue;
    const oa = calcVar(tw.origin.plannedArrival, tw.origin.actualArrival);
    const od = calcVar(tw.origin.plannedDeparture, tw.origin.actualDeparture);
    const da = calcVar(tw.destination.plannedArrival, tw.destination.actualArrival);
    const dd = calcVar(tw.destination.plannedDeparture, tw.destination.actualDeparture);
    const add = (map: Record<string, number>, key: string, v: number | null) => { if (v !== null && v > 15) map[key] = (map[key] || 0) + v; };
    add(originSums, l.origin, oa); add(originSums, l.origin, od);
    add(destSums, l.destination, da); add(destSums, l.destination, dd);
  }
  const originRows = Object.entries(originSums).sort((a, b) => b[1] - a[1]).map(([loc, mins]) => ({ Origin: loc, "Total Delay (min)": mins }));
  const destRows = Object.entries(destSums).sort((a, b) => b[1] - a[1]).map(([loc, mins]) => ({ Destination: loc, "Total Delay (min)": mins }));
  const wsOrigin = XLSX.utils.aoa_to_sheet([["Origin", "Total Delay (min)"]]);
  XLSX.utils.sheet_add_json(wsOrigin, originRows, { origin: "A2", skipHeader: true });
  applyHeaderStyle(wsOrigin, 0, 2);
  const wsDest = XLSX.utils.aoa_to_sheet([["Destination", "Total Delay (min)"]]);
  XLSX.utils.sheet_add_json(wsDest, destRows, { origin: "A2", skipHeader: true });
  applyHeaderStyle(wsDest, 0, 2);
  XLSX.utils.book_append_sheet(wb, wsOrigin, "Delays by Origin");
  XLSX.utils.book_append_sheet(wb, wsDest, "Delays by Destination");

  const filename = `variance-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, filename);
}