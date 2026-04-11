import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface AddTyreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
}

const AddTyreDialog = ({ open, onOpenChange, onAdd }: AddTyreDialogProps) => {
  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    dot_code: "",
    size: "",
    type: "",
    pressure_rating: "",
    initial_tread_depth: "",
    quantity: "0",
    min_quantity: "5",
    unit_price: "",
    purchase_cost_zar: "",
    purchase_cost_usd: "",
    location: "",
    supplier: "",
    status: "",
  });
  const [errors, setErrors] = useState<Partial<typeof formData>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));

    if (errors[id as keyof typeof formData]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[id as keyof typeof formData];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name as keyof typeof formData]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof typeof formData];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<typeof formData> = {};

    // Required fields
    if (!formData.brand) newErrors.brand = "Brand is required";
    if (!formData.model) newErrors.model = "Model is required";
    if (!formData.dot_code) newErrors.dot_code = "DOT code is required";
    if (!formData.size) newErrors.size = "Size is required";
    if (!formData.type) newErrors.type = "Type is required";
    if (!formData.pressure_rating) newErrors.pressure_rating = "Pressure rating is required";
    if (!formData.initial_tread_depth) newErrors.initial_tread_depth = "Initial tread depth is required";
    if (!formData.supplier) newErrors.supplier = "Supplier is required";
    if (!formData.purchase_cost_usd) newErrors.purchase_cost_usd = "Purchase cost (USD) is required";
    if (!formData.location) newErrors.location = "Location is required";
    if (!formData.status) newErrors.status = "Status is required";

    // DOT code validation
    if (formData.dot_code && !/^[a-zA-Z0-9]+$/.test(formData.dot_code)) {
      newErrors.dot_code = "DOT code should be alphanumeric";
    }

    // Numeric validation
    if (formData.pressure_rating && isNaN(Number(formData.pressure_rating))) {
      newErrors.pressure_rating = "Must be a number";
    }
    if (formData.initial_tread_depth && isNaN(Number(formData.initial_tread_depth))) {
      newErrors.initial_tread_depth = "Must be a number";
    }
    if (formData.purchase_cost_usd && isNaN(Number(formData.purchase_cost_usd))) {
      newErrors.purchase_cost_usd = "Must be a valid USD amount";
    }
    if (formData.purchase_cost_zar && isNaN(Number(formData.purchase_cost_zar))) {
      newErrors.purchase_cost_zar = "Must be a valid ZAR amount";
    }
    if (formData.unit_price && isNaN(Number(formData.unit_price))) {
      newErrors.unit_price = "Must be a valid USD amount";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const { error } = await supabase.from("tyre_inventory").insert({
        brand: formData.brand,
        model: formData.model,
        dot_code: formData.dot_code,
        size: formData.size,
        type: formData.type,
        pressure_rating: formData.pressure_rating ? parseFloat(formData.pressure_rating) : null,
        initial_tread_depth: formData.initial_tread_depth ? parseFloat(formData.initial_tread_depth) : null,
        quantity: parseInt(formData.quantity),
        min_quantity: parseInt(formData.min_quantity),
        unit_price: formData.unit_price ? parseFloat(formData.unit_price) : null,
        purchase_cost_zar: formData.purchase_cost_zar ? parseFloat(formData.purchase_cost_zar) : null,
        purchase_cost_usd: formData.purchase_cost_usd ? parseFloat(formData.purchase_cost_usd) : null,
        location: formData.location,
        supplier: formData.supplier,
        status: formData.status,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tyre added to inventory successfully",
      });
      onAdd();
      onOpenChange(false);
      setFormData({
        brand: "",
        model: "",
        dot_code: "",
        size: "",
        type: "",
        pressure_rating: "",
        initial_tread_depth: "",
        quantity: "0",
        min_quantity: "5",
        unit_price: "",
        purchase_cost_zar: "",
        purchase_cost_usd: "",
        location: "",
        supplier: "",
        status: "",
      });
      setErrors({});
    } catch {
      toast({
        title: "Error",
        description: "Failed to add tyre to inventory",
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
          <DialogTitle>Add Tyre to Inventory</DialogTitle>
          <DialogDescription>Add new tyre stock with comprehensive details. All prices are in USD ($).</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand *</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  placeholder="Enter tyre brand"
                  className={errors.brand ? "border-destructive" : ""}
                />
                {errors.brand && <p className="text-sm text-destructive">{errors.brand}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={handleChange}
                  placeholder="Enter tyre model"
                  className={errors.model ? "border-destructive" : ""}
                />
                {errors.model && <p className="text-sm text-destructive">{errors.model}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dot_code">DOT Code *</Label>
                <Input
                  id="dot_code"
                  value={formData.dot_code}
                  onChange={handleChange}
                  placeholder="Enter DOT code"
                  className={errors.dot_code ? "border-destructive" : ""}
                />
                {errors.dot_code && <p className="text-sm text-destructive">{errors.dot_code}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="size">Size *</Label>
                <Input
                  id="size"
                  value={formData.size}
                  onChange={handleChange}
                  placeholder="e.g., 225/60R16"
                  className={errors.size ? "border-destructive" : ""}
                />
                {errors.size && <p className="text-sm text-destructive">{errors.size}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select value={formData.type} onValueChange={(value) => handleSelectChange(value, "type")}>
                  <SelectTrigger className={errors.type ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select tyre type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="steer">Steer</SelectItem>
                    <SelectItem value="drive">Drive</SelectItem>
                    <SelectItem value="trailer">Trailer</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-sm text-destructive">{errors.type}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pressure_rating">Pressure Rating (PSI) *</Label>
                <Input
                  id="pressure_rating"
                  value={formData.pressure_rating}
                  onChange={handleChange}
                  placeholder="Enter pressure rating"
                  type="number"
                  step="0.1"
                  className={errors.pressure_rating ? "border-destructive" : ""}
                />
                {errors.pressure_rating && <p className="text-sm text-destructive">{errors.pressure_rating}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="initial_tread_depth">Initial Tread Depth (mm) *</Label>
                <Input
                  id="initial_tread_depth"
                  value={formData.initial_tread_depth}
                  onChange={handleChange}
                  placeholder="Enter tread depth"
                  type="number"
                  step="0.1"
                  className={errors.initial_tread_depth ? "border-destructive" : ""}
                />
                {errors.initial_tread_depth && <p className="text-sm text-destructive">{errors.initial_tread_depth}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier *</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  placeholder="Enter supplier name"
                  className={errors.supplier ? "border-destructive" : ""}
                />
                {errors.supplier && <p className="text-sm text-destructive">{errors.supplier}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_cost_usd">Purchase Cost (USD) *</Label>
                  <Input
                    id="purchase_cost_usd"
                    value={formData.purchase_cost_usd}
                    onChange={handleChange}
                    placeholder="Enter cost in USD (e.g., 250.00)"
                    type="number"
                    step="0.01"
                    className={errors.purchase_cost_usd ? "border-destructive" : ""}
                  />
                  {errors.purchase_cost_usd && <p className="text-sm text-destructive">{errors.purchase_cost_usd}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_cost_zar">Purchase Cost (ZAR) - Optional</Label>
                  <Input
                    id="purchase_cost_zar"
                    value={formData.purchase_cost_zar}
                    onChange={handleChange}
                    placeholder="Enter cost in ZAR (e.g., 4200.00)"
                    type="number"
                    step="0.01"
                  />
                  {errors.purchase_cost_zar && <p className="text-sm text-destructive">{errors.purchase_cost_zar}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_price">Unit Price (USD) - Optional</Label>
                <Input
                  id="unit_price"
                  value={formData.unit_price}
                  onChange={handleChange}
                  placeholder="Enter unit price in USD"
                  type="number"
                  step="0.01"
                />
                {errors.unit_price && <p className="text-sm text-destructive">{errors.unit_price}</p>}
                <p className="text-xs text-muted-foreground">If different from purchase cost (e.g., retail price)</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_quantity">Min Quantity *</Label>
                <Input
                  id="min_quantity"
                  type="number"
                  value={formData.min_quantity}
                  onChange={handleChange}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value) => handleSelectChange(value, "status")}>
                  <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                    <SelectItem value="refurbished">Refurbished</SelectItem>
                    <SelectItem value="scrap">Scrap</SelectItem>
                    <SelectItem value="in-service">In Service</SelectItem>
                  </SelectContent>
                </Select>
                {errors.status && <p className="text-sm text-destructive">{errors.status}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Store Location *</Label>
              <Select value={formData.location} onValueChange={(value) => handleSelectChange(value, "location")}>
                <SelectTrigger className={errors.location ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select store location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scrap-store">Scrap Store</SelectItem>
                  <SelectItem value="holding-bay">Holding Bay</SelectItem>
                  <SelectItem value="retread-bay">Retread Bay</SelectItem>
                  <SelectItem value="main-warehouse">Main Warehouse</SelectItem>
                  <SelectItem value="service-bay">Service Bay</SelectItem>
                </SelectContent>
              </Select>
              {errors.location && <p className="text-sm text-destructive">{errors.location}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Tyre to Inventory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTyreDialog;