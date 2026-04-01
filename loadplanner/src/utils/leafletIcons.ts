import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// ============================================================================
// Leaflet Default Icon Configuration
// ============================================================================

// Fix default marker icons for Leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ============================================================================
// Type Definitions
// ============================================================================

export interface MarkerOptions {
  size?: number;
  borderWidth?: number;
  shadowBlur?: number;
}

export interface TripMarkerIconConfig {
  startColor?: string;
  endColor?: string;
  size?: number;
  iconSize?: number;
}

// ============================================================================
// Professional SVG Icons (Inline for better control)
// ============================================================================

const StartIconSVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
`;

const EndIconSVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M8 12h8"/>
  </svg>
`;

const WaypointIconSVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="8"/>
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
  </svg>
`;

// ============================================================================
// Utility Functions for Marker Creation
// ============================================================================

/**
 * Create a professional circular marker with SVG icon
 * @param color - CSS color for the marker background
 * @param iconSvg - SVG string for the icon
 * @param options - Optional configuration for size and styling
 * @returns L.DivIcon configured for use with Leaflet
 */
const createCircularMarker = (
  color: string,
  iconSvg: string,
  options: MarkerOptions = {}
): L.DivIcon => {
  const {
    size = 36,
    borderWidth = 3,
    shadowBlur = 12
  } = options;

  const innerSize = size - (borderWidth * 2);
  const anchorPoint = size / 2;

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          border: ${borderWidth}px solid white;
          box-shadow: 0 ${shadowBlur / 4}px ${shadowBlur}px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: transform 0.1s ease;
        ">
          <div style="
            width: ${innerSize - 8}px;
            height: ${innerSize - 8}px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${iconSvg}
          </div>
        </div>
      </div>
    `,
    className: 'leaflet-marker-custom',
    iconSize: [size, size],
    iconAnchor: [anchorPoint, anchorPoint],
    popupAnchor: [0, -anchorPoint + 4],
  });
};

/**
 * Create a professional marker with label text
 * @param color - CSS color for the marker background
 * @param label - Text to display in the marker
 * @param options - Optional configuration for size and styling
 * @returns L.DivIcon configured for use with Leaflet
 */
const createLabelMarker = (
  color: string,
  label: string,
  options: MarkerOptions = {}
): L.DivIcon => {
  const {
    size = 32,
    borderWidth = 2,
    shadowBlur = 8
  } = options;

  const anchorPoint = size / 2;

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          border: ${borderWidth}px solid white;
          box-shadow: 0 ${shadowBlur / 4}px ${shadowBlur}px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: ${Math.max(11, size - 20)}px;
          font-family: system-ui, -apple-system, sans-serif;
        ">
          ${label.substring(0, 2).toUpperCase()}
        </div>
      </div>
    `,
    className: 'leaflet-marker-custom',
    iconSize: [size, size],
    iconAnchor: [anchorPoint, anchorPoint],
    popupAnchor: [0, -anchorPoint + 4],
  });
};

// ============================================================================
// Public API - Marker Creators
// ============================================================================

/**
 * Create a start marker for trip origin points
 * @param options - Optional configuration for marker styling
 * @returns L.DivIcon for start location
 */
export const createStartIcon = (options?: Partial<TripMarkerIconConfig>): L.DivIcon => {
  const {
    startColor = 'hsl(142, 76%, 36%)',  // Professional green
    size = 40,
    iconSize = 24
  } = options || {};

  const borderWidth = Math.max(2, Math.floor(size / 12));
  const shadowBlur = Math.max(8, Math.floor(size / 5));
  const anchorPoint = size / 2;

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${startColor};
          border: ${borderWidth}px solid white;
          box-shadow: 0 ${shadowBlur / 4}px ${shadowBlur}px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <div style="
            width: ${iconSize}px;
            height: ${iconSize}px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${StartIconSVG}
          </div>
        </div>
      </div>
    `,
    className: 'leaflet-marker-start',
    iconSize: [size, size],
    iconAnchor: [anchorPoint, anchorPoint],
    popupAnchor: [0, -anchorPoint + 4],
  });
};

/**
 * Create an end marker for trip destination points
 * @param options - Optional configuration for marker styling
 * @returns L.DivIcon for end location
 */
