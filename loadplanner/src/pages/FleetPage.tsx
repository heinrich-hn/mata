import { CreateFleetDialog } from '@/components/fleet/CreateFleetDialog';
import { EditFleetDialog } from '@/components/fleet/EditFleetDialog';
import { ViewFleetDialog } from '@/components/fleet/ViewFleetDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { FleetVehicle } from '@/hooks/useFleetVehicles';
import { useDeleteFleetVehicle, useFleetVehicles } from '@/hooks/useFleetVehicles';
import { cn } from '@/lib/utils';
import { Eye, Gauge, Package, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';

export default function FleetPage() {
  const { data: fleetVehicles = [], isLoading } = useFleetVehicles();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<FleetVehicle | null>(null);
  const deleteFleetVehicle = useDeleteFleetVehicle();

  const handleViewClick = (vehicle: FleetVehicle) => {
    setSelectedVehicle(vehicle);
    setViewDialogOpen(true);
  };

  const handleEditClick = (vehicle: FleetVehicle) => {
    setSelectedVehicle(vehicle);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (vehicle: FleetVehicle) => {
    setVehicleToDelete(vehicle);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (vehicleToDelete) {
      deleteFleetVehicle.mutate(vehicleToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setVehicleToDelete(null);
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fleet Vehicles</h1>
          <p className="text-muted-foreground">Manage and monitor your fleet vehicles</p>
        </div>

        {/* List-style loading skeletons */}
        <div className="rounded-xl border bg-card">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex items-center gap-6 p-6 border-b last:border-none"
            >
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fleet Vehicles</h1>
            <p className="text-muted-foreground">Manage and monitor your fleet vehicles</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        </div>

        {fleetVehicles.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm p-12 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No vehicles found</h3>
            <p className="text-muted-foreground mb-4">Add fleet vehicles to get started</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Vehicle
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            {fleetVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex items-center gap-6 p-6 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                {/* Icon + Vehicle ID + Badge */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Truck className="h-6 w-6 text-primary" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold truncate">{vehicle.vehicle_id}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          vehicle.available
                            ? 'bg-status-scheduled-bg text-status-scheduled border-status-scheduled/20'
                            : 'bg-status-pending-bg text-status-pending border-status-pending/20'
                        )}
                      >
                        {vehicle.available ? 'Available' : 'In Use'}
                      </Badge>
                    </div>

                    {/* Type */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Package className="h-4 w-4" />
                      <span className="truncate">{vehicle.type}</span>
                    </div>

                    {/* Capacity */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Gauge className="h-4 w-4" />
                      <span>Capacity: {vehicle.capacity} Tons</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => handleViewClick(vehicle)}
                    title="View details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => handleEditClick(vehicle)}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteClick(vehicle)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateFleetDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <ViewFleetDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        vehicle={selectedVehicle}
      />

      <EditFleetDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        vehicle={selectedVehicle}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete vehicle <span className="font-semibold">{vehicleToDelete?.vehicle_id}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFleetVehicle.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
