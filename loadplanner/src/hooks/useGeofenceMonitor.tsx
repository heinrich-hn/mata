/* eslint-disable react-refresh/only-export-components */
import { useAuth } from "@/hooks/useAuth";
import { useCustomLocations } from "@/hooks/useCustomLocations";
import { useTruckStopFulfillment } from "@/hooks/useTruckStopFulfillment";
import { useTruckStopOrders } from "@/hooks/useTruckStopOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useGeofenceLoadUpdate,
  useLoads,
  useLoadsRealtimeSync,
  type GeofenceEventType,
  type Load,
} from "@/hooks/useTrips";
import {
  customLocationToDepot,
  DEPOTS,
  findDepotByName,
  isWithinDepot,
} from "@/lib/depots";
import {
  authenticate,
  formatLastConnected,
  getAssetsWithPositions,
  getOrganisations,
  isAuthenticated,
  type TelematicsAsset,
} from "@/lib/telematicsGuru";
import { parseISO } from "date-fns";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ============================================================================
// TYPES
// ============================================================================

export interface LoadWithAsset extends Load {
  telematicsAsset?: TelematicsAsset | null;
  isAtLoadOrigin?: boolean;
  lastUpdate?: string;
}

interface GeofenceMonitorContextType {
  telematicsAssets: TelematicsAsset[];
  telematicsLoading: boolean;
  telematicsAuthError: boolean;
  lastRefresh: Date | null;
  loadsWithAssets: LoadWithAsset[];
  refetch: () => void;
  setDeliveryCompleteCallback?: (callback: (load: Load) => void) => void;
}

const GeofenceMonitorContext = createContext<GeofenceMonitorContextType | undefined>(undefined);

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolve the GPS fix time for an asset — i.e. when the device was physically
 * at its reported position. This is what we want to RECORD as an actual
 * arrival/departure, instead of the browser wall-clock at the moment we happen
 * to process a poll.
 *
 * Prefers `lastPositionUtc` (the GPS position fix) and falls back to
 * `lastConnectedUtc` (the cellular check-in, which lags for parked vehicles).
 * Returns `null` when no usable fix time is available so callers can fall back
 * to wall-clock time explicitly.
 */
function getAssetFixTime(asset: TelematicsAsset): Date | null {
  const raw = asset.lastPositionUtc || asset.lastConnectedUtc;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  // Guard against bad device/clock data: reject timestamps more than 2 minutes
  // in the future so we never record an arrival/departure "ahead of now".
  if (d.getTime() > Date.now() + 120_000) return null;
  return d;
}

// ============================================================================
// PROVIDER
// ============================================================================

