/**
 * Export a single trip's full route as a PDF.
 *
 * The PDF contains:
 *  • Page 1 — Trip header info + static tile-based route map with markers
 *  • Page 2 — Segment-by-segment breakdown table + step-by-step narrative
 *
 * Map tiles are fetched from OpenStreetMap (CORS-enabled public tiles).
 * Coordinates are resolved via the DEPOTS / ALL_LOCATIONS registry.
 * Routes now follow actual roads using OSRM routing service.
 */

import type { Load } from "@/types/Trips";
import { COMPANY_NAME, pdfColors } from "@/lib/exportStyles";
import { customLocationToDepot, findDepotByName, type Depot } from "@/lib/depots";
import { parseTimeWindow } from "@/lib/timeWindow";
import { calculateHaversineDistance, findWaypointByName } from "@/lib/waypoints";
import { getLocationDisplayName } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isValid } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ─────────────────────────────────────────────────────────────────────────────
// Slippy-map tile helpers
// ─────────────────────────────────────────────────────────────────────────────

const TILE_SIZE = 256;

/** Returns full pixel position (not constrained to any canvas) for a coordinate at a zoom level. */
function latLonToAbsPixel(
    lat: number,
    lon: number,
    zoom: number,
): { x: number; y: number } {
    const x = ((lon + 180) / 360) * Math.pow(2, zoom) * TILE_SIZE;
    const latRad = (lat * Math.PI) / 180;
    const y =
        ((1 -
            Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
            2) *
        Math.pow(2, zoom) *
        TILE_SIZE;
    return { x, y };
}

/**
 * Choose the highest zoom level where the bounding box (with padding already
 * applied) fits within targetW × targetH pixels.
 */
function chooseZoom(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    targetW: number,
    targetH: number,
    maxZoom: number = 13,
): number {
    for (let zoom = maxZoom; zoom >= 1; zoom--) {
        const tl = latLonToAbsPixel(maxLat, minLon, zoom);
        const br = latLonToAbsPixel(minLat, maxLon, zoom);
        const spanX = br.x - tl.x;
        const spanY = br.y - tl.y;
        if (spanX <= targetW * 0.82 && spanY <= targetH * 0.82) {
            return zoom;
        }
    }
    return 1;
}

/** Load an image from a URL and return it as an HTMLImageElement. */
function loadTileImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Tile load failed: ${url}`));
        img.src = url;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Road routing helpers (OpenRouteService primary, OSRM fallback)
// ─────────────────────────────────────────────────────────────────────────────

/** A single turn-by-turn instruction for one leg of a route. */
export interface RouteStep {
    /** Plain-language instruction such as "Turn right onto N1". */
    instruction: string;
    /** Optional street/road name, when provided by the routing engine. */
    name?: string;
    /** Distance in metres for this step. */
    distanceM: number;
    /** Duration in seconds for this step. */
    durationS: number;
    /** ORS maneuver type code (see ORS step types). Undefined when unknown. */
    type?: number;
    /**
     * Index range into the ORS leg's `way_points` (start, end). Used to derive
     * the next intersection's road name when the instruction itself is bare.
     */
    wayPoints?: [number, number];
}

/** Per-leg metrics + geometry returned from a multi-stop routing call. */
export interface RouteLeg {
    distanceKm: number;
    durationMin: number;
    geometry: Array<{ lat: number; lon: number }>;
    /** Turn-by-turn steps for this leg (empty when the provider didn't return them). */
    steps: RouteStep[];
}

export interface MultiStopRoute {
    legs: RouteLeg[];
    fullGeometry: Array<{ lat: number; lon: number }>;
    totalDistanceKm: number;
    totalDurationMin: number;
    provider: 'ors' | 'osrm' | 'none';
}

type OrsProfile = 'driving-hgv' | 'driving-car';

/**
 * Snap a list of [lon,lat] coordinates to the nearest road on the chosen
 * routing profile via POST /v2/snap/{profile}/json. Returns coordinates in
 * the SAME order as the input. Inputs that fail to snap (outside the search
 * radius) keep their original value so a routing call can still be attempted.
 *
 * The JSON variant is used because the geojson variant returns 406 Not
 * Acceptable on driving-hgv (ORS error 8007). The JSON response has shape:
 *   { locations: [ { location: [lon,lat], name?, snapped_distance } | null, … ] }
 * with one entry per input, in order; null means "outside the search radius".
 */
async function snapCoordinatesORS(
    coords: Array<{ lat: number; lon: number }>,
    profile: OrsProfile,
    apiKey: string,
): Promise<Array<{ lat: number; lon: number }>> {
    if (coords.length === 0) return coords;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(
            `https://api.openrouteservice.org/v2/snap/${profile}/json`,
            {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    Authorization: apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    locations: coords.map((c) => [c.lon, c.lat]),
                    radius: 5000, // metres — generous, depots are often off-network
                }),
            },
        );
        clearTimeout(timeoutId);
        if (!response.ok) {
            console.warn(`ORS snap failed: ${response.status}`);
            return coords;
        }
        const data = await response.json();
        const locations: Array<{ location?: [number, number] } | null> =
            data?.locations ?? [];

        const snapped = coords.slice();
        for (let i = 0; i < locations.length && i < snapped.length; i++) {
            const loc = locations[i];
            const c = loc?.location;
            if (Array.isArray(c) && c.length >= 2) {
                snapped[i] = { lon: c[0], lat: c[1] };
            }
        }
        return snapped;
    } catch (err) {
        console.warn('ORS snap error:', err);
        return coords;
    }
}

/**
 * Single multi-stop request to OpenRouteService.
 * Uses POST /v2/directions/{profile}/geojson which returns a feature whose
 * `properties.segments[]` carries per-leg distance/duration and
 * `properties.way_points` indexes the matching geometry slices.
 *
 * Tries `driving-hgv` first; on a 404 ("no route found"), retries with
 * `driving-car`. Coordinates are snapped to the road network beforehand so
 * waypoints inside yards or off-network return useful results.
 */
