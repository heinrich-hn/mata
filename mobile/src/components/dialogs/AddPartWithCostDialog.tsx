import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatCurrency } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileUp, X } from "lucide-react";
import { useCallback } from "react";
import InventorySearchDialog from "./InventorySearchDialog";
import ExternalPartForm from "./parts/ExternalPartForm";
import InventoryPartForm from "./parts/InventoryPartForm";
import ServicePartForm from "./parts/ServicePartForm";
import SourceTypeSelector from "./parts/SourceTypeSelector";
import RepeatedActionAlertDialog from "./RepeatedActionAlertDialog";

type InventoryItem = Database["public"]["Tables"]["inventory"]["Row"];
type Vendor = Database["public"]["Tables"]["vendors"]["Row"];

interface AddPartWithCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobCardId: string;
  onSuccess: () => void;
}

export default function AddPartWithCostDialog({
  open,
  onOpenChange,
  jobCardId,
  onSuccess,
}: AddPartWithCostDialogProps) {
  const {
    state,
    dispatch,
    totalPrice,
    hasInsufficientStock,
    isLowStock,
    handleInventorySelect,
    handleFileChange,
    handleSubmit,
    handleRepeatedActionConfirm,
  } = useAddPartForm(jobCardId, open, onSuccess, onOpenChange);

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

  // Fetch vendors
  const {
    data: vendors = [],
    isLoading: isLoadingVendors,
    error: vendorsError,
  } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return (data || []) as Vendor[];
    },
  });

  const handleVendorChange = useCallback(
    (value: string) => dispatch({ type: "SET_SELECTED_VENDOR_ID", payload: value }),
    [dispatch]
  );

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

  const handleIrNumberChange = useCallback(
    (value: string) => dispatch({ type: "SET_IR_NUMBER", payload: value }),
    [dispatch]
  );

  const isProcessing = state.isSubmitting || state.isUploading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Part/Service with Cost</DialogTitle>
            <DialogDescription>
              Choose from inventory, external parts, or services. Upload proof
              of cost.
            </DialogDescription>
          </DialogHeader>

          {vendorsError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Error loading vendors:{" "}
                {vendorsError instanceof Error
                  ? vendorsError.message
                  : "Unknown error"}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <SourceTypeSelector
              sourceType={state.sourceType}
              onSelect={(type) =>
                dispatch({ type: "SET_SOURCE_TYPE", payload: type })
              }
            />

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
                selectedVendorId={state.selectedVendorId}
                irNumber={state.irNumber}
                vendors={vendors}
                isLoadingVendors={isLoadingVendors}
                onPartNameChange={handlePartNameChange}
                onPartNumberChange={handlePartNumberChange}
                onVendorChange={handleVendorChange}
                onIrNumberChange={handleIrNumberChange}
              />
            )}

            {state.sourceType === "service" && (
              <ServicePartForm
                partName={state.partName}
                serviceDescription={state.serviceDescription}
                selectedVendorId={state.selectedVendorId}
                irNumber={state.irNumber}
                vendors={vendors}
                isLoadingVendors={isLoadingVendors}
                onPartNameChange={handlePartNameChange}
                onServiceDescriptionChange={handleServiceDescriptionChange}
                onVendorChange={handleVendorChange}
                onIrNumberChange={handleIrNumberChange}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="unitPrice">Unit Price (USD) *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={state.unitPrice}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_UNIT_PRICE",
                      payload: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={
                    state.sourceType === "inventory" &&
                    !!state.selectedInventoryId
                  }
                />
              </div>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total Cost:</span>
                  <span>{formatCurrency(totalPrice)}</span>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label htmlFor="document">
                Upload Document (Proof of Cost)
              </Label>
              <div className="mt-2">
                {state.documentFile ? (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50">
                    <div className="flex items-center gap-2">
                      <FileUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm">
                        {state.documentFile.name}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        dispatch({
                          type: "SET_DOCUMENT_FILE",
                          payload: null,
                        })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <Label
                      htmlFor="fileUpload"
                      className="cursor-pointer text-sm text-primary hover:underline"
                    >
                      Click to upload invoice, receipt, or quote
                    </Label>
                    <Input
                      id="fileUpload"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, JPG, PNG (max 5MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={state.notes}
                onChange={(e) =>
                  dispatch({ type: "SET_NOTES", payload: e.target.value })
                }
                placeholder="Additional notes or comments..."
                rows={2}
              />
            </div>

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
                {isProcessing ? "Processing..." : "Add to Job Card"}
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