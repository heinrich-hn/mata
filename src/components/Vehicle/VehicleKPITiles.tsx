// src/components/Vehicle/VehicleKPITiles.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  Truck, 
  CheckCircle, 
  AlertCircle, 
  Building2, 
  Car, 
  Tag
} from "lucide-react";

interface KPITile {
  label: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
}

export default function VehicleKPITiles() {
  const { data: vehicles = [], isLoading, error } = useQuery({
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
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-24 mb-2" />
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="col-span-full bg-red-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-600">Error loading vehicle data</p>
                <p className="text-xs text-red-500">{error.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
    { 
      label: "Total Vehicles", 
      value: total, 
      icon: Truck, 
      iconColor: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    { 
      label: "Active", 
      value: active, 
      icon: CheckCircle, 
      iconColor: "text-green-600",
      bgColor: "bg-green-100"
    },
    { 
      label: "Inactive", 
      value: inactive, 
      icon: AlertCircle, 
      iconColor: "text-gray-600",
      bgColor: "bg-gray-100"
    },
    { 
      label: "Unique Makes", 
      value: makes, 
      icon: Building2, 
      iconColor: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    { 
      label: "Unique Models", 
      value: models, 
      icon: Car, 
      iconColor: "text-orange-600",
      bgColor: "bg-orange-100"
    },
    { 
      label: "Vehicle Types", 
      value: types, 
      icon: Tag, 
      iconColor: "text-cyan-600",
      bgColor: "bg-cyan-100"
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {tiles.map((tile, i) => (
        <Card key={i} className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tile.label}
            </CardTitle>
            <div className={`p-2 rounded-full ${tile.bgColor}`}>
              <tile.icon className={`h-4 w-4 ${tile.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tile.value.toLocaleString()}</div>
            {total > 0 && tile.label !== "Total Vehicles" && (
              <p className="text-xs text-muted-foreground mt-1">
                {((tile.value / total) * 100).toFixed(1)}% of total
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}