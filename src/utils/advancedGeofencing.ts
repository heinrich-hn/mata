// src/utils/advancedGeofencing.ts
import { LatLng, Layer, Map } from 'leaflet';
import GeometryUtil from 'leaflet-geometryutil';

export class AdvancedGeofencingService {
  /**
   * Find all geofences within radius of vehicle
   */
  findNearbyGeofences(
    map: Map,
    vehiclePosition: LatLng,
    geofences: Layer[],
    radiusMeters: number = 5000
  ): Array<{ layer: Layer; latlng: LatLng; distance: number }> {
    const rawResults = GeometryUtil.layersWithin(map, geofences, vehiclePosition, radiusMeters);
    return rawResults.map(r => ({
      layer: r.layer,
      latlng: new LatLng(r.latlng.lat, r.latlng.lng),
      distance: r.distance
    }));
  }

  /**
   * Get N closest geofences to vehicle
   */
  getClosestGeofences(
    map: Map,
    vehiclePosition: LatLng,
    geofences: Layer[],
    count: number = 5
  ): Array<{ layer: Layer; latlng: LatLng; distance: number }> | null {
    const rawResults = GeometryUtil.nClosestLayers(map, geofences, vehiclePosition, count);
    if (!rawResults) return null;
    return rawResults.map(r => ({
      layer: r.layer,
      latlng: new LatLng(r.latlng.lat, r.latlng.lng),
      distance: r.distance
    }));
  }

  /**
   * Calculate ETA to geofence
   */
  calculateGeofenceETA(
    map: Map,
    vehiclePosition: LatLng,
    geofencePosition: LatLng,
    currentSpeed: number // km/h
  ): { distance: number; eta: number; readableETA: string } {
    const distance = GeometryUtil.distance(map, vehiclePosition, geofencePosition);

    if (currentSpeed === 0 || !currentSpeed) {
      return {
        distance,
        eta: 0,
        readableETA: 'N/A',
      };
    }

    const etaHours = distance / (currentSpeed * 1000); // Convert to hours
    const etaMinutes = Math.round(etaHours * 60);

    return {
      distance,
      eta: etaMinutes,
      readableETA: etaMinutes < 60 ? `${etaMinutes} min` : `${(etaMinutes / 60).toFixed(1)} hrs`,
    };
  }

  /**
   * Predict if vehicle will enter geofence based on heading
   */
  predictGeofenceEntry(
    vehiclePosition: LatLng,
    vehicleHeading: number,
    vehicleSpeed: number, // km/h
    geofenceCenter: LatLng,
    geofenceRadius: number,
    map: Map
  ): { willEnter: boolean; eta: number | null } {
    if (vehicleSpeed === 0 || !vehicleSpeed) {
      return { willEnter: false, eta: null };
    }

    // Calculate destination in 1 hour at current heading
    const futurePosition = GeometryUtil.destination(
      vehiclePosition,
      vehicleHeading,
      vehicleSpeed * 1000 // Convert to meters
    );

    // Check if future position is within geofence
    const distanceToGeofence = GeometryUtil.distance(
      map,
      futurePosition,
      geofenceCenter
    );

    if (distanceToGeofence <= geofenceRadius) {
      const currentDistance = GeometryUtil.distance(map, vehiclePosition, geofenceCenter);
      const eta = (currentDistance / (vehicleSpeed * 1000)) * 60; // minutes
      return { willEnter: true, eta: Math.round(eta) };
    }

    return { willEnter: false, eta: null };
  }

  /**
   * Get closest layer from a list
   */
  getClosestLayer<T extends Layer>(
    map: Map,
    layers: T[],
    latlng: LatLng
  ): { layer: T; latlng: LatLng; distance: number } | null {
    const rawResult = GeometryUtil.closestLayer(map, layers, latlng);
    if (!rawResult) return null;
    return {
      layer: rawResult.layer,
      latlng: new LatLng(rawResult.latlng.lat, rawResult.latlng.lng),
      distance: rawResult.distance
    };
  }
}

export const advancedGeofencing = new AdvancedGeofencingService();