export const createEndIcon = (options?: Partial<TripMarkerIconConfig>): L.DivIcon => {
  const {
    endColor = 'hsl(0, 84%, 60%)',  // Professional red
    size = 40,
    iconSize = 24
  } = options || {};

  const borderWidth = Math.max(2, Math.floor(size / 12));
  const shadowBlur = Math.max(8, Math.floor(size / 5));
  const anchorPoint = size / 2;

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${endColor};
          border: ${borderWidth}px solid white;
          box-shadow: 0 ${shadowBlur / 4}px ${shadowBlur}px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <div style="
            width: ${iconSize}px;
            height: ${iconSize}px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${EndIconSVG}
          </div>
        </div>
      </div>
    `,
    className: 'leaflet-marker-end',
    iconSize: [size, size],
    iconAnchor: [anchorPoint, anchorPoint],
    popupAnchor: [0, -anchorPoint + 4],
  });
};

/**
 * Create a waypoint marker for intermediate points
 * @param color - CSS color for the marker (default: hsl(217, 91%, 60%) - professional blue)
 * @param options - Optional configuration for marker styling
 * @returns L.DivIcon for waypoint location
 */
export const createWaypointIcon = (
  color: string = 'hsl(217, 91%, 60%)',
  options?: MarkerOptions
): L.DivIcon => {
  return createCircularMarker(color, WaypointIconSVG, options);
};

/**
 * Create a numbered marker for sequence points (1, 2, 3, etc.)
 * @param number - The number to display
 * @param color - CSS color for the marker (default: hsl(217, 91%, 60%) - professional blue)
 * @param options - Optional configuration for marker styling
 * @returns L.DivIcon for numbered location
 */
export const createNumberedMarker = (
  number: number,
  color: string = 'hsl(217, 91%, 60%)',
  options?: MarkerOptions
): L.DivIcon => {
  return createLabelMarker(color, number.toString(), options);
};

/**
 * Create a custom marker with any SVG icon
 * @param iconSvg - SVG string for the icon
 * @param color - CSS color for the marker background
 * @param options - Optional configuration for marker styling
 * @returns L.DivIcon configured with custom icon
 */
export const createCustomMarker = (
  iconSvg: string,
  color: string = 'hsl(217, 91%, 60%)',
  options?: MarkerOptions
): L.DivIcon => {
  return createCircularMarker(color, iconSvg, options);
};

// ============================================================================
// Pre-configured Markers for Common Use Cases
// ============================================================================

/**
 * Depot/warehouse marker
 */
export const createDepotMarker = (type: 'depot' | 'warehouse' | 'market' = 'depot'): L.DivIcon => {
  const colors = {
    depot: 'hsl(142, 76%, 36%)',    // Green
    warehouse: 'hsl(217, 91%, 60%)', // Blue
    market: 'hsl(0, 84%, 60%)',      // Red
  };
  
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9L12 3L21 9L12 15L3 9Z"/>
      <path d="M12 15V21M8 18H16"/>
    </svg>
  `;
  
  return createCircularMarker(colors[type], iconSvg, { size: 32 });
};

/**
 * Vehicle marker with status indicator
 * @param color - Status color (green for moving, red for stationary)
 * @param hasLoad - Whether the vehicle has an active load
 * @returns L.DivIcon for vehicle location
 */
export const createVehicleMarker = (
  color: string,
  hasLoad: boolean = false
): L.DivIcon => {
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12h4M21 12h4M12 3v4M12 17v4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  `;
  
  const marker = createCircularMarker(color, iconSvg, { size: 36 });
  
  // Add load indicator if needed
  if (hasLoad) {
    return L.divIcon({
      html: `
        ${marker.options.html}
        <div style="
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          background: hsl(271, 91%, 65%);
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        "></div>
      `,
      className: 'leaflet-marker-vehicle',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -14],
    });
  }
  
  return marker;
};

// ============================================================================
// CSS Classes for Global Styling (Optional)
// ============================================================================

/**
 * Add these CSS classes to your global stylesheet for consistent marker styling:
 * 
 * .leaflet-marker-custom {
 *   transition: transform 0.2s ease;
 * }
 * 
 * .leaflet-marker-custom:hover {
 *   transform: scale(1.05);
 *   z-index: 1000 !important;
 * }
 * 
 * .leaflet-marker-start,
 * .leaflet-marker-end,
 * .leaflet-marker-vehicle {
 *   transition: transform 0.2s ease;
 * }
 * 
 * .leaflet-marker-start:hover,
 * .leaflet-marker-end:hover,
 * .leaflet-marker-vehicle:hover {
 *   transform: scale(1.05);
 * }
 */