async function fetchMultiStopRouteORS(
    coords: Array<{ lat: number; lon: number }>,
): Promise<MultiStopRoute | null> {
    const orsKey = (import.meta.env.VITE_ORS_API_KEY as string | undefined) ?? '';
    if (!orsKey || coords.length < 2) return null;

    const attemptProfile = async (
        profile: OrsProfile,
    ): Promise<MultiStopRoute | null> => {
        const snapped = await snapCoordinatesORS(coords, profile, orsKey);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(
                `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
                {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        Authorization: orsKey,
                        'Content-Type': 'application/json',
                        Accept: 'application/json, application/geo+json',
                    },
                    body: JSON.stringify({
                        // ORS expects [longitude, latitude]
                        coordinates: snapped.map((c) => [c.lon, c.lat]),
                        instructions: true,
                        instructions_format: 'text',
                        units: 'm',
                    }),
                },
            );
            clearTimeout(timeoutId);

            if (!response.ok) {
                let detail = '';
                try {
                    const errBody = await response.json();
                    detail = errBody?.error?.message ?? errBody?.error ?? '';
                } catch {
                    /* ignore body parse failures */
                }
                console.warn(
                    `ORS routing failed (${profile}): ${response.status}${detail ? ` — ${detail}` : ''}`,
                );
                return null;
            }

            const data = await response.json();
            const feature = data?.features?.[0];
            if (!feature) return null;

            const geomCoords: Array<[number, number]> = feature.geometry?.coordinates ?? [];
            if (geomCoords.length < 2) return null;

            const fullGeometry = geomCoords.map((c) => ({ lat: c[1], lon: c[0] }));
            interface OrsSegment {
                distance: number;
                duration: number;
                steps?: Array<{
                    instruction?: string;
                    name?: string;
                    distance?: number;
                    duration?: number;
                    type?: number;
                    way_points?: [number, number];
                }>;
            }
            const segments: OrsSegment[] = feature.properties?.segments ?? [];
            const wayPointIdx: number[] = feature.properties?.way_points ?? [];

            const legs: RouteLeg[] = [];
            for (let i = 0; i < coords.length - 1; i++) {
                const seg = segments[i];
                const startIdx = wayPointIdx[i] ?? 0;
                const endIdx = wayPointIdx[i + 1] ?? fullGeometry.length - 1;
                const slice = fullGeometry.slice(startIdx, endIdx + 1);
                const steps: RouteStep[] = (seg?.steps ?? [])
                    .filter((s) => typeof s.instruction === 'string' && s.instruction.length > 0)
                    .map((s) => ({
                        instruction: s.instruction as string,
                        name: typeof s.name === 'string' && s.name.length > 0 && s.name !== '-'
                            ? s.name
                            : undefined,
                        distanceM: typeof s.distance === 'number' ? s.distance : 0,
                        durationS: typeof s.duration === 'number' ? s.duration : 0,
                        type: typeof s.type === 'number' ? s.type : undefined,
                        wayPoints: Array.isArray(s.way_points) && s.way_points.length === 2
                            ? [s.way_points[0], s.way_points[1]] as [number, number]
                            : undefined,
                    }));
                legs.push({
                    distanceKm: seg ? seg.distance / 1000 : 0,
                    durationMin: seg ? seg.duration / 60 : 0,
                    geometry: slice.length >= 2 ? slice : [coords[i], coords[i + 1]],
                    steps,
                });
            }

            const summary = feature.properties?.summary ?? {
                distance: legs.reduce((s, l) => s + l.distanceKm * 1000, 0),
                duration: legs.reduce((s, l) => s + l.durationMin * 60, 0),
            };

            return {
                legs,
                fullGeometry,
                totalDistanceKm: summary.distance / 1000,
                totalDurationMin: summary.duration / 60,
                provider: 'ors',
            };
        } catch (err) {
            console.warn(`ORS routing error (${profile}):`, err);
            return null;
        }
    };

    return (await attemptProfile('driving-hgv')) ?? (await attemptProfile('driving-car'));
}

/**
 * Multi-stop fallback via OSRM public demo server.
 * Uses `annotations=false` and stitches per-leg geometry from the leg list.
 */
async function fetchMultiStopRouteOSRM(
    coords: Array<{ lat: number; lon: number }>,
): Promise<MultiStopRoute | null> {
    if (coords.length < 2) return null;
    try {
        const path = coords.map((c) => `${c.lon},${c.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.code !== 'Ok' || !data.routes?.[0]) return null;
        const route = data.routes[0];
        const fullGeometry: Array<{ lat: number; lon: number }> =
            route.geometry.coordinates.map((c: [number, number]) => ({
                lat: c[1],
                lon: c[0],
            }));
        // OSRM legs don't expose geometry indices for `overview=full`, so we
        // approximate per-leg geometry by walking the polyline proportionally.
        const legCount = coords.length - 1;
        const legs: RouteLeg[] = [];
        let cursor = 0;
        const totalDist: number = route.distance;
        for (let i = 0; i < legCount; i++) {
            const leg = route.legs?.[i] ?? { distance: 0, duration: 0 };
            const ratio = totalDist > 0 ? leg.distance / totalDist : 1 / legCount;
            const nextCursor = i === legCount - 1
                ? fullGeometry.length
                : Math.max(cursor + 2, cursor + Math.round(fullGeometry.length * ratio));
            const slice = fullGeometry.slice(cursor, Math.min(nextCursor + 1, fullGeometry.length));
            legs.push({
                distanceKm: leg.distance / 1000,
                durationMin: leg.duration / 60,
                geometry: slice.length >= 2 ? slice : [coords[i], coords[i + 1]],
                steps: [],
            });
            cursor = nextCursor;
        }
        return {
            legs,
            fullGeometry,
            totalDistanceKm: route.distance / 1000,
            totalDurationMin: route.duration / 60,
            provider: 'osrm',
        };
    } catch (err) {
        console.warn('OSRM multi-stop routing error:', err);
        return null;
    }
}

/** Try ORS first, then OSRM. Returns null if both fail. */
async function fetchMultiStopRoute(
    coords: Array<{ lat: number; lon: number }>,
): Promise<MultiStopRoute | null> {
    return (await fetchMultiStopRouteORS(coords)) ?? (await fetchMultiStopRouteOSRM(coords));
}

// ─────────────────────────────────────────────────────────────────────────────
// Route point type
// ─────────────────────────────────────────────────────────────────────────────

interface RoutePoint {
    lat: number;
    lon: number;
    /** Short label rendered inside the marker (S, E, 1, 2 …) */
    markerLabel: string;
    /** Full name for reference */
    name: string;
    kind: "start" | "end" | "waypoint";
}

// ─────────────────────────────────────────────────────────────────────────────
// Map renderer
// ─────────────────────────────────────────────────────────────────────────────

/** Target aspect ratio of the map area in the PDF (width / height). */
const MAP_ASPECT = 269 / 108; // matches contentW × 108mm on landscape A4
/** Output pixel width — high enough that scaling into ~269 mm prints sharply. */
const MAP_OUTPUT_W = 2400;
/** Highest zoom level to attempt before falling back. */
const MAP_MAX_ZOOM = 16;

async function renderRouteMap(
    points: RoutePoint[],
    routeGeometry: Array<{ lat: number; lon: number }> | null = null,
): Promise<string | null> {
    if (points.length === 0) return null;

    try {
        // Compute bounds from BOTH the stops AND the road geometry so the
        // map frames the actual route (not just the marker positions).
        const lats = points.map((p) => p.lat);
        const lons = points.map((p) => p.lon);
        if (routeGeometry && routeGeometry.length > 0) {
            for (const g of routeGeometry) {
                lats.push(g.lat);
                lons.push(g.lon);
            }
        }

        const rawMinLat = Math.min(...lats);
        const rawMaxLat = Math.max(...lats);
        const rawMinLon = Math.min(...lons);
        const rawMaxLon = Math.max(...lons);

        // Initial padding so markers don't sit on the edge.
        let minLatRaw = rawMinLat;
        let maxLatRaw = rawMaxLat;
        let minLonRaw = rawMinLon;
        let maxLonRaw = rawMaxLon;
        {
            const latSpan = Math.max(maxLatRaw - minLatRaw, 0.05);
            const lonSpan = Math.max(maxLonRaw - minLonRaw, 0.05);
            const latPad = latSpan * 0.18 + 0.05;
            const lonPad = lonSpan * 0.18 + 0.05;
            minLatRaw -= latPad;
            maxLatRaw += latPad;
            minLonRaw -= lonPad;
            maxLonRaw += lonPad;
        }

        // Expand the bounding box to match the PDF aspect so the rendered map
        // is NEVER stretched by jsPDF's addImage. We compute pixel spans in a
        // probing zoom (independent of TILE_SIZE) — we'll re-check after
        // choosing the actual zoom below.
        const matchAspect = (
            minLat: number,
            maxLat: number,
            minLon: number,
            maxLon: number,
        ): { minLat: number; maxLat: number; minLon: number; maxLon: number } => {
            const z = 8;
            const tl = latLonToAbsPixel(maxLat, minLon, z);
            const br = latLonToAbsPixel(minLat, maxLon, z);
            const w = Math.max(br.x - tl.x, 1);
            const h = Math.max(br.y - tl.y, 1);
            const currentAspect = w / h;
            if (currentAspect > MAP_ASPECT) {
                // Too wide → grow vertically (latitude span).
                const targetH = w / MAP_ASPECT;
                const extraH = targetH - h;
                // Convert pixel delta back to latitude span at zoom z.
                const fullLatSpan = (extraH / (Math.pow(2, z) * TILE_SIZE)) * 360;
                return {
                    minLat: minLat - fullLatSpan / 2,
                    maxLat: maxLat + fullLatSpan / 2,
                    minLon,
                    maxLon,
                };
            } else if (currentAspect < MAP_ASPECT) {
                // Too tall → grow horizontally (longitude span).
                const targetW = h * MAP_ASPECT;
                const extraW = targetW - w;
                const lonSpan = (extraW / (Math.pow(2, z) * TILE_SIZE)) * 360;
                return {
                    minLat,
                    maxLat,
                    minLon: minLon - lonSpan / 2,
                    maxLon: maxLon + lonSpan / 2,
                };
            }
            return { minLat, maxLat, minLon, maxLon };
        };

        const adjusted = matchAspect(minLatRaw, maxLatRaw, minLonRaw, maxLonRaw);
        const minLat = adjusted.minLat;
        const maxLat = adjusted.maxLat;
        const minLon = adjusted.minLon;
        const maxLon = adjusted.maxLon;

        // Choose the highest zoom that fits in our supersampled output.
        const zoom = chooseZoom(
            minLat,
            maxLat,
            minLon,
            maxLon,
            MAP_OUTPUT_W,
            MAP_OUTPUT_W / MAP_ASPECT,
            MAP_MAX_ZOOM,
        );

        // Absolute pixel positions of the bounding box at the chosen zoom.
        const tlAbs = latLonToAbsPixel(maxLat, minLon, zoom);
        const brAbs = latLonToAbsPixel(minLat, maxLon, zoom);

        // Crop window: exactly aspect-matched. We center on the bbox center.
        const bboxW = brAbs.x - tlAbs.x;
        const bboxH = brAbs.y - tlAbs.y;
        let cropW = bboxW;
        let cropH = bboxH;
        if (cropW / cropH > MAP_ASPECT) {
            cropH = cropW / MAP_ASPECT;
        } else {
            cropW = cropH * MAP_ASPECT;
        }
        const centerX = (tlAbs.x + brAbs.x) / 2;
        const centerY = (tlAbs.y + brAbs.y) / 2;
        const cropLeft = centerX - cropW / 2;
        const cropTop = centerY - cropH / 2;

        // Tile range that fully covers the crop window.
        const tileXMin = Math.floor(cropLeft / TILE_SIZE);
        const tileXMax = Math.ceil((cropLeft + cropW) / TILE_SIZE) - 1;
        const tileYMin = Math.floor(cropTop / TILE_SIZE);
        const tileYMax = Math.ceil((cropTop + cropH) / TILE_SIZE) - 1;

        const tilesCanvasW = (tileXMax - tileXMin + 1) * TILE_SIZE;
        const tilesCanvasH = (tileYMax - tileYMin + 1) * TILE_SIZE;

        // Offscreen canvas holding the raw tile mosaic.
        const tilesCanvas = document.createElement("canvas");
        tilesCanvas.width = tilesCanvasW;
        tilesCanvas.height = tilesCanvasH;
        const tilesCtx = tilesCanvas.getContext("2d");
        if (!tilesCtx) return null;

        const tileSubdomains = ["a", "b", "c"];
        const tileJobs: Promise<void>[] = [];

        for (let tx = tileXMin; tx <= tileXMax; tx++) {
            for (let ty = tileYMin; ty <= tileYMax; ty++) {
                const sub =
                    tileSubdomains[Math.abs(tx + ty) % tileSubdomains.length];
                const url = `https://${sub}.tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
                const destX = (tx - tileXMin) * TILE_SIZE;
                const destY = (ty - tileYMin) * TILE_SIZE;

                tileJobs.push(
                    loadTileImage(url)
                        .then((img) => {
                            tilesCtx.drawImage(img, destX, destY);
                        })
                        .catch(() => {
                            tilesCtx.fillStyle = "#e9ecef";
                            tilesCtx.fillRect(destX, destY, TILE_SIZE, TILE_SIZE);
                            tilesCtx.strokeStyle = "#ced4da";
                            tilesCtx.lineWidth = 0.5;
                            tilesCtx.strokeRect(destX, destY, TILE_SIZE, TILE_SIZE);
                        }),
                );
            }
        }

        await Promise.all(tileJobs);

        // Final aspect-correct canvas at the desired output resolution.
        const canvasW = MAP_OUTPUT_W;
        const canvasH = Math.round(MAP_OUTPUT_W / MAP_ASPECT);
        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        // High quality resampling when scaling tiles into output.
        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) {
            (ctx as CanvasRenderingContext2D & { imageSmoothingQuality: ImageSmoothingQuality }).imageSmoothingQuality = 'high';
        }

        // Source rect on the tiles canvas (in tiles-canvas pixels).
        const srcX = cropLeft - tileXMin * TILE_SIZE;
        const srcY = cropTop - tileYMin * TILE_SIZE;

        ctx.drawImage(
            tilesCanvas,
            srcX, srcY, cropW, cropH,
            0, 0, canvasW, canvasH,
        );

        // Scale factor between the tile-canvas pixel space and the output canvas.
        const scaleX = canvasW / cropW;
        const scaleY = canvasH / cropH;

        // Helper: lat/lon → output canvas pixel.
        function toCanvas(lat: number, lon: number): { x: number; y: number } {
            const abs = latLonToAbsPixel(lat, lon, zoom);
            return {
                x: (abs.x - cropLeft) * scaleX,
                y: (abs.y - cropTop) * scaleY,
            };
        }

        // Drawing dimensions scale with the output canvas so strokes / fonts
        // stay perceptually consistent regardless of zoom & aspect math.
        const sizeScale = canvasW / 1280;

        // ── Draw the route ──────────────────────────────────────────────
        if (points.length >= 2) {
            if (routeGeometry && routeGeometry.length >= 2) {
                // Smooth full-route polyline supplied by the routing provider.

                // Shadow stroke for depth
                ctx.beginPath();
                ctx.strokeStyle = "rgba(0,0,0,0.22)";
                ctx.lineWidth = 14 * sizeScale;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                const shadowFirst = toCanvas(routeGeometry[0].lat, routeGeometry[0].lon);
                ctx.moveTo(shadowFirst.x + 2 * sizeScale, shadowFirst.y + 3 * sizeScale);
                for (let j = 1; j < routeGeometry.length; j++) {
                    const px = toCanvas(routeGeometry[j].lat, routeGeometry[j].lon);
                    ctx.lineTo(px.x + 2 * sizeScale, px.y + 3 * sizeScale);
                }
                ctx.stroke();

                // White outline for contrast against busy basemap
                ctx.beginPath();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 12 * sizeScale;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                const outlineFirst = toCanvas(routeGeometry[0].lat, routeGeometry[0].lon);
                ctx.moveTo(outlineFirst.x, outlineFirst.y);
                for (let j = 1; j < routeGeometry.length; j++) {
                    const px = toCanvas(routeGeometry[j].lat, routeGeometry[j].lon);
                    ctx.lineTo(px.x, px.y);
                }
                ctx.stroke();

                // Main road-following line
                ctx.beginPath();
                ctx.strokeStyle = "#2563eb";
                ctx.lineWidth = 8 * sizeScale;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                const first = toCanvas(routeGeometry[0].lat, routeGeometry[0].lon);
                ctx.moveTo(first.x, first.y);
                for (let j = 1; j < routeGeometry.length; j++) {
                    const px = toCanvas(routeGeometry[j].lat, routeGeometry[j].lon);
                    ctx.lineTo(px.x, px.y);
                }
                ctx.stroke();

                // Direction arrows along the polyline (spacing scales with size)
                let accumulated = 0;
                const arrowSpacing = 320 * sizeScale;
                for (let j = 0; j < routeGeometry.length - 1; j++) {
                    const a = toCanvas(routeGeometry[j].lat, routeGeometry[j].lon);
                    const b = toCanvas(routeGeometry[j + 1].lat, routeGeometry[j + 1].lon);
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const segLen = Math.sqrt(dx * dx + dy * dy);
                    accumulated += segLen;
                    if (accumulated >= arrowSpacing && segLen > 18 * sizeScale) {
                        const angle = Math.atan2(dy, dx);
                        const midX = a.x + dx * 0.5;
                        const midY = a.y + dy * 0.5;
                        const arrowSize = 14 * sizeScale;
                        ctx.save();
                        ctx.translate(midX, midY);
                        ctx.rotate(angle);
                        ctx.beginPath();
                        ctx.moveTo(arrowSize, 0);
                        ctx.lineTo(-arrowSize, -arrowSize * 0.55);
                        ctx.lineTo(-arrowSize, arrowSize * 0.55);
                        ctx.closePath();
                        ctx.fillStyle = "#1d4ed8";
                        ctx.fill();
                        ctx.strokeStyle = "#ffffff";
                        ctx.lineWidth = 2 * sizeScale;
                        ctx.stroke();
                        ctx.restore();
                        accumulated = 0;
                    }
                }
            } else {
                // No routing data — draw dashed straight lines per leg.
                for (let i = 0; i < points.length - 1; i++) {
                    const fromPx = toCanvas(points[i].lat, points[i].lon);
                    const toPx = toCanvas(points[i + 1].lat, points[i + 1].lon);

                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(37, 99, 235, 0.55)";
                    ctx.lineWidth = 5 * sizeScale;
                    ctx.lineJoin = "round";
                    ctx.lineCap = "round";
                    ctx.setLineDash([16 * sizeScale, 12 * sizeScale]);
                    ctx.moveTo(fromPx.x, fromPx.y);
                    ctx.lineTo(toPx.x, toPx.y);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    const dx = toPx.x - fromPx.x;
                    const dy = toPx.y - fromPx.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 100 * sizeScale) {
                        const angle = Math.atan2(dy, dx);
                        ctx.save();
                        ctx.translate(fromPx.x + dx * 0.5, fromPx.y + dy * 0.5);
                        ctx.rotate(angle);
                        ctx.beginPath();
                        ctx.moveTo(14 * sizeScale, 0);
                        ctx.lineTo(-14 * sizeScale, -8 * sizeScale);
                        ctx.lineTo(-14 * sizeScale, 8 * sizeScale);
                        ctx.closePath();
                        ctx.fillStyle = "rgba(37, 99, 235, 0.7)";
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }
        }

        // Draw markers
        for (const point of points) {
            const { x, y } = toCanvas(point.lat, point.lon);
            const r = (point.kind === "waypoint" ? 18 : 22) * sizeScale;

            // Drop shadow
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = 10 * sizeScale;
            ctx.shadowOffsetX = 1 * sizeScale;
            ctx.shadowOffsetY = 3 * sizeScale;

            // Outer ring (white halo)
            ctx.beginPath();
            ctx.arc(x, y, r + 3 * sizeScale, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // Colored fill
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            if (point.kind === "start") ctx.fillStyle = "#16a34a";
            else if (point.kind === "end") ctx.fillStyle = "#dc2626";
            else ctx.fillStyle = "#ea580c";
            ctx.fill();

            // Subtle inner stroke for crispness
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0,0,0,0.18)";
            ctx.lineWidth = 1.5 * sizeScale;
            ctx.stroke();

            // Label inside marker
            ctx.fillStyle = "#ffffff";
            const fontSize = (point.kind === "waypoint" ? 16 : 20) * sizeScale;
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(point.markerLabel, x, y);

            // Name tooltip bubble
            const nameText =
                point.name.length > 26 ? point.name.slice(0, 25) + "…" : point.name;
            const labelFont = `${15 * sizeScale}px Arial, sans-serif`;
            ctx.font = labelFont;
            const textW = ctx.measureText(nameText).width;
            const bubbleW = textW + 16 * sizeScale;
            const bubbleH = 26 * sizeScale;
            const bubbleX = x - bubbleW / 2;
            const bubbleY = y - r - bubbleH - 6 * sizeScale;

            ctx.fillStyle = "rgba(17, 24, 39, 0.88)";
            const bRad = 5 * sizeScale;
            ctx.beginPath();
            ctx.moveTo(bubbleX + bRad, bubbleY);
            ctx.lineTo(bubbleX + bubbleW - bRad, bubbleY);
            ctx.quadraticCurveTo(
                bubbleX + bubbleW,
                bubbleY,
                bubbleX + bubbleW,
                bubbleY + bRad,
            );
            ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH - bRad);
            ctx.quadraticCurveTo(
                bubbleX + bubbleW,
                bubbleY + bubbleH,
                bubbleX + bubbleW - bRad,
                bubbleY + bubbleH,
            );
            // Pointer
            ctx.lineTo(x + 7 * sizeScale, bubbleY + bubbleH);
            ctx.lineTo(x, bubbleY + bubbleH + 7 * sizeScale);
            ctx.lineTo(x - 7 * sizeScale, bubbleY + bubbleH);
            ctx.lineTo(bubbleX + bRad, bubbleY + bubbleH);
            ctx.quadraticCurveTo(
                bubbleX,
                bubbleY + bubbleH,
                bubbleX,
                bubbleY + bubbleH - bRad,
            );
            ctx.lineTo(bubbleX, bubbleY + bRad);
            ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + bRad, bubbleY);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#ffffff";
            ctx.font = labelFont;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(nameText, x, bubbleY + bubbleH / 2);
        }

        // OSM attribution (required by tile usage policy)
        const attrib = "© OpenStreetMap contributors";
        ctx.font = `${14 * sizeScale}px Arial, sans-serif`;
        const atW = ctx.measureText(attrib).width + 14 * sizeScale;
        const atH = 22 * sizeScale;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(canvasW - atW - 4, canvasH - atH - 4, atW, atH);
        ctx.fillStyle = "#222222";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(attrib, canvasW - 11, canvasH - atH / 2 - 4);

        // PNG keeps the basemap labels and route line crisp in the PDF.
        return canvas.toDataURL("image/png");
    } catch (error) {
        console.error("Failed to render route map:", error);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate lookup
// ─────────────────────────────────────────────────────────────────────────────

function lookupCoords(
    name: string,
    extraLocations: Depot[] = [],
): { lat: number; lon: number } | null {
    if (!name) return null;
    const depot = findDepotByName(name, extraLocations);
    if (depot && depot.latitude && depot.longitude) {
        return { lat: depot.latitude, lon: depot.longitude };
    }
    // Fallback: try the waypoints/geofences JSON dataset (much larger registry)
    const wp = findWaypointByName(name);
    if (wp && wp.latitude && wp.longitude) {
        return { lat: wp.latitude, lon: wp.longitude };
    }
    return null;
}

/** Fetch active custom_locations from Supabase, converted to Depot shape. */
async function fetchCustomDepots(): Promise<Depot[]> {
    try {
        const { data, error } = await supabase
            .from("custom_locations")
            .select("id, name, latitude, longitude, type, country")
            .eq("is_active", true);
        if (error || !data) return [];
        return data
            .filter((l) => l.latitude != null && l.longitude != null)
            .map((l) =>
                customLocationToDepot({
                    id: l.id,
                    name: l.name,
                    latitude: l.latitude as number | null,
                    longitude: l.longitude as number | null,
                    type: l.type,
                    country: l.country,
                }),
            );
    } catch {
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format a number of minutes as e.g. "4h 25m" / "55m". */
function formatDuration(minutes: number): string {
    if (!Number.isFinite(minutes) || minutes <= 0) return "—";
    const total = Math.round(minutes);
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h <= 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/** Distance phrasing tuned for road navigation. */
function formatDistanceForDriver(meters: number): string {
    if (!Number.isFinite(meters) || meters <= 0) return "a short distance";
    if (meters < 50) return "a few metres";
    if (meters < 1000) {
        const rounded = Math.round(meters / 10) * 10;
        return `about ${rounded.toLocaleString()} m`;
    }
    if (meters < 10_000) {
        return `about ${(meters / 1000).toFixed(1)} km`;
    }
    return `about ${Math.round(meters / 1000).toLocaleString()} km`;
}

/** Loose maneuver verbs for ORS step `type` codes. */
function maneuverHint(type: number | undefined): string | null {
    switch (type) {
        case 0: return "make a left turn";
        case 1: return "make a right turn";
        case 2: return "make a sharp left";
        case 3: return "make a sharp right";
        case 4: return "bear slightly left";
        case 5: return "bear slightly right";
        case 6: return "continue straight";
        case 7: return "enter the roundabout";
        case 8: return "exit the roundabout";
        case 9: return "make a U-turn";
        case 10: return "you will arrive at your destination";
        case 11: return "head off";
        case 12: return "keep to the left";
        case 13: return "keep to the right";
        default: return null;
    }
}

/**
 * Build a richer driver-facing description from an ORS step + the following
 * step's context. Returns 1-3 sentences that explain WHAT to do and WHAT to
 * watch for next.
 */
function buildDirection(step: RouteStep, next: RouteStep | null, isFirst: boolean, isLast: boolean): string {
    const dist = step.distanceM;
    const onRoad = step.name ? ` on ${step.name}` : "";
    const fallbackInstruction = step.instruction.replace(/\s+/g, " ").trim();

    // Departure
    if (isFirst || step.type === 11) {
        const head = `${fallbackInstruction}.`;
        if (next) {
            const cue = next.name
                ? `Continue ${formatDistanceForDriver(dist)}${onRoad} until you can ${maneuverHint(next.type) ?? "follow the next instruction"} onto ${next.name}.`
                : `Continue ${formatDistanceForDriver(dist)}${onRoad} until you ${maneuverHint(next.type) ?? "reach the next turn"}.`;
            return `${head} ${cue}`;
        }
        return `${head} Continue ${formatDistanceForDriver(dist)}${onRoad}.`;
    }

    // Arrival
    if (isLast || step.type === 10) {
        return `You have arrived at the destination. The trip ends here.`;
    }

    // Roundabouts deserve their own template
    if (step.type === 7) {
        const exitCue = next?.name
            ? ` and take the exit toward ${next.name}.`
            : ".";
        return `${fallbackInstruction}${exitCue}`;
    }

    // The maneuver itself
    const verb = maneuverHint(step.type);
    let opening: string;
    if (step.name) {
        opening = verb
            ? `${verb.charAt(0).toUpperCase()}${verb.slice(1)} onto ${step.name}.`
            : `${fallbackInstruction}.`;
    } else if (verb) {
        opening = `${verb.charAt(0).toUpperCase()}${verb.slice(1)} at the next intersection.`;
    } else {
        opening = `${fallbackInstruction}.`;
    }

    // What to do AFTER making the maneuver
    let followOn: string;
    if (dist >= 200 && next) {
        const nextVerb = maneuverHint(next.type);
        if (next.name && nextVerb && next.type !== 10) {
            followOn = ` Continue for ${formatDistanceForDriver(dist)}${onRoad}, then ${nextVerb} onto ${next.name}.`;
        } else if (nextVerb && next.type !== 10) {
            followOn = ` Continue for ${formatDistanceForDriver(dist)}${onRoad}, then ${nextVerb}.`;
        } else if (next.name) {
            followOn = ` Continue for ${formatDistanceForDriver(dist)}${onRoad} until you reach ${next.name}.`;
        } else {
            followOn = ` Continue for ${formatDistanceForDriver(dist)}${onRoad} before the next instruction.`;
        }
    } else if (dist > 0 && next) {
        const nextVerb = maneuverHint(next.type);
        if (next.name && nextVerb && next.type !== 10) {
            followOn = ` After ${formatDistanceForDriver(dist)} you will ${nextVerb} onto ${next.name}.`;
        } else if (nextVerb && next.type !== 10) {
            followOn = ` After ${formatDistanceForDriver(dist)} you will ${nextVerb}.`;
        } else if (next.name) {
            followOn = ` ${next.name} is the next road.`;
        } else {
            followOn = "";
        }
    } else {
        followOn = "";
    }

    return `${opening}${followOn}`.trim();
}

function safeDate(dateStr: string | null | undefined, fmt: string): string {
    if (!dateStr) return "N/A";
    try {
        const d = parseISO(dateStr);
        if (!isValid(d)) return "N/A";
        return format(d, fmt);
    } catch {
        return "N/A";
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export function
// ─────────────────────────────────────────────────────────────────────────────

export async function exportRoutePdf(load: Load): Promise<void> {
    const tw = parseTimeWindow(load.time_window);
    const tripWaypoints = tw.waypoints ?? [];

    // Pre-fetch custom locations once so subsequent lookups are sync
    const customDepots = await fetchCustomDepots();

    // Normalize origin/destination — these can be plain strings OR objects
    // (third-party loads store them as { placeName, address, ... }).
    const originName = getLocationDisplayName(load.origin) || String(load.origin ?? "");
    const destinationName =
        getLocationDisplayName(load.destination) || String(load.destination ?? "");

    // ── Build ordered stop list ──────────────────────────────────────────────
    interface Stop {
        name: string;
        type: string;
        plannedArrival?: string;
        plannedDeparture?: string;
        notes?: string;
    }

    const stops: Stop[] = [
        {
            name: originName,
            type: "Loading Point",
            plannedArrival: tw.origin.plannedArrival || undefined,
            plannedDeparture: tw.origin.plannedDeparture || undefined,
        },
        ...tripWaypoints.map((wp) => ({
            name: getLocationDisplayName(wp.placeName) || String(wp.placeName ?? ""),
            type:
                wp.type === "pickup"
                    ? "Pickup"
                    : wp.type === "delivery"
                        ? "Delivery"
                        : wp.type === "border"
                            ? "Border Crossing"
                            : wp.type === "stop"
                                ? "Truck Stop"
                                : "Stop",
            plannedArrival: wp.plannedArrival,
            plannedDeparture: wp.plannedDeparture,
            notes: wp.notes,
        })),
        {
            name: destinationName,
            type: "Offloading Point",
            plannedArrival: tw.destination.plannedArrival || undefined,
            plannedDeparture: tw.destination.plannedDeparture || undefined,
        },
    ];

    // ── Resolve coordinates ──────────────────────────────────────────────────
    const routePoints: RoutePoint[] = [];
    const missingCoords: string[] = [];
    for (let i = 0; i < stops.length; i++) {
        const coords = lookupCoords(stops[i].name, customDepots);
        if (!coords) {
            missingCoords.push(stops[i].name || `Stop ${i + 1}`);
            continue;
        }

        const isFirst = i === 0;
        const isLast = i === stops.length - 1;
        routePoints.push({
            lat: coords.lat,
            lon: coords.lon,
            name: stops[i].name,
            markerLabel: isFirst ? "S" : isLast ? "E" : String(i),
            kind: isFirst ? "start" : isLast ? "end" : "waypoint",
        });
    }

    // ── Fetch road geometry + per-leg metrics in a single multi-stop call ──
    let multiStopRoute: MultiStopRoute | null = null;
    if (routePoints.length >= 2) {
        multiStopRoute = await fetchMultiStopRoute(
            routePoints.map((p) => ({ lat: p.lat, lon: p.lon })),
        );
    }
    const routingProvider = multiStopRoute?.provider ?? 'none';

    // ── Compute segment distances (real road metrics where available) ──────
    interface SegmentInfo {
        fromIdx: number;
        toIdx: number;
        from: string;
        fromType: string;
        to: string;
        toType: string;
        /** Distance shown in the table — road km if available, otherwise haversine. */
        distanceKm: number;
        /** True when the value was supplied by the routing provider. */
        isRoadDistance: boolean;
        /** Drive time in minutes (0 when unknown). */
        durationMin: number;
        plannedArrival: string;
        plannedDeparture: string;
        notes: string;
    }

    // Map each stop index to the corresponding routePoint index (some stops
    // may be missing coordinates and thus not appear in routePoints).
    const stopIdxToRoutePointIdx = new Map<number, number>();
    {
        let rpIdx = 0;
        for (let i = 0; i < stops.length; i++) {
            const coords = lookupCoords(stops[i].name, customDepots);
            if (coords) {
                stopIdxToRoutePointIdx.set(i, rpIdx);
                rpIdx++;
            }
        }
    }

    const segments: SegmentInfo[] = [];
    for (let i = 0; i < stops.length - 1; i++) {
        const fromRp = stopIdxToRoutePointIdx.get(i);
        const toRp = stopIdxToRoutePointIdx.get(i + 1);

        let distanceKm = 0;
        let durationMin = 0;
        let isRoadDistance = false;

        if (
            multiStopRoute &&
            fromRp !== undefined &&
            toRp !== undefined &&
            toRp === fromRp + 1
        ) {
            const leg = multiStopRoute.legs[fromRp];
            if (leg && leg.distanceKm > 0) {
                distanceKm = Math.round(leg.distanceKm);
                durationMin = Math.round(leg.durationMin);
                isRoadDistance = true;
            }
        }

        if (!isRoadDistance) {
            const fromCoords = lookupCoords(stops[i].name, customDepots);
            const toCoords = lookupCoords(stops[i + 1].name, customDepots);
            distanceKm =
                fromCoords && toCoords
                    ? Math.round(
                        calculateHaversineDistance(
                            fromCoords.lat,
                            fromCoords.lon,
                            toCoords.lat,
                            toCoords.lon,
                        ),
                    )
                    : 0;
        }

        segments.push({
            fromIdx: i,
            toIdx: i + 1,
            from: stops[i].name,
            fromType: stops[i].type,
            to: stops[i + 1].name,
            toType: stops[i + 1].type,
            distanceKm,
            isRoadDistance,
            durationMin,
            plannedArrival: stops[i + 1].plannedArrival ?? "—",
            plannedDeparture: stops[i + 1].plannedDeparture ?? "—",
            notes: stops[i + 1].notes ?? "—",
        });
    }

    const totalKm = multiStopRoute
        ? Math.round(multiStopRoute.totalDistanceKm)
        : segments.reduce((s, seg) => s + seg.distanceKm, 0);
    const totalDurationMin = multiStopRoute ? multiStopRoute.totalDurationMin : 0;
    const anyRoadMetrics = segments.some((s) => s.isRoadDistance);

    // ── Render map (passes precomputed road geometry) ────────────────────────
    const mapDataUrl =
        routePoints.length >= 2
            ? await renderRouteMap(routePoints, multiStopRoute?.fullGeometry ?? null)
            : null;

    // ── Build PDF ─────────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    // jsPDF with autoTable — cast for finalY access
    const docEx = doc as jsPDF & { lastAutoTable?: { finalY: number } };

    const pageW = doc.internal.pageSize.getWidth(); // 297mm
    const pageH = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 14;
    const contentW = pageW - margin * 2;
    const navy = pdfColors.navy;

    // ── PAGE 1 ────────────────────────────────────────────────────────────────

    // Header band — title block
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setFillColor(...pdfColors.navyDark);
    doc.rect(0, 22, pageW, 1.5, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(COMPANY_NAME, margin, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(200, 215, 235);
    doc.text("Route Plan & Driver Briefing", margin, 17);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(load.load_id, pageW - margin, 11, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(200, 215, 235);
    doc.text(
        `Generated ${format(new Date(), "dd MMM yyyy · HH:mm")}`,
        pageW - margin,
        17,
        { align: "right" },
    );
    doc.setTextColor(0, 0, 0);

    let y = 28;

    // Origin → Destination strip ─────────────────────────────────────────────
    doc.setFillColor(...pdfColors.offWhite);
    doc.setDrawColor(...pdfColors.lightGray);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 11, 1.5, 1.5, "FD");
    doc.setTextColor(...pdfColors.textMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("ROUTE", margin + 4, y + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...pdfColors.charcoal);
    const routeLine = `${originName}    \u00BB    ${destinationName}`;
    doc.text(routeLine, margin + 4, y + 8.5);
    y += 14;

    // KPI cards ──────────────────────────────────────────────────────────────
    const kpis: { label: string; value: string; sub?: string }[] = [
        {
            label: "Loading Date",
            value: safeDate(load.loading_date, "dd MMM yyyy"),
            sub: safeDate(load.loading_date, "EEEE"),
        },
        {
            label: "Offloading Date",
            value: safeDate(load.offloading_date, "dd MMM yyyy"),
            sub: safeDate(load.offloading_date, "EEEE"),
        },
        {
            label: anyRoadMetrics ? "Road Distance" : "Distance (est.)",
            value: totalKm > 0
                ? `${anyRoadMetrics ? "" : "~"}${totalKm.toLocaleString()} km`
                : "—",
            sub: totalDurationMin > 0
                ? `Drive time ~ ${formatDuration(totalDurationMin)}`
                : routingProvider === 'none' ? "no road data" : undefined,
        },
        {
            label: "Stops",
            value: `${stops.length}`,
            sub: `${tripWaypoints.length} waypoint${tripWaypoints.length !== 1 ? "s" : ""}`,
        },
        {
            label: "Driver",
            value: load.driver?.name ?? "Unassigned",
        },
        {
            label: "Vehicle",
            value: load.fleet_vehicle?.vehicle_id ?? "Unassigned",
        },
    ];

    const kpiCols = 4;
    const kpiGap = 3;
    const kpiW = (contentW - kpiGap * (kpiCols - 1)) / kpiCols;
    const kpiH = 17;
    kpis.forEach((k, idx) => {
        const col = idx % kpiCols;
        const row = Math.floor(idx / kpiCols);
        const x = margin + col * (kpiW + kpiGap);
        const ky = y + row * (kpiH + kpiGap);

        // Card background
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...pdfColors.lightGray);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, ky, kpiW, kpiH, 1.5, 1.5, "FD");
        // Accent strip on the left
        doc.setFillColor(...pdfColors.blue);
        doc.rect(x, ky, 1.4, kpiH, "F");

        // Label
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.8);
        doc.setTextColor(...pdfColors.textMuted);
        doc.text(k.label.toUpperCase(), x + 4, ky + 4.5);
        // Value
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...pdfColors.charcoal);
        const value = k.value.length > 24 ? k.value.slice(0, 23) + "…" : k.value;
        doc.text(value, x + 4, ky + 10);
        // Sub
        if (k.sub) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...pdfColors.textMuted);
            doc.text(k.sub, x + 4, ky + 14.5);
        }
    });

    y += Math.ceil(kpis.length / kpiCols) * (kpiH + kpiGap) + 2;

    // Map image ───────────────────────────────────────────────────────────────
    // Use the exact aspect that renderRouteMap targets so jsPDF doesn't squash.
    const mapW = contentW;
    const mapH = mapW / (269 / 108); // matches MAP_ASPECT
    if (mapDataUrl) {
        doc.addImage(mapDataUrl, "PNG", margin, y, mapW, mapH, undefined, "FAST");
        doc.setDrawColor(...pdfColors.lightGray);
        doc.setLineWidth(0.4);
        doc.rect(margin, y, mapW, mapH, "S");
    } else {
        doc.setFillColor(...pdfColors.offWhite);
        doc.setDrawColor(...pdfColors.lightGray);
        doc.rect(margin, y, mapW, mapH, "FD");
        doc.setTextColor(...pdfColors.textMuted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Map unavailable", pageW / 2, y + mapH / 2 - 3, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const missingLine =
            missingCoords.length > 0
                ? `Coordinates not found for: ${missingCoords.join(", ")}`
                : "Need at least 2 located stops to draw a route.";
        doc.text(missingLine, pageW / 2, y + mapH / 2 + 3, { align: "center" });
        doc.setFontSize(7.5);
        doc.text(
            "Add these locations under Settings \u00BB Custom Locations to include them on the map.",
            pageW / 2,
            y + mapH / 2 + 9,
            { align: "center" },
        );
    }

    y += mapH + 3;

    // Legend ──────────────────────────────────────────────────────────────────
    const legendEntries: { rgb: [number, number, number]; label: string }[] = [
        { rgb: [22, 163, 74], label: "S  Loading Point (Start)" },
        { rgb: [220, 38, 38], label: "E  Offloading Point (End)" },
        { rgb: [234, 88, 12], label: "1…  Intermediate Waypoints" },
        { rgb: [37, 99, 235], label: "—  Road-following Route" },
        { rgb: [147, 175, 235], label: "- -  Estimated (no road data)" },
    ];
    let lx = margin;
    for (const entry of legendEntries) {
        doc.setFillColor(...entry.rgb);
        doc.circle(lx + 2.6, y + 2, 2.2, "F");
        doc.setTextColor(...pdfColors.darkGray);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(entry.label, lx + 7, y + 3);
        lx += 56;
    }

    // ── PAGE 2 ────────────────────────────────────────────────────────────────
    doc.addPage();
    y = 0;

    // Page 2 header
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageW, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Route Details  ·  ${load.load_id}`, margin, 10.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(200, 215, 235);
    doc.text(`${originName}  \u00BB  ${destinationName}`, pageW - margin, 10.5, {
        align: "right",
    });
    doc.setTextColor(0, 0, 0);

    y = 22;

    // Section heading helper
    const drawSectionHeading = (label: string) => {
        doc.setFillColor(...pdfColors.blue);
        doc.rect(margin, y - 4.5, 1.6, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...pdfColors.charcoal);
        doc.text(label, margin + 4, y);
        y += 4;
    };

    drawSectionHeading("Segment Breakdown");

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [
            [
                "#",
                "From",
                "Stop Type",
                "To",
                "Stop Type",
                "Distance",
                "Drive Time",
                "Planned Arrival",
                "Planned Departure",
                "Notes",
            ],
        ],
        body: segments.map((seg, i) => [
            String(i + 1),
            seg.from,
            seg.fromType,
            seg.to,
            seg.toType,
            seg.distanceKm > 0
                ? seg.isRoadDistance
                    ? `${seg.distanceKm.toLocaleString()} km`
                    : `~${seg.distanceKm.toLocaleString()} km*`
                : "—",
            seg.durationMin > 0 ? formatDuration(seg.durationMin) : "—",
            seg.plannedArrival,
            seg.plannedDeparture,
            seg.notes,
        ]),
        theme: "grid",
        headStyles: {
            fillColor: navy,
            textColor: [255, 255, 255] as [number, number, number],
            fontSize: 8.5,
            fontStyle: "bold",
            halign: "left",
            cellPadding: { top: 3, bottom: 3, left: 3.5, right: 3.5 },
            lineColor: navy,
            lineWidth: 0.1,
        },
        bodyStyles: {
            fontSize: 8.5,
            cellPadding: { top: 3, bottom: 3, left: 3.5, right: 3.5 },
            textColor: pdfColors.textPrimary,
            lineColor: [225, 230, 240] as [number, number, number],
            lineWidth: 0.15,
            valign: "middle",
        },
        alternateRowStyles: { fillColor: [248, 250, 253] as [number, number, number] },
        columnStyles: {
            0: { cellWidth: 9, halign: "center", fontStyle: "bold" },
            1: { cellWidth: 50 },
            2: { cellWidth: 22 },
            3: { cellWidth: 50 },
            4: { cellWidth: 22 },
            5: { cellWidth: 22, halign: "right", fontStyle: "bold" },
            6: { cellWidth: 18, halign: "right" },
            7: { cellWidth: 23 },
            8: { cellWidth: 23 },
        },
        tableLineColor: [225, 230, 240] as [number, number, number],
        tableLineWidth: 0.15,
    });

    y = (docEx.lastAutoTable?.finalY ?? y) + 4;

    // Provider / source attribution row
    if (totalKm > 0) {
        doc.setFillColor(...pdfColors.offWhite);
        doc.setDrawColor(...pdfColors.lightGray);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentW, 11, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...pdfColors.charcoal);
        const summaryParts = [
            anyRoadMetrics
                ? `Total road distance: ${totalKm.toLocaleString()} km`
                : `Total straight-line distance: ~${totalKm.toLocaleString()} km`,
        ];
        if (totalDurationMin > 0) {
            summaryParts.push(`Drive time: ${formatDuration(totalDurationMin)}`);
        }
        doc.text(summaryParts.join("    ·    "), margin + 4, y + 4.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...pdfColors.textMuted);
        const providerNote =
            routingProvider === 'ors'
                ? "Distances and drive times calculated by OpenRouteService (driving-hgv profile)."
                : routingProvider === 'osrm'
                    ? "Distances and drive times calculated by OSRM (fallback provider)."
                    : "No road routing data available — values shown are straight-line (Haversine) estimates.";
        const asteriskNote = anyRoadMetrics && segments.some((s) => !s.isRoadDistance)
            ? " Rows marked with * are straight-line estimates."
            : "";
        doc.text(providerNote + asteriskNote, margin + 4, y + 9);
        y += 14;
    }

    /** Open a fresh page with the standard navy header band. */
    const newPageWithHeader = (label: string) => {
        doc.addPage();
        doc.setFillColor(...navy);
        doc.rect(0, 0, pageW, 16, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`${label}  ·  ${load.load_id}`, margin, 10.5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(200, 215, 235);
        doc.text(`${originName}  \u00BB  ${destinationName}`, pageW - margin, 10.5, {
            align: "right",
        });
        doc.setTextColor(0, 0, 0);
        y = 22;
    };

    /** Reserve `needed` mm; jump to a new page if we'd run over. */
    const ensureSpace = (needed: number, label = "Route Details") => {
        if (y + needed > pageH - 14) newPageWithHeader(label);
    };

    // Add a new page if we're running low before the narrative.
    ensureSpace(40);
    drawSectionHeading("Step-by-Step Route Narrative");

    for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        const isFirst = i === 0;
        const isLast = i === stops.length - 1;
        const nextSeg = i < segments.length ? segments[i] : null;

        // Estimate space: marker + heading + details + drive line
        const detailLines = [
            stop.plannedArrival ? `Planned arrival: ${stop.plannedArrival}` : null,
            stop.plannedDeparture ? `Planned departure: ${stop.plannedDeparture}` : null,
            stop.notes ? `Note: ${stop.notes}` : null,
        ].filter(Boolean) as string[];
        const blockH = 9 + detailLines.length * 4 + (isLast ? 0 : 9);
        ensureSpace(blockH);

        // Step number + main label
        const markerLabel = isFirst ? "S" : isLast ? "E" : String(i);
        const stepRgb: [number, number, number] = isFirst
            ? [22, 163, 74]
            : isLast
                ? [220, 38, 38]
                : [234, 88, 12];

        // Numbered circle
        doc.setFillColor(...stepRgb);
        doc.circle(margin + 4, y + 1, 4.6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(markerLabel, margin + 4, y + 1.2, { align: "center" });

        // Stop heading — truncate so the type badge always fits on one line
        const headingX = margin + 11;
        const badgeGap = 5;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        const typeText = stop.type;
        const typeW = doc.getTextWidth(typeText) + 6;
        const maxHeadingW = contentW - 11 - badgeGap - typeW - 4;

        doc.setFontSize(11);
        let displayName = stop.name;
        if (doc.getTextWidth(displayName) > maxHeadingW) {
            while (
                displayName.length > 4 &&
                doc.getTextWidth(displayName + "\u2026") > maxHeadingW
            ) {
                displayName = displayName.slice(0, -1);
            }
            displayName = displayName.replace(/\s+\S{0,3}$/, "") + "\u2026";
        }
        doc.setTextColor(...pdfColors.charcoal);
        doc.text(displayName, headingX, y + 1.5);

        // Type badge — placed flush right of the (truncated) heading
        doc.setFontSize(7.5);
        const headingW = doc.getTextWidth(displayName);
        const badgeX = headingX + headingW + badgeGap;
        doc.setFillColor(...pdfColors.lightBlue);
        doc.roundedRect(badgeX, y - 2.5, typeW, 6, 1, 1, "F");
        doc.setTextColor(...pdfColors.blue);
        doc.text(typeText, badgeX + typeW / 2, y + 1.5, { align: "center" });

        // Heading row — leave breathing room before details / pill
        y += 8;

        // Timing & notes
        if (detailLines.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...pdfColors.textMuted);
            for (const line of detailLines) {
                doc.text(line, margin + 11, y);
                y += 4.5;
            }
            y += 1;
        }

        // Drive to next
        if (!isLast && nextSeg) {
            const pillH = 7.5;
            doc.setFillColor(...pdfColors.infoLight);
            doc.roundedRect(margin + 11, y, contentW - 14, pillH, 1.8, 1.8, "F");

            // Down chevron drawn as a polygon (jsPDF helvetica lacks ↓/→ glyphs)
            doc.setFillColor(...pdfColors.blue);
            const cx = margin + 16;
            const cy = y + pillH / 2;
            doc.triangle(
                cx - 2.3, cy - 1.6,
                cx + 2.3, cy - 1.6,
                cx, cy + 1.8,
                "F",
            );

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...pdfColors.blue);
            const nextStopName = stops[i + 1].name;
            let distTxt: string;
            if (nextSeg.distanceKm > 0) {
                const verb = nextSeg.isRoadDistance ? "Drive" : "Drive approximately";
                const driveTime =
                    nextSeg.durationMin > 0
                        ? `  \u00B7  ${formatDuration(nextSeg.durationMin)}`
                        : "";
                distTxt = `${verb} ${nextSeg.distanceKm.toLocaleString()} km${driveTime}  \u00BB  ${nextStopName}`;
            } else {
                distTxt = `Continue to  \u00BB  ${nextStopName}`;
            }
            // Make sure the pill never overflows
            const pillTextMaxW = contentW - 14 - 12;
            while (
                distTxt.length > 4 &&
                doc.getTextWidth(distTxt) > pillTextMaxW
            ) {
                distTxt = distTxt.slice(0, -1);
            }
            doc.text(distTxt, margin + 21, y + pillH / 2 + 1.4);

            // Connector line
            doc.setDrawColor(...pdfColors.lightGray);
            doc.setLineWidth(0.6);
            doc.setLineDashPattern([1, 2], 0);
            doc.line(margin + 4, y + pillH + 1, margin + 4, y + pillH + 4);
            doc.setLineDashPattern([], 0);
            y += pillH + 5;
        } else {
            y += 3;
        }
    }

    // ── Section: Turn-by-Turn Directions ─────────────────────────────────────
    if (multiStopRoute) {
        const totalSteps = multiStopRoute.legs.reduce((s, l) => s + l.steps.length, 0);

        if (totalSteps > 0) {
            ensureSpace(30, "Turn-by-Turn Directions");
            drawSectionHeading("Turn-by-Turn Directions");
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(...pdfColors.textMuted);
            doc.text(
                `Generated from OpenRouteService (driving-hgv profile) · ${totalSteps} instructions across ${multiStopRoute.legs.length} leg${multiStopRoute.legs.length !== 1 ? "s" : ""}.`,
                margin,
                y + 1,
            );
            y += 5;

            // Render one autoTable per leg, with a leg-header row.
            multiStopRoute.legs.forEach((leg, legIdx) => {
                if (leg.steps.length === 0) return;

                ensureSpace(20, "Turn-by-Turn Directions");

                const fromName = routePoints[legIdx]?.name ?? `Stop ${legIdx + 1}`;
                const toName = routePoints[legIdx + 1]?.name ?? `Stop ${legIdx + 2}`;

                // Leg banner
                doc.setFillColor(...pdfColors.navy);
                doc.roundedRect(margin, y, contentW, 8.5, 1, 1, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5);
                doc.text(
                    `Leg ${legIdx + 1}:  ${fromName}  \u00BB  ${toName}`,
                    margin + 3,
                    y + 5.5,
                );
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                const legSummary = `${leg.distanceKm.toFixed(0)} km  ·  ${formatDuration(leg.durationMin)}`;
                doc.text(legSummary, pageW - margin - 3, y + 5.5, { align: "right" });
                doc.setTextColor(0, 0, 0);
                y += 9;

                // Pre-compute per-step rows, including a running cumulative
                // distance so the driver can sanity-check progress.
                let cumulativeM = 0;
                const rows = leg.steps.map((s, i) => {
                    const next = leg.steps[i + 1] ?? null;
                    const isFirst = i === 0;
                    const isLast = i === leg.steps.length - 1;
                    const direction = buildDirection(s, next, isFirst, isLast);
                    cumulativeM += s.distanceM;
                    const segDistTxt =
                        s.distanceM <= 0
                            ? "—"
                            : s.distanceM >= 1000
                                ? `${(s.distanceM / 1000).toFixed(s.distanceM >= 10000 ? 0 : 1)} km`
                                : `${Math.round(s.distanceM)} m`;
                    const cumKm = cumulativeM / 1000;
                    const cumTxt = cumKm < 1
                        ? `${Math.round(cumulativeM)} m`
                        : `${cumKm.toFixed(cumKm >= 100 ? 0 : 1)} km`;
                    const timeTxt = s.durationS <= 0
                        ? "—"
                        : s.durationS >= 60
                            ? formatDuration(s.durationS / 60)
                            : `${Math.round(s.durationS)}s`;
                    // Use a chevron rather than the running step number — it
                    // keeps the column narrow regardless of how many steps
                    // there are and reads naturally as "next instruction".
                    return ["\u00BB", direction, segDistTxt, cumTxt, timeTxt];
                });

                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin },
                    head: [["", "What to do", "Segment", "From start", "Time"]],
                    body: rows,
                    theme: "grid",
                    headStyles: {
                        fillColor: pdfColors.blue,
                        textColor: [255, 255, 255] as [number, number, number],
                        fontSize: 8.5,
                        fontStyle: "bold",
                        halign: "left",
                        cellPadding: { top: 2.8, bottom: 2.8, left: 3.2, right: 3.2 },
                        lineColor: pdfColors.blue,
                        lineWidth: 0.1,
                    },
                    bodyStyles: {
                        fontSize: 9,
                        cellPadding: { top: 3, bottom: 3, left: 3.2, right: 3.2 },
                        textColor: pdfColors.textPrimary,
                        lineColor: [225, 230, 240] as [number, number, number],
                        lineWidth: 0.15,
                        valign: "top",
                    },
                    alternateRowStyles: { fillColor: [248, 250, 253] as [number, number, number] },
                    columnStyles: {
                        // Compact chevron column — same width regardless of
                        // step count (no more cramping at 10+).
                        0: {
                            cellWidth: 7,
                            halign: "center",
                            fontStyle: "bold",
                            textColor: pdfColors.blue,
                        },
                        // What to do — wraps onto multiple lines automatically.
                        1: { cellWidth: "auto" },
                        2: { cellWidth: 22, halign: "right" },
                        3: { cellWidth: 24, halign: "right", textColor: pdfColors.textMuted },
                        4: { cellWidth: 18, halign: "right" },
                    },
                });

                y = (docEx.lastAutoTable?.finalY ?? y) + 5;
            });
        }
    }

    // ── Footer on every page ──────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    const generatedAt = format(new Date(), "dd MMM yyyy · HH:mm");
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        // Thin accent line
        doc.setDrawColor(...pdfColors.lightGray);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 9, pageW - margin, pageH - 9);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...pdfColors.darkGray);
        doc.text(COMPANY_NAME, margin, pageH - 4.5);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...pdfColors.textMuted);
        doc.text(`Route Plan · ${load.load_id}`, margin, pageH - 1);

        doc.text(`Generated ${generatedAt}`, pageW / 2, pageH - 1, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.setTextColor(...pdfColors.darkGray);
        doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 1, {
            align: "right",
        });
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    const filename = `route-${load.load_id}-${format(new Date(), "yyyyMMdd")}.pdf`;
    doc.save(filename);
}