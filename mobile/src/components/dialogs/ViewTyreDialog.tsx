import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Box, DollarSign, Gauge, MapPin, Package, Pencil, Ruler, Tag, Truck, User } from "lucide-react";

interface TyreStock {
  id: string;
  brand: string;
  model: string;
  dotCode: string;
  size: string;
  type: string;
  pressureRating: number | null;
  initialTreadDepth: number | null;
  quantity: number;
  minQuantity: number;
  unitPrice: number; // Now required, in USD
  purchaseCostZar: number | null; // Keep for reference but not display
  purchaseCostUsd: number | null; // In USD
  location: string;
  supplier: string;
  status: string;
}

interface ViewTyreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tyre: TyreStock | null;
  onInstall?: (tyre: TyreStock) => void;
  onEdit?: (tyre: TyreStock) => void;
}

const ViewTyreDialog = ({ open, onOpenChange, tyre, onInstall, onEdit }: ViewTyreDialogProps) => {
  if (!tyre) return null;

  const isLowStock = tyre.quantity < tyre.minQuantity;

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      steer: "bg-primary text-primary-foreground",
      Steer: "bg-primary text-primary-foreground",
      drive: "bg-accent text-accent-foreground",
      Drive: "bg-accent text-accent-foreground",
      trailer: "bg-secondary text-secondary-foreground",
      Trailer: "bg-secondary text-secondary-foreground",
    };
    return (
      <Badge className={colors[type] || "bg-muted"}>
        {type}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      new: "default",
      used: "secondary",
      refurbished: "outline",
      scrap: "destructive",
      "in-service": "secondary",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status.replace(/-/g, " ")}
      </Badge>
    );
  };

  // Format currency in USD only
  const formatUSD = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Get the price to display (prioritize purchaseCostUsd, then unitPrice)
  const getDisplayPrice = (): number | null => {
    if (tyre.purchaseCostUsd !== null && tyre.purchaseCostUsd !== undefined) {
      return tyre.purchaseCostUsd;
    }
    if (tyre.unitPrice !== null && tyre.unitPrice !== undefined) {
      return tyre.unitPrice;
    }
    return null;
  };

  const displayPrice = getDisplayPrice();
  const totalValue = displayPrice ? displayPrice * tyre.quantity : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5" />
            {tyre.brand} {tyre.model}
          </DialogTitle>
          <DialogDescription>
            Complete specifications and details for this tyre stock item
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Stock Status Alert */}
          {isLowStock && (
            <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Low Stock Warning</p>
                <p className="text-sm text-muted-foreground">
                  Current quantity ({tyre.quantity}) is below minimum threshold ({tyre.minQuantity})
                </p>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Brand</p>
                <p className="font-medium">{tyre.brand}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Model</p>
                <p className="font-medium">{tyre.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">DOT Code</p>
                <p className="font-mono font-medium">{tyre.dotCode || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <div className="mt-0.5">{getTypeBadge(tyre.type)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Condition</p>
                <div className="mt-0.5">{getStatusBadge(tyre.status)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Supplier</p>
                <p className="font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {tyre.supplier || "-"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Technical Specifications */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Technical Specifications
            </h3>
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5" />
                  Size
                </p>
                <p className="font-mono font-medium text-lg">{tyre.size}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Initial Tread Depth</p>
                <p className="font-mono font-medium text-lg">
                  {tyre.initialTreadDepth ? `${tyre.initialTreadDepth}mm` : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pressure Rating</p>
                <p className="font-mono font-medium text-lg">
                  {tyre.pressureRating ? `${tyre.pressureRating} PSI` : "-"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Stock & Location */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Box className="h-4 w-4" />
              Stock & Location
            </h3>
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Current Quantity</p>
                <p className={`font-bold text-2xl ${isLowStock ? "text-destructive" : "text-primary"}`}>
                  {tyre.quantity}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Minimum Quantity</p>
                <p className="font-medium text-lg">{tyre.minQuantity}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Location
                </p>
                <p className="font-medium capitalize">{tyre.location.replace(/-/g, " ") || "-"}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Pricing Information - All in USD */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing Information (USD)
            </h3>
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Unit Price</p>
                <p className="font-mono font-medium text-lg">
                  {displayPrice ? formatUSD(displayPrice) : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Purchase Cost (USD)</p>
                <p className="font-mono font-medium text-lg text-green-600 dark:text-green-400">
                  {tyre.purchaseCostUsd ? formatUSD(tyre.purchaseCostUsd) : "-"}
                </p>
              </div>
            </div>

            {/* Total Stock Value in USD */}
            {totalValue && totalValue > 0 && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Stock Value (USD)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tyre.quantity} units × {formatUSD(displayPrice)}
                    </p>
                  </div>
                  <p className="font-bold text-xl text-primary">
                    {formatUSD(totalValue)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && (
            <Button
              variant="secondary"
              onClick={() => {
                onEdit(tyre);
                onOpenChange(false);
              }}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          {onInstall && tyre.quantity > 0 && (
            <Button
              onClick={() => {
                onInstall(tyre);
                onOpenChange(false);
              }}
              className="gap-2"
            >
              <Truck className="h-4 w-4" />
              Install Tyre
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ViewTyreDialog;