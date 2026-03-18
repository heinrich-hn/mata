import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Vendor } from "@/types/vendor";
import { useEffect, useState } from "react";

interface AddVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  editVendor?: Vendor | null;
}

const AddVendorDialog = ({ editVendor, onAdd, onOpenChange, open }: AddVendorDialogProps) => {
  const [formData, setFormData] = useState({
    vendor_id: "",
    vendor_name: "",
    contact_person: "",
    email: "",
    phone: "",
    street_address: "",
    city: "",
  });
  const [loading, setLoading] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editVendor) {
      setFormData({
        vendor_id: editVendor.vendor_number || editVendor.vendor_id || "",
        vendor_name: editVendor.name || editVendor.vendor_name || "",
        contact_person: editVendor.contact_person || "",
        email: editVendor.email || "",
        phone: editVendor.phone || "",
        street_address: editVendor.street_address || "",
        city: editVendor.city || "",
      });
    } else {
      // Reset form when not editing
      setFormData({
        vendor_id: "",
        vendor_name: "",
        contact_person: "",
        email: "",
        phone: "",
        street_address: "",
        city: "",
      });
    }
  }, [editVendor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editVendor) {
        // Update existing vendor
        const { error } = await supabase
          .from("vendors")
          .update({
            vendor_name: formData.vendor_name,
            contact_person: formData.contact_person,
            email: formData.email,
            phone: formData.phone,
            street_address: formData.street_address,
            city: formData.city,
          })
          .eq("id", editVendor.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Vendor updated successfully",
        });
      } else {
        // Check for duplicate vendor_id
        if (formData.vendor_id) {
          const { data: existing } = await supabase
            .from("vendors")
            .select("id")
            .eq("vendor_id", formData.vendor_id)
            .single();

          if (existing) {
            toast({
              title: "Error",
              description: "A vendor with this ID already exists",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }

        // Insert new vendor (both vendor_id and vendor_name are required)
        const { error } = await supabase.from("vendors").insert({
          vendor_id: formData.vendor_id,
          vendor_name: formData.vendor_name,
          contact_person: formData.contact_person,
          email: formData.email,
          phone: formData.phone,
          street_address: formData.street_address,
          city: formData.city,
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Vendor added successfully",
        });
      }

      onAdd();
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: editVendor ? "Failed to update vendor" : "Failed to add vendor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          <DialogDescription>
            {editVendor ? "Update the vendor information" : "Add a new vendor to your supplier list"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_id">Vendor ID *</Label>
                <Input
                  id="vendor_id"
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                  disabled={!!editVendor}
                  required
                  placeholder="e.g., VEND001"
                />
                {editVendor && (
                  <p className="text-xs text-muted-foreground">Vendor ID cannot be changed</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_name">Vendor Name *</Label>
                <Input
                  id="vendor_name"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  required
                  placeholder="e.g., ABC Suppliers"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="e.g., John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., +27 123 456 7890"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g., contact@abcsuppliers.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="street_address">Address</Label>
              <Input
                id="street_address"
                value={formData.street_address}
                onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                placeholder="e.g., 123 Industrial Road"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g., Johannesburg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (editVendor ? "Updating..." : "Adding...") : (editVendor ? "Update Vendor" : "Add Vendor")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddVendorDialog;