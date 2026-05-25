/**
 * Per-day vehicle locations export — WhatsApp chat format.
 *
 * Fetches the current telematics position for every vehicle assigned to a
 * load on the selected day and builds a single WhatsApp-friendly message
 * listing each vehicle, its driver(s), assigned load IDs, status and a
 * tappable Google Maps link.
 */
import type { Load } from "@/hooks/useTrips";
import {
    formatLastConnected,
    getAssetDetails,
    isAuthenticated,
    type TelematicsAsset,
} from "@/lib/telematicsGuru";
import { format, parseISO } from "date-fns";

export interface DayVehicleLocationsResult {
    vehicleCount: number;
    fetched: number;
    failed: number;
    skipped: number;
    message: string;
}

interface VehicleAggregate {
    fleetVehicleId: string;
    registration: string;
    telematicsAssetId: string | null;
    drivers: Set<string>;
    loadIds: string[];
}

function aggregateVehicles(loads: Load[]): VehicleAggregate[] {
    const map = new Map<string, VehicleAggregate>();

    for (const load of loads) {
        const fv = load.fleet_vehicle;
        if (!fv?.id) continue;
        const key = String(fv.id);

        let entry = map.get(key);
        if (!entry) {
            entry = {
                fleetVehicleId: key,
                registration: fv.vehicle_id || "(unknown)",
                telematicsAssetId: fv.telematics_asset_id ? String(fv.telematics_asset_id) : null,
                drivers: new Set<string>(),
                loadIds: [],
            };
            map.set(key, entry);
        }

        if (load.driver?.name) entry.drivers.add(load.driver.name);
        entry.loadIds.push(load.load_id);
    }

    return Array.from(map.values()).sort((a, b) =>
        a.registration.localeCompare(b.registration, undefined, { numeric: true }),
    );
}

function statusEmoji(asset: TelematicsAsset | null): string {
    if (!asset) return "⚪";
    if (!asset.isEnabled) return "⚫";
    if ((asset.speedKmH ?? 0) >= 5) return "🟢";
    if (asset.inTrip) return "🟡";
    return "🔵";
}

function statusLabel(asset: TelematicsAsset | null): string {
    if (!asset) return "No data";
    if (!asset.isEnabled) return "Disabled";
    if ((asset.speedKmH ?? 0) >= 5) return `Moving ${Math.round(asset.speedKmH)} km/h`;
    if (asset.inTrip) return "In trip — stopped";
    return "Stationary";
}

// The Telematics Guru `/v1/asset/{id}` endpoint returns PascalCase fields,
// sometimes wrapped as `{ Assets: [...] }`. The proxy passes the raw payload
// through, so we normalise here into the camelCase shape our types expect.
function normaliseAsset(raw: unknown): TelematicsAsset {
    const r = (raw ?? {}) as Record<string, unknown>;
    const inner = Array.isArray((r as { Assets?: unknown[] }).Assets)
        ? ((r as { Assets: Record<string, unknown>[] }).Assets[0] ?? {})
        : r;

    const pick = <T,>(...keys: string[]): T | undefined => {
        for (const k of keys) {
            const v = inner[k];
            if (v !== undefined && v !== null) return v as T;
        }
        return undefined;
    };

    return {
        id: pick<number>("id", "Id", "assetId", "AssetId") ?? 0,
        assetId: pick<number>("assetId", "AssetId", "id", "Id"),
        name: pick<string>("name", "Name"),
        code: pick<string>("code", "Code"),
        displayName: pick<string>("displayName", "DisplayName"),
        registrationNumber: pick<string>("registrationNumber", "RegistrationNumber"),
        isEnabled: pick<boolean>("isEnabled", "IsEnabled") ?? true,
        inTrip: pick<boolean>("inTrip", "InTrip") ?? false,
        speedKmH: pick<number>("speedKmH", "SpeedKmH", "Speed", "speed") ?? 0,
        heading: pick<number>("heading", "Heading"),
        lastLatitude: pick<number>("lastLatitude", "LastLatitude", "Latitude", "latitude") ?? null,
        lastLongitude: pick<number>("lastLongitude", "LastLongitude", "Longitude", "longitude") ?? null,
        lastConnectedUtc: pick<string>("lastConnectedUtc", "LastConnectedUtc"),
        lastPositionUtc: pick<string>("lastPositionUtc", "LastPositionUtc"),
        odometer: pick<number>("odometer", "Odometer"),
        engineHours: pick<number>("engineHours", "EngineHours"),
    };
}

