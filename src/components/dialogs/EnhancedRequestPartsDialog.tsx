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
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { AlertTriangle, CheckCircle2, Package, Search } from "lucide-react";
import { useEffect, useState } from "react";
import InventorySearchDialog from "./InventorySearchDialog";

type InventoryItem = Database["public"]["Tables"]["inventory"]["Row"];

interface EnhancedRequestPartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobCardId: string;
  onSuccess: () => void;
}

export default function EnhancedRequestPartsDialog({
  open,
  onOpenChange,
  jobCardId,
  onSuccess,
}: EnhancedRequestPartsDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInventorySearch, setShowInventorySearch] = useState(false);

  // Form state
  const [partName, setPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");

  // Inventory integration state
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(
    null
  );
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [availableQuantity, setAvailableQuantity] = useState<number>(0);
  const [location, setLocation] = useState<string>("");
  const [supplier, setSupplier] = useState<string>("");

  // Computed values
  const totalPrice = quantity * unitPrice;
  const hasInsufficientStock = selectedInventoryId && quantity > availableQuantity;
  const isLowStock = availableQuantity > 0 && availableQuantity <= quantity * 2;

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setPartName("");
      setPartNumber("");
      setQuantity(1);
      setNotes("");
      setSelectedInventoryId(null);
      setUnitPrice(0);
      setAvailableQuantity(0);
      setLocation("");
      setSupplier("");
    }
  }, [open]);

  const handleInventorySelect = (item: InventoryItem) => {
    setPartName(item.name || "");
    setPartNumber(item.part_number || "");
    setSelectedInventoryId(item.id);
    setUnitPrice(item.unit_price || 0);
    setAvailableQuantity(item.quantity || 0);
    setLocation(item.location || "");
    setSupplier(item.supplier || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!partName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Part name is required",
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Quantity must be greater than 0",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Determine fulfilment path:
      // - inventory item with sufficient stock → fulfilled immediately (DOES NOT go to procurement)
      // - inventory item with insufficient stock → pending (goes to procurement)
      // - external part (no inventory) → pending (goes to procurement)
      const fulfilledFromStock = !!selectedInventoryId && !hasInsufficientStock;

      // For out of stock items, add a note indicating they need procurement
      const stockNote = hasInsufficientStock
        ? `[OUT OF STOCK - needs procurement] Available: ${availableQuantity}, Requested: ${quantity}${notes ? '. ' + notes : ''}`
        : notes || null;

      const { data: partsRequest, error: insertError } = await supabase
        .from("parts_requests")
        .insert({
          part_name: partName,
          part_number: partNumber || null,
          quantity,
          job_card_id: jobCardId,
          notes: fulfilledFromStock ? (notes || null) : stockNote,
          // CRITICAL: Fulfilled items get status "fulfilled", others get "pending"
          status: fulfilledFromStock ? "fulfilled" : "pending",
          inventory_id: selectedInventoryId || null,
          is_from_inventory: !!selectedInventoryId,
          unit_price: selectedInventoryId ? unitPrice : null,
          total_price: selectedInventoryId ? unitPrice * quantity : null,
          requested_by: user?.email || null,
          ...(fulfilledFromStock && {
            allocated_to_job_card: true,
            allocated_at: new Date().toISOString(),
          }),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // If fulfilled from stock: deduct inventory immediately
      if (fulfilledFromStock && partsRequest) {
        const { error: deductError } = await supabase.rpc("deduct_inventory", {
          p_parts_request_id: partsRequest.id,
          p_inventory_id: selectedInventoryId!,
          p_quantity: quantity,
          p_performed_by: user?.email || "system",
        });

        if (deductError) {
          console.error("Failed to deduct inventory:", deductError);
          toast({
            variant: "destructive",
            title: "Warning",
            description: "Part added to job card but inventory deduction failed — please adjust manually",
          });
        }
      }

      toast({
        title: "Success",
        description: fulfilledFromStock
          ? `Part added and ${quantity} unit(s) deducted from inventory`
          : hasInsufficientStock
            ? "Parts request submitted — out of stock, sent to Procurement for ordering"
            : "Parts request submitted — sent to Procurement",
      });
      requestGoogleSheetsSync('workshop');

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating parts request:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create parts request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Request Parts
            </DialogTitle>
            <DialogDescription>
              Request parts for this job card either from inventory or external suppliers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Inventory Selection Button */}
            <div className="flex justify-between items-center p-3 bg-accent rounded-lg">
              <div className="text-sm">
                <p className="font-medium">Select from inventory</p>
                <p className="text-muted-foreground">
                  Browse existing parts or enter manually below
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInventorySearch(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Browse Inventory
              </Button>
            </div>

            {/* Stock Alert */}
            {selectedInventoryId && (
              <Alert
                variant={
                  hasInsufficientStock
                    ? "destructive"
                    : "default"
                }
              >
                {hasInsufficientStock ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <AlertDescription>
                  {hasInsufficientStock ? (
                    <>
                      <strong>Short — needs restock!</strong> Only{" "}
                      {availableQuantity} units available. This item will be
                      sent to procurement for ordering.
                    </>
                  ) : isLowStock ? (
                    <>
                      <strong>Low stock warning:</strong> {availableQuantity}{" "}
                      units available.
                    </>
                  ) : (
                    <>
                      <strong>In stock:</strong> {availableQuantity} units
                      available. This item will be allocated immediately.
                    </>
                  )}
                  {location && ` Location: ${location}`}
                </AlertDescription>
              </Alert>
            )}

            {/* Part Name */}
            <div className="space-y-2">
              <Label htmlFor="partName">
                Part Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="partName"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="Enter part name"
                required
              />
            </div>

            {/* Part Number */}
            <div className="space-y-2">
              <Label htmlFor="partNumber">Part Number</Label>
              <Input
                id="partNumber"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="Enter part number (optional)"
              />
            </div>

            {/* Quantity and Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  required
                />
              </div>

              {selectedInventoryId && (
                <div className="space-y-2">
                  <Label>Total Price</Label>
                  <div className="h-10 flex items-center px-3 border rounded-md bg-muted">
                    <span className="font-semibold text-primary">
                      R{totalPrice.toFixed(2)}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({quantity} × R{unitPrice.toFixed(2)})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Supplier (if from inventory) */}
            {selectedInventoryId && supplier && (
              <div className="space-y-2">
                <Label>Supplier</Label>
                <div className="p-2 border rounded-md bg-muted text-sm">
                  {supplier}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes or requirements..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inventory Search Dialog */}
      <InventorySearchDialog
        open={showInventorySearch}
        onOpenChange={setShowInventorySearch}
        onSelect={handleInventorySelect}
      />
    </>
  );
}