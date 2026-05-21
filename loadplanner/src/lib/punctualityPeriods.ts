import type { Load } from "@/hooks/useTrips";
import * as timeWindowLib from "@/lib/timeWindow";
import { timeToSASTMinutes } from "@/lib/timeWindow";
import {
    endOfWeek,
    format,
    getISOWeek,
    parseISO,
    startOfMonth,
    startOfWeek,
} from "date-fns";

export type PunctualityView = "total" | "week" | "month";

export interface PunctualityPeriodBucket {
    key: string;
    label: string;
    loads: Load[];
    count: number;
    avgOriginArr: number | null;
    avgOriginDep: number | null;
    avgDestArr: number | null;
    avgDestDep: number | null;
    onTime: number;
    late: number;
    early: number;
    // Breakdown counts (denominator is the matching *Measured field).
    // Arrivals: on-time = variance ≤ 15m (early counts as on-time), late = > 15m.
    // Departures: early = < -15m, late = > 15m.
    oaOnTime: number; oaLate: number; oaMeasured: number;
    daOnTime: number; daLate: number; daMeasured: number;
    odEarly: number; odLate: number; odMeasured: number;
    ddEarly: number; ddLate: number; ddMeasured: number;
}

function variance(planned?: string | null, actual?: string | null): number | null {
    const p = timeToSASTMinutes(planned ?? undefined);
    const a = timeToSASTMinutes(actual ?? undefined);
    if (p === null || a === null) return null;
    return a - p;
}

function avg(values: Array<number | null>): number | null {
    const filtered = values.filter((v): v is number => v !== null);
    if (filtered.length === 0) return null;
    return filtered.reduce((s, v) => s + v, 0) / filtered.length;
}

function safeParse(d?: string | null): Date | null {
    if (!d) return null;
    try {
        const dt = parseISO(d);
        if (Number.isNaN(dt.getTime())) return null;
        return dt;
    } catch {
        return null;
    }
}

export function viewLabel(view: PunctualityView): string {
    if (view === "week") return "Weekly";
    if (view === "month") return "Monthly";
    return "Total Summary";
}

export function viewSlug(view: PunctualityView): string {
    if (view === "week") return "Weekly";
    if (view === "month") return "Monthly";
    return "Total";
}

export function bucketPunctuality(
    loads: Load[],
    view: PunctualityView,
): PunctualityPeriodBucket[] {
    if (view === "total") return [];

    const groups = new Map<string, { label: string; loads: Load[] }>();
    for (const l of loads) {
        const d = safeParse(l.loading_date);
        if (!d) continue;
        let key: string;
        let label: string;
        if (view === "week") {
            const start = startOfWeek(d, { weekStartsOn: 1 });
            const end = endOfWeek(d, { weekStartsOn: 1 });
            const isoWeek = getISOWeek(d);
            key = format(start, "yyyy-'W'") + String(isoWeek).padStart(2, "0");
            label = `Week ${isoWeek} (${format(start, "dd MMM")}–${format(end, "dd MMM yyyy")})`;
        } else {
            const start = startOfMonth(d);
            key = format(start, "yyyy-MM");
            label = format(start, "MMMM yyyy");
        }
        if (!groups.has(key)) groups.set(key, { label, loads: [] });
        groups.get(key)!.loads.push(l);
    }

    const buckets: PunctualityPeriodBucket[] = [];
    for (const [key, { label, loads: bLoads }] of groups) {
        const oa: Array<number | null> = [];
        const od: Array<number | null> = [];
        const da: Array<number | null> = [];
        const dd: Array<number | null> = [];
        let onTime = 0;
        let late = 0;
        const early = 0;
        let oaOnTime = 0, oaLate = 0, oaMeasured = 0;
        let daOnTime = 0, daLate = 0, daMeasured = 0;
        let odEarly = 0, odLate = 0, odMeasured = 0;
        let ddEarly = 0, ddLate = 0, ddMeasured = 0;
        for (const l of bLoads) {
            const tw = timeWindowLib.parseTimeWindowOrNull(l.time_window);
            if (!tw) continue;
            const oaV = variance(tw.origin.plannedArrival, tw.origin.actualArrival);
            const odV = variance(tw.origin.plannedDeparture, tw.origin.actualDeparture);
            const daV = variance(tw.destination.plannedArrival, tw.destination.actualArrival);
            const ddV = variance(tw.destination.plannedDeparture, tw.destination.actualDeparture);
            oa.push(oaV);
            od.push(odV);
            da.push(daV);
            dd.push(ddV);
            // Classify by destination arrival variance (primary punctuality KPI).
            // Early arrivals are treated as on-time per business rule.
            if (daV !== null) {
                if (daV > 15) late++;
                else onTime++;
            }
            if (oaV !== null) { oaMeasured++; if (oaV > 15) oaLate++; else oaOnTime++; }
            if (daV !== null) { daMeasured++; if (daV > 15) daLate++; else daOnTime++; }
            if (odV !== null) { odMeasured++; if (odV < -15) odEarly++; else if (odV > 15) odLate++; }
            if (ddV !== null) { ddMeasured++; if (ddV < -15) ddEarly++; else if (ddV > 15) ddLate++; }
        }
        buckets.push({
            key,
            label,
            loads: bLoads,
            count: bLoads.length,
            avgOriginArr: avg(oa),
            avgOriginDep: avg(od),
            avgDestArr: avg(da),
            avgDestDep: avg(dd),
            onTime,
            late,
            early,
            oaOnTime, oaLate, oaMeasured,
            daOnTime, daLate, daMeasured,
            odEarly, odLate, odMeasured,
            ddEarly, ddLate, ddMeasured,
        });
    }

    buckets.sort((a, b) => a.key.localeCompare(b.key));
    return buckets;
}

