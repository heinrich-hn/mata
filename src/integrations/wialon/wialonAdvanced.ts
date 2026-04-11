export interface TrackingEvent {
  type: 'position' | 'alarm' | 'status';
  unitId: number;
  unitName: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  speed: number;
  course?: number;
  altitude?: number;
  address?: string;
  [key: string]: unknown;
}

// Export types that are referenced in index.ts
export interface WialonPosition {
  y: number; // latitude
  x: number; // longitude
  s: number; // speed
  c: number; // course
  z: number; // altitude
  sc: number; // satellite count
  t: number; // timestamp (Unix)
}

export interface WialonUnit {
  id: number;
  nm: string; // name
  pos: WialonPosition | null;
}

export interface WialonMessage {
  tp: string; // message type
  id: number;
  f: number; // flags
  t: number; // time
  pos?: WialonPosition;
  p?: Record<string, unknown>; // parameters
}

type TrackingCallback = (event: TrackingEvent) => void;

export class WialonAdvancedService {
  private isInitialized = false;
  private trackingCallbacks: Map<number, TrackingCallback> = new Map();
  private eventListeners: Map<number, () => void> = new Map();

  /**
   * Check if the Wialon SDK is ready
   */
  isReady(): boolean {
    return this.isInitialized && typeof window !== 'undefined' && window.wialon !== undefined;
  }

  /**
   * Initialize the service
   */
  initialize(): void {
    this.isInitialized = true;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  /**
   * Convert degrees to radians
   */
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate ETA based on distance and speed
   */
  calculateETA(distanceKm: number, speedKmh: number): Date | string {
    if (speedKmh <= 0) {
      return 'Vehicle stationary';
    }

    const hoursToDestination = distanceKm / speedKmh;
    const minutesToDestination = hoursToDestination * 60;

    const eta = new Date();
    eta.setMinutes(eta.getMinutes() + minutesToDestination);

    return eta;
  }

  /**
   * Setup real-time tracking for a unit
   */
  setupRealtimeTracking(unitId: number, callback: TrackingCallback): () => void {
    if (!this.isReady()) {
      console.warn('Wialon SDK not ready, tracking setup skipped');
      return () => {}; // Return no-op cleanup
    }

    this.trackingCallbacks.set(unitId, callback);

    // Setup event listener for position updates
    const handleEvent = (event: { unitId: number; data: unknown }) => {
      if (event.unitId === unitId) {
        const trackingEvent = this.parseWialonEvent(event);
        if (trackingEvent) {
          callback(trackingEvent);
        }
      }
    };

    // Store the listener for cleanup
    this.eventListeners.set(unitId, handleEvent as () => void);

    // In a real implementation, you would bind to Wialon's event system here
    // For now, we'll simulate with a polling mechanism
    const intervalId = setInterval(() => {
      this.fetchUnitPosition(unitId).then((position) => {
        if (position) {
          callback(position);
        }
      });
    }, 5000); // Poll every 5 seconds

    // Return cleanup function
    return () => {
      this.trackingCallbacks.delete(unitId);
      this.eventListeners.delete(unitId);
      clearInterval(intervalId);
    };
  }

  /**
   * Fetch current position for a unit
   */
  private async fetchUnitPosition(_unitId: number): Promise<TrackingEvent | null> {
    if (!this.isReady()) {
      return null;
    }

    try {
      // In a real implementation, this would query the Wialon API
      // For now, return null to indicate no update
      return null;
    } catch (error) {
      console.error('Failed to fetch unit position:', error);
      return null;
    }
  }

  /**
   * Parse Wialon event into TrackingEvent
   */
  private parseWialonEvent(event: { unitId: number; data: unknown }): TrackingEvent | null {
    try {
      // This is a simplified parser - adjust based on actual Wialon event structure
      const data = event.data as {
        pos?: { x: number; y: number; s: number; c?: number; z?: number; t: number };
        nm?: string;
      };

      if (!data.pos) {
        return null;
      }

      return {
        type: 'position',
        unitId: event.unitId,
        unitName: data.nm || `Unit ${event.unitId}`,
        timestamp: new Date(data.pos.t * 1000),
        latitude: data.pos.y,
        longitude: data.pos.x,
        speed: data.pos.s || 0,
        course: data.pos.c,
        altitude: data.pos.z,
      };
    } catch (error) {
      console.error('Failed to parse Wialon event:', error);
      return null;
    }
  }

  /**
   * Stop tracking for a specific unit
   */
  stopTracking(unitId: number): void {
    const cleanup = this.eventListeners.get(unitId);
    if (cleanup) {
      cleanup();
    }
    this.trackingCallbacks.delete(unitId);
    this.eventListeners.delete(unitId);
  }

  /**
   * Stop all tracking
   */
  stopAllTracking(): void {
    this.eventListeners.forEach((cleanup) => cleanup());
    this.trackingCallbacks.clear();
    this.eventListeners.clear();
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopAllTracking();
    this.isInitialized = false;
  }
}

// Singleton instance
let wialonAdvancedServiceInstance: WialonAdvancedService | null = null;

/**
 * Get the singleton instance of WialonAdvancedService
 */
export function getWialonAdvancedService(): WialonAdvancedService {
  if (!wialonAdvancedServiceInstance) {
    wialonAdvancedServiceInstance = new WialonAdvancedService();
    wialonAdvancedServiceInstance.initialize();
  }
  return wialonAdvancedServiceInstance;
}

/**
 * Reset the service instance (useful for testing)
 */
export function resetWialonAdvancedService(): void {
  if (wialonAdvancedServiceInstance) {
    wialonAdvancedServiceInstance.cleanup();
    wialonAdvancedServiceInstance = null;
  }
}

// Note: Window.wialon type is already declared in types.ts