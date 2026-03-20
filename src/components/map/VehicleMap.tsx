import type { VehicleLocation } from '@/integrations/wialon/types';
import { createTruckIcon, VEHICLE_COLORS } from '@/lib/leafletSetup';
import L, { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayersControl, MapContainer, Marker, Popup, TileLayer, useMap, ZoomControl } from 'react-leaflet';

// Marker icon configuration for Leaflet (fallback)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default marker icons in Leaflet with Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Create vehicle icon using the shared utility
const createVehicleIcon = (isMoving: boolean, heading: number, speed: number = 0, isSelected: boolean = false) => {
  return createTruckIcon({ isMoving, heading, speed, isSelected });
};

interface VehicleMapProps {
  vehicles: VehicleLocation[];
  selectedVehicle?: VehicleLocation | null;
  center?: [number, number];
  zoom?: number;
  className?: string;
  onVehicleClick?: (vehicle: VehicleLocation) => void;
}

// MapViewHandler for managing bounds and animations
function MapViewHandler({ vehicles, selectedVehicle }: { vehicles: VehicleLocation[]; selectedVehicle?: VehicleLocation | null }) {
  const map = useMap();
  const [hasFitBounds, setHasFitBounds] = useState(false);

  const getBounds = useCallback((): LatLngBoundsExpression | undefined => {
    if (vehicles.length === 0) return undefined;
    return vehicles.map(v => [v.latitude, v.longitude] as [number, number]);
  }, [vehicles]);

  useEffect(() => {
    const bounds = getBounds();
    if (bounds && !hasFitBounds) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      setHasFitBounds(true);
    }
  }, [vehicles, map, hasFitBounds, getBounds]);

  useEffect(() => {
    if (selectedVehicle) {
      map.flyTo([selectedVehicle.latitude, selectedVehicle.longitude], 16, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedVehicle, map]);

  return null;
}

// MapContent component
function MapContent({ vehicles, selectedVehicle, onVehicleClick }: {
  vehicles: VehicleLocation[];
  selectedVehicle?: VehicleLocation | null;
  onVehicleClick?: (vehicle: VehicleLocation) => void;
}) {
  return (
    <>
      <LayersControl>
        <LayersControl.BaseLayer checked name="Street Map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Terrain">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <MapViewHandler vehicles={vehicles} selectedVehicle={selectedVehicle} />

      {vehicles.map(vehicle => {
        const isSelected = selectedVehicle?.vehicleId === vehicle.vehicleId;
        return (
          <Marker
            key={vehicle.vehicleId}
            position={[vehicle.latitude, vehicle.longitude]}
            icon={createVehicleIcon(vehicle.isMoving, vehicle.heading, vehicle.speed, isSelected)}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
              click: () => onVehicleClick?.(vehicle),
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-semibold text-base border-b pb-2 mb-3">{vehicle.vehicleName}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Status</span>
                    <span
                      className="font-medium px-2 py-0.5 rounded-full text-white text-xs"
                      style={{ backgroundColor: vehicle.isMoving ? VEHICLE_COLORS.moving : VEHICLE_COLORS.stopped }}
                    >
                      {vehicle.isMoving ? 'Moving' : 'Stopped'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Speed</span>
                    <span className="font-medium">{vehicle.speed.toFixed(1)} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Heading</span>
                    <span className="font-medium">{vehicle.heading.toFixed(0)}°</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      <ZoomControl />
    </>
  );
}

// Main VehicleMap component
export default function VehicleMap({
  vehicles,
  selectedVehicle,
  center = [0, 0],
  zoom = 2,
  className = '',
  onVehicleClick,
}: VehicleMapProps) {
  const mapCenter = useMemo<[number, number]>(() => {
    if (vehicles.length > 0) {
      const lat = vehicles.reduce((sum, v) => sum + v.latitude, 0) / vehicles.length;
      const lng = vehicles.reduce((sum, v) => sum + v.longitude, 0) / vehicles.length;
      return [lat, lng];
    }
    return center;
  }, [vehicles, center]);

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        className="h-full w-full rounded-lg"
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <MapContent vehicles={vehicles} selectedVehicle={selectedVehicle} onVehicleClick={onVehicleClick} />
      </MapContainer>

      {/* Vehicle Count Badge */}
      {vehicles.length > 0 && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-3 py-2 z-[1000]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              🚗 {vehicles.length} Vehicle{vehicles.length !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-1">
              <span className="text-xs text-green-600">
                {vehicles.filter(v => v.isMoving).length} moving
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-red-600">
                {vehicles.filter(v => !v.isMoving).length} stopped
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No Vehicles Message */}
      {vehicles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/90 rounded-lg z-[1000]">
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <p className="text-gray-700 text-lg font-medium mb-2">No vehicles to display</p>
            <p className="text-gray-500 text-sm">
              Connect to Wialon or refresh to see vehicle locations
            </p>
          </div>
        </div>
      )}
    </div>
  );
}