import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAddPartForm } from "@/hooks/useAddPartForm";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info } from "lucide-react";
import { useCallback } from "react";
import InventorySearchDialog from "./InventorySearchDialog";
import ExternalPartForm from "./parts/ExternalPartForm";
import InventoryPartForm from "./parts/InventoryPartForm";
import ServicePartForm from "./parts/ServicePartForm";
import SourceTypeSelector from "./parts/SourceTypeSelector";
import TyreInventoryPartForm from "./parts/TyreInventoryPartForm";
import RepeatedActionAlertDialog from "./RepeatedActionAlertDialog";

type InventoryItem = Database["public"]["Tables"]["inventory"]["Row"];

interface AddPartWithCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobCardId: string;
  onSuccess: () => void;
  isTyreJobCard?: boolean;
}

export default function AddPartWithCostDialog({
  open,
  onOpenChange,
  jobCardId,
  onSuccess,
  isTyreJobCard = false,
}: AddPartWithCostDialogProps) {
  const {
    state,
    dispatch,
    hasInsufficientStock,
    isLowStock,
    handleInventorySelect,
    handleTyreSelect,
    handleSubmit,
    handleRepeatedActionConfirm,
  } = useAddPartForm(jobCardId, open, onSuccess, onOpenChange, isTyreJobCard);

  // Fetch inventory items for direct selection
  const {
    data: inventoryItems = [],
    isLoading: isLoadingInventory,
    error: inventoryError,
  } = useQuery<InventoryItem[]>({
    queryKey: ["inventory", "parts-dialog-selector"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: open && state.sourceType === "inventory",
  });

  const handlePartNameChange = useCallback(
    (value: string) => dispatch({ type: "SET_PART_NAME", payload: value }),
    [dispatch]
  );

  const handlePartNumberChange = useCallback(
    (value: string) => dispatch({ type: "SET_PART_NUMBER", payload: value }),
    [dispatch]
  );

  const handleServiceDescriptionChange = useCallback(
    (value: string) => dispatch({ type: "SET_SERVICE_DESCRIPTION", payload: value }),
    [dispatch]
  );

  const isProcessing = state.isSubmitting || state.isUploading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isTyreJobCard ? "Request Tyre or Service" : "Request Part or Service"}
            </DialogTitle>
            <DialogDescription>
              {isTyreJobCard
                ? "Select a tyre from the holding bay inventory, or request an external part/service. Vendor, pricing and IR numbers will be assigned by procurement."
                : "Submit a request for a part or service. Vendor, pricing and IR number will be assigned by the procurement team."}
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-blue-200 bg-blue-50 text-blue-800">
            <Info className="h-4 w-4" />
            <AlertDescription>
              You don&apos;t need to enter costs, vendors, or IR numbers. The
              procurement team will handle these details once they receive this
              request.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <SourceTypeSelector
              sourceType={state.sourceType}
              onSelect={(type) =>
                dispatch({ type: "SET_SOURCE_TYPE", payload: type })
              }
              isTyreJobCard={isTyreJobCard}
            />

            {state.sourceType === "tyre-inventory" && (
              <TyreInventoryPartForm
                selectedTyreId={state.selectedTyreId}
                onTyreSelect={handleTyreSelect}
              />
            )}

            {state.sourceType === "inventory" && (
              <InventoryPartForm
                partName={state.partName}
                selectedInventoryId={state.selectedInventoryId}
                availableQuantity={state.availableQuantity}
                quantity={state.quantity}
                location={state.location}
                supplier={state.supplier}
                inventoryItems={inventoryItems}
                isLoadingInventory={isLoadingInventory}
                inventoryError={
                  inventoryError instanceof Error ? inventoryError : null
                }
                isLowStock={isLowStock}
                hasInsufficientStock={hasInsufficientStock}
                onPartNameChange={handlePartNameChange}
                onInventorySelect={handleInventorySelect}
                onOpenSearch={() =>
                  dispatch({
                    type: "SET_SHOW_INVENTORY_SEARCH",
                    payload: true,
                  })
                }
              />
            )}

            {state.sourceType === "external" && (
              <ExternalPartForm
                partName={state.partName}
                partNumber={state.partNumber}
                onPartNameChange={handlePartNameChange}
                onPartNumberChange={handlePartNumberChange}
              />
            )}

            {state.sourceType === "service" && (
              <ServicePartForm
                partName={state.partName}
                serviceDescription={state.serviceDescription}
                onPartNameChange={handlePartNameChange}
                onServiceDescriptionChange={handleServiceDescriptionChange}
              />
            )}

            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={state.quantity}
                onChange={(e) =>
                  dispatch({
                    type: "SET_QUANTITY",
                    payload: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={state.notes}
                onChange={(e) =>
                  dispatch({ type: "SET_NOTES", payload: e.target.value })
                }
                placeholder="Describe what the part/service is needed for..."
                rows={2}
              />
            </div>

            {hasInsufficientStock && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Insufficient stock. The request will be submitted and
                  procurement will source the item.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <InventorySearchDialog
        open={state.showInventorySearch}
        onOpenChange={(open) =>
          dispatch({ type: "SET_SHOW_INVENTORY_SEARCH", payload: open })
        }
        onSelect={handleInventorySelect}
      />

      <RepeatedActionAlertDialog
        open={state.showRepeatedAlert}
        onOpenChange={(open) =>
          dispatch({ type: "SET_SHOW_REPEATED_ALERT", payload: open })
        }
        title="Repeated Part Usage Detected"
        description="This part has been used on this vehicle before. Please provide a reason for this repeated usage."
        alertType="part"
        vehicleInfo={state.vehicleInfo || undefined}
        previousOccurrences={state.previousUsages}
        onConfirm={handleRepeatedActionConfirm}
        onCancel={() => {
          dispatch({ type: "SET_SHOW_REPEATED_ALERT", payload: false });
          dispatch({ type: "SET_PREVIOUS_USAGES", payload: [] });
        }}
        isSubmitting={state.isSubmitting}
      />
    </>
  );
}