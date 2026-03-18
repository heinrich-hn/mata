// src/components/Vehicle/VehicleKPITiles.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";


interface KPITile {
  label: string;
  value: number;
}

export default function VehicleKPITiles() {
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles-kpi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("active, make, model, vehicle_type");

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-20 mb-2" />
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const total = vehicles.length;
  const active = vehicles.filter((v) => v.active === true).length;
  const inactive = vehicles.filter((v) => v.active === false).length;
  const makes = new Set(vehicles.map((v) => v.make).filter(Boolean)).size;
  const models = new Set(vehicles.map((v) => v.model).filter(Boolean)).size;
  const types = new Set(vehicles.map((v) => v.vehicle_type).filter(Boolean)).size;

  const tiles: KPITile[] = [
    { label: "Total Vehicles", value: total },
    { label: "Active", value: active },
    { label: "Inactive", value: inactive },
    { label: "Unique Makes", value: makes },
    { label: "Unique Models", value: models },
    { label: "Vehicle Types", value: types },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {tiles.map((tile, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {tile.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{tile.value.toLocaleString()}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}