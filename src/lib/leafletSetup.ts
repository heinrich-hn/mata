import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Extend the Leaflet type to include the private method
interface LeafletIconDefault extends L.Icon.Default {
  _getIconUrl?: () => string;
}

// Fix default marker icons in Vite (used as fallback)
delete (L.Icon.Default.prototype as LeafletIconDefault)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom vehicle marker colors
export const VEHICLE_COLORS = {
  moving: '#22c55e',    // green-500
  stopped: '#ef4444',   // red-500
  idle: '#f59e0b',      // amber-500
  selected: '#3b82f6',  // blue-500
  offline: '#6b7280',   // gray-500
} as const;

// Create a custom truck icon for vehicle tracking
export const createTruckIcon = (options: {
  isMoving: boolean;
  heading?: number;
  speed?: number;
  isSelected?: boolean;
}) => {
  const { isMoving, heading = 0, speed: _speed = 0, isSelected = false } = options;

  const color: string = VEHICLE_COLORS.stopped;
  const size = isSelected ? 48 : 40;
  const pulseClass = isMoving ? 'vehicle-pulse' : '';

  const truckSvg = `
    <svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="markerShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25"/>
        </filter>
      </defs>

      <g filter="url(#markerShadow)">
        <!-- Outer ring -->
        <circle cx="20" cy="20" r="18" fill="white" stroke="${color}" stroke-width="2.5"/>

        <!-- Inner colored circle -->
        <circle cx="20" cy="20" r="14" fill="${color}"/>

        <!-- Truck icon (white) -->
        <g fill="white">
          <!-- Truck cab -->
          <rect x="22" y="16" width="6" height="9" rx="1"/>
          <!-- Truck body -->
          <rect x="12" y="13" width="11" height="12" rx="1.5"/>
          <!-- Wheels -->
          <circle cx="15" cy="26" r="1.5"/>
          <circle cx="25" cy="26" r="1.5"/>
        </g>

        <!-- Direction arrow at top -->
        <polygon points="20,2 16,9 24,9" fill="${color}" stroke="white" stroke-width="1"/>
      </g>
    </svg>
  `;

  return L.divIcon({
    html: `<div class="vehicle-marker-wrapper ${pulseClass}" style="transform: rotate(${heading}deg);">${truckSvg}</div>`,
    className: 'vehicle-marker-modern',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};