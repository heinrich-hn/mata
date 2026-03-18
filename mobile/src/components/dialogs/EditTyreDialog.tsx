import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

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
  unitPrice: number;
  purchaseCostZar: number | null;
  purchaseCostUsd: number | null;
  location: string;
  supplier: string;
  status: string;
}

interface EditTyreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tyre: TyreStock | null;
  onUpdate: () => void;
}

const EditTyreDialog = ({ open, onOpenChange, tyre, onUpdate }: EditTyreDialogProps) => {
  const { toast } = useToast();
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

  // Populate form when tyre changes
  useEffect(() => {
    if (tyre) {
      setFormData({
        brand: tyre.brand || "",
        model: tyre.model || "",
        dot_code: tyre.dotCode || "",
        size: tyre.size || "",
        type: tyre.type || "",
        pressure_rating: tyre.pressureRating?.toString() || "",
        initial_tread_depth: tyre.initialTreadDepth?.toString() || "",
        quantity: tyre.quantity?.toString() || "0",
        min_quantity: tyre.minQuantity?.toString() || "5",
        unit_price: tyre.unitPrice?.toString() || "",
        purchase_cost_zar: tyre.purchaseCostZar?.toString() || "",
        purchase_cost_usd: tyre.purchaseCostUsd?.toString() || "",
        location: tyre.location || "",
        supplier: tyre.supplier || "",
        status: tyre.status || "",
      });
      setErrors({});
    }
  }, [tyre]);

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
    if (!formData.size) newErrors.size = "Size is required";
    if (!formData.type) newErrors.type = "Type is required";

    // DOT code validation (optional but must be alphanumeric if provided)
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
    if (formData.purchase_cost_zar && isNaN(Number(formData.purchase_cost_zar))) {
      newErrors.purchase_cost_zar = "Must be a number";
    }
    if (formData.purchase_cost_usd && isNaN(Number(formData.purchase_cost_usd))) {
      newErrors.purchase_cost_usd = "Must be a number";
    }
    if (formData.quantity && isNaN(Number(formData.quantity))) {
      newErrors.quantity = "Must be a number";
    }
    if (formData.min_quantity && isNaN(Number(formData.min_quantity))) {
      newErrors.min_quantity = "Must be a number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !tyre) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("tyre_inventory")
        .update({
          brand: formData.brand,
          model: formData.model,
          dot_code: formData.dot_code || null,
          size: formData.size,
          type: formData.type,
          pressure_rating: formData.pressure_rating ? parseFloat(formData.pressure_rating) : null,
          initial_tread_depth: formData.initial_tread_depth ? parseFloat(formData.initial_tread_depth) : null,
          quantity: parseInt(formData.quantity) || 0,
          min_quantity: parseInt(formData.min_quantity) || 5,
          unit_price: formData.unit_price ? parseFloat(formData.unit_price) : null,
          purchase_cost_zar: formData.purchase_cost_zar ? parseFloat(formData.purchase_cost_zar) : null,
          purchase_cost_usd: formData.purchase_cost_usd ? parseFloat(formData.purchase_cost_usd) : null,
          location: formData.location || null,
          supplier: formData.supplier || null,
          status: formData.status || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tyre.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tyre details updated successfully",
      });
      onUpdate();
      onOpenChange(false);
    } catch (err) {
      console.error("Error updating tyre:", err);
      toast({
        title: "Error",
        description: "Failed to update tyre details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!tyre) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tyre Details</DialogTitle>
          <DialogDescription>
            Update specifications and details for {tyre.brand} {tyre.model}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Basic Information
              </h3>
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
                  <Label htmlFor="dot_code">DOT Code</Label>
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
                  <Label htmlFor="supplier">Supplier/Vendor</Label>
                  <Input
                    id="supplier"
                    value={formData.supplier}
                    onChange={handleChange}
                    placeholder="Enter supplier name"
                  />
                </div>
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Technical Specifications
              </h3>
              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initial_tread_depth">Initial Tread Depth (mm)</Label>
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
                  <Label htmlFor="pressure_rating">Pressure Rating (PSI)</Label>
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
            </div>

            {/* Stock & Location */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Stock & Location
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={handleChange}
                    min="0"
                    className={errors.quantity ? "border-destructive" : ""}
                  />
                  {errors.quantity && <p className="text-sm text-destructive">{errors.quantity}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_quantity">Min Quantity</Label>
                  <Input
                    id="min_quantity"
                    type="number"
                    value={formData.min_quantity}
                    onChange={handleChange}
                    min="0"
                    className={errors.min_quantity ? "border-destructive" : ""}
                  />
                  {errors.min_quantity && <p className="text-sm text-destructive">{errors.min_quantity}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Condition</Label>
                  <Select value={formData.status} onValueChange={(value) => handleSelectChange(value, "status")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="used">Used</SelectItem>
                      <SelectItem value="refurbished">Refurbished</SelectItem>
                      <SelectItem value="scrap">Scrap</SelectItem>
                      <SelectItem value="in-service">In Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Store Location</Label>
                <Select value={formData.location} onValueChange={(value) => handleSelectChange(value, "location")}>
                  <SelectTrigger>
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
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Pricing Information
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Unit Price (ZAR)</Label>
                  <Input
                    id="unit_price"
                    value={formData.unit_price}
                    onChange={handleChange}
                    placeholder="Unit price"
                    type="number"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_cost_zar">Purchase Cost (ZAR)</Label>
                  <Input
                    id="purchase_cost_zar"
                    value={formData.purchase_cost_zar}
                    onChange={handleChange}
                    placeholder="Cost in ZAR"
                    type="number"
                    step="0.01"
                    className={errors.purchase_cost_zar ? "border-destructive" : ""}
                  />
                  {errors.purchase_cost_zar && <p className="text-sm text-destructive">{errors.purchase_cost_zar}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_cost_usd">Purchase Cost (USD)</Label>
                  <Input
                    id="purchase_cost_usd"
                    value={formData.purchase_cost_usd}
                    onChange={handleChange}
                    placeholder="Cost in USD"
                    type="number"
                    step="0.01"
                    className={errors.purchase_cost_usd ? "border-destructive" : ""}
                  />
                  {errors.purchase_cost_usd && <p className="text-sm text-destructive">{errors.purchase_cost_usd}</p>}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTyreDialog;