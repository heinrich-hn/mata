import GeometryUtil from 'leaflet-geometryutil';
import { LatLng, Polyline, Map } from 'leaflet';

export class RouteGeometryService {
  /**
   * Calculate accurate route distance in meters
   */
  calculateRouteDistance(route: LatLng[] | Polyline): number {
    return GeometryUtil.length(route);
  }

  /**
   * Get human-readable distance
   */
  formatDistance(distance: number, useMetric: boolean = true): string {
    return GeometryUtil.readableDistance(distance, useMetric ? 'metric' : 'imperial');
  }

  /**
   * Calculate vehicle progress along route (0 to 1)
   */
  calculateProgress(map: Map, vehiclePosition: LatLng, route: Polyline): number {
    return GeometryUtil.locateOnLine(map, route, vehiclePosition);
  }

  /**
   * Find closest point on route to vehicle
   */
  findClosestPointOnRoute(
    map: Map,
    vehiclePosition: LatLng,
    route: LatLng[]
  ): {
    point: LatLng;
    distance: number;
  } | null {
    const closest = GeometryUtil.closest(map, route, vehiclePosition, false);
    return closest ? { point: new LatLng(closest.lat, closest.lng), distance: closest.distance } : null;
  }

  /**
   * Calculate deviation from planned route
   */
  calculateRouteDeviation(
    map: Map,
    vehiclePosition: LatLng,
    route: LatLng[]
  ): {
    deviation: number;
    closestPoint: LatLng;
    isOffRoute: boolean;
  } {
    const closest = this.findClosestPointOnRoute(map, vehiclePosition, route);
    if (!closest) {
      return { deviation: Infinity, closestPoint: vehiclePosition, isOffRoute: true };
    }

    const MAX_DEVIATION_METERS = 500;
    return {
      deviation: closest.distance,
      closestPoint: closest.point,
      isOffRoute: closest.distance > MAX_DEVIATION_METERS,
    };
  }

  /**
   * Get position at specific progress along route
   */
  getPositionAtProgress(map: Map, route: LatLng[] | Polyline, progress: number): LatLng | null {
    const result = GeometryUtil.interpolateOnLine(map, route, progress);
    return result?.latLng || null;
  }

  /**
   * Calculate bearing between two points (in degrees)
   */
  calculateBearing(from: LatLng, to: LatLng): number {
    return GeometryUtil.bearing(from, to);
  }

  /**
   * Extract route segment between two progress points
   */
  extractRouteSegment(
    map: Map,
    route: Polyline,
    startProgress: number,
    endProgress: number
  ): LatLng[] {
    return GeometryUtil.extract(map, route, startProgress, endProgress);
  }

  /**
   * Calculate accumulated distances along route
   */
  getDistanceMarkers(route: LatLng[] | Polyline): number[] {
    return GeometryUtil.accumulatedLengths(route);
  }

  /**
   * Calculate distance between two points
   */
  distance(map: Map, latlngA: LatLng, latlngB: LatLng): number {
    return GeometryUtil.distance(map, latlngA, latlngB);
  }

  /**
   * Check if point belongs to a segment
   */
  belongsToSegment(
    latlng: LatLng,
    latlngA: LatLng,
    latlngB: LatLng,
    tolerance: number = 10
  ): boolean {
    return GeometryUtil.belongsSegment(latlng, latlngA, latlngB, tolerance);
  }

  /**
   * Get closest point on a segment
   */
  closestOnSegment(
    map: Map,
    latlng: LatLng,
    latlngA: LatLng,
    latlngB: LatLng
  ): LatLng {
    return GeometryUtil.closestOnSegment(map, latlng, latlngA, latlngB);
  }

  /**
   * Calculate angle at a point between two other points
   */
  angle(map: Map, latlngA: LatLng, latlngB: LatLng): number {
    return GeometryUtil.angle(map, latlngA, latlngB);
  }

  /**
   * Calculate destination point given start, bearing, and distance
   */
  destination(latlng: LatLng, heading: number, distance: number): LatLng {
    return GeometryUtil.destination(latlng, heading, distance);
  }
}

export const routeGeometry = new RouteGeometryService();