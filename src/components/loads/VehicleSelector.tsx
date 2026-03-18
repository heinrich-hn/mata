
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useWialonContext } from "@/integrations/wialon";
import { useQuery } from "@tanstack/react-query";
import { Gauge, MapPin, RefreshCw, Search, Truck } from "lucide-react";
import { useState } from "react";

interface VehicleSelectorProps {
  onSelect: (vehicleId: string, vehicleName: string) => void;
  selectedVehicleId?: string;
  showGPSOnly?: boolean;
  originLat?: number;
  originLng?: number;
}

interface VehicleWithGPS {
  id: string;
  wialon_unit_id: number;
  name: string;
  registration: string | null;
  created_at: string | null;
  updated_at: string | null;
  currentLat?: number;
  currentLng?: number;
  speed?: number;
  distance?: number;
  lastUpdate?: Date;
}

const VehicleSelector = ({
  onSelect,
  selectedVehicleId,
  showGPSOnly = false,
  originLat,
  originLng,
}: VehicleSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const {
    isConnected,
    isLoading: wialonLoading,
    vehicleLocations,
    connect,
    refreshUnits,
  } = useWialonContext();

  // Fetch all vehicles from wialon_vehicles table (which loads.assigned_vehicle_id references)
  const { data: vehicles = [], isLoading: vehiclesLoading, refetch } = useQuery({
    queryKey: ["wialon-vehicles-for-selection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wialon_vehicles")
        .select("*")
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  // Merge vehicles with GPS data
  const vehiclesWithGPS: VehicleWithGPS[] = vehicles.map((vehicle) => {
    // Try to match with GPS data using various identifiers
    const gpsData = vehicleLocations.find((loc) => {
      // Try matching by name
      if (loc.vehicleName === vehicle.name) return true;
      // Try matching by registration (as wialon vehicleId)
      if (loc.vehicleId === vehicle.registration) return true;
      // Try matching name prefix
      if (loc.vehicleName.startsWith(vehicle.name + " ")) return true;
      // Try matching registration without spaces
      if (vehicle.registration) {
        const regNoSpaces = vehicle.registration.replace(/\s/g, "");
        if (loc.vehicleId.includes(regNoSpaces)) return true;
      }
      // Try matching if registration is part of the vehicle name
      if (vehicle.registration && loc.vehicleName.includes(vehicle.registration)) return true;
      return false;
    });    let distance: number | undefined;
    if (gpsData && originLat && originLng) {
      // Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = ((gpsData.latitude - originLat) * Math.PI) / 180;
      const dLon = ((gpsData.longitude - originLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((originLat * Math.PI) / 180) *
          Math.cos((gpsData.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance = R * c;
    }

    return {
      ...vehicle,
      currentLat: gpsData?.latitude,
      currentLng: gpsData?.longitude,
      speed: gpsData?.speed,
      distance,
      lastUpdate: gpsData?.timestamp,
    } as VehicleWithGPS;
  });

  // Filter vehicles
  const filteredVehicles = vehiclesWithGPS
    .filter((v) => {
      if (showGPSOnly && !v.currentLat) return false;
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        v.name.toLowerCase().includes(searchLower) ||
        v.registration?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      // Sort by distance if origin is provided
      if (originLat && originLng && a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return 0;
    });

  const handleRefresh = async () => {
    try {
      await Promise.all([
        refetch(),
        isConnected ? refreshUnits() : connect(),
      ]);
    } catch (err) {
      console.error('Failed to refresh vehicles:', err);
      // Error is already logged by useWialon, just prevent unhandled promise rejection
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Select Vehicle</h3>
          {isConnected && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
              GPS Connected
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {!isConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={connect}
              disabled={wialonLoading}
            >
              {wialonLoading ? "Connecting..." : "Connect GPS"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={wialonLoading || vehiclesLoading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by fleet number, registration, make..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Vehicle List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredVehicles.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {showGPSOnly
                  ? "No vehicles with GPS tracking found"
                  : "No vehicles found"}
              </p>
            </CardContent>
          </Card>
        )}

        {filteredVehicles.map((vehicle) => {
          const isSelected = selectedVehicleId === vehicle.id;
          const hasGPS = !!vehicle.currentLat;

          return (
            <Card
              key={vehicle.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "hover:border-gray-300"
              }`}
              onClick={() =>
                onSelect(vehicle.id, `${vehicle.name}${vehicle.registration ? ` (${vehicle.registration})` : ''}`)
              }
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Truck
                      className={`h-5 w-5 mt-0.5 ${
                        isSelected ? "text-primary" : "text-gray-400"
                      }`}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{vehicle.name}</span>
                        {vehicle.registration && (
                          <span className="text-sm text-gray-500">
                            {vehicle.registration}
                          </span>
                        )}
                        {hasGPS && (
                          <Badge variant="outline" className="text-xs bg-green-50">
                            <MapPin className="h-3 w-3 mr-1" />
                            GPS Active
                          </Badge>
                        )}
                        {vehicle.distance !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            {vehicle.distance.toFixed(1)} km away
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Unit ID</p>
                          <p className="font-medium">{vehicle.wialon_unit_id}</p>
                        </div>
                        {hasGPS && (
                          <>
                            <div>
                              <p className="text-gray-500">Speed</p>
                              <p className="font-medium flex items-center gap-1">
                                <Gauge className="h-3 w-3" />
                                {vehicle.speed?.toFixed(0) || 0} km/h
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Location</p>
                              <p className="font-medium text-xs">
                                {vehicle.currentLat?.toFixed(4)}, {vehicle.currentLng?.toFixed(4)}
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {hasGPS && vehicle.lastUpdate && (
                        <p className="text-xs text-gray-500">
                          Last updated:{" "}
                          {new Date(vehicle.lastUpdate).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && <Badge className="ml-2">Selected</Badge>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stats */}
      {filteredVehicles.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Showing {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? "s" : ""}
          {isConnected && (
            <span className="ml-1">
              • {filteredVehicles.filter((v) => v.currentLat).length} with GPS
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default VehicleSelector;
