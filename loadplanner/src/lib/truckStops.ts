/**
 * Truck stop registry.
 *
 * Derived from the shared waypoints / geofences dataset by selecting only the
 * locations whose name identifies them as a truck stop (e.g. "Harare Truck
 * Stop", "Gateway Truckstop"). Used by the Truck Stops order workflow so users
 * can pick a truck stop from a curated list.
 */
import waypointsData from "@/waypoints-zones-geofences.json";

export interface TruckStop {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

const TRUCK_STOP_NAME_PATTERN = /truck\s*stop/i;

/**
 * Manually curated truck stops. Coordinates were provided in
 * `longitude,latitude` order.
 */
const ADDITIONAL_TRUCK_STOPS: TruckStop[] = [
    { name: "Rutenga Truck Stop", address: "Rutenga", longitude: 30.7399571851, latitude: -21.1899927227 },
    { name: "Mvuma Truck Stop", address: "Mvuma", longitude: 30.547494, latitude: -19.265138 },
    { name: "Mwenezi Truck Stop", address: "Mwenezi", longitude: 30.777382, latitude: -20.89834 },
    { name: "Kwekwe Truck Stop", address: "Kwekwe", longitude: 29.811216, latitude: -18.894808 },
    { name: "Gweru Truck Stop", address: "Gweru", longitude: 29.818788, latitude: -19.390914 },
    { name: "Gate Way Truck Stop", address: "Gate Way", longitude: 29.9850633882, latitude: -22.2403730468 },
    { name: "Chibwa Truck Stop", address: "Chibwa", longitude: 30.689657, latitude: -20.294295 },
    { name: "Chegutu Truck Stop", address: "Chegutu", longitude: 30.119512, latitude: -18.152641 },
    { name: "Bubi River Truck Stop", address: "Bubi River", longitude: 30.48814, latitude: -21.725955 },
    { name: "Rusape Truck Stop - Buffalo Truck Inn", address: "Rusape", longitude: 32.122242, latitude: -18.528486 },
    { name: "Chivhu Truck Stop", address: "Chivhu", longitude: 30.898199, latitude: -19.010744 },
];

const derivedTruckStops = (waypointsData as TruckStop[]).filter((waypoint) =>
    TRUCK_STOP_NAME_PATTERN.test(waypoint.name),
);

// Merge derived + manual stops, de-duplicating by name (case-insensitive).
const truckStopsByName = new Map<string, TruckStop>();
for (const stop of [...derivedTruckStops, ...ADDITIONAL_TRUCK_STOPS]) {
    truckStopsByName.set(stop.name.trim().toLowerCase(), stop);
}

export const TRUCK_STOPS: TruckStop[] = Array.from(truckStopsByName.values()).sort(
    (a, b) => a.name.localeCompare(b.name),
);
