import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface InventoryItemData {
  id: string;
  name: string;
  part_number: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit_price: number;
  location: string;
  supplier: string;
}

interface AddInventoryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  editItem?: InventoryItemData | null;
}

const AddInventoryItemDialog = ({ open, onOpenChange, onAdd, editItem }: AddInventoryItemDialogProps) => {
  const [formData, setFormData] = useState({
    name: "",
    part_number: "",
    category: "",
    quantity: "0",
    min_quantity: "5",
    unit_price: "",
    location: "",
    supplier: "",
  });
  const [loading, setLoading] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editItem) {
      setFormData({
        name: editItem.name,
        part_number: editItem.part_number,
        category: editItem.category,
        quantity: editItem.quantity.toString(),
        min_quantity: editItem.min_quantity.toString(),
        unit_price: editItem.unit_price.toString(),
        location: editItem.location || "",
        supplier: editItem.supplier || "",
      });
    } else {
      // Reset form when not editing
      setFormData({
        name: "",
        part_number: "",
        category: "",
        quantity: "0",
        min_quantity: "5",
        unit_price: "",
        location: "",
        supplier: "",
      });
    }
  }, [editItem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const itemData = {
        name: formData.name,
        part_number: formData.part_number,
        category: formData.category,
        quantity: parseInt(formData.quantity),
        min_quantity: parseInt(formData.min_quantity),
        unit_price: parseFloat(formData.unit_price),
        location: formData.location,
        supplier: formData.supplier,
      };

      if (editItem) {
        // Update existing item
        const { error } = await supabase
          .from("inventory")
          .update(itemData)
          .eq("id", editItem.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Inventory item updated successfully",
        });
      } else {
        // Insert new item
        const { error } = await supabase.from("inventory").insert(itemData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Inventory item added successfully",
        });
      }

      onAdd();
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: editItem ? "Failed to update inventory item" : "Failed to add inventory item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
          <DialogDescription>
            {editItem ? "Update the inventory item details" : "Add a new part to your inventory"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Part Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="part_number">Part Number *</Label>
                <Input
                  id="part_number"
                  value={formData.part_number}
                  onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                  disabled={!!editItem}
                  required
                />
                {editItem && (
                  <p className="text-xs text-muted-foreground">Part number cannot be changed</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  min="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_quantity">Min Quantity *</Label>
                <Input
                  id="min_quantity"
                  type="number"
                  value={formData.min_quantity}
                  onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                  min="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_price">Unit Price</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  min="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (editItem ? "Updating..." : "Adding...") : (editItem ? "Update Item" : "Add Item")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddInventoryItemDialog;