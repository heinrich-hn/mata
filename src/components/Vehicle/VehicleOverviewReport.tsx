// src/components/Vehicle/VehicleOverviewReport.tsx
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, Loader2, AlertCircle, CheckCircle, Fuel, Truck, Gauge, Calendar } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';

interface VehicleStats {
  id: string;
  registration_number: string;
  fleet_number: string | null;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  tonnage: number | null;
  engine_specs: string | null;
  active: boolean;
  current_odometer: number | null;
  reefer_unit: string | null;
  created_at: string;
  wialon_id: number | null;
}

interface OverviewData {
  total_vehicles: number;
  active_vehicles: number;
  inactive_vehicles: number;
  total_tonnage: number;
  avg_odometer: number;
  vehicles_by_type: Record<string, number>;
  recent_vehicles: VehicleStats[];
}

export default function VehicleOverviewReport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [vehicles, setVehicles] = useState<VehicleStats[]>([]);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all vehicles
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .order('fleet_number', { ascending: true });

      if (vehiclesError) {
        console.error('Error fetching vehicles:', vehiclesError);
        throw vehiclesError;
      }

      if (!vehiclesData || vehiclesData.length === 0) {
        setOverviewData({
          total_vehicles: 0,
          active_vehicles: 0,
          inactive_vehicles: 0,
          total_tonnage: 0,
          avg_odometer: 0,
          vehicles_by_type: {},
          recent_vehicles: []
        });
        setVehicles([]);
        return;
      }

      // Calculate statistics
      const activeVehicles = vehiclesData.filter(v => v.active === true).length;
      const inactiveVehicles = vehiclesData.filter(v => v.active === false).length;
      
      // Calculate total tonnage (sum of all tonnage values)
      const totalTonnage = vehiclesData.reduce((sum, v) => sum + (v.tonnage || 0), 0);
      
      // Calculate average odometer reading
      const vehiclesWithOdometer = vehiclesData.filter(v => v.current_odometer !== null);
      const avgOdometer = vehiclesWithOdometer.length > 0
        ? vehiclesWithOdometer.reduce((sum, v) => sum + (v.current_odometer || 0), 0) / vehiclesWithOdometer.length
        : 0;

      // Group vehicles by type
      const vehiclesByType: Record<string, number> = {};
      vehiclesData.forEach(vehicle => {
        const type = vehicle.vehicle_type || 'Unknown';
        vehiclesByType[type] = (vehiclesByType[type] || 0) + 1;
      });

      // Get 5 most recently added vehicles
      const recentVehicles = [...vehiclesData]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      setOverviewData({
        total_vehicles: vehiclesData.length,
        active_vehicles: activeVehicles,
        inactive_vehicles: inactiveVehicles,
        total_tonnage: totalTonnage,
        avg_odometer: avgOdometer,
        vehicles_by_type: vehiclesByType,
        recent_vehicles: recentVehicles
      });

      setVehicles(vehiclesData as VehicleStats[]);

    } catch (err) {
      console.error('Error fetching overview data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: { 
    title: string; 
    value: number | string; 
    icon: React.ElementType;
    color: string;
    subtitle?: string;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Vehicle Overview Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
            <div className="text-center space-y-2">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading vehicle data...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Vehicle Overview Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
            <div className="text-center space-y-2">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
              <p className="text-sm text-red-500">Error loading data: {error}</p>
              <button 
                onClick={fetchOverviewData}
                className="text-sm text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!overviewData || overviewData.total_vehicles === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Vehicle Overview Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
            <div className="text-center space-y-2">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No vehicles found in the system</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Vehicles" 
          value={overviewData.total_vehicles}
          icon={Truck}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard 
          title="Active Vehicles" 
          value={overviewData.active_vehicles}
          icon={CheckCircle}
          color="bg-green-100 text-green-600"
          subtitle={`${overviewData.inactive_vehicles} inactive`}
        />
        <StatCard 
          title="Total Tonnage" 
          value={overviewData.total_tonnage}
          icon={Fuel}
          color="bg-purple-100 text-purple-600"
          subtitle="Combined capacity"
        />
        <StatCard 
          title="Avg. Odometer" 
          value={`${Math.round(overviewData.avg_odometer).toLocaleString()} km`}
          icon={Gauge}
          color="bg-orange-100 text-orange-600"
        />
      </div>

      {/* Vehicle Type Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Vehicles by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(overviewData.vehicles_by_type).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{type.toLowerCase()}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${(count / overviewData.total_vehicles) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recently Added Vehicles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overviewData.recent_vehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">
                      {vehicle.fleet_number || vehicle.registration_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {vehicle.make} {vehicle.model}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {new Date(vehicle.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Fleet #</th>
                  <th className="text-left py-3 px-4 font-medium">Registration</th>
                  <th className="text-left py-3 px-4 font-medium">Make/Model</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-left py-3 px-4 font-medium">Tonnage</th>
                  <th className="text-left py-3 px-4 font-medium">Odometer (km)</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">
                      {vehicle.fleet_number || '-'}
                    </td>
                    <td className="py-3 px-4">{vehicle.registration_number}</td>
                    <td className="py-3 px-4">
                      {vehicle.make && vehicle.model 
                        ? `${vehicle.make} ${vehicle.model}`
                        : vehicle.make || vehicle.model || '-'}
                    </td>
                    <td className="py-3 px-4 capitalize">
                      {vehicle.vehicle_type?.toLowerCase() || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {vehicle.tonnage ? `${vehicle.tonnage} tons` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {vehicle.current_odometer?.toLocaleString() || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        vehicle.active 
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {vehicle.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}