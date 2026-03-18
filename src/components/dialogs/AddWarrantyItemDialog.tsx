import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useVehicles } from "@/hooks/useVehicles";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { CalendarIcon, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface JobCard {
  id: string;
  job_number: string;
  title: string;
  status: string;
}

interface WarrantyItemData {
  id?: string;
  name: string;
  part_number: string | null;
  serial_number: string | null;
  category: string | null;
  description: string | null;
  warranty_provider: string | null;
  warranty_period_months: number | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  warranty_terms: string | null;
  warranty_claim_contact: string | null;
  warranty_notes: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  supplier: string | null;
  invoice_number: string | null;
  job_card_id: string | null;
  vehicle_id?: string | null;
  status: string;
}

interface AddWarrantyItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editItem?: WarrantyItemData | null;
}

const AddWarrantyItemDialog = ({
  open,
  onOpenChange,
  onSuccess,
  editItem,
}: AddWarrantyItemDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { data: vehicles = [] } = useVehicles();
  const [formData, setFormData] = useState({
    name: "",
    part_number: "",
    serial_number: "",
    category: "",
    description: "",
    warranty_provider: "",
    warranty_period_months: "",
    warranty_start_date: null as Date | null,
    warranty_end_date: null as Date | null,
    warranty_terms: "",
    warranty_claim_contact: "",
    warranty_notes: "",
    purchase_date: null as Date | null,
    purchase_price: "",
    supplier: "",
    invoice_number: "",
    job_card_id: "",
    vehicle_id: "",
  });

  // Fetch vendors for warranty provider selection
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-for-warranty"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, vendor_name")
        .eq("is_active", true)
        .order("vendor_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch job cards for linking
  const { data: jobCards = [], isLoading: loadingJobCards } = useQuery({
    queryKey: ["job-cards-for-warranty"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select("id, job_number, title, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as JobCard[];
    },
    enabled: open,
  });

  // Reset form when dialog opens/closes or editItem changes
  useEffect(() => {
    if (editItem) {
      setFormData({
        name: editItem.name || "",
        part_number: editItem.part_number || "",
        serial_number: editItem.serial_number || "",
        category: editItem.category || "",
        description: editItem.description || "",
        warranty_provider: editItem.warranty_provider || "",
        warranty_period_months: editItem.warranty_period_months?.toString() || "",
        warranty_start_date: editItem.warranty_start_date
          ? new Date(editItem.warranty_start_date)
          : null,
        warranty_end_date: editItem.warranty_end_date
          ? new Date(editItem.warranty_end_date)
          : null,
        warranty_terms: editItem.warranty_terms || "",
        warranty_claim_contact: editItem.warranty_claim_contact || "",
        warranty_notes: editItem.warranty_notes || "",
        purchase_date: editItem.purchase_date ? new Date(editItem.purchase_date) : null,
        purchase_price: editItem.purchase_price?.toString() || "",
        supplier: editItem.supplier || "",
        invoice_number: editItem.invoice_number || "",
        job_card_id: editItem.job_card_id || "",
        vehicle_id: editItem.vehicle_id || "",
      });
    } else if (open) {
      setFormData({
        name: "",
        part_number: "",
        serial_number: "",
        category: "",
        description: "",
        warranty_provider: "",
        warranty_period_months: "",
        warranty_start_date: null,
        warranty_end_date: null,
        warranty_terms: "",
        warranty_claim_contact: "",
        warranty_notes: "",
        purchase_date: null,
        purchase_price: "",
        supplier: "",
        invoice_number: "",
        job_card_id: "",
        vehicle_id: "",
      });
    }
  }, [editItem, open]);

  const handleWarrantyPeriodChange = (months: string) => {
    setFormData((prev) => {
      const newData = { ...prev, warranty_period_months: months };
      if (months && prev.warranty_start_date) {
        newData.warranty_end_date = addMonths(prev.warranty_start_date, parseInt(months));
      }
      return newData;
    });
  };

  const handleStartDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => {
        const newData = { ...prev, warranty_start_date: date };
        if (prev.warranty_period_months) {
          newData.warranty_end_date = addMonths(date, parseInt(prev.warranty_period_months));
        }
        return newData;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Item name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const itemData = {
        name: formData.name,
        part_number: formData.part_number || null,
        serial_number: formData.serial_number || null,
        category: formData.category || null,
        description: formData.description || null,
        warranty_provider: formData.warranty_provider || null,
        warranty_period_months: formData.warranty_period_months
          ? parseInt(formData.warranty_period_months)
          : null,
        warranty_start_date: formData.warranty_start_date
          ? format(formData.warranty_start_date, "yyyy-MM-dd")
          : null,
        warranty_end_date: formData.warranty_end_date
          ? format(formData.warranty_end_date, "yyyy-MM-dd")
          : null,
        warranty_terms: formData.warranty_terms || null,
        warranty_claim_contact: formData.warranty_claim_contact || null,
        warranty_notes: formData.warranty_notes || null,
        purchase_date: formData.purchase_date
          ? format(formData.purchase_date, "yyyy-MM-dd")
          : null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        supplier: formData.supplier || null,
        invoice_number: formData.invoice_number || null,
        job_card_id: formData.job_card_id || null,
        vehicle_id: formData.vehicle_id || null,
      };

      if (editItem?.id) {
        // warranty_items table not yet in generated types - using any cast
        const { error } = await (supabase as unknown as { from: (table: string) => { update: (data: unknown) => { eq: (col: string, val: string) => Promise<{ error: Error | null }> } } })
          .from("warranty_items")
          .update(itemData)
          .eq("id", editItem.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Warranty item updated successfully",
        });
      } else {
        // warranty_items table not yet in generated types - using any cast
        const { error } = await (supabase as unknown as { from: (table: string) => { insert: (data: unknown) => Promise<{ error: Error | null }> } })
          .from("warranty_items")
          .insert(itemData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Warranty item added successfully",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving warranty item:", error);
      toast({
        title: "Error",
        description: editItem ? "Failed to update warranty item" : "Failed to add warranty item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "open":
      case "pending":
        return "text-yellow-600";
      case "in_progress":
        return "text-blue-600";
      case "completed":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Warranty Item" : "Add Warranty Item"}</DialogTitle>
          <DialogDescription>
            {editItem
              ? "Update warranty details for this item"
              : "Add a new item with warranty tracking. You can link it to a job card for better traceability."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Basic Item Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Item Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Alternator, Starter Motor"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part_number">Part Number</Label>
                  <Input
                    id="part_number"
                    value={formData.part_number}
                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    placeholder="e.g., ALT-12345"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    placeholder="e.g., SN-ABC123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Electrical, Engine"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the item"
                  rows={2}
                />
              </div>
            </div>

            {/* Job Card Linking */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Job Card Link
              </h3>
              <div className="space-y-2">
                <Label htmlFor="job_card">Link to Job Card</Label>
                <Select
                  value={formData.job_card_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, job_card_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingJobCards ? "Loading..." : "Select a job card (optional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No job card link</SelectItem>
                    {jobCards.map((jc) => (
                      <SelectItem key={jc.id} value={jc.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="font-mono">{jc.job_number}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="truncate max-w-[200px]">{jc.title}</span>
                          <span className={cn("text-xs capitalize", getStatusBadgeClass(jc.status))}>
                            ({jc.status})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link this warranty item to a job card for tracking which job it was used in
                </p>
              </div>
            </div>

            {/* Vehicle Linking */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Vehicle Link
              </h3>
              <div className="space-y-2">
                <Label htmlFor="vehicle">Link to Vehicle</Label>
                <Select
                  value={formData.vehicle_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, vehicle_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vehicle (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No vehicle link</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        <div className="flex items-center gap-2">
                          {vehicle.fleet_number && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {vehicle.fleet_number}
                            </Badge>
                          )}
                          <span className="font-medium">{vehicle.registration_number}</span>
                          <span className="text-muted-foreground text-sm">
                            {vehicle.make} {vehicle.model}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link this warranty item to a specific vehicle in the fleet
                </p>
              </div>
            </div>

            {/* Purchase Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Purchase Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.purchase_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.purchase_date
                          ? format(formData.purchase_date, "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.purchase_date || undefined}
                        onSelect={(date) => setFormData({ ...formData, purchase_date: date || null })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Purchase Price</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier / Warranty Provider</Label>
                  <Select
                    value={formData.supplier}
                    onValueChange={(value) => {
                      const vendorName = value === "none" ? "" : value;
                      setFormData({ ...formData, supplier: vendorName, warranty_provider: vendorName });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No vendor</SelectItem>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.vendor_name}>
                          {vendor.vendor_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This vendor will also be the warranty provider
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">Invoice Number</Label>
                  <Input
                    id="invoice_number"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    placeholder="e.g., INV-2026-001"
                  />
                </div>
              </div>
            </div>

            {/* Warranty Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Warranty Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="warranty_period">Warranty Period (Months)</Label>
                  <Input
                    id="warranty_period"
                    type="number"
                    min="1"
                    value={formData.warranty_period_months}
                    onChange={(e) => handleWarrantyPeriodChange(e.target.value)}
                    placeholder="e.g., 12"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Warranty Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.warranty_start_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.warranty_start_date
                          ? format(formData.warranty_start_date, "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.warranty_start_date || undefined}
                        onSelect={handleStartDateChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Warranty End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.warranty_end_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.warranty_end_date
                          ? format(formData.warranty_end_date, "PPP")
                          : "Auto-calculated"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.warranty_end_date || undefined}
                        onSelect={(date) =>
                          date && setFormData({ ...formData, warranty_end_date: date })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="warranty_claim_contact">Claim Contact</Label>
                <Input
                  id="warranty_claim_contact"
                  value={formData.warranty_claim_contact}
                  onChange={(e) =>
                    setFormData({ ...formData, warranty_claim_contact: e.target.value })
                  }
                  placeholder="Phone number or email for claims"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warranty_terms">Warranty Terms</Label>
                <Textarea
                  id="warranty_terms"
                  value={formData.warranty_terms}
                  onChange={(e) => setFormData({ ...formData, warranty_terms: e.target.value })}
                  placeholder="Brief description of warranty coverage"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warranty_notes">Additional Notes</Label>
                <Textarea
                  id="warranty_notes"
                  value={formData.warranty_notes}
                  onChange={(e) => setFormData({ ...formData, warranty_notes: e.target.value })}
                  placeholder="Any additional notes or conditions"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editItem ? "Update Item" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddWarrantyItemDialog;