
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABELS } from "@/constants/loadStatusWorkflow";
import { useToast } from "@/hooks/use-toast";
import { useLoads } from "@/hooks/useLoads";
import { Edit, MapPin, Navigation, Package, Route, Trash2 } from "lucide-react";
import React, { useCallback } from "react";
import type { Load } from "@/pages/LoadManagement"; // Adjust import path as needed based on your structure

interface LoadsTableProps {
  loads: Load[];
  onAssign: (load: Load) => void;
  onTrackLive: (loadId: string) => void;
  onPlanRoute: (loadId: string) => void;
  onEdit: (load: Load) => void;
}

// Utility functions for styling
const getStatusVariant = (status: string) => {
  const map: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
    pending: "secondary",
    assigned: "default",
    arrived_at_loading: "default",
    loading: "default",
    loading_completed: "default",
    in_transit: "default",
    arrived_at_delivery: "default",
    offloading: "default",
    offloading_completed: "default",
    delivered: "default",
    completed: "default",
    cancelled: "destructive",
    failed_delivery: "destructive",
  };
  return map[status] || "secondary";
};

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    pending: "text-yellow-600 bg-yellow-50",
    assigned: "text-blue-600 bg-blue-50",
    arrived_at_loading: "text-purple-600 bg-purple-50",
    loading: "text-indigo-600 bg-indigo-50",
    loading_completed: "text-teal-600 bg-teal-50",
    in_transit: "text-green-600 bg-green-50",
    arrived_at_delivery: "text-amber-600 bg-amber-50",
    offloading: "text-orange-600 bg-orange-50",
    offloading_completed: "text-emerald-600 bg-emerald-50",
    delivered: "text-green-700 bg-green-100",
    completed: "text-green-800 bg-green-200",
    cancelled: "text-red-600 bg-red-50",
    failed_delivery: "text-red-800 bg-red-100",
  };
  return map[status] || "text-gray-600 bg-gray-50";
};

const getPriorityVariant = (priority: string) => {
  const map: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
    urgent: "destructive",
    high: "default",
    medium: "secondary",
    low: "outline",
  };
  return map[priority] || "secondary";
};

export const LoadsTable = React.memo(({
  loads,
  onAssign,
  onTrackLive,
  onPlanRoute,
  onEdit,
}: LoadsTableProps) => {
  const { updateLoadAsync, deleteLoad, isDeleting } = useLoads();
  const { toast } = useToast();

  const handleStartTransit = useCallback(async (load: Load) => {
    try {
      await updateLoadAsync({
        id: load.id,
        updates: { status: "in_transit" },
      });
      toast({
        title: "Load In Transit",
        description: `Load ${load.load_number} is now in transit. GPS tracking is active.`,
      });
      onTrackLive(load.id);
    } catch (error) {
      console.error("Failed to start transit:", error);
      toast({
        title: "Error",
        description: "Failed to update load status",
        variant: "destructive",
      });
    }
  }, [updateLoadAsync, toast, onTrackLive]);

  const handleDelete = useCallback((load: Load) => {
    if (window.confirm(`Are you sure you want to delete load ${load.load_number}?\n\nThis action cannot be undone.`)) {
      deleteLoad(load.id);
    }
  }, [deleteLoad]);

  if (loads.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No loads found</h3>
          <p className="text-gray-500">There are no loads matching the current filter.</p>
        </CardContent>
      </Card>
    );
  }

  // Helper to determine available actions based on status
  const renderActions = (load: Load) => {
    const status = load.status;
    const isAssigned = status === "assigned" && load.assigned_vehicle;
    const isInProgress = ["arrived_at_loading", "loading", "loading_completed", "in_transit", "arrived_at_delivery", "offloading", "offloading_completed"].includes(status) && load.assigned_vehicle;
    const isCompleted = ["delivered", "completed", "cancelled", "failed_delivery"].includes(status);

    return (
      <div className="flex gap-2 flex-wrap">
        {status === "pending" && (
          <>
            <Button size="sm" variant="outline" onClick={() => onAssign(load)}>Assign</Button>
            <Button size="sm" variant="outline" onClick={() => onPlanRoute(load.id)} className="gap-1">
              <Route className="h-4 w-4" /> Plan
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(load)} className="gap-1">
              <Edit className="h-4 w-4" /> Edit
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleDelete(load)} className="gap-1" disabled={isDeleting}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        )}

        {isAssigned && (
          <>
            <Button size="sm" onClick={() => handleStartTransit(load)} className="gap-1">
              <Navigation className="h-4 w-4" /> Start Transit
            </Button>
            <Button size="sm" variant="outline" onClick={() => onPlanRoute(load.id)} className="gap-1">
              <Route className="h-4 w-4" /> Plan
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(load)} className="gap-1">
              <Edit className="h-4 w-4" /> Edit
            </Button>
          </>
        )}

        {isInProgress && (
          <>
            <Button size="sm" onClick={() => onTrackLive(load.id)} className="gap-1">
              <Navigation className="h-4 w-4" /> Track Live
            </Button>
            <Button size="sm" variant="outline" onClick={() => onPlanRoute(load.id)} className="gap-1">
              <Route className="h-4 w-4" /> Plan
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(load)} className="gap-1">
              <Edit className="h-4 w-4" /> Edit
            </Button>
          </>
        )}

        {isCompleted && (
          <Button size="sm" variant="outline" onClick={() => onEdit(load)} className="gap-1">
            <Edit className="h-4 w-4" /> Edit
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card>
      <div className="overflow-x-auto">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead>Load #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Pickup Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Assigned Vehicle</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loads.map((load) => (
            <TableRow key={load.id}>
              <TableCell className="font-medium">{load.load_number}</TableCell>
              <TableCell>{load.customer_name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <MapPin className="h-3 w-3 text-gray-400" />
                  <span className="truncate max-w-[150px]">{load.origin} → {load.destination}</span>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="text-sm font-medium">{load.cargo_type}</div>
                  <div className="text-xs text-gray-500">{load.weight_kg}kg</div>
                </div>
              </TableCell>
              <TableCell>{new Date(load.pickup_datetime).toLocaleDateString()}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(load.status)} className={getStatusColor(load.status)}>
                  {STATUS_LABELS[load.status as keyof typeof STATUS_LABELS] || load.status.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getPriorityVariant(load.priority)}>{load.priority}</Badge>
              </TableCell>
              <TableCell>
                {load.quoted_price ? `${load.currency} ${load.quoted_price.toLocaleString()}` : "-"}
              </TableCell>
              <TableCell>
                {load.assigned_vehicle ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{load.assigned_vehicle.name || `Unit ${load.assigned_vehicle.wialon_unit_id}`}</Badge>
                    <Badge variant="secondary" className="gap-1">
                      <MapPin className="h-3 w-3" /> GPS
                    </Badge>
                  </div>
                ) : (
                  <span className="text-gray-500">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                {renderActions(load)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </Card>
  );
});

LoadsTable.displayName = "LoadsTable";
