import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, Building2, DollarSign } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type InventoryItem = Database["public"]["Tables"]["inventory"]["Row"];

interface InventoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryId: string | null;
}

export default function InventoryDetailDialog({
  open,
  onOpenChange,
  inventoryId,
}: InventoryDetailDialogProps) {
  // Fetch inventory item details
  const { data: inventory, isLoading } = useQuery({
    queryKey: ["inventory", inventoryId],
    queryFn: async () => {
      if (!inventoryId) return null;

      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("id", inventoryId)
        .single();

      if (error) throw error;
      return data as InventoryItem;
    },
    enabled: !!inventoryId && open,
  });

  // Calculate stock status
  const getStockStatus = () => {
    if (!inventory) return { label: "Unknown", variant: "secondary" as const };

    const current = inventory.quantity || 0;
    const min = inventory.min_quantity || 0;

    if (current === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (current <= min) return { label: "Low Stock", variant: "destructive" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  const stockStatus = getStockStatus();

  if (!inventoryId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventory Item Details
          </DialogTitle>
          <DialogDescription>
            View detailed information about this inventory item including stock levels, location, and pricing.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : inventory ? (
          <div className="space-y-4">
            {/* Header Info */}
            <div>
              <h3 className="text-xl font-bold">{inventory.name}</h3>
              {inventory.part_number && (
                <p className="text-sm text-muted-foreground">
                  Part #: {inventory.part_number}
                </p>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
              <span className="text-sm text-muted-foreground">
                {inventory.quantity} units available
              </span>
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Location */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold">
                    {inventory.location || "Not specified"}
                  </p>
                </CardContent>
              </Card>

              {/* Category */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold">
                    {inventory.category || "Uncategorized"}
                  </p>
                </CardContent>
              </Card>

              {/* Supplier */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Supplier
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold">
                    {inventory.supplier || "Not specified"}
                  </p>
                </CardContent>
              </Card>

              {/* Unit Price */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Unit Price
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold text-primary">
                    {inventory.unit_price
                      ? `R${inventory.unit_price.toFixed(2)}`
                      : "N/A"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Stock Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Stock Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Current Quantity:
                  </span>
                  <span className="font-semibold">{inventory.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Minimum Quantity:
                  </span>
                  <span className="font-semibold">
                    {inventory.min_quantity || "Not set"}
                  </span>
                </div>
                {inventory.unit_price && (
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-sm text-muted-foreground">
                      Total Value:
                    </span>
                    <span className="font-semibold text-primary">
                      R{((inventory.quantity || 0) * inventory.unit_price).toFixed(2)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Inventory item not found</p>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}