export function GeofenceMonitorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: loads = [] } = useLoads();
  useLoadsRealtimeSync(); // Instant cache invalidation on any loads table change
  const { data: customLocations = [] } = useCustomLocations();
  const { data: truckStopOrders = [] } = useTruckStopOrders();

  const extraDepots = useMemo(
    () => customLocations.map(customLocationToDepot),
    [customLocations]
  );

  const [telematicsAssets, setTelematicsAssets] = useState<TelematicsAsset[]>([]);
  const [telematicsLoading, setTelematicsLoading] = useState(false);
  const [telematicsAuthError, setTelematicsAuthError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Geofence tracking refs
  const previousPositionsRef = useRef<Map<string, { lat: number; lon: number }>>(new Map());
  const processedEventsRef = useRef<Set<string>>(new Set());
  const geofenceEntryRef = useRef<Map<string, Date>>(new Map());
  const stationaryTrackingRef = useRef<Map<string, { entryTime: Date; stationaryStartTime: Date | null }>>(new Map());
  const insideCountRef = useRef<Map<string, number>>(new Map());
  // Dwell-time tracking: records when a vehicle was first observed inside a geofence zone.
  // If the vehicle stays inside for 10+ minutes without a transition-based entry event firing,
  // this fallback auto-triggers the appropriate arrival event.
  // `wall` is the processing clock used to measure dwell duration (always advances);
  // `fix` is the GPS fix time of that first-inside observation, which is what we RECORD
  // as the actual arrival so the stored time isn't biased late by the dwell window.
  const dwellTrackingRef = useRef<Map<string, { wall: Date; fix: Date }>>(new Map());
  // Exit-dwell tracking: records when a vehicle was first observed OUTSIDE a geofence zone
  // after an arrival was recorded. If the vehicle stays outside for 10+ min without a
  // transition-based exit event firing, this fallback auto-triggers the departure event.
  const exitDwellTrackingRef = useRef<Map<string, { wall: Date; fix: Date }>>(new Map());
  const geofenceUpdateMutation = useGeofenceLoadUpdate();

  const [organisationId, setOrganisationId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("telematics_org_id");
    return stored ? parseInt(stored) : null;
  });

  // Callback to trigger delivery confirmation dialog - stored in ref for use in effect
  const onDeliveryCompleteRef = useRef<((load: Load) => void) | undefined>(undefined);

  // Check if there are any active loads to monitor (include pending for dwell-time auto-detection)
  const hasActiveLoads = useMemo(() => {
    return loads.some((l) => l.status === "pending" || l.status === "scheduled" || l.status === "in-transit");
  }, [loads]);

  // Check if there are any open truck stop orders awaiting fulfilment. Keeps the
  // telematics poll running for truck-stop dwell detection even when there are
  // no active loads.
  const hasActiveTruckStopOrders = useMemo(() => {
    return truckStopOrders.some(
      (o) => o.status !== "fulfilled" && o.status !== "cancelled"
    );
  }, [truckStopOrders]);

  // Fetch telematics data
  const fetchTelematicsData = useCallback(async () => {
    if (!isAuthenticated()) {
      // Reuse the same saved credentials the Live Tracking page persists
      // (tg_username / base64 tg_password when "remember me" is enabled) so the
      // background monitor can self-authenticate on app load WITHOUT the user
      // first having to open the Live Tracking page. Falls back to the legacy
      // telematics_username / telematics_password keys for backward compat.
      let username = localStorage.getItem("telematics_username");
      let password = localStorage.getItem("telematics_password");

      if ((!username || !password) && localStorage.getItem("tg_remember") === "true") {
        const savedUsername = localStorage.getItem("tg_username");
        const savedPassword = localStorage.getItem("tg_password");
        if (savedUsername && savedPassword) {
          username = savedUsername;
          try {
            password = atob(savedPassword);
          } catch {
            password = null;
          }
        }
      }

      if (username && password) {
        const success = await authenticate(username, password);
        if (!success) {
          setTelematicsAuthError(true);
          return;
        }
        setTelematicsAuthError(false);
      } else {
        setTelematicsAuthError(true);
        return;
      }
    }

    setTelematicsLoading(true);
    try {
      let orgId = organisationId;
      if (!orgId) {
        const orgs = await getOrganisations();
        if (orgs && orgs.length > 0) {
          orgId = orgs[0].id;
          setOrganisationId(orgId);
          localStorage.setItem("telematics_org_id", orgId.toString());
        } else {
          setTelematicsAuthError(true);
          return;
        }
      }

      const assets = await getAssetsWithPositions(orgId);
      setTelematicsAssets(assets || []);
      setLastRefresh(new Date());
      setTelematicsAuthError(false);
      console.debug('[Geofence] Telematics poll OK', {
        orgId,
        assetCount: assets?.length ?? 0,
        at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Geofence] Telematics poll failed:', error);
      if (error instanceof Error && error.message.includes("Authentication")) {
        setTelematicsAuthError(true);
        localStorage.removeItem("telematics_username");
        localStorage.removeItem("telematics_password");
        localStorage.removeItem("telematics_org_id");
        setOrganisationId(null);
      }
    } finally {
      setTelematicsLoading(false);
    }
  }, [organisationId]);

  // Poll telematics every 10 seconds when user is logged in and there are active loads
  useEffect(() => {
    if (!user || (!hasActiveLoads && !hasActiveTruckStopOrders)) return;

    fetchTelematicsData();
    const interval = setInterval(fetchTelematicsData, 10000);
    return () => clearInterval(interval);
  }, [fetchTelematicsData, user, hasActiveLoads, hasActiveTruckStopOrders]);

  // Match loads to telematics assets
  const loadsWithAssets: LoadWithAsset[] = useMemo(() => {
    return loads.map((load) => {
      const vehicle = load.fleet_vehicle;
      const telematicsAssetId = vehicle?.telematics_asset_id;
      let telematicsAsset: TelematicsAsset | null = null;

      if (telematicsAssetId) {
        telematicsAsset =
          telematicsAssets.find(
            (a) =>
              a.id.toString() === telematicsAssetId ||
              a.assetId?.toString() === telematicsAssetId ||
              a.registrationNumber === vehicle?.vehicle_id
          ) || null;
      }
      if (!telematicsAsset && vehicle) {
        telematicsAsset =
          telematicsAssets.find(
            (a) =>
              a.registrationNumber === vehicle.vehicle_id ||
              a.displayName?.includes(vehicle.vehicle_id)
          ) || null;
      }

      const originDepot = findDepotByName(load.origin, extraDepots);
      let isAtLoadOrigin = false;
      if (originDepot && telematicsAsset?.lastLatitude && telematicsAsset?.lastLongitude) {
        isAtLoadOrigin = isWithinDepot(
          telematicsAsset.lastLatitude,
          telematicsAsset.lastLongitude,
          originDepot
        );
      }

      return {
        ...load,
        telematicsAsset,
        isAtLoadOrigin,
        lastUpdate: telematicsAsset?.lastConnectedUtc
          ? formatLastConnected(telematicsAsset.lastConnectedUtc)
          : undefined,
      };
    });
  }, [loads, telematicsAssets, extraDepots]);

  // Auto-fulfil truck stop orders when the assigned vehicle dwells inside the
  // truck stop geofence for more than 1h30m before exiting.
  useTruckStopFulfillment(telematicsAssets, truckStopOrders, !!user);

  // Geofence checking effect
  useEffect(() => {
    // Include pending loads that have fleet and driver assigned - they can be auto-transitioned to scheduled
    const activeLoads = loadsWithAssets.filter(
      (l) => l.status === "pending" || l.status === "scheduled" || l.status === "in-transit"
    );

    // === DIAGNOSTIC SUMMARY ===
    // Per polling tick, log a single grouped summary of every active load and
    // why it will / will not be processed. Helps users (and us) debug stuck
    // status indicators (e.g. BV-origin trips not advancing) without having
    // to attach a debugger.
    if (activeLoads.length > 0) {
      console.groupCollapsed(`[Geofence] tick — ${activeLoads.length} active load(s)`);
      for (const l of activeLoads) {
        const a = l.telematicsAsset;
        const od = findDepotByName(l.origin, extraDepots);
        const dd = findDepotByName(l.destination, extraDepots);
        const inOrigin = od && a?.lastLatitude && a?.lastLongitude
          ? isWithinDepot(a.lastLatitude, a.lastLongitude, od) : null;
        const inDest = dd && a?.lastLatitude && a?.lastLongitude
          ? isWithinDepot(a.lastLatitude, a.lastLongitude, dd) : null;
        console.log(`[Geofence] ${l.load_id}`, {
          status: l.status,
          vehicle: l.fleet_vehicle?.vehicle_id ?? '(none)',
          driver_id: l.driver_id ?? '(none)',
          origin_text: l.origin,
          dest_text: l.destination,
          origin_resolved: od ? `${od.name} (r=${od.radius}m)` : 'NOT RESOLVED',
          dest_resolved: dd ? `${dd.name} (r=${dd.radius}m)` : 'NOT RESOLVED',
          asset_pos: a?.lastLatitude && a?.lastLongitude
            ? `${a.lastLatitude.toFixed(5)}, ${a.lastLongitude.toFixed(5)}`
            : 'NO POSITION',
          asset_last: a?.lastConnectedUtc ?? '(no asset)',
          in_origin: inOrigin,
          in_dest: inDest,
          actual_loading_arrival: l.actual_loading_arrival,
          actual_loading_departure: l.actual_loading_departure,
          actual_offloading_arrival: l.actual_offloading_arrival,
          actual_offloading_departure: l.actual_offloading_departure,
        });
      }
      console.groupEnd();
    }

    // Track which vehicles we have updated in this tick to prevent loop state contamination
    const updatedVehiclesInTick = new Set<string>();

    for (const load of activeLoads) {
      // Gate: Only process the single "current" load for each vehicle.
      // Priority: in-transit first (the load actively being delivered), then
      // earliest by offloading_date, then loading_date. This prevents a
      // scheduled future load from receiving geofence events meant for the
      // load the driver is currently busy with.
      const gateVehicleId = load.fleet_vehicle?.vehicle_id || "unassigned";
      if (gateVehicleId !== "unassigned") {
        const statusPriority: Record<string, number> = { 'in-transit': 0, 'scheduled': 1, 'pending': 2 };
        const assetForGate = load.telematicsAsset;
        const gateLat = assetForGate?.lastLatitude;
        const gateLon = assetForGate?.lastLongitude;

        // Compute, for each candidate load on this vehicle, whether the truck
        // is physically inside its origin or destination geofence right now.
        // A load whose geofence currently contains the truck takes absolute
        // priority over the date-based ordering — otherwise a "next" load
        // scheduled out of the same depot blocks the active load from
        // advancing while the truck is sitting at the origin.
        const isInsideAnyGeofence = (l: LoadWithAsset): boolean => {
          if (gateLat == null || gateLon == null) return false;
          const od = findDepotByName(l.origin, extraDepots);
          const dd = findDepotByName(l.destination, extraDepots);
          if (od && isWithinDepot(gateLat, gateLon, od)) return true;
          if (dd && isWithinDepot(gateLat, gateLon, dd)) return true;
          return false;
        };

        const notDeliveredForVehicle = loadsWithAssets
          .filter((l) => (l.fleet_vehicle?.vehicle_id || "unassigned") === gateVehicleId && l.status !== "delivered")
          .sort((a, b) => {
            // 0. A load whose origin/destination currently contains the truck
            //    wins outright. If both or neither are inside, fall through.
            const aInside = isInsideAnyGeofence(a);
            const bInside = isInsideAnyGeofence(b);
            if (aInside !== bInside) return aInside ? -1 : 1;
            // 1. Prefer in-transit over scheduled/pending
            const sPri = (statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3);
            if (sPri !== 0) return sPri;
            // 2. Earlier offloading_date first (the one due soonest)
            const offDiff = (parseISO(a.offloading_date).getTime() || 0) - (parseISO(b.offloading_date).getTime() || 0);
            if (offDiff !== 0) return offDiff;
            // 3. Fallback: earlier loading_date
            return (parseISO(a.loading_date).getTime() || 0) - (parseISO(b.loading_date).getTime() || 0);
          });
        const currentLoadForVehicle = notDeliveredForVehicle[0];
        if (currentLoadForVehicle && currentLoadForVehicle.id !== load.id) {
          console.log(`[Geofence] ${load.load_id}: SKIPPED — vehicle ${gateVehicleId} is currently bound to load ${currentLoadForVehicle.load_id} (status=${currentLoadForVehicle.status}, inside_geofence=${isInsideAnyGeofence(currentLoadForVehicle)})`);
          continue;
        }
      }

      const asset = load.telematicsAsset;
      if (!asset?.lastLatitude || !asset?.lastLongitude) {
        console.log(`[Geofence] ${load.load_id}: SKIPPED — no telematics asset/position (vehicle=${load.fleet_vehicle?.vehicle_id ?? 'none'}, telematics_asset_id=${load.fleet_vehicle?.telematics_asset_id ?? 'none'})`);
        continue;
      }

      const vehicleKey = asset.id?.toString() || asset.registrationNumber || "";
      if (!vehicleKey) continue;

      const previousPos = previousPositionsRef.current.get(vehicleKey);
      const currentPos = { lat: asset.lastLatitude, lon: asset.lastLongitude };

      const originDepot = findDepotByName(load.origin, extraDepots);
      const destinationDepot = findDepotByName(load.destination, extraDepots);

      // Process origin and destination geofences INDEPENDENTLY so that an
      // unresolved destination (e.g. a custom location whose name doesn't
      // match exactly) does not silently disable origin arrival detection
      // — and vice versa. Previously the gate was `originDepot && destinationDepot`,
      // which caused trips with origin = "BV" and a custom-location destination
      // to be stuck on "Scheduled" forever because the whole geofence block
      // was skipped.
      if (originDepot || destinationDepot) {
        if (!originDepot && load.origin) {
          console.warn(`[Geofence] Load ${load.load_id}: origin "${load.origin}" did not resolve to a known depot or custom location — origin geofence checks skipped for this load.`);
        }
        if (!destinationDepot && load.destination) {
          console.warn(`[Geofence] Load ${load.load_id}: destination "${load.destination}" did not resolve to a known depot or custom location — destination geofence checks skipped for this load.`);
        }

        const originInsideRaw = originDepot ? isWithinDepot(currentPos.lat, currentPos.lon, originDepot) : false;
        const destInsideRaw = destinationDepot ? isWithinDepot(currentPos.lat, currentPos.lon, destinationDepot) : false;

        const originKeyForHyst = originDepot ? `${vehicleKey}-${originDepot.name}-origin` : '';
        const destKeyForHyst = destinationDepot ? `${vehicleKey}-${destinationDepot.name}-dest` : '';

        const requiresHysteresis = (depotName: string, depotType: string) => {
          const isCBC = depotName.toLowerCase() === 'cbc';
          const isDepotType = depotType === 'depot';
          return isCBC || isDepotType;
        };

        const applyHysteresis = (key: string, rawInside: boolean, enabled: boolean) => {
          if (!enabled || !key) return rawInside;
          const current = insideCountRef.current.get(key) || 0;
          if (rawInside) {
            const next = current + 1;
            insideCountRef.current.set(key, next);
            return next >= 2;
          } else {
            insideCountRef.current.set(key, 0);
            return false;
          }
        };

        // Always run hysteresis to keep counters in sync (when depot resolved)
        const isAtOriginHyst = originDepot
          ? applyHysteresis(originKeyForHyst, originInsideRaw, requiresHysteresis(originDepot.name, originDepot.type))
          : false;
        const isAtDestHyst = destinationDepot
          ? applyHysteresis(destKeyForHyst, destInsideRaw, requiresHysteresis(destinationDepot.name, destinationDepot.type))
          : false;

        // On first observation (no previous position), bypass hysteresis and use raw
        // geofence check so vehicles already inside a geofence are detected immediately
        // instead of waiting for the 10-minute dwell-time fallback.
        const isAtOrigin = previousPos ? isAtOriginHyst : originInsideRaw;
        const isAtDestination = previousPos ? isAtDestHyst : destInsideRaw;

        const wasAtOrigin = previousPos && originDepot
          ? isWithinDepot(previousPos.lat, previousPos.lon, originDepot)
          : null;
        const wasAtDestination = previousPos && destinationDepot
          ? isWithinDepot(previousPos.lat, previousPos.lon, destinationDepot)
          : null;

        // Wall-clock instant — used ONLY for dwell/stationary DURATION math,
        // de-dup keys and ref bookkeeping. It must always advance even when the
        // device stops emitting fresh GPS fixes, otherwise the dwell-time
        // fallbacks (which exist precisely for sparse-reporting devices) would
        // stop firing.
        const nowTs = new Date();
        // GPS fix time of the position we are evaluating. This is what we
        // RECORD as the actual arrival/departure so the stored timestamp
        // reflects when the truck was physically there — not when our browser
        // processed the poll. Falls back to wall-clock only when the device
        // provides no usable fix time.
        const fixTs = getAssetFixTime(asset) ?? nowTs;
        const timestamp = fixTs;
        const dateKey = nowTs.toISOString().slice(0, 10);
        const originEntryKey = `${load.id}-origin-entry`;
        const destEntryKey = `${load.id}-dest-entry`;

        const eventCtx = {
          vehicleRegistration: load.fleet_vehicle?.vehicle_id || asset.registrationNumber || asset.name || "",
          telematicsAssetId: String(asset.id),
          loadNumber: load.load_id,
          latitude: currentPos.lat,
          longitude: currentPos.lon,
        };

        // === ORIGIN GEOFENCE ===
        // Handle pending loads: transition to scheduled when vehicle enters origin with fleet+driver
        if (originDepot && load.status === "pending") {
          const hasFleetAndDriver = load.fleet_vehicle_id && load.driver_id;
          const justEnteredOrigin =
            (wasAtOrigin === false && isAtOrigin === true) ||
            (wasAtOrigin === null && isAtOrigin === true);

          // Auto-transition to scheduled when vehicle enters origin (if fleet+driver assigned)
          if (hasFleetAndDriver && justEnteredOrigin && !geofenceEntryRef.current.has(originEntryKey)) {
            geofenceEntryRef.current.set(originEntryKey, timestamp);
            const scheduledEventKey = `${load.id}-pending-scheduled-${dateKey}`;
            if (!processedEventsRef.current.has(scheduledEventKey)) {
              processedEventsRef.current.add(scheduledEventKey);
              // Update status to scheduled
              geofenceUpdateMutation.mutate({
                loadId: load.id,
                eventType: "loading_arrival" as GeofenceEventType,
                timestamp,
                ...eventCtx,
                geofenceName: originDepot.name,
              });
            }
            dwellTrackingRef.current.delete(`${load.id}-origin-dwell`);
          }

          // === DWELL-TIME FALLBACK for pending loads at origin ===
          // If vehicle is inside origin for 10+ minutes without a transition-based entry event,
          // auto-trigger the arrival so it doesn't get missed.
          if (hasFleetAndDriver && originInsideRaw) {
            const originDwellKey = `${load.id}-origin-dwell`;
            const scheduledEventKey = `${load.id}-pending-scheduled-${dateKey}`;
            if (!processedEventsRef.current.has(scheduledEventKey)) {
              if (!dwellTrackingRef.current.has(originDwellKey)) {
                dwellTrackingRef.current.set(originDwellKey, { wall: nowTs, fix: fixTs });
              } else {
                const dwellStart = dwellTrackingRef.current.get(originDwellKey)!;
                const dwellMinutes = (nowTs.getTime() - dwellStart.wall.getTime()) / (1000 * 60);
                if (dwellMinutes >= 10) {
                  processedEventsRef.current.add(scheduledEventKey);
                  geofenceEntryRef.current.set(originEntryKey, dwellStart.wall);
                  console.log(`[Geofence Dwell] Pending load ${load.load_id}: vehicle inside origin ${originDepot.name} for ${dwellMinutes.toFixed(1)}min — auto-transitioning to scheduled`);
                  geofenceUpdateMutation.mutate({
                    loadId: load.id,
                    eventType: "loading_arrival" as GeofenceEventType,
                    timestamp: dwellStart.fix,
                    ...eventCtx,
                    geofenceName: originDepot.name,
                  });
                  dwellTrackingRef.current.delete(originDwellKey);
                }
              }
            }
          } else {
            dwellTrackingRef.current.delete(`${load.id}-origin-dwell`);
          }

          continue; // Skip further processing for pending loads
        }

        if (originDepot && load.status === "scheduled") {
          const justEnteredOrigin =
            (wasAtOrigin === false && isAtOrigin === true) ||
            (wasAtOrigin === null && isAtOrigin === true);

          if (justEnteredOrigin && !geofenceEntryRef.current.has(originEntryKey)) {
            geofenceEntryRef.current.set(originEntryKey, timestamp);
            dwellTrackingRef.current.delete(`${load.id}-origin-dwell`);
            const arrivalEventKey = `${load.id}-loading_arrival-${dateKey}`;
            if (!processedEventsRef.current.has(arrivalEventKey) && !load.actual_loading_arrival) {
              console.log('[Geofence Transition] loading_arrival', {
                load: load.load_id,
                vehicle: eventCtx.vehicleRegistration,
                geofence: originDepot.name,
              });
              geofenceUpdateMutation.mutate({
                loadId: load.id,
                eventType: "loading_arrival" as GeofenceEventType,
                timestamp,
                ...eventCtx,
                geofenceName: originDepot.name,
              });
              processedEventsRef.current.add(arrivalEventKey);
            }
          }
        }

        // === ORIGIN DWELL-TIME FALLBACK (scheduled) ===
        // If vehicle is inside origin for 10+ min without transition entry, auto-fire loading_arrival
        if (originDepot && load.status === "scheduled" && originInsideRaw && !load.actual_loading_arrival) {
          const originDwellKey = `${load.id}-origin-dwell`;
          const arrivalEventKey = `${load.id}-loading_arrival-${dateKey}`;
          if (!processedEventsRef.current.has(arrivalEventKey)) {
            if (!dwellTrackingRef.current.has(originDwellKey)) {
              dwellTrackingRef.current.set(originDwellKey, { wall: nowTs, fix: fixTs });
            } else {
              const dwellStart = dwellTrackingRef.current.get(originDwellKey)!;
              const dwellMinutes = (nowTs.getTime() - dwellStart.wall.getTime()) / (1000 * 60);
              if (dwellMinutes >= 10) {
                processedEventsRef.current.add(arrivalEventKey);
                if (!geofenceEntryRef.current.has(originEntryKey)) {
                  geofenceEntryRef.current.set(originEntryKey, dwellStart.wall);
                }
                console.log(`[Geofence Dwell] Scheduled load ${load.load_id}: vehicle inside origin ${originDepot.name} for ${dwellMinutes.toFixed(1)}min — auto-firing loading_arrival`);
                geofenceUpdateMutation.mutate({
                  loadId: load.id,
                  eventType: "loading_arrival" as GeofenceEventType,
                  timestamp: dwellStart.fix,
                  ...eventCtx,
                  geofenceName: originDepot.name,
                });
                dwellTrackingRef.current.delete(originDwellKey);
              }
            }
          }
        } else if (originDepot && load.status === "scheduled" && !originInsideRaw) {
          dwellTrackingRef.current.delete(`${load.id}-origin-dwell`);
        }

        if (originDepot && load.status === "scheduled" && wasAtOrigin === true && isAtOrigin === false) {
          const entryTime = geofenceEntryRef.current.get(originEntryKey);
          if (entryTime) {
            if (!load.actual_loading_arrival) {
              const eventKey = `${load.id}-loading_arrival-${dateKey}`;
              if (!processedEventsRef.current.has(eventKey)) {
                processedEventsRef.current.add(eventKey);
                geofenceUpdateMutation.mutate({
                  loadId: load.id,
                  eventType: "loading_arrival" as GeofenceEventType,
                  timestamp,
                  ...eventCtx,
                  geofenceName: originDepot.name,
                });
              }
            } else if (!load.actual_loading_departure) {
              const eventKey = `${load.id}-loading_departure-${dateKey}`;
              if (!processedEventsRef.current.has(eventKey)) {
                processedEventsRef.current.add(eventKey);
                geofenceUpdateMutation.mutate({
                  loadId: load.id,
                  eventType: "loading_departure" as GeofenceEventType,
                  timestamp,
                  ...eventCtx,
                  geofenceName: originDepot.name,
                });
              }
            }
            geofenceEntryRef.current.delete(originEntryKey);
          }
        }

        // === ORIGIN EXIT-DWELL FALLBACK (scheduled → in-transit) ===
        // If loading_arrival was recorded and vehicle is now OUTSIDE origin for 10+ min,
        // auto-fire loading_departure so load progresses to in-transit.
        if (originDepot && load.status === "scheduled" && load.actual_loading_arrival && !load.actual_loading_departure) {
          const originExitDwellKey = `${load.id}-origin-exit-dwell`;
          if (!originInsideRaw) {
            const depEventKey = `${load.id}-loading_departure-${dateKey}`;
            if (!processedEventsRef.current.has(depEventKey)) {
              if (!exitDwellTrackingRef.current.has(originExitDwellKey)) {
                exitDwellTrackingRef.current.set(originExitDwellKey, { wall: nowTs, fix: fixTs });
              } else {
                const exitStart = exitDwellTrackingRef.current.get(originExitDwellKey)!;
                const exitMinutes = (nowTs.getTime() - exitStart.wall.getTime()) / (1000 * 60);
                if (exitMinutes >= 10) {
                  processedEventsRef.current.add(depEventKey);
                  console.log(`[Geofence ExitDwell] Scheduled load ${load.load_id}: vehicle outside origin ${originDepot.name} for ${exitMinutes.toFixed(1)}min — auto-firing loading_departure`);
                  geofenceUpdateMutation.mutate({
                    loadId: load.id,
                    eventType: "loading_departure" as GeofenceEventType,
                    timestamp: exitStart.fix,
                    ...eventCtx,
                    geofenceName: originDepot.name,
                  });
                  exitDwellTrackingRef.current.delete(originExitDwellKey);
                  geofenceEntryRef.current.delete(originEntryKey);
                }
              }
            }
          } else {
            // Vehicle is back inside origin, reset exit-dwell timer
            exitDwellTrackingRef.current.delete(originExitDwellKey);
          }
        }

        // === DESTINATION GEOFENCE ===
        if (destinationDepot && load.status === "in-transit") {
          const justEnteredDest =
            (wasAtDestination === false && isAtDestination === true) ||
            (wasAtDestination === null && isAtDestination === true);

          if (justEnteredDest && !geofenceEntryRef.current.has(destEntryKey)) {
            geofenceEntryRef.current.set(destEntryKey, timestamp);
            stationaryTrackingRef.current.set(destEntryKey, { entryTime: timestamp, stationaryStartTime: null });
            dwellTrackingRef.current.delete(`${load.id}-dest-dwell`);
            const destArrivalEventKey = `${load.id}-offloading_arrival-${dateKey}`;
            if (!processedEventsRef.current.has(destArrivalEventKey) && !load.actual_offloading_arrival) {
              console.log('[Geofence Transition] offloading_arrival', {
                load: load.load_id,
                vehicle: eventCtx.vehicleRegistration,
                geofence: destinationDepot.name,
              });
              geofenceUpdateMutation.mutate({
                loadId: load.id,
                eventType: "offloading_arrival" as GeofenceEventType,
                timestamp,
                ...eventCtx,
                geofenceName: destinationDepot.name,
              });
              processedEventsRef.current.add(destArrivalEventKey);
            }
          }
        }

        // === DESTINATION DWELL-TIME FALLBACK (in-transit) ===
        // If vehicle is inside destination for 10+ min without transition entry, auto-fire offloading_arrival
        if (destinationDepot && load.status === "in-transit" && destInsideRaw && !load.actual_offloading_arrival) {
          const destDwellKey = `${load.id}-dest-dwell`;
          const destArrivalEventKey = `${load.id}-offloading_arrival-${dateKey}`;
          if (!processedEventsRef.current.has(destArrivalEventKey)) {
            if (!dwellTrackingRef.current.has(destDwellKey)) {
              dwellTrackingRef.current.set(destDwellKey, { wall: nowTs, fix: fixTs });
            } else {
              const dwellStart = dwellTrackingRef.current.get(destDwellKey)!;
              const dwellMinutes = (nowTs.getTime() - dwellStart.wall.getTime()) / (1000 * 60);
              if (dwellMinutes >= 10) {
                processedEventsRef.current.add(destArrivalEventKey);
                if (!geofenceEntryRef.current.has(destEntryKey)) {
                  geofenceEntryRef.current.set(destEntryKey, dwellStart.wall);
                  stationaryTrackingRef.current.set(destEntryKey, { entryTime: dwellStart.wall, stationaryStartTime: null });
                }
                console.log(`[Geofence Dwell] In-transit load ${load.load_id}: vehicle inside destination ${destinationDepot.name} for ${dwellMinutes.toFixed(1)}min — auto-firing offloading_arrival`);
                geofenceUpdateMutation.mutate({
                  loadId: load.id,
                  eventType: "offloading_arrival" as GeofenceEventType,
                  timestamp: dwellStart.fix,
                  ...eventCtx,
                  geofenceName: destinationDepot.name,
                });
                dwellTrackingRef.current.delete(destDwellKey);
              }
            }
          }
        } else if (destinationDepot && load.status === "in-transit" && !destInsideRaw) {
          dwellTrackingRef.current.delete(`${load.id}-dest-dwell`);
        }

        if (destinationDepot && load.status === "in-transit" && isAtDestination) {
          const tracking = stationaryTrackingRef.current.get(destEntryKey);
          if (tracking) {
            const isStationary = (asset.speedKmH ?? 0) < 1;
            if (isStationary) {
              if (!tracking.stationaryStartTime) {
                stationaryTrackingRef.current.set(destEntryKey, { ...tracking, stationaryStartTime: nowTs });
              } else {
                const stationaryDurationMs = nowTs.getTime() - tracking.stationaryStartTime.getTime();
                const stationaryDurationMinutes = stationaryDurationMs / (1000 * 60);

                if (stationaryDurationMinutes >= 5 && !load.actual_offloading_arrival) {
                  const eventKey = `${load.id}-offloading_arrival-stationary-${dateKey}`;
                  if (!processedEventsRef.current.has(eventKey) && !processedEventsRef.current.has(`${load.id}-offloading_arrival-${dateKey}`)) {
                    processedEventsRef.current.add(eventKey);
                    geofenceUpdateMutation.mutate({
                      loadId: load.id,
                      eventType: "offloading_arrival" as GeofenceEventType,
                      timestamp,
                      ...eventCtx,
                      geofenceName: destinationDepot.name,
                    });
                  }
                }
              }
            } else if (tracking.stationaryStartTime) {
              stationaryTrackingRef.current.set(destEntryKey, { ...tracking, stationaryStartTime: null });
            }
          }
        }

        if (destinationDepot && load.status === "in-transit" && wasAtDestination === true && isAtDestination === false) {
          const entryTime = geofenceEntryRef.current.get(destEntryKey);
          if (entryTime) {
            if (!load.actual_offloading_arrival) {
              const eventKey = `${load.id}-offloading_arrival-${dateKey}`;
              if (!processedEventsRef.current.has(eventKey)) {
                processedEventsRef.current.add(eventKey);
                geofenceUpdateMutation.mutate({
                  loadId: load.id,
                  eventType: "offloading_arrival" as GeofenceEventType,
                  timestamp,
                  ...eventCtx,
                  geofenceName: destinationDepot.name,
                });
              }
            } else if (!load.actual_offloading_departure) {
              const eventKey = `${load.id}-offloading_departure-${dateKey}`;
              if (!processedEventsRef.current.has(eventKey)) {
                processedEventsRef.current.add(eventKey);
                geofenceUpdateMutation.mutate({
                  loadId: load.id,
                  eventType: "offloading_departure" as GeofenceEventType,
                  timestamp,
                  ...eventCtx,
                  geofenceName: destinationDepot.name,
                  onDeliveryComplete: () => {
                    if (onDeliveryCompleteRef.current) {
                      onDeliveryCompleteRef.current(load);
                    }
                  },
                });

                geofenceEntryRef.current.delete(originEntryKey);
                geofenceEntryRef.current.delete(destEntryKey);
                stationaryTrackingRef.current.delete(destEntryKey);
                insideCountRef.current.delete(originKeyForHyst);
                insideCountRef.current.delete(destKeyForHyst);
                dwellTrackingRef.current.delete(`${load.id}-origin-dwell`);
                dwellTrackingRef.current.delete(`${load.id}-dest-dwell`);
                exitDwellTrackingRef.current.delete(`${load.id}-origin-exit-dwell`);
                exitDwellTrackingRef.current.delete(`${load.id}-dest-exit-dwell`);

                const keysToDelete: string[] = [];
                processedEventsRef.current.forEach((k) => {
                  if (k.startsWith(`${load.id}-`)) keysToDelete.push(k);
                });
                keysToDelete.forEach((k) => processedEventsRef.current.delete(k));
              }
            }
            geofenceEntryRef.current.delete(destEntryKey);
            stationaryTrackingRef.current.delete(destEntryKey);
          }
        }

        // === DESTINATION EXIT-DWELL FALLBACK (in-transit → delivered) ===
        // If offloading_arrival was recorded and vehicle is now OUTSIDE destination for 10+ min,
        // auto-fire offloading_departure so load progresses to delivered.
        if (destinationDepot && load.status === "in-transit" && load.actual_offloading_arrival && !load.actual_offloading_departure) {
          const destExitDwellKey = `${load.id}-dest-exit-dwell`;
          if (!destInsideRaw) {
            const depEventKey = `${load.id}-offloading_departure-${dateKey}`;
            if (!processedEventsRef.current.has(depEventKey)) {
              if (!exitDwellTrackingRef.current.has(destExitDwellKey)) {
                exitDwellTrackingRef.current.set(destExitDwellKey, { wall: nowTs, fix: fixTs });
              } else {
                const exitStart = exitDwellTrackingRef.current.get(destExitDwellKey)!;
                const exitMinutes = (nowTs.getTime() - exitStart.wall.getTime()) / (1000 * 60);
                if (exitMinutes >= 10) {
                  processedEventsRef.current.add(depEventKey);
                  console.log(`[Geofence ExitDwell] In-transit load ${load.load_id}: vehicle outside destination ${destinationDepot.name} for ${exitMinutes.toFixed(1)}min — auto-firing offloading_departure`);
                  geofenceUpdateMutation.mutate({
                    loadId: load.id,
                    eventType: "offloading_departure" as GeofenceEventType,
                    timestamp: exitStart.fix,
                    ...eventCtx,
                    geofenceName: destinationDepot.name,
                    onDeliveryComplete: () => {
                      if (onDeliveryCompleteRef.current) {
                        onDeliveryCompleteRef.current(load);
                      }
                    },
                  });
                  // Cleanup all tracking for this load
                  exitDwellTrackingRef.current.delete(destExitDwellKey);
                  geofenceEntryRef.current.delete(originEntryKey);
                  geofenceEntryRef.current.delete(destEntryKey);
                  stationaryTrackingRef.current.delete(destEntryKey);
                  insideCountRef.current.delete(originKeyForHyst);
                  insideCountRef.current.delete(destKeyForHyst);
                  dwellTrackingRef.current.delete(`${load.id}-origin-dwell`);
                  dwellTrackingRef.current.delete(`${load.id}-dest-dwell`);
                  exitDwellTrackingRef.current.delete(`${load.id}-origin-exit-dwell`);
                }
              }
            }
          } else {
            // Vehicle is back inside destination, reset exit-dwell timer
            exitDwellTrackingRef.current.delete(destExitDwellKey);
          }
        }
      }

      // Update position for the vehicle, but only if we haven't already processed it for another load in this tick
      if (!updatedVehiclesInTick.has(vehicleKey)) {
        previousPositionsRef.current.set(vehicleKey, currentPos);
        updatedVehiclesInTick.add(vehicleKey);
      }
    }
  }, [loadsWithAssets, geofenceUpdateMutation, extraDepots]);

  // ==========================================================================
  // MUTARE DEPOT ALL-VEHICLE ACTIVITY MONITOR
  // Tracks every telematics asset entering / leaving the Mutare Depot,
  // independent of any load assignment. Each transition is logged to
  // geofence_events (event_type = 'depot_entry' | 'depot_exit') and a toast
  // notification is shown so dispatchers see the activity in real time.
  // ==========================================================================
  const mutareInsideRef = useRef<Map<string, boolean>>(new Map());
  const mutareLoggedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || telematicsAssets.length === 0) return;
    const mutareDepot = DEPOTS.find((d) => d.id === "mutare-depot");
    if (!mutareDepot) return;

    for (const asset of telematicsAssets) {
      if (asset.lastLatitude == null || asset.lastLongitude == null) continue;
      const vehicleKey = asset.id?.toString() || asset.registrationNumber || "";
      if (!vehicleKey) continue;

      const isInside = isWithinDepot(asset.lastLatitude, asset.lastLongitude, mutareDepot);
      const wasInside = mutareInsideRef.current.get(vehicleKey);

      if (wasInside === undefined) {
        // First observation — seed state without firing an event.
        mutareInsideRef.current.set(vehicleKey, isInside);
        continue;
      }
      if (wasInside === isInside) continue;

      mutareInsideRef.current.set(vehicleKey, isInside);

      const eventType = isInside ? "depot_entry" : "depot_exit";
      const timestamp = new Date(); // wall clock — dedupe only
      // Record the GPS fix time (falls back to wall clock) so the logged event
      // time reflects when the vehicle was physically at the depot.
      const eventTimeTs = getAssetFixTime(asset) ?? timestamp;
      const vehicleReg = asset.registrationNumber || asset.name || vehicleKey;
      // Dedupe across re-renders within the same minute (telematics poll runs every 10s)
      const dedupeKey = `${vehicleKey}-${eventType}-${timestamp.toISOString().slice(0, 16)}`;
      if (mutareLoggedKeysRef.current.has(dedupeKey)) continue;
      mutareLoggedKeysRef.current.add(dedupeKey);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("geofence_events")
        .insert({
          load_id: null,
          load_number: null,
          vehicle_registration: vehicleReg,
          telematics_asset_id: String(asset.id),
          event_type: eventType,
          geofence_name: mutareDepot.name,
          latitude: asset.lastLatitude,
          longitude: asset.lastLongitude,
          event_time: eventTimeTs.toISOString(),
          source: "auto-depot-monitor",
        })
        .then(({ error }: { error: unknown }) => {
          if (error) {
            console.error("[MutareDepot] geofence_events INSERT failed", { vehicleReg, eventType, error });
          }
        });

      if (isInside) {
        toast.success(`${vehicleReg} entered Mutare Depot`, {
          description: `Arrived at ${eventTimeTs.toLocaleTimeString()}`,
        });
      } else {
        toast.info(`${vehicleReg} left Mutare Depot`, {
          description: `Departed at ${eventTimeTs.toLocaleTimeString()}`,
        });
      }
    }
  }, [telematicsAssets, user]);

  const contextValue = useMemo<GeofenceMonitorContextType>(
    () => ({
      telematicsAssets,
      telematicsLoading,
      telematicsAuthError,
      lastRefresh,
      loadsWithAssets,
      refetch: fetchTelematicsData,
      setDeliveryCompleteCallback: (callback: (load: Load) => void) => {
        onDeliveryCompleteRef.current = callback;
      },
    }),
    [telematicsAssets, telematicsLoading, telematicsAuthError, lastRefresh, loadsWithAssets, fetchTelematicsData]
  );

  return (
    <GeofenceMonitorContext.Provider value={contextValue}>
      {children}
    </GeofenceMonitorContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useGeofenceMonitor() {
  const context = useContext(GeofenceMonitorContext);
  if (context === undefined) {
    throw new Error("useGeofenceMonitor must be used within a GeofenceMonitorProvider");
  }
  return context;
}