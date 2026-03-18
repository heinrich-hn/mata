/**
 * Wialon Integration Module
 * GPS tracking and route planning with Wialon Remote API
 *
 * @see https://sdk.wialon.com/wiki/en/sidebar/remoteapi/apiref/apiref
 */

// Core Service
export { getWialonService, WialonService } from './service';

// Advanced Service (with Explain.COde examples)
export { getWialonAdvancedService, WialonAdvancedService } from './wialonAdvanced';
export type { TrackingEvent, WialonPosition as WialonAdvancedPosition, WialonUnit as WialonAdvancedUnit, WialonMessage } from './wialonAdvanced';

// React Hooks
export { useWialon } from './useWialon';
export { useWialonContext } from './useWialonContext';

// Context Provider
export { WialonContext } from './WialonContext';
export { WialonProvider } from './WialonProvider';

// Types
export type {
  Route,
  RoutePoint, VehicleLocation, WialonConfig,
  WialonPosition, WialonSDK, WialonSession, WialonUnit
} from './types';