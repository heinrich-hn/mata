import { geocodeService } from 'esri-leaflet-geocoder';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';

// Our unified result format (used across the app)
export interface SearchResult {
  label: string;
  x: number; // longitude
  y: number; // latitude
  bounds?: [[number, number], [number, number]];
}

interface GeoSearchResult {
  label: string;
  x: number;
  y: number;
  raw?: {
    boundingbox?: [string, string, string, string];
  };
}

export class GeocodingService {
  private osmProvider = new OpenStreetMapProvider();
  private esriGeocoder: ReturnType<typeof geocodeService>;

  constructor() {
    const apiKey = import.meta.env.VITE_ESRI_API_KEY as string | undefined;

    this.esriGeocoder = geocodeService(
      apiKey ? { apikey: apiKey } : {}
    );
  }

  /**
   * Search for address using OpenStreetMap (Nominatim)
   */
  async searchAddress(query: string): Promise<SearchResult[]> {
    try {
      const results = await this.osmProvider.search({ query });

      return results.map((r: GeoSearchResult) => ({
        label: r.label,
        x: r.x,
        y: r.y,
        bounds: r.raw?.boundingbox
          ? [
              [parseFloat(r.raw.boundingbox[0]), parseFloat(r.raw.boundingbox[2])],
              [parseFloat(r.raw.boundingbox[1]), parseFloat(r.raw.boundingbox[3])],
            ]
          : undefined,
      }));
    } catch (error) {
      console.error('Address search error:', error);
      return [];
    }
  }

  /**
   * Reverse geocode coordinates → address using ESRI
   */
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.esriGeocoder
        .reverse()
        .latlng([lat, lng])
        .run((error: Error | null, result: { address?: { Match_addr?: string } }) => {
          if (error) {
            console.error('Reverse geocode error:', error);
            reject(error);
            return;
          }
          resolve(result?.address?.Match_addr ?? 'Unknown location');
        });
    });
  }

  /**
   * Batch reverse geocode multiple coordinates
   */
  async batchReverseGeocode(
    coordinates: Array<{ lat: number; lng: number }>
  ): Promise<Array<{ lat: number; lng: number; address: string }>> {
    const results = await Promise.allSettled(
      coordinates.map((coord) => this.reverseGeocode(coord.lat, coord.lng))
    );

    return results.map((result, index) => ({
      ...coordinates[index],
      address: result.status === 'fulfilled' ? result.value : 'Unknown location',
    }));
  }

  /**
   * Create Leaflet GeoSearch control
   */
  createSearchControl(): ReturnType<typeof GeoSearchControl> {
    return GeoSearchControl({
      provider: this.osmProvider,
      style: 'bar',
      showMarker: true,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      keepResult: false,
      searchLabel: 'Enter address',
    });
  }

  /**
   * Geocode address → coordinates (convenience wrapper)
   */
  async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const results = await this.searchAddress(address);
      if (results.length > 0) {
        return { lat: results[0].y, lng: results[0].x };
      }
      return null;
    } catch (error) {
      console.error('Geocode error:', error);
      return null;
    }
  }
}

// Singleton instance used throughout the app
export const geocoding = new GeocodingService();