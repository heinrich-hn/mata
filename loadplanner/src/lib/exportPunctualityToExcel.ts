import type { Load } from "@/hooks/useTrips";
import * as timeWindowLib from "@/lib/timeWindow";
import { timeToSASTMinutes } from "@/lib/timeWindow";
import { format, parseISO } from "date-fns";
import XLSX from "xlsx-js-style";
import {
  COMPANY_NAME,
  xlGoodVariance, xlBadVariance, xlNeutralVariance,
  applyHeaderStyle, applyTitleRows,
} from "@/lib/exportStyles";

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

export function exportPunctualityToExcel(loads: Load[], timeRange: "3months" | "6months" | "12months") {
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
      row["Origin Planned Arr"] = t.origin.plannedArrival || "";
      row["Origin Actual Arr"] = t.origin.actualArrival || "";
      row["Origin Var Arr (min)"] = minutesVariance(t.origin.plannedArrival, t.origin.actualArrival);
      row["Origin Planned Dep"] = t.origin.plannedDeparture || "";
      row["Origin Actual Dep"] = t.origin.actualDeparture || "";
      row["Origin Var Dep (min)"] = minutesVariance(t.origin.plannedDeparture, t.origin.actualDeparture);
      row["Dest Planned Arr"] = t.destination.plannedArrival || "";
      row["Dest Actual Arr"] = t.destination.actualArrival || "";
      row["Dest Var Arr (min)"] = minutesVariance(t.destination.plannedArrival, t.destination.actualArrival);
      row["Dest Planned Dep"] = t.destination.plannedDeparture || "";
      row["Dest Actual Dep"] = t.destination.actualDeparture || "";
      row["Dest Var Dep (min)"] = minutesVariance(t.destination.plannedDeparture, t.destination.actualDeparture);
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

  const titleRow = [`${COMPANY_NAME} — Punctuality Report (${timeRange})`];
  const genRow = [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`];

  const wb = XLSX.utils.book_new();
  const detailsWs = XLSX.utils.aoa_to_sheet([titleRow, genRow, []]);
  XLSX.utils.sheet_add_json(detailsWs, detailsRows.map(d => d.row), { origin: "A4" });

  const colCount = Object.keys(detailsRows[0]?.row ?? {}).length || 19;
  const merges: XLSX.Range[] = [];
  applyTitleRows(detailsWs, colCount, merges);
  detailsWs["!merges"] = merges;
  applyHeaderStyle(detailsWs, 3, colCount);

  // Variance columns: 9, 12, 15, 18 (0-based among data cols)
  const varianceCols = [9, 12, 15, 18];
  const varianceKeys = ["oaV", "odV", "daV", "ddV"] as const;

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
  XLSX.writeFile(wb, `Punctuality-${timeRange}-${nowLabel}.xlsx`);
}