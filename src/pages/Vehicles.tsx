import Layout from "@/components/Layout";
import VehicleDocAlerts from "@/components/Vehicle/VehicleDocAlerts";
import { VehicleDetailsModal } from "@/components/Vehicle/VehicleDetailsModal";
import AddVehicleDialog from "@/components/dialogs/AddVehicleDialog";
import DeleteVehicleDialog from "@/components/dialogs/DeleteVehicleDialog";
import EditVehicleDialog from "@/components/dialogs/EditVehicleDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ensureAlert } from '@/lib/alertUtils';
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from 'date-fns';
import { Eye, Loader2, Pencil, Plus, Search, Trash2, Truck } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";

// Update the Vehicle interface to match the actual Supabase table structure
interface Vehicle {
  id: string;
  fleet_number: string | null;
  registration_number: string;
  make: string;
  model: string;
  vehicle_type: string;
  tonnage: number | null;
  engine_specs: string | null;
  active: boolean | null;
  license_disk_expiry: string | null;
  created_at: string | null;
  // Add other fields that might be in the response
  qr_code_value?: string | null;
  reefer_unit?: string | null;
  wialon_id?: number | null;
  current_odometer?: number | null;
  last_service_date?: string | null;
  next_service_due?: string | null;
  insurance_expiry?: string | null;
  mot_expiry?: string | null;
  year?: number | null;
  vin?: string | null;
}

const Vehicles = () => {
  const [searchTerm, setSearchTerm] = useState("");
  // Defer the search term so the query doesn't refetch on every keystroke
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ["vehicles", deferredSearchTerm, statusFilter, typeFilter],
    queryFn: async (): Promise<Vehicle[]> => {
      let query = supabase
        .from("vehicles")
        .select("*")
        .order("fleet_number", { ascending: true });

      if (deferredSearchTerm) {
        query = query.or(
          `fleet_number.ilike.%${deferredSearchTerm}%,registration_number.ilike.%${deferredSearchTerm}%,make.ilike.%${deferredSearchTerm}%,model.ilike.%${deferredSearchTerm}%`
        );
      }

      if (statusFilter === "active") {
        query = query.eq("active", true);
      } else if (statusFilter === "inactive") {
        query = query.eq("active", false);
      }

      if (typeFilter !== "all") {
        query = query.eq("vehicle_type", typeFilter as Database["public"]["Enums"]["vehicle_type"]);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as unknown as Vehicle[];
    },
    staleTime: 60 * 1000,
  });

  // Generate alerts for expired license disks
  useEffect(() => {
    if (isLoading || !vehicles || vehicles.length === 0) return;
    const today = new Date();
    vehicles.forEach((v) => {
      if (!v.license_disk_expiry) return;
      const exp = parseISO(v.license_disk_expiry);
      if (!isNaN(exp.getTime()) && exp < today) {
        ensureAlert({
          sourceType: 'vehicle',
          sourceId: v.id,
          sourceLabel: v.fleet_number || v.registration_number,
          category: 'document_expiry',
          severity: 'high',
          title: 'Vehicle license disk expired',
          message: `License disk expired on ${format(exp, 'yyyy-MM-dd')} for ${v.registration_number}`,
          metadata: {
            registration_number: v.registration_number,
            fleet_number: v.fleet_number,
            expiry_date: v.license_disk_expiry,
            document: 'license_disk',
          },
        }).catch((e) => console.error('ensureAlert failed', e));
      }
    });
  }, [isLoading, vehicles]);

  // Get unique vehicle types for filter
  const vehicleTypes = [...new Set(vehicles.map(v => v.vehicle_type).filter(Boolean))].sort();

  const getVehicleTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      rigid_truck: { label: "Rigid Truck", variant: "default" },
      horse_truck: { label: "Horse Truck", variant: "default" },
      refrigerated_truck: { label: "Refrigerated", variant: "secondary" },
      reefer: { label: "Reefer Trailer", variant: "secondary" },
      interlink: { label: "Interlink Trailer", variant: "outline" },
      truck: { label: "Truck", variant: "default" },
      trailer: { label: "Trailer", variant: "secondary" },
      van: { label: "Van", variant: "outline" },
      pickup: { label: "Pickup", variant: "outline" },
      tanker: { label: "Tanker", variant: "default" },
    };
    const config = typeMap[type] || { label: type, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleEdit = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setEditDialogOpen(true);
  };

  const handleDelete = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setDeleteDialogOpen(true);
  };

  const handleViewDetails = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setDetailsModalOpen(true);
  };

  // Convert our Vehicle type to the VehicleDetailsModal expected type
  const getDetailsModalVehicle = () => {
    if (!selectedVehicle) return null;
    return {
      id: selectedVehicle.id,
      registration: selectedVehicle.registration_number,
      make: selectedVehicle.make,
      model: selectedVehicle.model,
      year: selectedVehicle.year || 2020,
      vin: selectedVehicle.vin || "N/A",
      status: selectedVehicle.active ? "active" : "inactive",
      mileage: selectedVehicle.current_odometer || 0,
      fuel_type: "Diesel",
      last_service_date: selectedVehicle.last_service_date || "",
      next_service_due: selectedVehicle.next_service_due || "",
      insurance_expiry: selectedVehicle.insurance_expiry || "",
      mot_expiry: selectedVehicle.mot_expiry || "",
      created_at: selectedVehicle.created_at || "",
      updated_at: selectedVehicle.created_at || "",
      fleetNumber: selectedVehicle.fleet_number,
    };
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Vehicle
          </Button>
        </div>

        {/* Document Alerts */}
        <VehicleDocAlerts />

        {/* Vehicle List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Vehicle List</CardTitle>
                <CardDescription>
                  {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} in your fleet
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vehicles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full sm:w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {vehicleTypes.map((type) => (
                      <SelectItem key={type as string} value={type as string}>
                        {String(type).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No vehicles found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Add a vehicle to get started"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fleet #</TableHead>
                      <TableHead>Registration</TableHead>
                      <TableHead>Make & Model</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Tonnage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>License Disk</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-medium">
                          {vehicle.fleet_number || "-"}
                        </TableCell>
                        <TableCell>{vehicle.registration_number}</TableCell>
                        <TableCell>
                          {vehicle.make} {vehicle.model}
                        </TableCell>
                        <TableCell>{getVehicleTypeBadge(vehicle.vehicle_type)}</TableCell>
                        <TableCell>
                          {vehicle.tonnage ? `${vehicle.tonnage}T` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={vehicle.active ? "default" : "secondary"}>
                            {vehicle.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {vehicle.license_disk_expiry ? (
                            <div className="flex items-center gap-2">
                              <span className={parseISO(vehicle.license_disk_expiry) < new Date() ? 'text-destructive font-semibold' : ''}>
                                {format(parseISO(vehicle.license_disk_expiry), 'yyyy-MM-dd')}
                              </span>
                              {parseISO(vehicle.license_disk_expiry) < new Date() && (
                                <Badge variant="destructive">Expired</Badge>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(vehicle)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(vehicle)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(vehicle)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <AddVehicleDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
        <EditVehicleDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          vehicle={selectedVehicle}
        />
        <DeleteVehicleDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          vehicle={selectedVehicle}
        />
        <VehicleDetailsModal
          vehicle={getDetailsModalVehicle()}
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
        />
      </div>
    </Layout>
  );
};

export default Vehicles;