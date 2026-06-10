/**
 * Fleet analytics — utilization & geofence dwell-time computation + Excel export.
 *
 * Utilization is derived from Telematics Guru trip history; dwell times are
 * derived from paired entry/exit `geofence_events` rows (reusing the pairing
 * logic from the Vehicle Movement Report).
 */

import { format } from "date-fns";
import XLSX from "xlsx-js-style";

import {
    BRAND,
    COMPANY_NAME,
    SYSTEM_NAME,
} from "@/lib/exportStyles";
import type { TelematicsTrip } from "@/lib/telematicsGuru";
import {
    buildMovementRecords,
    type RawGeofenceEvent,
} from "@/lib/exportVehicleMovementReport";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UtilizationRow {
    vehicle: string;
    trips: number;
    distanceKm: number;
    drivingMinutes: number;
    idleMinutes: number;
    avgSpeedKmH: number;
    maxSpeedKmH: number;
    /** Driving time as % of the report range. */
    utilizationPct: number;
}

export interface DwellSummaryRow {
    location: string;
    visits: number;
    avgMinutes: number;
    maxMinutes: number;
    totalMinutes: number;
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

function tripNumber(value: unknown): number {
    return typeof value === "number" && isFinite(value) ? value : 0;
}

export function computeUtilization(
    trips: TelematicsTrip[],
    rangeStart: Date,
    rangeEnd: Date,
): UtilizationRow[] {
    const rangeMinutes = Math.max(
        (rangeEnd.getTime() - rangeStart.getTime()) / 60000,
        1,
    );

    const byVehicle = new Map<string, TelematicsTrip[]>();
    for (const trip of trips) {
        const key =
            (trip.assetName as string) ||
            (trip.assetId != null ? `Asset ${trip.assetId}` : "Unknown");
        const list = byVehicle.get(key) ?? [];
        list.push(trip);
        byVehicle.set(key, list);
    }

    const rows: UtilizationRow[] = [];
    for (const [vehicle, vehicleTrips] of byVehicle) {
        let distanceKm = 0;
        let drivingMinutes = 0;
        let idleMinutes = 0;
        let maxSpeed = 0;
        let speedSum = 0;
        let speedCount = 0;

        for (const t of vehicleTrips) {
            distanceKm += tripNumber(t.distanceKm ?? t.distance);
            drivingMinutes += tripNumber(t.durationMinutes ?? t.duration);
            idleMinutes += tripNumber(t.idleDurationMinutes ?? t.idleDuration);
            maxSpeed = Math.max(maxSpeed, tripNumber(t.maxSpeedKmH ?? t.maxSpeed));
            const avg = tripNumber(t.averageSpeedKmH ?? t.averageSpeed);
            if (avg > 0) {
                speedSum += avg;
                speedCount++;
            }
        }

        rows.push({
            vehicle,
            trips: vehicleTrips.length,
            distanceKm,
            drivingMinutes,
            idleMinutes,
            avgSpeedKmH: speedCount > 0 ? speedSum / speedCount : 0,
            maxSpeedKmH: maxSpeed,
            utilizationPct: Math.min((drivingMinutes / rangeMinutes) * 100, 100),
        });
    }

    return rows.sort((a, b) => b.drivingMinutes - a.drivingMinutes);
}

export function computeDwellSummary(
    events: RawGeofenceEvent[],
): DwellSummaryRow[] {
    const records = buildMovementRecords(events, (e) => ({
        fleetNumber: e.vehicle_registration || e.telematics_asset_id || "Unknown",
        registration: e.vehicle_registration || "",
        type: "",
    }));

    const byLocation = new Map<string, number[]>();
    for (const rec of records) {
        if (rec.durationMinutes == null || rec.durationMinutes < 0) continue;
        const list = byLocation.get(rec.location) ?? [];
        list.push(rec.durationMinutes);
        byLocation.set(rec.location, list);
    }

    const rows: DwellSummaryRow[] = [];
    for (const [location, durations] of byLocation) {
        const total = durations.reduce((s, d) => s + d, 0);
        rows.push({
            location,
            visits: durations.length,
            avgMinutes: total / durations.length,
            maxMinutes: Math.max(...durations),
            totalMinutes: total,
        });
    }

    return rows.sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function formatMinutes(minutes: number): string {
    if (!isFinite(minutes) || minutes <= 0) return "—";
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ---------------------------------------------------------------------------
// Excel export
// ---------------------------------------------------------------------------

const headerStyle = {
    font: { bold: true, sz: 11, color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.navy } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
};

const titleStyle = {
    font: { bold: true, sz: 14, color: { rgb: BRAND.navy } },
};

const metaStyle = {
    font: { sz: 9, italic: true, color: { rgb: BRAND.darkGray } },
};

function styledSheet(
    title: string,
    rangeLabel: string,
    header: string[],
    rows: (string | number)[][],
    colWidths: number[],
): XLSX.WorkSheet {
    const aoa: (string | number)[][] = [
        [title],
        [`${COMPANY_NAME} · ${SYSTEM_NAME} · ${rangeLabel}`],
        [],
        header,
        ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = colWidths.map((wch) => ({ wch }));

    const titleCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
    if (titleCell) titleCell.s = titleStyle;
    const metaCell = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    if (metaCell) metaCell.s = metaStyle;
    for (let c = 0; c < header.length; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 3, c })];
        if (cell) cell.s = headerStyle;
    }
    return ws;
}

export function exportFleetAnalyticsToExcel(
    utilization: UtilizationRow[],
    dwell: DwellSummaryRow[],
    rangeStart: Date,
    rangeEnd: Date,
): void {
    const rangeLabel = `${format(rangeStart, "dd MMM yyyy")} – ${format(rangeEnd, "dd MMM yyyy")}`;
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        wb,
        styledSheet(
            "Fleet Utilization Report",
            rangeLabel,
            ["Vehicle", "Trips", "Distance (km)", "Driving Time", "Idle Time", "Avg Speed (km/h)", "Max Speed (km/h)", "Utilization %"],
            utilization.map((r) => [
                r.vehicle,
                r.trips,
                Math.round(r.distanceKm * 10) / 10,
                formatMinutes(r.drivingMinutes),
                formatMinutes(r.idleMinutes),
                Math.round(r.avgSpeedKmH),
                Math.round(r.maxSpeedKmH),
                Math.round(r.utilizationPct * 10) / 10,
            ]),
            [22, 8, 14, 14, 14, 16, 16, 14],
        ),
        "Utilization",
    );

    XLSX.utils.book_append_sheet(
        wb,
        styledSheet(
            "Geofence Dwell-Time Report",
            rangeLabel,
            ["Location", "Visits", "Avg Dwell", "Max Dwell", "Total Dwell"],
            dwell.map((r) => [
                r.location,
                r.visits,
                formatMinutes(r.avgMinutes),
                formatMinutes(r.maxMinutes),
                formatMinutes(r.totalMinutes),
            ]),
            [32, 8, 14, 14, 14],
        ),
        "Dwell Times",
    );

    XLSX.writeFile(
        wb,
        `fleet-analytics-${format(rangeStart, "yyyyMMdd")}-${format(rangeEnd, "yyyyMMdd")}.xlsx`,
    );
}