/**
 * Build a WhatsApp-formatted snapshot of all vehicles assigned to loads on
 * the given day, fetching live positions from Telematics Guru.
 */
export async function generateVehicleLocationsWhatsAppMessage(
    loads: Load[],
    dayIso: string,
): Promise<DayVehicleLocationsResult> {
    if (!isAuthenticated()) {
        throw new Error(
            "Not connected to Telematics Guru. Open Live Tracking and sign in first.",
        );
    }

    const dayLabel = (() => {
        try { return format(parseISO(dayIso), "EEEE dd MMM yyyy"); } catch { return dayIso; }
    })();

    const vehicles = aggregateVehicles(loads);

    const result: DayVehicleLocationsResult = {
        vehicleCount: vehicles.length,
        fetched: 0,
        failed: 0,
        skipped: 0,
        message: "",
    };

    const positions = await Promise.all(
        vehicles.map(async (v) => {
            if (!v.telematicsAssetId) {
                result.skipped += 1;
                return { vehicle: v, asset: null as TelematicsAsset | null, error: "No telematics ID linked" };
            }
            try {
                const raw = await getAssetDetails(parseInt(v.telematicsAssetId, 10));
                const asset = normaliseAsset(raw);
                result.fetched += 1;
                return { vehicle: v, asset, error: null as string | null };
            } catch (err) {
                result.failed += 1;
                return {
                    vehicle: v,
                    asset: null as TelematicsAsset | null,
                    error: err instanceof Error ? err.message : "Failed to fetch position",
                };
            }
        }),
    );

    const generatedAt = format(new Date(), "dd MMM HH:mm");

    const lines: string[] = [
        `*Vehicle Locations — ${dayLabel}*`,
        `_Snapshot taken ${generatedAt}_`,
        "",
        `Vehicles: ${result.vehicleCount} · Located: ${result.fetched} · No GPS link: ${result.skipped} · Failed: ${result.failed}`,
        "━━━━━━━━━━━━━━━━━━━━",
        "",
    ];

    if (positions.length === 0) {
        lines.push("_No vehicles assigned to loads on this day._");
    }

    positions.forEach(({ vehicle, asset, error }, idx) => {
        const emoji = statusEmoji(asset);
        const lat = asset?.lastLatitude ?? null;
        const lng = asset?.lastLongitude ?? null;
        const drivers = Array.from(vehicle.drivers).join(", ") || "—";
        const loadList = vehicle.loadIds.join(", ");

        lines.push(`${emoji} *${vehicle.registration}*`);
        lines.push(`Driver: ${drivers}`);
        lines.push(`Loads: ${loadList}`);
        lines.push(`Status: ${statusLabel(asset)}`);

        if (lat !== null && lng !== null) {
            const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
            lines.push(`Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            lines.push(`Map: ${mapsUrl}`);
            if (asset?.lastConnectedUtc) {
                lines.push(`Last seen: ${formatLastConnected(asset.lastConnectedUtc)}`);
            }
        } else {
            lines.push(`Location: _unavailable_${error ? ` (${error})` : ""}`);
        }

        if (idx < positions.length - 1) {
            lines.push("");
            lines.push("────────────────────");
            lines.push("");
        }
    });

    lines.push("");
    lines.push("_Generated by MATA Load Planner_");

    result.message = lines.join("\n");
    return result;
}

/**
 * Build the WhatsApp message, copy it to the clipboard and open the
 * WhatsApp share sheet pre-filled with the message.
 */
export async function shareVehicleLocationsForDayWhatsApp(
    loads: Load[],
    dayIso: string,
): Promise<DayVehicleLocationsResult> {
    const result = await generateVehicleLocationsWhatsAppMessage(loads, dayIso);

    try {
        await navigator.clipboard.writeText(result.message);
    } catch {
        // Clipboard may be blocked (e.g. non-secure context); the WhatsApp
        // share window still receives the message via the URL below.
    }

    const shareUrl = `https://wa.me/?text=${encodeURIComponent(result.message)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");

    return result;
}

