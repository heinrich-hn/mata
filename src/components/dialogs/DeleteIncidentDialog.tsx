import
  {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Incident } from "@/hooks/useIncidents";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface DeleteIncidentDialogProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DeleteIncidentDialog = ({
  incident,
  open,
  onOpenChange,
}: DeleteIncidentDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!incident) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("incidents")
        .delete()
        .eq("id", incident.id);

      if (error) throw error;

      toast({
        title: "Incident Deleted",
        description: `Incident ${incident.incident_number} has been deleted.`,
      });

      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      onOpenChange(false);
    } catch (err) {
      console.error("Error deleting incident:", err);
      toast({
        title: "Error",
        description: "Failed to delete incident. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!incident) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Incident</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete incident{" "}
            <strong>{incident.incident_number}</strong>? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteIncidentDialog;