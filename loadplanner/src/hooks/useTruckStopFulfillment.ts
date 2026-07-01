import { isWithinDepot } from "@/lib/depots";
import { findTruckStopByName, truckStopToDepot } from "@/lib/truckStops";
import type { TelematicsAsset } from "@/lib/telematicsGuru";
import { useEffect, useRef } from "react";
import {
    useFulfillTruckStopOrder,
    type TruckStopOrder,
} from "./useTruckStopOrders";

/**
 * A truck stop order auto-fulfils when its assigned vehicle stops inside the
 * truck stop's geofence and stays there continuously for more than this
 * duration before exiting.
 */
const MIN_DWELL_MS = 90 * 60 * 1000; // 1 hour 30 minutes

/**
 * Resolve the live telematics asset for an order's vehicle. Mirrors the
 * matching logic used in useGeofenceMonitor: prefer the explicit telematics
 * asset id, then fall back to the vehicle registration / display name.
 */
function matchAssetForOrder(
    assets: TelematicsAsset[],
    telematicsAssetId: string | null | undefined,
    vehicleId: string | null | undefined,
): TelematicsAsset | null {
    if (telematicsAssetId) {
        const byId = assets.find(
            (a) =>
                a.id?.toString() === telematicsAssetId ||
                a.assetId?.toString() === telematicsAssetId,
        );
        if (byId) return byId;
    }
    if (vehicleId) {
        const byVehicle = assets.find(
            (a) =>
                a.registrationNumber === vehicleId ||
                a.displayName?.includes(vehicleId),
        );
        if (byVehicle) return byVehicle;
    }
    return null;
}

/**
 * Auto-fulfils truck stop orders based on live telematics positions.
 *
 * When the vehicle assigned to an open order stops inside the truck stop's
 * geofence and remains there for more than 1 hour 30 minutes before exiting,
 * the order is automatically marked as fulfilled.
 *
 * Designed to run inside GeofenceMonitorProvider so it reuses the existing
 * telematics polling (every 10s) rather than polling independently.
 */
export function useTruckStopFulfillment(
    telematicsAssets: TelematicsAsset[],
    orders: TruckStopOrder[],
    enabled: boolean,
) {
    const fulfillMutation = useFulfillTruckStopOrder();

    // orderId -> wall-clock time the vehicle was first observed inside the geofence.
    const insideSinceRef = useRef<Map<string, Date>>(new Map());
    // Orders already auto-fulfilled this session. Guards the window between the
    // mutation firing and the orders query refetching with status = "fulfilled".
    const fulfilledRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!enabled || telematicsAssets.length === 0) return;

        for (const order of orders) {
            // Only open orders can be auto-fulfilled.
            if (order.status === "fulfilled" || order.status === "cancelled") {
                insideSinceRef.current.delete(order.id);
                continue;
            }
            if (fulfilledRef.current.has(order.id)) continue;

            const stop = findTruckStopByName(order.truck_stop);
            if (!stop) continue;

            const vehicleId =
                order.fleet_vehicle?.vehicle_id ??
                order.load?.fleet_vehicle?.vehicle_id ??
                null;
            const telematicsAssetId =
                order.fleet_vehicle?.telematics_asset_id ??
                order.load?.fleet_vehicle?.telematics_asset_id ??
                null;

            const asset = matchAssetForOrder(
                telematicsAssets,
                telematicsAssetId,
                vehicleId,
            );
            if (
                !asset ||
                asset.lastLatitude == null ||
                asset.lastLongitude == null
            ) {
                continue;
            }

            const geofence = truckStopToDepot(stop);
            const isInside = isWithinDepot(
                asset.lastLatitude,
                asset.lastLongitude,
                geofence,
            );
            const enteredAt = insideSinceRef.current.get(order.id);
            const now = new Date();

            if (isInside) {
                // Seed the entry time on the first observation inside the geofence.
                if (!enteredAt) {
                    insideSinceRef.current.set(order.id, now);
                }
                // Fulfilment is evaluated on exit, so nothing else to do while inside.
                continue;
            }

            // Vehicle is currently outside the geofence.
            if (!enteredAt) continue; // never seen inside — nothing to evaluate.

            // Vehicle has just exited: measure how long it dwelled inside.
            insideSinceRef.current.delete(order.id);
            const dwellMs = now.getTime() - enteredAt.getTime();
            if (dwellMs <= MIN_DWELL_MS) continue;

            fulfilledRef.current.add(order.id);
            const dwellMinutes = Math.round(dwellMs / 60000);
            console.log(
                `[TruckStop] Order ${order.order_number}: vehicle ${vehicleId ?? "?"} dwelled ${dwellMinutes}min at ${stop.name} — auto-fulfilling`,
            );
            fulfillMutation.mutate(order.id, {
                onError: () => {
                    // Allow another attempt on the next exit if the update failed.
                    fulfilledRef.current.delete(order.id);
                },
            });
        }
    }, [telematicsAssets, orders, enabled, fulfillMutation]);
}
