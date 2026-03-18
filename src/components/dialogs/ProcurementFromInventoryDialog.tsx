import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileUp, Package, ShoppingCart, X } from "lucide-react";
import { useEffect, useState } from "react";

interface InventoryItemForProcurement {
  id: string;
  name: string;
  partNumber: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  location: string;
  supplier: string;
}

interface ProcurementFromInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryItem: InventoryItemForProcurement | null;
  onSuccess?: () => void;
}

const ProcurementFromInventoryDialog = ({
  open,
  onOpenChange,
  inventoryItem,
  onSuccess,
}: ProcurementFromInventoryDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");

  // New fields
  const [irNumber, setIrNumber] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [makeBrand, setMakeBrand] = useState("");
  const [partCode, setPartCode] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Reset form when dialog opens with new item
  useEffect(() => {
    if (open && inventoryItem) {
      // Calculate suggested reorder quantity (bring stock to 2x minimum)
      const suggestedQuantity = Math.max(
        inventoryItem.minQuantity * 2 - inventoryItem.quantity,
        inventoryItem.minQuantity
      );
      setQuantity(suggestedQuantity.toString());
      setUnitPrice(inventoryItem.unitPrice.toString());
      setMakeBrand("");
      setPartCode(inventoryItem.partNumber || "");
      setIrNumber("");
      setNotes("");
      setExpectedDeliveryDate("");
      setSelectedVendorId("");
      setDocumentFile(null);
    }
  }, [open, inventoryItem]);

  // Fetch vendors for selection
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, vendor_name")
        .order("vendor_name");
      if (error) throw error;
      return data || [];
    },
  });

  const isLowStock = inventoryItem
    ? inventoryItem.quantity < inventoryItem.minQuantity
    : false;

  const stockDeficit = inventoryItem
    ? Math.max(0, inventoryItem.minQuantity - inventoryItem.quantity)
    : 0;

  // Calculate total price
  const calculatedTotalPrice =
    quantity && unitPrice && parseFloat(unitPrice) > 0 && parseInt(quantity) > 0
      ? parseFloat(unitPrice) * parseInt(quantity)
      : 0;

  // File handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File Too Large",
          description: "Please upload a file smaller than 5MB",
        });
        return;
      }
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a PDF, JPG, or PNG file",
        });
        return;
      }
      setDocumentFile(file);
    }
  };

  const uploadDocument = async (): Promise<string | null> => {
    if (!documentFile) return null;

    setIsUploading(true);
    try {
      const fileExt = documentFile.name.split(".").pop();
      const fileName = `procurement-${inventoryItem?.id}-${Date.now()}.${fileExt}`;
      const filePath = `procurement-quotes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, documentFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Document upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Could not upload document. Please try again.",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inventoryItem) {
      toast({
        title: "Error",
        description: "No inventory item selected",
        variant: "destructive",
      });
      return;
    }

    if (!quantity || parseInt(quantity) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    if (!selectedVendorId) {
      toast({
        title: "Error",
        description: "Please select a vendor for the procurement request",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Upload document if provided
      let uploadedDocUrl: string | null = null;
      if (documentFile) {
        uploadedDocUrl = await uploadDocument();
        if (!uploadedDocUrl && documentFile) {
          throw new Error("Document upload failed");
        }
      }

      // Build notes - keep details separate if columns exist, otherwise include in notes
      const stockNote = `Reorder for existing inventory item. Current stock: ${inventoryItem.quantity} units. Min stock level: ${inventoryItem.minQuantity} units.`;
      const finalNotes = notes ? `${notes}\n\n${stockNote}` : stockNote;

      const parsedUnitPrice = parseFloat(unitPrice) || inventoryItem.unitPrice || 0;
      const parsedQuantity = parseInt(quantity);
      const calculatedTotal = parsedUnitPrice * parsedQuantity;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertData: Record<string, any> = {
        part_name: inventoryItem.name,
        part_number: partCode || inventoryItem.partNumber || null,
        quantity: parsedQuantity,
        unit_price: parsedUnitPrice,
        total_price: calculatedTotal,
        inventory_id: inventoryItem.id,
        is_from_inventory: true,
        notes: finalNotes,
        status: "pending",
        vendor_id: selectedVendorId,
        is_service: false,
        expected_delivery_date: expectedDeliveryDate || null,
        document_url: uploadedDocUrl,
        document_name: documentFile?.name || null,
      };

      // Add new fields (columns added via migration 20260202000001)
      if (irNumber) insertData.ir_number = irNumber;
      if (makeBrand) insertData.make_brand = makeBrand;

      const { error } = await supabase
        .from("parts_requests")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(insertData as any);

      if (error) throw error;

      toast({
        title: "Procurement Request Submitted",
        description: `Request for ${quantity} units of "${inventoryItem.name}" has been submitted successfully.`,
      });
      requestGoogleSheetsSync('workshop');

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Procurement request error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit procurement request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!inventoryItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Reorder Inventory Item
          </DialogTitle>
          <DialogDescription>
            Create a procurement request for an existing inventory item
          </DialogDescription>
        </DialogHeader>

        {/* Item Summary Card */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{inventoryItem.name}</span>
            </div>
            {isLowStock && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Low Stock
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Part Number:</span>{" "}
              <span className="font-mono">{inventoryItem.partNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Category:</span>{" "}
              <span>{inventoryItem.category}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Current Stock:</span>{" "}
              <span className={isLowStock ? "text-warning font-semibold" : ""}>
                {inventoryItem.quantity} units
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Min Quantity:</span>{" "}
              <span>{inventoryItem.minQuantity} units</span>
            </div>
          </div>
          {stockDeficit > 0 && (
            <div className="text-sm text-destructive mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Stock deficit: {stockDeficit} units below minimum level
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* IR Number */}
          <div className="space-y-2">
            <Label htmlFor="irNumber">IR Number (Internal Requisition)</Label>
            <Input
              id="irNumber"
              placeholder="e.g., IR-2026-001234"
              value={irNumber}
              onChange={(e) => setIrNumber(e.target.value)}
            />
          </div>

          {/* Part Details - Make/Brand and Part Code */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="makeBrand">Make / Brand</Label>
              <Input
                id="makeBrand"
                placeholder="e.g., Bosch, Continental"
                value={makeBrand}
                onChange={(e) => setMakeBrand(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partCode">Part Code</Label>
              <Input
                id="partCode"
                placeholder="e.g., ABC-12345"
                value={partCode}
                onChange={(e) => setPartCode(e.target.value)}
              />
            </div>
          </div>

          {/* Quantity and Unit Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Order Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitPrice">Unit Price ($) *</Label>
              <Input
                id="unitPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Total Amount - Auto Calculated */}
          {calculatedTotalPrice > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Amount:</span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-400">
                  ${calculatedTotalPrice.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {quantity} units × ${parseFloat(unitPrice).toFixed(2)} per unit
              </p>
            </div>
          )}

          {/* Vendor Selection */}
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor *</Label>
            <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.vendor_name || vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vendors.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No vendors available. Please add vendors first.
              </p>
            )}
          </div>

          {/* Expected Delivery Date */}
          <div className="space-y-2">
            <Label htmlFor="expectedDelivery">Expected Delivery Date</Label>
            <Input
              id="expectedDelivery"
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Quote File Upload */}
          <div className="space-y-2">
            <Label>Supporting Quote Document</Label>
            {documentFile ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate max-w-[300px]">{documentFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(documentFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDocumentFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <Label
                  htmlFor="quoteUpload"
                  className="cursor-pointer text-sm text-primary hover:underline"
                >
                  Click to upload quote, invoice, or supporting document
                </Label>
                <Input
                  id="quoteUpload"
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional information or special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* New stock projection */}
          {quantity && parseInt(quantity) > 0 && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-sm">
              <p className="text-green-700 dark:text-green-400">
                <strong>After delivery:</strong> Stock will be{" "}
                <span className="font-semibold">
                  {inventoryItem.quantity + parseInt(quantity)} units
                </span>
                {inventoryItem.quantity + parseInt(quantity) >= inventoryItem.minQuantity && (
                  <span className="ml-1">(above minimum level ✓)</span>
                )}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading || isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || isUploading}>
              {loading || isUploading ? "Processing..." : "Submit Procurement Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProcurementFromInventoryDialog;