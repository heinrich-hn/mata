// src/components/Vehicle/VehicleMapView.tsx
// This component requires react-leaflet and leaflet packages
// Run: npm install react-leaflet leaflet @types/leaflet

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with React
// Use type assertion instead of 'any'
delete (L.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Vehicle {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'inactive' | 'maintenance';
  last_update: string;
}

interface VehicleMapViewProps {
  vehicles?: Vehicle[];
  center?: [number, number];
  zoom?: number;
}

// Component to handle map bounds and fit all markers
function FitBounds({ vehicles }: { vehicles: Vehicle[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (vehicles.length > 0) {
      const bounds = L.latLngBounds(
        vehicles.map(v => [v.latitude, v.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [vehicles, map]);
  
  return null;
}

export default function VehicleMapView({ 
  vehicles = [], 
  center = [51.505, -0.09], 
  zoom = 13 
}: VehicleMapViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if Leaflet CSS is loaded
    const checkLeafletCSS = () => {
      const cssLoaded = document.querySelector('link[href*="leaflet"]') !== null;
      if (!cssLoaded) {
        console.warn('Leaflet CSS may not be loaded properly');
      }
      setIsLoading(false);
    };

    checkLeafletCSS();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Vehicle Map View
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
            <div className="text-center space-y-2">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (_error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Vehicle Map View
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
            <div className="text-center space-y-2">
              <p className="text-sm text-red-500">Error loading map: {_error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Vehicle Map View
          </div>
          {vehicles.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} on map
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 rounded-lg overflow-hidden">
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {vehicles.map((vehicle) => (
              <Marker
                key={vehicle.id}
                position={[vehicle.latitude, vehicle.longitude]}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold">{vehicle.name}</h3>
                    <p className="text-sm">Status: 
                      <span className={`ml-1 capitalize ${
                        vehicle.status === 'active' ? 'text-green-600' :
                        vehicle.status === 'inactive' ? 'text-gray-600' :
                        'text-orange-600'
                      }`}>
                        {vehicle.status}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last update: {new Date(vehicle.last_update).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Position: {vehicle.latitude.toFixed(4)}, {vehicle.longitude.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {vehicles.length > 0 && <FitBounds vehicles={vehicles} />}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}