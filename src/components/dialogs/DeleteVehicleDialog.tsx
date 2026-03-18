import { Button } from "@/components/ui/button";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

interface Vehicle {
  id: string;
  fleet_number: string | null;
  registration_number: string;
  make: string;
  model: string;
}

interface DeleteVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
}

const DeleteVehicleDialog = ({ open, onOpenChange, vehicle }: DeleteVehicleDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteVehicleMutation = useMutation({
    mutationFn: async () => {
      if (!vehicle) throw new Error("No vehicle selected");

      const { error } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", vehicle.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({
        title: "Success",
        description: "Vehicle deleted successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteVehicleMutation.mutate();
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Vehicle
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this vehicle? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted p-4 rounded-lg space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <span className="text-sm font-medium text-muted-foreground">Fleet #:</span>
            <span className="col-span-2 text-sm">{vehicle.fleet_number || "N/A"}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <span className="text-sm font-medium text-muted-foreground">Registration:</span>
            <span className="col-span-2 text-sm">{vehicle.registration_number}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <span className="text-sm font-medium text-muted-foreground">Vehicle:</span>
            <span className="col-span-2 text-sm">{vehicle.make} {vehicle.model}</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteVehicleMutation.isPending}
          >
            {deleteVehicleMutation.isPending ? "Deleting..." : "Delete Vehicle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteVehicleDialog;