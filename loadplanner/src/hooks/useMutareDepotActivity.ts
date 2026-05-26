import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface MutareDepotStay {
    vehicleRegistration: string;
    telematicsAssetId: string | null;
    entryTime: string | null;
    exitTime: string | null;
    durationMinutes: number | null;
    stillInside: boolean;
}

interface RawEvent {
    vehicle_registration: string | null;
    telematics_asset_id: string | null;
    event_type: string;
    event_time: string;
}

interface UseMutareDepotActivityOptions {
    startDate?: Date;
    endDate?: Date;
}

/**
 * Pairs depot_entry events with the next depot_exit per vehicle to compute stay durations.
 * Open (still-inside) stays are returned with exitTime/durationMinutes = null.
 */
export function useMutareDepotActivity(options: UseMutareDepotActivityOptions = {}) {
    const { startDate, endDate } = options;

    return useQuery({
        queryKey: [
            "mutare_depot_activity",
            startDate?.toISOString() ?? null,
            endDate?.toISOString() ?? null,
        ],
        queryFn: async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let qb: any = (supabase as any)
                .from("geofence_events")
                .select("vehicle_registration, telematics_asset_id, event_type, event_time")
                .eq("geofence_name", "Mutare Depot")
                .in("event_type", ["depot_entry", "depot_exit"])
                .order("event_time", { ascending: true });

            if (startDate) qb = qb.gte("event_time", startDate.toISOString());
            if (endDate) qb = qb.lte("event_time", endDate.toISOString());

            const { data, error } = await qb;
            if (error) throw error;

            const events = (data ?? []) as RawEvent[];

            // Group events by vehicle, then pair entry → next exit.
            const byVehicle = new Map<string, RawEvent[]>();
            for (const e of events) {
                const key = e.vehicle_registration || e.telematics_asset_id || "unknown";
                if (!byVehicle.has(key)) byVehicle.set(key, []);
                byVehicle.get(key)!.push(e);
            }

            const stays: MutareDepotStay[] = [];
            for (const [vehicleKey, list] of byVehicle.entries()) {
                let openEntry: RawEvent | null = null;
                for (const ev of list) {
                    if (ev.event_type === "depot_entry") {
                        // If a prior entry has no matching exit yet, record it as still-inside
                        // before starting a new stay (defensive against missing exit events).
                        if (openEntry) {
                            stays.push({
                                vehicleRegistration: vehicleKey,
                                telematicsAssetId: openEntry.telematics_asset_id,
                                entryTime: openEntry.event_time,
                                exitTime: null,
                                durationMinutes: null,
                                stillInside: false,
                            });
                        }
                        openEntry = ev;
                    } else if (ev.event_type === "depot_exit") {
                        if (openEntry) {
                            const entryMs = new Date(openEntry.event_time).getTime();
                            const exitMs = new Date(ev.event_time).getTime();
                            stays.push({
                                vehicleRegistration: vehicleKey,
                                telematicsAssetId: openEntry.telematics_asset_id,
                                entryTime: openEntry.event_time,
                                exitTime: ev.event_time,
                                durationMinutes: Math.max(0, Math.round((exitMs - entryMs) / 60000)),
                                stillInside: false,
                            });
                            openEntry = null;
                        } else {
                            // Exit with no matching entry in the window — record as exit-only row
                            stays.push({
                                vehicleRegistration: vehicleKey,
                                telematicsAssetId: ev.telematics_asset_id,
                                entryTime: null,
                                exitTime: ev.event_time,
                                durationMinutes: null,
                                stillInside: false,
                            });
                        }
                    }
                }
                if (openEntry) {
                    const nowMs = Date.now();
                    const entryMs = new Date(openEntry.event_time).getTime();
                    stays.push({
                        vehicleRegistration: vehicleKey,
                        telematicsAssetId: openEntry.telematics_asset_id,
                        entryTime: openEntry.event_time,
                        exitTime: null,
                        durationMinutes: Math.max(0, Math.round((nowMs - entryMs) / 60000)),
                        stillInside: true,
                    });
                }
            }

            // Most recent stays first
            stays.sort((a, b) => {
                const aT = a.entryTime ?? a.exitTime ?? "";
                const bT = b.entryTime ?? b.exitTime ?? "";
                return bT.localeCompare(aT);
            });

            return stays;
        },
    });
}
