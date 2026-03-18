import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input"; // Added for search
import { useToast } from "@/hooks/use-toast";
import { useRouteOptimization } from "@/hooks/useRouteOptimization";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useWialonContext } from "@/integrations/wialon";
import { AlertCircle, MapPin, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
// Types
type Load = Database["public"]["Tables"]["loads"]["Row"];
type WialonVehicle = Database["public"]["Tables"]["wialon_vehicles"]["Row"];
interface LoadAssignmentDialogProps {
  load: Load | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
interface WialonUnitWithDistance {
  id: number;
  nm: string;
  pos: { y: number; x: number; s: number; c: number; z: number; sc: number; t: number; } | null;
  distance_km?: number;
  score?: number;
}
// Constants
const SCORING_CONFIG = {
  DISTANCE_FACTOR: 1.0,
  NO_GPS_PENALTY: 10000,
  URGENT_BONUS: -500,
  HIGH_PRIORITY_BONUS: -200,
} as const;
const LoadAssignmentDialog = ({ load, open, onOpenChange }: LoadAssignmentDialogProps) => {
  const { toast } = useToast();
  const { calculateDistance } = useRouteOptimization();
  const { units, isLoading, isConnected, connect, error: wialonError } = useWialonContext();
  // State
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [dbVehicles, setDbVehicles] = useState<WialonVehicle[]>([]);
  const [useWialonVehicles, setUseWialonVehicles] = useState(true);
  const [search, setSearch] = useState(""); // Added for search
  // Reset selected vehicle when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedVehicle(null);
      setSearch("");
    }
  }, [open]);
  // Fetch database vehicles
  const fetchDbVehicles = useCallback(async () => {
    if (!open) return;
    try {
      const { data } = await supabase.from('wialon_vehicles').select('*');
      if (data) setDbVehicles(data);
    } catch (error) {
      console.error('Failed to fetch database vehicles:', error);
    }
  }, [open]);
  useEffect(() => {
    fetchDbVehicles();
  }, [fetchDbVehicles]);
  // Handle Wialon connection fallback
  useEffect(() => {
    if (wialonError && dbVehicles.length > 0) {
      console.warn('⚠️ Wialon unavailable, using database vehicles');
      setUseWialonVehicles(false);
    }
  }, [wialonError, dbVehicles.length]);
  // Auto-connect to Wialon
  useEffect(() => {
    if (open && !isConnected && !isLoading && useWialonVehicles) {
      connect();
    }
  }, [open, isConnected, isLoading, connect, useWialonVehicles]);
  // Calculate vehicle scores and distances
  const rankedVehicles = useMemo(() => {
    if (!load || !units.length) return [];
    const vehiclesWithScores: WialonUnitWithDistance[] = units.map((unit) => {
      const distance_km = calculateVehicleDistance(load, unit, calculateDistance);
      const score = calculateVehicleScore(distance_km, load.priority);
      return { ...unit, distance_km, score };
    });
    return vehiclesWithScores.sort((a, b) => (a.score || 0) - (b.score || 0));
  }, [units, load, calculateDistance]);
  // Filtered vehicles based on search
  const filteredRankedVehicles = useMemo(() => {
    if (!search) return rankedVehicles;
    const lower = search.toLowerCase();
    return rankedVehicles.filter((v) =>
      v.nm.toLowerCase().includes(lower) || v.id.toString().includes(search)
    );
  }, [rankedVehicles, search]);
  const filteredDbVehicles = useMemo(() => {
    if (!search) return dbVehicles;
    const lower = search.toLowerCase();
    return dbVehicles.filter((v) =>
      (v.name || "").toLowerCase().includes(lower) || v.wialon_unit_id.toString().includes(search)
    );
  }, [dbVehicles, search]);
  // Auto-select best vehicle on open
  useEffect(() => {
    if (open && useWialonVehicles && rankedVehicles[0] && !selectedVehicle) {
      setSelectedVehicle(rankedVehicles[0].id.toString());
    }
  }, [open, useWialonVehicles, rankedVehicles, selectedVehicle]);
  // Vehicle lookup for names
  const vehicleLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (useWialonVehicles) {
      rankedVehicles.forEach((u) => map.set(u.id.toString(), u.nm));
    } else {
      dbVehicles.forEach((v) => map.set(v.wialon_unit_id.toString(), v.name || "Unknown"));
    }
    return map;
  }, [useWialonVehicles, rankedVehicles, dbVehicles]);
  // Vehicle assignment handler
  const handleAssign = useCallback(async () => {
    if (!selectedVehicle || !load) {
      showToast(toast, "error", "No vehicle selected", "Please select a vehicle to assign this load.");
      return;
    }
    setIsAssigning(true);
    try {
      const vehicleId = await getOrCreateVehicleId(
        selectedVehicle,
        useWialonVehicles,
        rankedVehicles,
        dbVehicles
      );
      await assignLoadToVehicle(load.id, vehicleId);
      const vehicleName = vehicleLookup.get(selectedVehicle) ?? "vehicle";
      showToast(toast, "success", "Load assigned", `Load ${load.load_number} has been assigned to ${vehicleName}.`);
      onOpenChange(false);
    } catch (error) {
      console.error("Assignment failed:", error);
      showToast(
        toast,
        "error",
        "Assignment failed",
        error instanceof Error ? error.message : "Could not assign load. Please try again."
      );
    } finally {
      setIsAssigning(false);
    }
  }, [selectedVehicle, load, useWialonVehicles, rankedVehicles, dbVehicles, toast, onOpenChange, vehicleLookup]);
  if (!load) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Load to Wialon Vehicle</DialogTitle>
          <DialogDescription>
            Select a GPS-tracked vehicle from Wialon based on proximity and availability.
          </DialogDescription>
        </DialogHeader>
        <LoadDetailsCard load={load} />
        <VehicleSelectionSection
          useWialonVehicles={useWialonVehicles}
          setUseWialonVehicles={setUseWialonVehicles}
          isConnected={isConnected}
          isLoading={isLoading}
          dbVehicles={dbVehicles}
          rankedVehicles={rankedVehicles}
          filteredRankedVehicles={filteredRankedVehicles}
          filteredDbVehicles={filteredDbVehicles}
          selectedVehicle={selectedVehicle}
          setSelectedVehicle={setSelectedVehicle}
          search={search}
          setSearch={setSearch}
          connect={connect}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAssigning}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedVehicle || isAssigning || (useWialonVehicles && !isConnected)}
          >
            {isAssigning ? "Assigning..." : "Assign Vehicle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default LoadAssignmentDialog;
// Helper Components
const LoadDetailsCard = ({ load }: { load: Load }) => (
  <Card className="mb-4">
    <CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-gray-400" />
        <RouteInfo origin={load.origin} destination={load.destination} />
      </div>
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-gray-400" />
        <DetailItem label="Load #" value={load.load_number} />
      </div>
      <DetailItem label="Weight" value={`${load.weight_kg.toLocaleString()} kg`} />
      <PriorityBadge priority={load.priority} />
    </CardContent>
  </Card>
);
const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div className="text-sm">
    <span className="text-gray-500">{label}:</span> {value}
  </div>
);
const PriorityBadge = ({ priority }: { priority: string }) => (
  <Badge variant={getPriorityVariant(priority)}>
    Priority: {priority}
  </Badge>
);
const RouteInfo = ({ origin, destination }: { origin: string; destination: string }) => (
  <span className="text-sm">
    Route: {origin} → {destination}
  </span>
);
const VehicleSelectionSection = ({
  useWialonVehicles,
  setUseWialonVehicles,
  isConnected,
  isLoading,
  dbVehicles,
  rankedVehicles,
  filteredRankedVehicles,
  filteredDbVehicles,
  selectedVehicle,
  setSelectedVehicle,
  search,
  setSearch,
  connect,
}: {
  useWialonVehicles: boolean;
  setUseWialonVehicles: (use: boolean) => void;
  isConnected: boolean;
  isLoading: boolean;
  dbVehicles: WialonVehicle[];
  rankedVehicles: WialonUnitWithDistance[];
  filteredRankedVehicles: WialonUnitWithDistance[];
  filteredDbVehicles: WialonVehicle[];
  selectedVehicle: string | null;
  setSelectedVehicle: (vehicle: string | null) => void;
  search: string;
  setSearch: (search: string) => void;
  connect: () => void;
}) => (
  <div className="space-y-4">
    <VehicleSelectionHeader
      useWialonVehicles={useWialonVehicles}
      setUseWialonVehicles={setUseWialonVehicles}
      isConnected={isConnected}
      dbVehicles={dbVehicles}
      rankedVehicles={rankedVehicles}
    />
    <Input
      placeholder="Search vehicles by name or ID..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="w-full px-3 py-2 border rounded-md text-sm"
    />
    {useWialonVehicles && !isConnected && (
      <Button size="sm" onClick={connect} disabled={isLoading}>
        {isLoading ? "Connecting..." : "Retry Wialon Connection"}
      </Button>
    )}
    <VehicleSelectionContent
      useWialonVehicles={useWialonVehicles}
      isLoading={isLoading}
      isConnected={isConnected}
      dbVehicles={dbVehicles}
      rankedVehicles={rankedVehicles}
      filteredRankedVehicles={filteredRankedVehicles}
      filteredDbVehicles={filteredDbVehicles}
      selectedVehicle={selectedVehicle}
      setSelectedVehicle={setSelectedVehicle}
    />
  </div>
);
const VehicleSelectionHeader = ({
  useWialonVehicles,
  setUseWialonVehicles,
  isConnected,
  dbVehicles,
  rankedVehicles,
}: {
  useWialonVehicles: boolean;
  setUseWialonVehicles: (use: boolean) => void;
  isConnected: boolean;
  dbVehicles: WialonVehicle[];
  rankedVehicles: WialonUnitWithDistance[];
}) => (
  <div className="flex items-center justify-between">
    <h3 className="font-medium">
      {useWialonVehicles ? 'Available Wialon Vehicles' : 'Available Vehicles (Database)'}
    </h3>
    <div className="space-x-2">
      {useWialonVehicles && !isConnected && dbVehicles.length > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setUseWialonVehicles(false)}>
          Use Database Vehicles
        </Button>
      )}
      {!useWialonVehicles && (
        <span className="text-sm text-gray-500">
          {dbVehicles.length} vehicles in database
        </span>
      )}
      {useWialonVehicles && isConnected && (
        <span className="text-sm text-gray-500">
          {rankedVehicles.length} GPS-tracked vehicles
        </span>
      )}
    </div>
  </div>
);
const VehicleSelectionContent = ({
  useWialonVehicles,
  isLoading,
  isConnected,
  dbVehicles,
  rankedVehicles,
  filteredRankedVehicles,
  filteredDbVehicles,
  selectedVehicle,
  setSelectedVehicle,
}: {
  useWialonVehicles: boolean;
  isLoading: boolean;
  isConnected: boolean;
  dbVehicles: WialonVehicle[];
  rankedVehicles: WialonUnitWithDistance[];
  filteredRankedVehicles: WialonUnitWithDistance[];
  filteredDbVehicles: WialonVehicle[];
  selectedVehicle: string | null;
  setSelectedVehicle: (vehicle: string | null) => void;
}) => {
  if (useWialonVehicles && isLoading) {
    return <LoadingSpinner />;
  }
  if (useWialonVehicles && !isLoading && !isConnected && dbVehicles.length === 0) {
    return <ConnectionErrorCard />;
  }
  if (useWialonVehicles && !isLoading && isConnected && rankedVehicles.length === 0) {
    return <NoVehiclesCard />;
  }
  if (useWialonVehicles && !isLoading && isConnected && filteredRankedVehicles.length > 0) {
    return (
      <WialonVehiclesList
        vehicles={filteredRankedVehicles}
        rankedVehicles={rankedVehicles} // Pass original ranked for recommendations
        selectedVehicle={selectedVehicle}
        setSelectedVehicle={setSelectedVehicle}
      />
    );
  }
  if (!useWialonVehicles && filteredDbVehicles.length > 0) {
    return (
      <DatabaseVehiclesList
        vehicles={filteredDbVehicles}
        selectedVehicle={selectedVehicle}
        setSelectedVehicle={setSelectedVehicle}
      />
    );
  }
  return null;
};
const LoadingSpinner = () => (
  <div className="flex justify-center py-8 text-gray-500">
    Loading Wialon vehicles...
  </div>
);
const ConnectionErrorCard = () => (
  <Card className="border-destructive/20 bg-destructive/5">
    <CardContent className="p-4 flex items-start gap-3 text-destructive">
      <AlertCircle className="h-5 w-5 mt-0.5" />
      <div>
        <h4 className="font-medium">Cannot connect to Wialon</h4>
        <p className="text-sm">
          Wialon GPS integration is unavailable. No vehicles found in database either.
          <br />
          Please check Wialon edge function deployment or add vehicles to the database.
        </p>
      </div>
    </CardContent>
  </Card>
);
const NoVehiclesCard = () => (
  <Card className="border-yellow-500/20 bg-yellow-500/5">
    <CardContent className="p-4 flex items-start gap-3 text-yellow-600">
      <AlertCircle className="h-5 w-5 mt-0.5" />
      <div>
        <h4 className="font-medium">No vehicles available</h4>
        <p className="text-sm">There are no active vehicles in Wialon.</p>
      </div>
    </CardContent>
  </Card>
);
const WialonVehiclesList = ({
  vehicles,
  rankedVehicles,
  selectedVehicle,
  setSelectedVehicle,
}: {
  vehicles: WialonUnitWithDistance[];
  rankedVehicles: WialonUnitWithDistance[];
  selectedVehicle: string | null;
  setSelectedVehicle: (vehicle: string | null) => void;
}) => (
  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
    {vehicles.map((unit) => {
      const originalIndex = rankedVehicles.findIndex((v) => v.id === unit.id);
      return (
        <WialonVehicleCard
          key={unit.id}
          unit={unit}
          originalIndex={originalIndex}
          isSelected={selectedVehicle === unit.id.toString()}
          onSelect={() => setSelectedVehicle(unit.id.toString())}
        />
      );
    })}
  </div>
);
const DatabaseVehiclesList = ({
  vehicles,
  selectedVehicle,
  setSelectedVehicle,
}: {
  vehicles: WialonVehicle[];
  selectedVehicle: string | null;
  setSelectedVehicle: (vehicle: string | null) => void;
}) => (
  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
    {vehicles.map((vehicle) => (
      <DatabaseVehicleCard
        key={vehicle.id}
        vehicle={vehicle}
        isSelected={selectedVehicle === vehicle.wialon_unit_id.toString()}
        onSelect={() => setSelectedVehicle(vehicle.wialon_unit_id.toString())}
      />
    ))}
  </div>
);
const WialonVehicleCard = ({
  unit,
  originalIndex,
  isSelected,
  onSelect,
}: {
  unit: WialonUnitWithDistance;
  originalIndex: number;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const distanceColor = unit.distance_km !== undefined
    ? unit.distance_km < 50
      ? "text-green-600 border-green-600"
      : unit.distance_km < 200
      ? "text-yellow-600 border-yellow-600"
      : "text-red-600 border-red-600"
    : "";
  const isStale = unit.pos && Date.now() - unit.pos.t * 1000 > 30 * 60 * 1000;
  return (
    <Card
      className={`cursor-pointer transition-all ${isSelected ? "border-primary bg-primary/5" : "hover:border-gray-300"}`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <Truck className={`h-5 w-5 mt-0.5 ${isSelected ? "text-primary" : "text-gray-400"}`} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{unit.nm}</span>
                {unit.distance_km !== undefined && (
                  <Badge variant="outline" className={`text-xs ${distanceColor}`}>
                    {unit.distance_km.toFixed(1)} km away
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <DetailItem label="Unit ID" value={unit.id.toString()} />
                {unit.pos && (
                  <>
                    <DetailItem
                      label="Speed"
                      value={unit.pos.s ? `${unit.pos.s} km/h` : 'Stopped'}
                    />
                    <DetailItem label="Score" value={unit.score?.toFixed(0) || "N/A"} />
                  </>
                )}
              </div>
              {unit.pos && (
                <>
                  <p className="text-xs text-gray-500">
                    Last GPS: {unit.pos.y?.toFixed(4)}, {unit.pos.x?.toFixed(4)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last update: {new Date(unit.pos.t * 1000).toLocaleTimeString()}
                    {isStale && " ⚠️ Stale (>30min)"}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {originalIndex === 0 && <Badge variant="default">Recommended</Badge>}
            {originalIndex === 1 && <Badge variant="secondary">2nd Best</Badge>}
            {originalIndex === 2 && <Badge variant="secondary">3rd Best</Badge>}
            {isSelected && <Badge className="ml-2">Selected</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
const DatabaseVehicleCard = ({
  vehicle,
  isSelected,
  onSelect,
}: {
  vehicle: WialonVehicle;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <Card
    className={`cursor-pointer transition-all ${isSelected ? "border-primary bg-primary/5" : "hover:border-gray-300"}`}
    onClick={onSelect}
  >
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <Truck className={`h-5 w-5 mt-0.5 ${isSelected ? "text-primary" : "text-gray-400"}`} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {vehicle.fleet_number ? `${vehicle.fleet_number} - ` : ''}{vehicle.name}
              </span>
              {vehicle.registration && (
                <Badge variant="outline" className="text-xs">
                  {vehicle.registration}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <DetailItem label="Unit ID" value={vehicle.wialon_unit_id.toString()} />
              <DetailItem label="Database ID" value={`${vehicle.id.substring(0, 8)}...`} />
            </div>
            <p className="text-xs text-gray-500">
              ⚠️ GPS tracking unavailable - using database record
            </p>
          </div>
        </div>
        {isSelected && <Badge className="ml-2">Selected</Badge>}
      </div>
    </CardContent>
  </Card>
);
// Utility Functions
const calculateVehicleDistance = (
  load: Load,
  unit: WialonUnitWithDistance,
  calculateDistance: (lat1: number, lng1: number, lat2: number, lng2: number) => number
): number | undefined => {
  if (load.origin_lat && load.origin_lng && unit.pos?.y && unit.pos?.x) {
    return calculateDistance(load.origin_lat, load.origin_lng, unit.pos.y, unit.pos.x);
  }
  return undefined;
};
const calculateVehicleScore = (distance_km: number | undefined, priority: string): number => {
  let score = distance_km !== undefined ? distance_km * SCORING_CONFIG.DISTANCE_FACTOR : SCORING_CONFIG.NO_GPS_PENALTY;
  if (priority === "urgent") score += SCORING_CONFIG.URGENT_BONUS;
  else if (priority === "high") score += SCORING_CONFIG.HIGH_PRIORITY_BONUS;
  return score;
};
const getPriorityVariant = (priority: string) => {
  switch (priority) {
    case "urgent": return "destructive";
    case "high": return "default";
    default: return "secondary";
  }
};
const getOrCreateVehicleId = async (
  selectedVehicle: string,
  useWialonVehicles: boolean,
  rankedVehicles: WialonUnitWithDistance[],
  dbVehicles: WialonVehicle[]
): Promise<string> => {
  if (useWialonVehicles) {
    const wialonUnitId = parseInt(selectedVehicle);
    const unit = rankedVehicles.find(u => u.id === wialonUnitId);
    // Step 1: Check if vehicle already exists
    const { data: existing, error: fetchError } = await supabase
      .from('wialon_vehicles')
      .select('id')
      .eq('wialon_unit_id', wialonUnitId)
      .maybeSingle();
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows
      throw new Error(`DB error: ${fetchError.message}`);
    }
    if (existing) {
      console.log('Using existing vehicle record:', existing.id);
      return existing.id; // ← Critical: Always return if exists
    }
    // Step 2: Create new vehicle record
    const { data: newVehicle, error: insertError } = await supabase
      .from('wialon_vehicles')
      .insert({
        wialon_unit_id: wialonUnitId,
        name: unit?.nm || `Unit ${wialonUnitId}`,
        registration: null,
        fleet_number: null, // Add if your table requires it
      })
      .select('id')
      .single();
    if (insertError || !newVehicle) {
      throw new Error(`Failed to create vehicle record: ${insertError?.message || 'Unknown error'}`);
    }
    console.log('Created new vehicle record:', newVehicle.id);
    return newVehicle.id;
  } else {
    // Database-only mode
    const vehicle = dbVehicles.find(v => v.wialon_unit_id.toString() === selectedVehicle);
    if (!vehicle) throw new Error('Selected vehicle not found in database');
    return vehicle.id;
  }
};
const assignLoadToVehicle = async (loadId: string, vehicleId: string): Promise<void> => {
  // Extra safety: Validate vehicle exists (redundant but prevents FK errors)
  const { data: vehicleExists, error: checkError } = await supabase
    .from('wialon_vehicles')
    .select('id')
    .eq('id', vehicleId)
    .maybeSingle();
  if (checkError) {
    throw new Error(`Failed to validate vehicle: ${checkError.message}`);
  }
  if (!vehicleExists) {
    throw new Error(`Vehicle ID ${vehicleId} does not exist in wialon_vehicles table. Please refresh the vehicle list and try again.`);
  }
  // Proceed with assignment
  const { error: updateError } = await supabase
    .from('loads')
    .update({
      assigned_vehicle_id: vehicleId,
      status: 'assigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', loadId);
  if (updateError) {
    throw new Error(`Failed to assign load: ${updateError.message}`);
  }
  console.log('✅ Assignment successful - Load updated');
};
const showToast = (
  toast: ReturnType<typeof useToast>['toast'],
  type: "success" | "error",
  title: string,
  description: string
) => {
  toast({
    title,
    description,
    variant: type === "error" ? "destructive" : undefined,
  });
};
