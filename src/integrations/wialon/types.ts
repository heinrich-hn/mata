/**
 * Wialon API Type Definitions
 * Based on Wialon Remote API documentation
 */

export interface WialonConfig {
  host: string;
  token: string;
  appName: string;
}

export interface WialonPosition {
  x: number; // Longitude
  y: number; // Latitude
  z?: number; // Altitude
  s?: number; // Speed (km/h)
  c?: number; // Course (degrees)
  t?: number; // Timestamp (Unix)
  sc?: number; // Satellite count
}

export interface WialonUnit {
  id: number;
  nm: string; // Name
  cls: number; // Class
  uid: string; // Unique ID
  pos?: WialonPosition; // Last position
  lmsg?: {
    t: number; // Message time
    f: number; // Flags
    tp: string; // Message type
    pos: WialonPosition;
  };
}

export interface WialonMessage {
  uid: string; // Unit ID
  pos?: WialonPosition;
  t: number; // Timestamp
  f: number; // Flags
}

/**
 * Wialon User Interface
 */
export interface WialonUser {
  getId: () => number;
  getName: () => string;
  getLocale: () => string;
  getCustomProperty: (name: string) => string;
}

/**
 * Wialon Session Interface
 */
export interface WialonSession {
  // Session management
  getId: () => string;
  initSession: (host: string) => void;

  // Authentication methods
  login: (username: string, password: string, callback: (code: number) => void) => void;
  loginToken: (token: string, operateAs: string, callback: (code: number) => void) => void;
  duplicate: (token: string, callback: (code: number) => void) => void;
  logout: (callback?: (code: number) => void) => void;

  // User info
  getCurrUser: () => WialonUser | null;

  // Data management
  updateDataFlags: (
    spec: Array<{ type: string; data: string; flags: number; mode: number }>,
    callback: (code: number) => void
  ) => void;
  getItems: (type: string) => WialonUnit[];
  getItem: (id: number) => WialonUnit | null;

  // Event listeners
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addListener: (event: string, callback: (data: any) => void, context?: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeListener: (event: string, callback: (data: any) => void, context?: any) => void;
}

/**
 * Wialon SDK Interface
 */
export interface WialonSDK {
  core: {
    Session: {
      getInstance: () => WialonSession;
    };
    Errors: {
      getErrorText: (code: number) => string;
    };
  };
  item: {
    Item: {
      dataFlag: {
        base: number;
        customFields: number;
        customProps: number;
        billingProps: number;
        image: number;
      };
    };
    Unit: {
      dataFlag: {
        lastPosition: number;
        lastMessage: number;
        sensors: number;
        counters: number;
        profile: number;
        messages: number;
        driverUnits: number;
        trailerUnits: number;
        maintenance: number;
      };
    };
  };
}

// Extend window interface for Wialon global
declare global {
  interface Window {
    wialon?: WialonSDK;
  }
}

/**
 * Vehicle Location (normalized format)
 */
export interface VehicleLocation {
  vehicleId: string;
  vehicleName: string;
  /** String version of the Wialon unit id (available in hook state) */
  unitId?: string;
  /** Optional friendly name/registration pulled directly from Wialon */
  name?: string;
  registration?: string;
  wialonUnitId?: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number; // km/h
  heading: number; // degrees
  timestamp: Date;
  satelliteCount: number;
  isMoving: boolean;
  /** Derived status flag used by dashboards */
  status?: 'online' | 'offline' | 'moving' | 'stopped';
  fuel?: number;
  temperature?: number;
  odometer?: number;
  engineHours?: number;
}

/**
 * Route Point
 */
export interface RoutePoint {
  latitude: number;
  longitude: number;
  address?: string;
  arrivalTime?: Date;
  departureTime?: Date;
}

/**
 * Route
 */
export interface Route {
  id: string;
  vehicleId: string;
  driverId?: string;
  waypoints: RoutePoint[];
  startTime: Date;
  estimatedEndTime?: Date;
  distance?: number; // km
  duration?: number; // minutes
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
}

/**
 * Wialon Event Types
 */
export type WialonEventType =
  | 'messageUpdated'
  | 'unitChanged'
  | 'itemsUpdated'
  | 'messagesDeleted';