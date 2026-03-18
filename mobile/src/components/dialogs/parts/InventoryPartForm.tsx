import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database } from "@/integrations/supabase/types";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { memo } from "react";

type InventoryItem = Database["public"]["Tables"]["inventory"]["Row"];

interface InventoryPartFormProps {
  partName: string;
  selectedInventoryId: string | null;
  availableQuantity: number;
  quantity: number;
  location: string;
  supplier: string;
  inventoryItems: InventoryItem[];
  isLoadingInventory: boolean;
  inventoryError: Error | null;
  isLowStock: boolean;
  hasInsufficientStock: boolean;
  onPartNameChange: (value: string) => void;
  onInventorySelect: (item: InventoryItem) => void;
  onOpenSearch: () => void;
}

function InventoryPartFormInner({
  partName,
  selectedInventoryId,
  availableQuantity,
  quantity,
  location,
  supplier,
  inventoryItems,
  isLoadingInventory,
  inventoryError,
  isLowStock,
  hasInsufficientStock,
  onPartNameChange,
  onInventorySelect,
  onOpenSearch,
}: InventoryPartFormProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="inventory-item">Select Inventory Item *</Label>
        <Select
          value={selectedInventoryId || undefined}
          onValueChange={(value) => {
            const selectedItem = inventoryItems.find(
              (item) => item.id === value
            );
            if (selectedItem) {
              onInventorySelect(selectedItem);
            }
          }}
        >
          <SelectTrigger id="inventory-item">
            <SelectValue
              placeholder={
                isLoadingInventory
                  ? "Loading inventory..."
                  : "Choose inventory item"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {isLoadingInventory ? (
              <SelectItem value="loading" disabled>
                Loading inventory...
              </SelectItem>
            ) : inventoryItems.length === 0 ? (
              <SelectItem value="empty" disabled>
                No inventory items found
              </SelectItem>
            ) : (
              inventoryItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}{" "}
                  {item.part_number ? `(${item.part_number})` : ""} • Qty:{" "}
                  {item.quantity || 0}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="partName">Part Name *</Label>
          <Input
            id="partName"
            value={partName}
            onChange={(e) => onPartNameChange(e.target.value)}
            placeholder="Enter part name"
            disabled={!!selectedInventoryId}
          />
        </div>
        <Button type="button" variant="outline" onClick={onOpenSearch}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {inventoryError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Error loading inventory:{" "}
            {inventoryError instanceof Error
              ? inventoryError.message
              : "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      {selectedInventoryId && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Inventory Item Selected
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available:</span>
              <Badge
                variant={
                  availableQuantity > quantity ? "default" : "destructive"
                }
              >
                {availableQuantity} units
              </Badge>
            </div>
            {location && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span>{location}</span>
              </div>
            )}
            {supplier && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier:</span>
                <span>{supplier}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isLowStock && !hasInsufficientStock && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Low stock warning: Only {availableQuantity} units available
          </AlertDescription>
        </Alert>
      )}

      {hasInsufficientStock && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Insufficient stock: Only {availableQuantity} units available
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

const InventoryPartForm = memo(InventoryPartFormInner);
export default InventoryPartForm;