export interface PunctualityTotals {
    count: number;
    avgOriginArr: number | null;
    avgOriginDep: number | null;
    avgDestArr: number | null;
    avgDestDep: number | null;
    onTime: number;
    late: number;
    early: number;
    oaOnTime: number; oaLate: number; oaMeasured: number;
    daOnTime: number; daLate: number; daMeasured: number;
    odEarly: number; odLate: number; odMeasured: number;
    ddEarly: number; ddLate: number; ddMeasured: number;
}

export function computeTotals(loads: Load[]): PunctualityTotals {
    const oa: Array<number | null> = [];
    const od: Array<number | null> = [];
    const da: Array<number | null> = [];
    const dd: Array<number | null> = [];
    let onTime = 0;
    let late = 0;
    const early = 0;
    let oaOnTime = 0, oaLate = 0, oaMeasured = 0;
    let daOnTime = 0, daLate = 0, daMeasured = 0;
    let odEarly = 0, odLate = 0, odMeasured = 0;
    let ddEarly = 0, ddLate = 0, ddMeasured = 0;
    for (const l of loads) {
        const tw = timeWindowLib.parseTimeWindowOrNull(l.time_window);
        if (!tw) continue;
        const oaV = variance(tw.origin.plannedArrival, tw.origin.actualArrival);
        const odV = variance(tw.origin.plannedDeparture, tw.origin.actualDeparture);
        const daV = variance(tw.destination.plannedArrival, tw.destination.actualArrival);
        const ddV = variance(tw.destination.plannedDeparture, tw.destination.actualDeparture);
        oa.push(oaV);
        od.push(odV);
        da.push(daV);
        dd.push(ddV);
        if (daV !== null) {
            if (daV > 15) late++;
            else onTime++;
        }
        if (oaV !== null) { oaMeasured++; if (oaV > 15) oaLate++; else oaOnTime++; }
        if (daV !== null) { daMeasured++; if (daV > 15) daLate++; else daOnTime++; }
        if (odV !== null) { odMeasured++; if (odV < -15) odEarly++; else if (odV > 15) odLate++; }
        if (ddV !== null) { ddMeasured++; if (ddV < -15) ddEarly++; else if (ddV > 15) ddLate++; }
    }
    return {
        count: loads.length,
        avgOriginArr: avg(oa),
        avgOriginDep: avg(od),
        avgDestArr: avg(da),
        avgDestDep: avg(dd),
        onTime,
        late,
        early,
        oaOnTime, oaLate, oaMeasured,
        daOnTime, daLate, daMeasured,
        odEarly, odLate, odMeasured,
        ddEarly, ddLate, ddMeasured,
    };
}

export function fmtMin(v: number | null): string {
    if (v === null) return "—";
    return v.toFixed(1);
}

/** Format a percentage given numerator/denominator. Returns "—" when denominator is 0. */
export function fmtPct(num: number, denom: number): string {
    if (!denom) return "—";
    return `${((num / denom) * 100).toFixed(1)}%`;
}
